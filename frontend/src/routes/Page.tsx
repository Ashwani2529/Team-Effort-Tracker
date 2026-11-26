import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useOutletContext, useParams } from 'react-router-dom';
import { DndContext, useDraggable, useDroppable, type DragEndEvent } from '@dnd-kit/core';
import { createColumnHelper, flexRender, getCoreRowModel, useReactTable } from '@tanstack/react-table';
import { addDays, addMonths, differenceInCalendarDays, endOfMonth, endOfWeek, format, parseISO, startOfMonth, startOfWeek } from 'date-fns';
import { AlertCircle, ArrowLeft, ArrowRight, ArrowUpRight, CalendarClock, CalendarDays, CheckCircle2, CircleDot, Clock3, Download, Filter, GripVertical, Plus, ShieldCheck } from 'lucide-react';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { isInPeriod, STATUSES, type PeriodRange, type Role, type Status } from '@effort-tracker/shared';
import { useApi } from '../hooks/use-api';
import { searchDeliverables } from '../lib/search';
import { calendarActivityForDate, monthGridDates, rosterStatusFor } from '../lib/scheduling';
import type { CalendarTaskActivity } from '../lib/scheduling';
import type { Deliverable, ProjectAnalytics, RosterStatus, Snapshot } from '../types';
import { TaskDrawer } from '../features/deliverables/TaskDrawer';
import { TaxonomyManager } from '../features/admin/TaxonomyManager';
import { MemberStatsDialog } from '../features/team/MemberStatsDialog';

type Context = { snapshot: Snapshot; search: string; setSearch: (v: string) => void; period: string; setPeriod: (v: string) => void; openTask: (id?: string) => void; taskId?: string; closeTask: () => void };
const stageMeta: Record<Status, { label: string; color: string }> = {
  backlog: { label: 'Backlog', color: '#77808f' }, todo: { label: 'Not started', color: '#5b7cfa' }, doing: { label: 'In progress', color: '#8b5cf6' },
  review: { label: 'In review', color: '#e6a740' }, done: { label: 'Delivered', color: '#27a674' }, deployed: { label: 'Deployed', color: '#17865f' }
};
const listColumn = createColumnHelper<Deliverable>();

function rangeFor(period: string, today: string): PeriodRange {
  const date = parseISO(today);
  if (period === 'active' || period === 'history') return { mode: period };
  if (period === 'day') return { mode: 'day', from: today, to: today };
  if (period === 'month') return { mode: 'month', from: format(startOfMonth(date), 'yyyy-MM-dd'), to: format(endOfMonth(date), 'yyyy-MM-dd') };
  return { mode: 'week', from: format(startOfWeek(date, { weekStartsOn: 1 }), 'yyyy-MM-dd'), to: format(endOfWeek(date, { weekStartsOn: 1 }), 'yyyy-MM-dd'), includeEarlierOverdue: true };
}
const memberOf = (snapshot: Snapshot, id?: string) => snapshot.members.find((m) => m.legacyId === id || m._id === id);
const towerOf = (snapshot: Snapshot, id?: string) => snapshot.towers.find((t) => t.legacyId === id || t._id === id);
const memberWorksOn = (item: Deliverable, memberId: string, snapshot?: Snapshot) => {
  const member = snapshot?.members.find((value) => value._id === memberId || value.legacyId === memberId);
  const ids = [memberId, member?.legacyId].filter(Boolean) as string[];
  return ids.includes(item.primaryAssigneeId || '') || item.contributorIds.some((id) => ids.includes(id)) || item.worklogs.some((entry) => ids.includes(entry.memberId));
};
const actualHours = (item: Deliverable) => (item.worklogMinutes || 0) / 60;
const estimate = (item: Deliverable) => item.estimatedHours || 0;
const remaining = (item: Deliverable) => Math.max(0, estimate(item) - actualHours(item));
const priorityRank: Record<Deliverable['priority'], number> = { critical: 0, high: 1, medium: 2, low: 3 };
const unfinishedDependencies = (item: Deliverable, snapshot: Snapshot) => (item.dependencyIds || []).flatMap((id) => { const dependency = snapshot.deliverables.find((value) => value._id === id); return dependency && !['done', 'deployed'].includes(dependency.status) ? [dependency] : []; });
function useProjectAnalytics(projectId: string, month: string) {
  const call = useApi();
  return useQuery({ queryKey: ['analytics', projectId, month], queryFn: () => call<ProjectAnalytics>(`/projects/${projectId}/analytics?month=${month}`) });
}

export function Page() {
  const ctx = useOutletContext<Context>(), { projectId = '', view = 'overview' } = useParams(), call = useApi(), client = useQueryClient();
  const [rosterDate, setRosterDate] = useState(ctx.snapshot.serverDate), [calendarMonth, setCalendarMonth] = useState(ctx.snapshot.serverDate.slice(0, 7)), [calendarStatus, setCalendarStatus] = useState<Status | 'all'>('all');
  const range = useMemo(() => rangeFor(ctx.period, ctx.snapshot.serverDate), [ctx.period, ctx.snapshot.serverDate]);
  const searchedItems = useMemo(() => searchDeliverables(ctx.snapshot, ctx.search, ctx.snapshot.deliverables), [ctx.snapshot, ctx.search]);
  const items = useMemo(() => searchedItems.filter((item) => isInPeriod(item, range)), [searchedItems, range]);
  const calendarItems = useMemo(() => calendarStatus === 'all' ? searchedItems : searchedItems.filter((item) => item.status === calendarStatus), [searchedItems, calendarStatus]);
  const status = useMutation({ mutationFn: ({ item, next }: { item: Deliverable; next: Status }) => call<Deliverable>(`/projects/${projectId}/deliverables/${item._id}/status`, { method: 'PATCH', body: JSON.stringify({ status: next, version: item.__v }) }), onSuccess: async () => { await client.invalidateQueries({ queryKey: ['snapshot', projectId] }); await client.invalidateQueries({ queryKey: ['analytics', projectId] }); }, onError: (error) => window.alert(error.message) });
  const common = { snapshot: ctx.snapshot, items, openTask: ctx.openTask, projectId, role: ctx.snapshot.access.role };
  if ((view === 'reports' || view === 'admin') && ctx.snapshot.access.role !== 'admin') return <section className="page"><div className="premium-locked"><ShieldCheck /><span className="eyebrow">Admin access</span><h2>Switch to Admin mode</h2><p>This premium area and its exports are protected by the project admin password.</p></div></section>;
  const views: Record<string, React.ReactNode> = { overview: <Overview {...common} />, framework: <Framework {...common} />, board: <Board {...common} onStatus={(item, next) => status.mutate({ item, next })} />, list: <WorkList {...common} />, assignees: <Assignees {...common} />, timeline: <Timeline {...common} />, calendar: <Calendar {...common} items={calendarItems} month={calendarMonth} />, roster: <Roster {...common} selectedDate={rosterDate} />, team: <Team {...common} />, reports: <Reports {...common} />, activity: <ActivityView {...common} />, admin: <Admin {...common} /> };
  return <><section className="page"><PageHeader view={view} count={view === 'calendar' ? calendarItems.length : items.length} period={ctx.period} setPeriod={ctx.setPeriod} onCreate={() => ctx.openTask('new')} rosterDate={rosterDate} setRosterDate={setRosterDate} calendarMonth={calendarMonth} setCalendarMonth={setCalendarMonth} calendarStatus={calendarStatus} setCalendarStatus={setCalendarStatus} />{status.error && <div className="error-banner">{status.error.message}</div>}{views[view] || <div className="empty-state">Unknown view.</div>}</section>{ctx.taskId && <TaskDrawer snapshot={ctx.snapshot} id={ctx.taskId} onClose={ctx.closeTask} />}</>;
}

function PageHeader({ view, count, period, setPeriod, onCreate, rosterDate, setRosterDate, calendarMonth, setCalendarMonth, calendarStatus, setCalendarStatus }: { view: string; count: number; period: string; setPeriod: (v: string) => void; onCreate: () => void; rosterDate: string; setRosterDate: (v: string) => void; calendarMonth: string; setCalendarMonth: (v: string) => void; calendarStatus: Status | 'all'; setCalendarStatus: (v: Status | 'all') => void }) {
  const title = ({ framework: 'Delivery Framework', assignees: 'Assignees', timeline: 'Timeline', calendar: 'Calendar', roster: 'Shift Roster', team: 'Team', reports: 'Reports', activity: 'Activity', admin: 'Administration' } as Record<string, string>)[view] || view[0]!.toUpperCase() + view.slice(1);
  const subtitle = view === 'roster' ? 'Weekly availability for the project team' : `${count.toLocaleString()} deliverables in this view`;
  return <div className="page-head"><div><span className="eyebrow">Project workspace</span><h1>{title}</h1><p>{subtitle}</p></div><div className="page-actions">
    {view === 'roster' && <label className="date-select"><CalendarDays size={15} /><input aria-label="Roster week" type="date" value={rosterDate} onChange={(event) => event.target.value && setRosterDate(event.target.value)} /></label>}
    {view === 'calendar' ? <><label className="date-select"><CalendarDays size={15} /><input aria-label="Calendar month" type="month" value={calendarMonth} onChange={(event) => event.target.value && setCalendarMonth(event.target.value)} /></label><label className="period-select"><Filter size={15} /><select aria-label="Calendar status" value={calendarStatus} onChange={(event) => setCalendarStatus(event.target.value as Status | 'all')}><option value="all">All statuses</option>{STATUSES.map((value) => <option key={value} value={value}>{stageMeta[value].label}</option>)}</select></label></> : !['activity', 'reports'].includes(view) && <label className="period-select"><Filter size={15} /><select value={period} onChange={(e) => setPeriod(e.target.value)}><option value="active">All statuses</option><option value="week">This week + overdue</option><option value="month">This month</option><option value="day">Today</option><option value="history">All History</option></select></label>}
    <button className="button primary" onClick={onCreate}><Plus size={16} /> New Deliverable</button></div></div>;
}

interface ViewProps { snapshot: Snapshot; items: Deliverable[]; openTask: (id: string) => void; projectId: string; role: Role }
function Overview({ snapshot, items, openTask }: ViewProps) {
  const analytics = useProjectAnalytics(snapshot.project._id, snapshot.serverDate.slice(0, 7)).data;
  const active = items.filter((i) => !['done', 'deployed'].includes(i.status)), done = items.filter((i) => ['done', 'deployed'].includes(i.status)), overdue = active.filter((i) => i.dueDate && i.dueDate < snapshot.serverDate), blocked = active.filter((i) => i.blocked);
  const byStage = STATUSES.map((status) => ({ name: stageMeta[status].label, count: items.filter((i) => i.status === status).length, color: stageMeta[status].color }));
  const estimateTotal = items.reduce((n, i) => n + estimate(i), 0), actualTotal = items.reduce((n, i) => n + actualHours(i), 0);
  return <div className="stack"><div className="metric-grid"><Metric icon={<CircleDot />} label="Active work" value={active.length} hint={`${active.filter((i) => i.status === 'doing').length} in progress`} /><Metric icon={<CheckCircle2 />} label="Delivered" value={done.length} hint={`${items.length ? Math.round(done.length / items.length * 100) : 0}% of filtered work`} tone="green" /><Metric icon={<AlertCircle />} label="Needs attention" value={overdue.length + blocked.length} hint={`${overdue.length} overdue · ${blocked.length} blocked`} tone={overdue.length + blocked.length ? 'amber' : 'green'} /><Metric icon={<Clock3 />} label="Verified effort" value={`${actualTotal.toFixed(1)}h`} hint={`${estimateTotal.toFixed(0)}h Estimated Efforts`} /></div>{analytics && <TodayCapacity analytics={analytics} />}<div className="dashboard-grid"><Panel title="Delivery flow" subtitle="Work distribution by stage"><ResponsiveContainer width="100%" height={260}><BarChart data={byStage}><CartesianGrid vertical={false} stroke="var(--border)" /><XAxis dataKey="name" tick={{ fill: 'var(--muted)', fontSize: 11 }} axisLine={false} tickLine={false} /><YAxis tick={{ fill: 'var(--muted)', fontSize: 11 }} axisLine={false} tickLine={false} /><Tooltip contentStyle={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 10 }} /><Bar dataKey="count" radius={[5, 5, 0, 0]}>{byStage.map((entry) => <Cell key={entry.name} fill={entry.color} />)}</Bar></BarChart></ResponsiveContainer></Panel><Panel title="Attention queue" subtitle="Highest-risk active work"><div className="attention-list">{[...blocked, ...overdue.filter((x) => !x.blocked)].slice(0, 7).map((item) => <button key={item._id} onClick={() => openTask(item._id)}><span className={item.blocked ? 'risk-dot red' : 'risk-dot amber'} /><div><strong>{item.title}</strong><span>{memberOf(snapshot, item.primaryAssigneeId)?.name || 'Unassigned'} · {item.blocked ? item.blockReason : `Due ${item.dueDate}`}</span></div><ArrowUpRight size={15} /></button>)}{!blocked.length && !overdue.length && <div className="empty-state compact"><ShieldCheck />No work needs immediate attention.</div>}</div></Panel></div></div>;
}

function Framework({ snapshot, items, projectId, openTask }: ViewProps) {
  const [selectedMemberId, setSelectedMemberId] = useState<string>();
  const analytics = useProjectAnalytics(projectId, snapshot.serverDate.slice(0, 7)).data;
  const done = items.filter((i) => ['done', 'deployed'].includes(i.status)), due = done.filter((i) => i.dueDate && i.completionDate), onTime = due.length ? due.filter((i) => i.completionDate! <= i.dueDate!).length / due.length * 100 : 0;
  const blocked = items.filter((i) => i.blocked).length;
  const sections = [
    ['Demand', [['Backlog', items.filter((i) => i.status === 'backlog').length, 'items waiting'], ['Queued effort', items.reduce((n, i) => n + remaining(i), 0).toFixed(0), 'hours remaining']]],
    ['Capacity', analytics ? [['Scheduled today', analytics.today.capacity.toFixed(1), 'hours from roster + allocation'], ['Logged today', analytics.today.logged.toFixed(1), `${analytics.today.utilization.toFixed(0)}% utilization`], ['Available today', analytics.today.availability.toFixed(1), `${analytics.today.availableMembers} available members`], ['Adjusted team effort', analytics.today.adjustedEffort.toFixed(1), 'sum of max(logged - 1h, 0)'], ['Overtime', analytics.today.overtime.toFixed(1), 'hours beyond capacity'], ['Capacity coverage', analytics.today.availability ? (analytics.monthTotals.remainingEffort / analytics.today.availability).toFixed(1) : '—', 'working days at today capacity']] : [['Team size', snapshot.members.length, 'active members'], ['Committed load', items.filter((i) => ['todo', 'doing', 'review'].includes(i.status)).reduce((n, i) => n + remaining(i), 0).toFixed(0), 'hours active']]],
    ['Flow', [['Work in progress', items.filter((i) => ['doing', 'review'].includes(i.status)).length, 'doing + review'], ['Blocked', blocked, blocked ? 'requires action' : 'clear']]],
    ['Delivery', [['On-time delivery', `${onTime.toFixed(0)}%`, `${due.length} dated outcomes`], ['Awaiting deploy', items.filter((i) => i.toBeDeployed && i.status !== 'deployed').length, 'planned releases']]]
    // Quality & automation is intentionally paused for now.
  ];
  const projectStart = String(snapshot.project.createdAt || snapshot.project.startDate || snapshot.serverDate).slice(0, 10);
  const elapsedProjectDays = Math.max(1, differenceInCalendarDays(parseISO(snapshot.serverDate), parseISO(projectStart)) + 1);
  const memberRows = snapshot.members.map((member) => {
    const assigned = snapshot.deliverables.filter((item) => item.primaryAssigneeId === member._id || item.primaryAssigneeId === member.legacyId);
    const verifiedHours = assigned.reduce((total, item) => total + (item.worklogMinutes || 0) / 60, 0);
    return {
      member,
      total: assigned.length,
      current: assigned.filter((item) => ['doing', 'review'].includes(item.status)).length,
      completed: assigned.filter((item) => ['done', 'deployed'].includes(item.status)).length,
      queued: assigned.filter((item) => ['backlog', 'todo'].includes(item.status)).length,
      impact: verifiedHours / elapsedProjectDays
    };
  });
  const selected = snapshot.members.find((member) => member._id === selectedMemberId);
  return <><div className="framework-grid">{sections.map(([title, cards]: any) => <Panel key={title} title={title} subtitle="Explainable project indicators"><div className="scorecards">{cards.map(([label, value, hint]: any) => <div className="scorecard" key={label}><span>{label}</span><strong>{value}</strong><small>{hint}</small></div>)}</div></Panel>)}<Panel title="All-time team overview" subtitle={`Impact = verified worklog hours divided by ${elapsedProjectDays} elapsed project day${elapsedProjectDays === 1 ? '' : 's'}`}><div className="framework-member-table"><div className="framework-member-head"><span>Team member</span><span>Total tasks</span><span>In progress + review</span><span>Completed + deployed</span><span>Backlog + not started</span><span>Impact</span></div>{memberRows.map((row) => <button key={row.member._id} className="framework-member-row" onClick={() => setSelectedMemberId(row.member._id)}><span className="framework-member-name"><i className="avatar mini" style={{ background: row.member.color }}>{initials(row.member.name)}</i><strong>{row.member.name}</strong></span><span><b>{row.total}</b><small>Total tasks</small></span><span><b>{row.current}</b><small>In progress + review</small></span><span><b>{row.completed}</b><small>Completed + deployed</small></span><span><b>{row.queued}</b><small>Backlog + not started</small></span><span><b>{row.impact.toFixed(2)}h/day</b><small>Impact</small></span></button>)}{!memberRows.length && <div className="empty-state compact">No team members have been added yet.</div>}</div></Panel></div>{selected && <MemberStatsDialog member={selected} deliverables={snapshot.deliverables} today={snapshot.serverDate} capacity={analytics?.members.find((value) => value.memberId === selected._id)} onClose={() => setSelectedMemberId(undefined)} onOpenTask={(id) => { setSelectedMemberId(undefined); openTask(id); }} />}</>;
}

function Board({ snapshot, items, openTask, onStatus }: ViewProps & { onStatus: (item: Deliverable, status: Status) => void }) {
  const [filters, setFilters] = useState<{ status: Status | 'all'; memberId: string; dueDate: string }>({ status: 'all', memberId: '', dueDate: '' });
  const end = (event: DragEndEvent) => { const item = items.find((i) => i._id === event.active.id); const next = event.over?.id as Status | undefined; if (item && next && STATUSES.includes(next) && item.status !== next) onStatus(item, next); };
  const filtered = items.filter((item) => (filters.status === 'all' || item.status === filters.status) && (!filters.memberId || memberWorksOn(item, filters.memberId, snapshot)) && (!filters.dueDate || item.dueDate === filters.dueDate));
  const visibleStatuses = filters.status === 'all' ? STATUSES : [filters.status];
  const active = filters.status !== 'all' || filters.memberId || filters.dueDate;
  return <div className="stack"><div className="view-filters"><label>Status<select aria-label="Board status filter" value={filters.status} onChange={(event) => setFilters({ ...filters, status: event.target.value as Status | 'all' })}><option value="all">All statuses</option>{STATUSES.map((status) => <option value={status} key={status}>{stageMeta[status].label}</option>)}</select></label><label>Person<select aria-label="Board person filter" value={filters.memberId} onChange={(event) => setFilters({ ...filters, memberId: event.target.value })}><option value="">All team members</option>{snapshot.members.map((member) => <option key={member._id} value={member._id}>{member.name}</option>)}</select></label><label>Due date<input aria-label="Board due date filter" type="date" value={filters.dueDate} onChange={(event) => setFilters({ ...filters, dueDate: event.target.value })} /></label>{active && <button className="button compact" onClick={() => setFilters({ status: 'all', memberId: '', dueDate: '' })}>Clear filters</button>}<span>{filtered.length} matching task{filtered.length === 1 ? '' : 's'}</span></div><DndContext onDragEnd={end}><div className={`board ${visibleStatuses.length === 1 ? 'single-column' : ''}`}>{visibleStatuses.map((status) => <BoardColumn key={status} status={status} items={filtered.filter((i) => i.status === status)} snapshot={snapshot} openTask={openTask} />)}</div></DndContext></div>;
}
function BoardColumn({ status, items, snapshot, openTask }: { status: Status; items: Deliverable[]; snapshot: Snapshot; openTask: (id: string) => void }) {
  const drop = useDroppable({ id: status }); return <div className={`board-column ${drop.isOver ? 'over' : ''}`} ref={drop.setNodeRef}><div className="column-head"><i style={{ background: stageMeta[status].color }} /><strong>{stageMeta[status].label}</strong><span>{items.length}</span></div><div className="column-body">{items.map((item) => <TaskCard key={item._id} item={item} snapshot={snapshot} openTask={openTask} />)}{!items.length && <div className="drop-empty">Drop work here</div>}</div></div>;
}
function TaskCard({ item, snapshot, openTask }: { item: Deliverable; snapshot: Snapshot; openTask: (id: string) => void }) {
  const drag = useDraggable({ id: item._id }), blockers = unfinishedDependencies(item, snapshot); return <article ref={drag.setNodeRef} style={drag.transform ? { transform: `translate3d(${drag.transform.x}px,${drag.transform.y}px,0)`, zIndex: 20 } : undefined} className={`task-card ${drag.isDragging ? 'dragging' : ''}`}><button className="drag-handle" {...drag.listeners} {...drag.attributes}><GripVertical size={14} /></button><button className="card-main" onClick={() => openTask(item._id)}><div className="card-kicker"><span>{towerOf(snapshot, item.towerId)?.name || 'No tower'}</span>{item.ticket && <code>{item.ticket}</code>}</div><h3>{item.title}</h3><div className="chips"><span className={`priority ${item.priority}`}>{item.priority}</span>{(item.flagIds || []).map((id) => { const flag = snapshot.flags.find((value) => value._id === id); return flag && <span className="color-tag" style={{ '--tag-color': flag.color } as React.CSSProperties} key={id}>{flag.name}</span>; })}{item.blocked && <span className="chip danger">Blocked</span>}{blockers.length > 0 && <span className="chip danger">Blocked by {blockers.length}</span>}{item.toBeDeployed && <span className="chip amber">Deploy</span>}</div><div className="card-foot"><span className="avatar mini" style={{ background: memberOf(snapshot, item.primaryAssigneeId)?.color }}>{initials(memberOf(snapshot, item.primaryAssigneeId)?.name)}</span><span>{item.dueDate ? format(parseISO(item.dueDate), 'dd MMM') : 'No due date'}</span><strong>{remaining(item).toFixed(0)}h</strong></div></button></article>;
}

function WorkList({ snapshot, items, openTask }: ViewProps) {
  const [filters, setFilters] = useState({ towerId: '', flagId: '', memberId: '', dueDate: '', text: '' });
  const filteredItems = useMemo(() => { const text = filters.text.trim().toLowerCase(), tower = snapshot.towers.find((value) => value._id === filters.towerId); return items.filter((item) => (!filters.towerId || item.towerId === filters.towerId || item.towerId === tower?.legacyId) && (!filters.flagId || item.flagIds.includes(filters.flagId)) && (!filters.memberId || memberWorksOn(item, filters.memberId, snapshot)) && (!filters.dueDate || item.dueDate === filters.dueDate) && (!text || item.title.toLowerCase().includes(text) || (item.description || '').toLowerCase().includes(text))); }, [items, filters, snapshot]);
  const columns = useMemo(() => [
    listColumn.accessor('title', { header: 'Deliverable', cell: (c) => <button className="title-cell" onClick={() => openTask(c.row.original._id)}><span className="status-dot" style={{ background: stageMeta[c.row.original.status].color }} />{c.getValue()}<small>{c.row.original.ticket || 'No ticket'}</small></button> }),
    listColumn.accessor('status', { header: 'Stage', cell: (c) => <span className="chip">{stageMeta[c.getValue()].label}</span> }),
    listColumn.accessor('priority', { header: 'Priority', cell: (c) => <span className={`priority ${c.getValue()}`}>{c.getValue()}</span>, sortingFn: (a, b) => priorityRank[a.original.priority] - priorityRank[b.original.priority] }),
    listColumn.accessor('primaryAssigneeId', { header: 'Assignee', cell: (c) => memberOf(snapshot, c.getValue())?.name || 'Unassigned' }),
    listColumn.accessor('towerId', { header: 'Tower', cell: (c) => towerOf(snapshot, c.getValue())?.name || '—' }),
    listColumn.accessor('flagIds', { header: 'Tags', cell: (c) => <div className="chips">{(c.getValue() || []).map((id) => { const flag = snapshot.flags.find((value) => value._id === id); return flag && <span className="color-tag" style={{ '--tag-color': flag.color } as React.CSSProperties} key={id}>{flag.name}</span>; })}</div> }),
    listColumn.accessor('dueDate', { header: 'Due', cell: (c) => c.getValue() || '—' }),
    listColumn.display({ id: 'estimate', header: 'Est. Efforts', cell: (c) => `${estimate(c.row.original).toFixed(1)}h` }),
    listColumn.display({ id: 'actual', header: 'Actual', cell: (c) => `${actualHours(c.row.original).toFixed(1)}h` }),
    listColumn.display({ id: 'remaining', header: 'Remaining', cell: (c) => `${['done', 'deployed'].includes(c.row.original.status) ? '0.0' : remaining(c.row.original).toFixed(1)}h` })
  ], [snapshot, openTask]);
  const table = useReactTable({ data: filteredItems, columns, getCoreRowModel: getCoreRowModel() });
  const active = Object.values(filters).some(Boolean);
  return <div className="stack"><div className="view-filters list-filters"><label>Text<input aria-label="List text filter" placeholder="Title or description…" value={filters.text} onChange={(event) => setFilters({ ...filters, text: event.target.value })} /></label><label>Tower<select aria-label="List tower filter" value={filters.towerId} onChange={(event) => setFilters({ ...filters, towerId: event.target.value })}><option value="">All towers</option>{snapshot.towers.map((tower) => <option key={tower._id} value={tower._id}>{tower.name}</option>)}</select></label><label>Tag<select aria-label="List tag filter" value={filters.flagId} onChange={(event) => setFilters({ ...filters, flagId: event.target.value })}><option value="">All tags</option>{snapshot.flags.map((flag) => <option key={flag._id} value={flag._id}>{flag.name}</option>)}</select></label><label>Team member<select aria-label="List member filter" value={filters.memberId} onChange={(event) => setFilters({ ...filters, memberId: event.target.value })}><option value="">All team members</option>{snapshot.members.map((member) => <option key={member._id} value={member._id}>{member.name}</option>)}</select></label><label>Due date<input aria-label="List due date filter" type="date" value={filters.dueDate} onChange={(event) => setFilters({ ...filters, dueDate: event.target.value })} /></label>{active && <button className="button compact" onClick={() => setFilters({ towerId: '', flagId: '', memberId: '', dueDate: '', text: '' })}>Clear filters</button>}<span>{filteredItems.length} matching item{filteredItems.length === 1 ? '' : 's'}</span></div><div className="table-wrap"><table><thead>{table.getHeaderGroups().map((g) => <tr key={g.id}>{g.headers.map((h) => <th key={h.id}>{flexRender(h.column.columnDef.header, h.getContext())}</th>)}</tr>)}</thead><tbody>{table.getRowModel().rows.map((row) => <tr key={row.id}>{row.getVisibleCells().map((cell) => <td key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>)}</tr>)}</tbody></table>{!filteredItems.length && <div className="empty-state">No deliverables match these filters.</div>}</div></div>;
}

function Assignees({ snapshot, items, openTask }: ViewProps) {
  const [selectedMemberId, setSelectedMemberId] = useState<string>();
  const analytics = useProjectAnalytics(snapshot.project._id, snapshot.serverDate.slice(0, 7)).data;
  const rows = snapshot.members.map((member) => { const owned = items.filter((i) => i.primaryAssigneeId === member.legacyId || i.primaryAssigneeId === member._id); return { member, owned, remaining: owned.reduce((n, i) => n + remaining(i), 0), overdue: owned.filter((i) => i.dueDate && i.dueDate < snapshot.serverDate && !['done', 'deployed'].includes(i.status)).length }; }).sort((a, b) => b.remaining - a.remaining);
  const selected = snapshot.members.find((member) => member._id === selectedMemberId);
  return <><div className="people-grid">{rows.map(({ member, owned, remaining: hours, overdue }) => <button className="person-card" key={member._id} onClick={() => setSelectedMemberId(member._id)}><div className="avatar" style={{ background: member.color }}>{initials(member.name)}</div><div><strong>{member.name}</strong><span>{member.title || member.department || 'Team member'}</span></div><div className="person-stats"><span><b>{owned.length}</b> items</span><span><b>{hours.toFixed(0)}h</b> left</span><span className={overdue ? 'bad-text' : ''}><b>{overdue}</b> overdue</span></div><div className="loadbar"><i style={{ width: `${Math.min(100, hours / 80 * 100)}%` }} /></div></button>)}</div>{selected && <MemberStatsDialog member={selected} deliverables={snapshot.deliverables} today={snapshot.serverDate} capacity={analytics?.members.find((value) => value.memberId === selected._id)} onClose={() => setSelectedMemberId(undefined)} onOpenTask={(id) => { setSelectedMemberId(undefined); openTask(id); }} />}</>;
}

function Timeline({ snapshot, items, openTask }: ViewProps) {
  const dated = items.filter((i) => i.startDate || i.dueDate), base = parseISO(snapshot.serverDate), from = addDays(base, -14), total = 70;
  return <Panel title="Delivery timeline" subtitle="70-day window centered on today"><div className="timeline-scroll"><div className="timeline-head"><span>Deliverable</span>{[0, 14, 28, 42, 56].map((d) => <b key={d}>{format(addDays(from, d), 'dd MMM')}</b>)}</div><div className="timeline-rows">{dated.slice(0, 80).map((item) => { const start = parseISO(item.startDate || item.dueDate!), end = parseISO(item.dueDate || item.startDate!), left = Math.max(0, differenceInCalendarDays(start, from) / total * 100), width = Math.max(1.5, (differenceInCalendarDays(end, start) + 1) / total * 100), blockers = unfinishedDependencies(item, snapshot); return <button key={item._id} onClick={() => openTask(item._id)}><span className="timeline-task-label"><strong>{item.title}</strong><small><i className={`priority-dot ${item.priority}`} />{item.priority} · {['done', 'deployed'].includes(item.status) ? '0.0' : remaining(item).toFixed(1)}h remaining{blockers.length ? ` · Blocked by ${blockers.length}` : ''}</small></span><div><i style={{ left: `${left}%`, width: `${Math.min(100 - left, width)}%`, background: stageMeta[item.status].color }} /></div></button>; })}</div></div></Panel>;
}

function calendarEventColor(activity: CalendarTaskActivity, date: string, today: string) {
  if (activity.markers.includes('deployed')) return '#17865f';
  if (activity.markers.includes('delivered')) return '#27a674';
  if (activity.markers.includes('due') && !['done', 'deployed'].includes(activity.item.status)) return date < today ? '#dc4c4c' : '#e6a740';
  return stageMeta[activity.item.status].color;
}

export function Calendar({ snapshot, items, openTask, month }: ViewProps & { month: string }) {
  const [selectedDate, setSelectedDate] = useState(snapshot.serverDate);
  const activeDate = selectedDate.startsWith(month) ? selectedDate : `${month}-01`;
  const dates = monthGridDates(month), selectedActivity = calendarActivityForDate(items, activeDate);
  return <div className="calendar-workspace"><div className="calendar-main"><div className="calendar-weekdays">{['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => <span key={day}>{day}</span>)}</div><div className="calendar-grid">{dates.map((date) => {
    const dayActivity = calendarActivityForDate(items, date), visible = dayActivity.slice(0, 3), outside = !date.startsWith(month);
    return <div className={`day-card ${date === snapshot.serverDate ? 'today' : ''} ${date === activeDate ? 'selected' : ''} ${outside ? 'outside' : ''}`} key={date}>
      <button aria-label={`Open ${date}`} className="day-heading" onClick={() => setSelectedDate(date)}><strong>{format(parseISO(date), 'd')}</strong><span>{date === snapshot.serverDate ? 'Today' : format(parseISO(date), 'MMM')}</span></button>
      <div className="day-events">{visible.map((activity) => <button className={['done', 'deployed'].includes(activity.item.status) ? 'calendar-task finished' : 'calendar-task'} key={activity.item._id} onClick={() => openTask(activity.item._id)} style={{ '--event-color': calendarEventColor(activity, date, snapshot.serverDate) } as React.CSSProperties}><i />{activity.item.title}</button>)}{dayActivity.length > visible.length && <button className="more-events" onClick={() => setSelectedDate(date)}>+{dayActivity.length - visible.length} more</button>}</div>
    </div>;
  })}</div></div><aside className="calendar-day-panel"><header><span className="eyebrow">Selected date</span><h2>{format(parseISO(activeDate), 'EEEE, dd MMMM')}</h2><p>{selectedActivity.length} task{selectedActivity.length === 1 ? '' : 's'} active or reaching a milestone</p></header><div>{selectedActivity.map((activity) => <button key={activity.item._id} onClick={() => openTask(activity.item._id)}><i style={{ background: calendarEventColor(activity, activeDate, snapshot.serverDate) }} /><span className={['done', 'deployed'].includes(activity.item.status) ? 'finished' : ''}><strong>{activity.item.title}</strong><small>{activity.markers.length ? activity.markers.map((marker) => marker[0]!.toUpperCase() + marker.slice(1)).join(' · ') : 'Active timeline'} · {stageMeta[activity.item.status].label}</small></span><ArrowUpRight size={14} /></button>)}{!selectedActivity.length && <div className="empty-state compact"><CalendarDays />No task activity on this date.</div>}</div></aside></div>;
}

const rosterOptions: Array<{ value: RosterStatus; label: string }> = [
  { value: 'general', label: 'General 09:00–18:00 IST' }, { value: 'night', label: 'Night 21:00–06:00 IST' }, { value: 'leave', label: 'Leave' }, { value: 'off', label: 'Off' }
];

export function Roster({ snapshot, projectId, selectedDate }: ViewProps & { selectedDate: string }) {
  const call = useApi(), client = useQueryClient();
  const mutation = useMutation({
    mutationFn: ({ memberId, date, status }: { memberId: string; date: string; status: RosterStatus }) => call(`/projects/${projectId}/roster/${memberId}/${date}`, { method: 'PUT', body: JSON.stringify({ status }) }),
    onSuccess: async () => { await client.invalidateQueries({ queryKey: ['snapshot', projectId] }); await client.invalidateQueries({ queryKey: ['analytics', projectId] }); }
  });
  const days = Array.from({ length: 7 }, (_, index) => addDays(startOfWeek(parseISO(selectedDate), { weekStartsOn: 1 }), index));
  return <div className="roster-stack"><div className="roster-summary"><span><i className="general" />General 09:00–18:00</span><span><i className="night" />Night 21:00–06:00</span><span><i className="leave" />Leave</span><span><i className="off" />Off</span><strong>IST · Monday–Sunday</strong></div>{mutation.error && <div className="error-banner">{mutation.error.message}</div>}<div className="table-wrap roster"><table><thead><tr><th>Team member</th>{days.map((day) => { const date = format(day, 'yyyy-MM-dd'); return <th className={date === snapshot.serverDate ? 'today' : ''} key={date}>{format(day, 'EEE')}<small>{format(day, 'dd MMM')}{date === snapshot.serverDate ? ' · Today' : ''}</small></th>; })}</tr></thead><tbody>{snapshot.members.map((member) => {
    const editable = snapshot.access.role === 'admin' || snapshot.access.memberId === member._id;
    return <tr key={member._id}><td><div className="roster-member"><span className="avatar mini" style={{ background: member.color }}>{initials(member.name)}</span><span><strong>{member.name}</strong><small>{member.email}</small></span></div></td>{days.map((day) => {
      const date = format(day, 'yyyy-MM-dd'), pending = mutation.isPending && mutation.variables?.memberId === member._id && mutation.variables.date === date;
      const current = pending ? mutation.variables!.status : rosterStatusFor(member, date, snapshot.rosterOverrides || [], snapshot.leaves || []);
      return <td className={date === snapshot.serverDate ? 'today' : ''} key={date}><select aria-label={`${member.name} ${date} shift`} className={`roster-select ${current}`} value={current} disabled={!editable || mutation.isPending} onChange={(event) => mutation.mutate({ memberId: member._id, date, status: event.target.value as RosterStatus })}>{rosterOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></td>;
    })}</tr>;
  })}</tbody></table></div></div>;
}

function Team({ snapshot, items, projectId, role, openTask }: ViewProps) {
  const call = useApi(), client = useQueryClient();
  const analytics = useProjectAnalytics(projectId, snapshot.serverDate.slice(0, 7)).data;
  const [selectedMemberId, setSelectedMemberId] = useState<string>();
  const [member, setMember] = useState({ name: '', email: '', title: '', department: '', allocationPercent: 100 });
  const addMember = useMutation({ mutationFn: () => call('/projects/' + projectId + '/members', { method: 'POST', body: JSON.stringify(member) }), onSuccess: async () => { setMember({ name: '', email: '', title: '', department: '', allocationPercent: 100 }); await client.invalidateQueries({ queryKey: ['snapshot', projectId] }); } });
  const selected = snapshot.members.find((person) => person._id === selectedMemberId);
  return <><div className="stack">{role === 'admin' && <Panel title="Add team member" subtitle="Name and email are required; the email identifies the member at project entry."><div className="inline-admin-form"><label>Name<input value={member.name} onChange={(e) => setMember({ ...member, name: e.target.value })} /></label><label>Email<input type="email" value={member.email} onChange={(e) => setMember({ ...member, email: e.target.value })} /></label><label>Title<input value={member.title} onChange={(e) => setMember({ ...member, title: e.target.value })} /></label><label>Department<input value={member.department} onChange={(e) => setMember({ ...member, department: e.target.value })} /></label><label>Allocation %<input type="number" min="1" max="100" value={member.allocationPercent} onChange={(e) => setMember({ ...member, allocationPercent: Number(e.target.value) })} /></label><button className="button primary" disabled={member.name.trim().length < 2 || !member.email.includes('@') || addMember.isPending} onClick={() => addMember.mutate()}><Plus size={15} /> Add member</button></div>{addMember.error && <div className="error-banner">{addMember.error.message}</div>}</Panel>}<div className="people-grid">{snapshot.members.map((person) => { const count = items.filter((item) => item.primaryAssigneeId === person.legacyId || item.primaryAssigneeId === person._id).length, capacity = analytics?.members.find((value) => value.memberId === person._id); return <button className="team-card" key={person._id} onClick={() => setSelectedMemberId(person._id)}><div className="avatar large" style={{ background: person.color }}>{initials(person.name)}</div><div><h3>{person.name}</h3><p>{person.email}</p></div><span className="chip">Team member</span><dl><div><dt>Allocation</dt><dd>{person.allocationPercent || 100}%</dd></div><div><dt>Active work</dt><dd>{count}</dd></div><div><dt>Available today</dt><dd>{capacity ? `${capacity.todayAvailability.toFixed(1)}h` : '—'}</dd></div></dl></button>; })}</div></div>{selected && <MemberStatsDialog member={selected} deliverables={snapshot.deliverables} today={snapshot.serverDate} capacity={analytics?.members.find((value) => value.memberId === selected._id)} onClose={() => setSelectedMemberId(undefined)} onOpenTask={(id) => { setSelectedMemberId(undefined); openTask(id); }} />}</>;
}

function Reports({ snapshot, items }: ViewProps) {
  const [month, setMonth] = useState(snapshot.serverDate.slice(0, 7));
  const analytics = useProjectAnalytics(snapshot.project._id, month).data;
  const trend = Array.from({ length: 8 }, (_, i) => { const end = addDays(parseISO(snapshot.serverDate), -7 * (7 - i)); return { week: format(end, 'dd MMM'), completed: items.filter((x) => x.completionDate && Math.abs(differenceInCalendarDays(parseISO(x.completionDate), end)) < 7).length }; });
  const exportCsv = () => download('deliverables.csv', ['Title,Ticket,Status,Priority,Assignee,Tower,Start,Due,Completed,Deployed,Estimated Efforts,Actual hours,Remaining hours', ...items.map((i) => [i.title, i.ticket || '', stageMeta[i.status].label, i.priority, memberOf(snapshot, i.primaryAssigneeId)?.name || '', towerOf(snapshot, i.towerId)?.name || '', i.startDate || '', i.dueDate || '', i.completionDate || '', i.deploymentDate || '', estimate(i), actualHours(i), ['done', 'deployed'].includes(i.status) ? 0 : remaining(i)].map(csv).join(','))].join('\r\n'), 'text/csv');
  const exportMonthly = () => analytics && download(`team-effort-${analytics.month}.csv`, ['Date,Capacity,Logged,Availability,Overtime,Adjusted effort', ...analytics.daily.map((entry) => [entry.date, entry.capacity, entry.logged, entry.availability, entry.overtime, entry.adjustedEffort].map(csv).join(',')), '', 'Member,Capacity,Logged,Availability,Overtime', ...analytics.members.map((entry) => [entry.name, entry.capacity, entry.logged, entry.availability, entry.overtime].map(csv).join(','))].join('\r\n'), 'text/csv');
  const exportIcs = () => download('effort-tracker.ics', ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Effort Tracker//EN', ...items.filter((i) => i.dueDate).flatMap((i) => ['BEGIN:VEVENT', `UID:${i._id}@effort-tracker`, `DTSTART;VALUE=DATE:${i.dueDate!.replaceAll('-', '')}`, `DTEND;VALUE=DATE:${format(addDays(parseISO(i.dueDate!), 1), 'yyyyMMdd')}`, `SUMMARY:${ics(`Due: ${i.title}`)}`, 'END:VEVENT']), 'END:VCALENDAR'].join('\r\n'), 'text/calendar');
  return <div className="stack"><MonthNavigator month={analytics?.month || month} minMonth={analytics?.minMonth || month} maxMonth={analytics?.maxMonth || month} onChange={setMonth} /><div className="report-actions"><button className="button" onClick={exportCsv}><Download size={16} /> Deliverables CSV</button><button className="button" disabled={!analytics} onClick={exportMonthly}><Download size={16} /> Monthly effort CSV</button><button className="button" onClick={exportIcs}><CalendarClock size={16} /> Team calendar ICS</button><button className="button" onClick={() => download('effort-tracker-backup.json', JSON.stringify(snapshot, null, 2), 'application/json')}><Download size={16} /> Scoped JSON backup</button></div>{analytics && <><div className="metric-grid report-metrics"><Metric icon={<Clock3 />} label="Monthly capacity" value={`${analytics.monthTotals.capacity.toFixed(1)}h`} hint={`${analytics.monthTotals.utilization.toFixed(0)}% utilization`} /><Metric icon={<CircleDot />} label="Total effort" value={`${analytics.monthTotals.logged.toFixed(1)}h`} hint={`${analytics.monthTotals.adjustedEffort.toFixed(1)}h after daily 1h adjustment`} /><Metric icon={<CheckCircle2 />} label="Availability" value={`${analytics.monthTotals.availability.toFixed(1)}h`} hint="Remaining scheduled hours" tone="green" /><Metric icon={<AlertCircle />} label="Overtime" value={`${analytics.monthTotals.overtime.toFixed(1)}h`} hint="Beyond scheduled capacity" tone={analytics.monthTotals.overtime ? 'amber' : 'green'} /></div><div className="dashboard-grid"><Panel title="Daily team effort and availability" subtitle={`Capacity, logged effort and remaining availability · ${analytics.month}`}><ResponsiveContainer width="100%" height={300}><BarChart data={analytics.daily}><CartesianGrid vertical={false} stroke="var(--border)" /><XAxis dataKey="date" tickFormatter={(value) => value.slice(8)} tick={{ fill: 'var(--muted)', fontSize: 11 }} /><YAxis tick={{ fill: 'var(--muted)', fontSize: 11 }} /><Tooltip /><Legend /><Bar dataKey="capacity" fill="#5b7cfa" name="Capacity" /><Bar dataKey="logged" fill="#8b5cf6" name="Logged" /><Bar dataKey="availability" fill="#27a674" name="Availability" /></BarChart></ResponsiveContainer></Panel><Panel title="Monthly effort by team member" subtitle="Logged effort compared with available hours"><ResponsiveContainer width="100%" height={300}><BarChart data={analytics.members} layout="vertical"><CartesianGrid horizontal={false} stroke="var(--border)" /><XAxis type="number" tick={{ fill: 'var(--muted)', fontSize: 11 }} /><YAxis type="category" dataKey="name" width={100} tick={{ fill: 'var(--muted)', fontSize: 10 }} /><Tooltip /><Legend /><Bar dataKey="logged" fill="#8b5cf6" name="Logged" /><Bar dataKey="availability" fill="#27a674" name="Availability" /></BarChart></ResponsiveContainer></Panel></div></>}<Panel title="Weekly outcomes" subtitle="Completed work trend"><ResponsiveContainer width="100%" height={280}><AreaChart data={trend}><defs><linearGradient id="area" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#8b5cf6" stopOpacity={0.5} /><stop offset="1" stopColor="#8b5cf6" stopOpacity={0} /></linearGradient></defs><CartesianGrid vertical={false} stroke="var(--border)" /><XAxis dataKey="week" tick={{ fill: 'var(--muted)', fontSize: 11 }} axisLine={false} /><YAxis tick={{ fill: 'var(--muted)', fontSize: 11 }} axisLine={false} /><Tooltip /><Area dataKey="completed" stroke="#8b5cf6" fill="url(#area)" strokeWidth={2} /></AreaChart></ResponsiveContainer></Panel></div>;
}

function ActivityView({ snapshot, projectId }: ViewProps) {
  const [month, setMonth] = useState(snapshot.serverDate.slice(0, 7));
  const analytics = useProjectAnalytics(projectId, month).data;
  const fallback = useMemo(() => {
    const monthStart = `${month}-01`, monthFinish = format(endOfMonth(parseISO(monthStart)), 'yyyy-MM-dd');
    const relevant = snapshot.deliverables.filter((item) => {
      const start = item.startDate || item.createdAt.slice(0, 10);
      const finish = item.deploymentDate || item.completionDate || item.dueDate || monthFinish;
      return start <= monthFinish && finish >= monthStart;
    });
    const loggedThrough = (item: Deliverable, date: string) => item.worklogs.filter((entry) => entry.workDate <= date).reduce((total, entry) => total + entry.minutes / 60, 0);
    const loggedBeforeMonth = (item: Deliverable) => item.worklogs.filter((entry) => entry.workDate < monthStart).reduce((total, entry) => total + entry.minutes / 60, 0);
    const totalPlanned = relevant.reduce((total, item) => total + Math.max(estimate(item) - loggedBeforeMonth(item), 0), 0);
    const checkpoints = [monthStart, format(addDays(parseISO(monthStart), 6), 'yyyy-MM-dd'), format(addDays(parseISO(monthStart), 13), 'yyyy-MM-dd'), format(addDays(parseISO(monthStart), 20), 'yyyy-MM-dd'), monthFinish].filter((date, index, all) => date <= monthFinish && all.indexOf(date) === index);
    const burndown = checkpoints.map((date, index) => {
      const actual = relevant.reduce((total, item) => {
        const finished = item.deploymentDate || item.completionDate;
        return finished && finished <= date ? total : total + Math.max(estimate(item) - loggedThrough(item, date), 0);
      }, 0);
      const ideal = totalPlanned * (1 - index / Math.max(checkpoints.length - 1, 1));
      const logged = relevant.reduce((total, item) => total + item.worklogs.filter((entry) => entry.workDate >= monthStart && entry.workDate <= date).reduce((sum, entry) => sum + entry.minutes / 60, 0), 0);
      return { date, label: index === 0 ? 'Start' : index === checkpoints.length - 1 ? 'Month end' : `Week ${index}`, ideal, actual, logged, variance: actual - ideal };
    });
    return {
      burndown,
      estimatedEfforts: relevant.reduce((total, item) => total + estimate(item), 0),
      remainingEffort: relevant.filter((item) => !['done', 'deployed'].includes(item.status)).reduce((total, item) => total + remaining(item), 0),
      logged: relevant.reduce((total, item) => total + item.worklogs.filter((entry) => entry.workDate >= monthStart && entry.workDate <= monthFinish).reduce((sum, entry) => sum + entry.minutes / 60, 0), 0)
    };
  }, [month, snapshot.deliverables]);
  const burndown = analytics?.burndown?.length ? analytics.burndown : fallback.burndown;
  const estimatedEfforts = analytics?.monthTotals.estimatedEfforts ?? fallback.estimatedEfforts;
  const remainingEffort = analytics?.monthTotals.remainingEffort ?? fallback.remainingEffort;
  const logged = analytics?.monthTotals.logged ?? fallback.logged;
  const minMonth = analytics?.minMonth || String(snapshot.project.createdAt || snapshot.project.startDate || snapshot.serverDate).slice(0, 7);
  const maxMonth = analytics?.maxMonth || snapshot.serverDate.slice(0, 7);
  return <div className="stack"><MonthNavigator month={analytics?.month || month} minMonth={minMonth} maxMonth={maxMonth} onChange={setMonth} /><div className="metric-grid report-metrics"><Metric icon={<CircleDot />} label="Planned Efforts" value={`${estimatedEfforts.toFixed(1)}h`} hint="Current dynamic task estimates" /><Metric icon={<Clock3 />} label="Remaining work" value={`${remainingEffort.toFixed(1)}h`} hint="Open work after verified effort" /><Metric icon={<CheckCircle2 />} label="Effort logged" value={`${logged.toFixed(1)}h`} hint={`During ${month}`} tone="green" /></div><Panel title="Team-level Burndown Chart" subtitle="Four-week planned versus actual remaining effort"><ResponsiveContainer width="100%" height={330}><LineChart data={burndown}><CartesianGrid stroke="var(--border)" /><XAxis dataKey="label" tick={{ fill: 'var(--muted)', fontSize: 11 }} /><YAxis label={{ value: 'Hours remaining', angle: -90, position: 'insideLeft', fill: 'var(--muted)' }} tick={{ fill: 'var(--muted)', fontSize: 11 }} /><Tooltip /><Legend /><Line type="monotone" dataKey="ideal" name="Ideal remaining" stroke="#4da3e6" strokeWidth={2} dot /><Line type="monotone" dataKey="actual" name="Actual remaining" stroke="#8b5cf6" strokeWidth={2} dot /></LineChart></ResponsiveContainer></Panel><Panel title="Audit & activity" subtitle="Immutable operational history"><div className="activity-list">{snapshot.activity.map((event) => <div key={event._id}><i /><div><strong>{event.by || 'System'}</strong><p>{event.text}</p></div><time>{event.at ? new Date(event.at).toLocaleString() : ''}</time></div>)}{!snapshot.activity.length && <div className="empty-state">No activity recorded for this project yet.</div>}</div></Panel></div>;
}
function Admin({ snapshot, projectId }: ViewProps) {
  const call = useApi();
  const [passwords, setPasswords] = useState({ teamPassword: '', adminPassword: '' });
  const changePasswords = useMutation({ mutationFn: () => call('/projects/' + projectId + '/passwords', { method: 'PATCH', body: JSON.stringify({ teamPassword: passwords.teamPassword || undefined, adminPassword: passwords.adminPassword || undefined }) }), onSuccess: () => setPasswords({ teamPassword: '', adminPassword: '' }) });
  return <div className="stack"><TaxonomyManager snapshot={snapshot} projectId={projectId} /><Panel title="Project passwords" subtitle="Changing either password immediately invalidates all other open project sessions."><div className="password-settings"><label>New shared team password<input type="password" minLength={8} value={passwords.teamPassword} placeholder="Leave blank to keep current" onChange={(e) => setPasswords({ ...passwords, teamPassword: e.target.value })} /></label><label>New admin password<input type="password" minLength={8} value={passwords.adminPassword} placeholder="Leave blank to keep current" onChange={(e) => setPasswords({ ...passwords, adminPassword: e.target.value })} /></label><button className="button primary" disabled={changePasswords.isPending || (passwords.teamPassword.length < 8 && passwords.adminPassword.length < 8)} onClick={() => changePasswords.mutate()}>Update passwords</button></div>{changePasswords.error && <div className="error-banner">{changePasswords.error.message}</div>}{changePasswords.isSuccess && <div className="success-banner">Passwords updated. Your Admin session was renewed.</div>}</Panel><Panel title="Access modes" subtitle="Enforced by the API and the project session"><div className="role-matrix"><div><strong>Team</strong><span>All operational views and normal project-work editing.</span></div><div><strong>Admin</strong><span>Everything in Team mode plus Reports, exports, settings, member creation, and destructive actions.</span></div></div></Panel></div>;
}

function TodayCapacity({ analytics }: { analytics: ProjectAnalytics }) {
  return <Panel title="Today's team effort and availability" subtitle="IST · roster and allocation aware"><div className="today-capacity"><div className="capacity-numbers"><span><b>{analytics.today.capacity.toFixed(1)}h</b> capacity</span><span><b>{analytics.today.logged.toFixed(1)}h</b> logged</span><span><b>{analytics.today.availability.toFixed(1)}h</b> available</span><span><b>{analytics.today.utilization.toFixed(0)}%</b> utilized</span>{analytics.today.overtime > 0 && <span className="attention"><b>{analytics.today.overtime.toFixed(1)}h</b> overtime</span>}</div><div className="capacity-members">{analytics.members.map((member) => <div key={member.memberId}><span><strong>{member.name}</strong></span><div><b style={{ width: `${member.todayCapacity ? Math.min(100, member.todayLogged / member.todayCapacity * 100) : member.todayLogged ? 100 : 0}%` }} /></div><small>{member.todayLogged.toFixed(1)}h logged · {member.todayAvailability.toFixed(1)}h available</small></div>)}</div></div></Panel>;
}

function MonthNavigator({ month, minMonth, maxMonth, onChange }: { month: string; minMonth: string; maxMonth: string; onChange: (value: string) => void }) {
  const shift = (amount: number) => onChange(format(addMonths(parseISO(`${month}-01`), amount), 'yyyy-MM'));
  return <div className="month-navigator"><button aria-label="Previous month" disabled={month <= minMonth} onClick={() => shift(-1)}><ArrowLeft size={16} /></button><div><span>Reporting month</span><strong>{format(parseISO(`${month}-01`), 'MMMM yyyy')}</strong></div><button aria-label="Next month" disabled={month >= maxMonth} onClick={() => shift(1)}><ArrowRight size={16} /></button></div>;
}

function Metric({ icon, label, value, hint, tone = '' }: { icon: React.ReactNode; label: string; value: React.ReactNode; hint: string; tone?: string }) { return <article className={`metric ${tone}`}><div>{icon}<span>{label}</span></div><strong>{value}</strong><p>{hint}</p></article>; }
function Panel({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) { return <section className="panel"><header><div><h2>{title}</h2>{subtitle && <p>{subtitle}</p>}</div></header>{children}</section>; }
function initials(name = 'Unassigned') { return name.split(/\s+/).filter(Boolean).slice(0, 2).map((v) => v[0]).join('').toUpperCase(); }
const csv = (v: unknown) => `"${String(v ?? '').replaceAll('"', '""')}"`;
const ics = (v: string) => v.replaceAll('\\', '\\\\').replaceAll(';', '\\;').replaceAll(',', '\\,').replaceAll('\n', '\\n');
function download(name: string, content: string, type: string) { const url = URL.createObjectURL(new Blob([content], { type })), anchor = document.createElement('a'); anchor.href = url; anchor.download = name; anchor.click(); URL.revokeObjectURL(url); }
