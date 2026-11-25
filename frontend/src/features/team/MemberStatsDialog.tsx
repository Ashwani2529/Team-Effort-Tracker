import { format, parseISO } from 'date-fns';
import { CalendarClock, Clock3, X } from 'lucide-react';
import { STATUSES, type Status } from '@effort-tracker/shared';
import type { Deliverable, Member } from '../../types';

const statusMeta: Record<Status, { label: string; color: string }> = {
  backlog: { label: 'Backlog', color: '#77808f' }, todo: { label: 'Not started', color: '#5b7cfa' },
  doing: { label: 'In progress', color: '#8b5cf6' }, review: { label: 'In review', color: '#e6a740' },
  done: { label: 'Delivered', color: '#27a674' }, deployed: { label: 'Deployed', color: '#17865f' }
};

const belongsTo = (item: Deliverable, member: Member) => {
  const ids = [member._id, member.legacyId].filter(Boolean);
  return ids.includes(item.primaryAssigneeId) || item.contributorIds.some((id) => ids.includes(id)) || item.worklogs.some((entry) => ids.includes(entry.memberId));
};

export function MemberStatsDialog({ member, deliverables, today, onClose, onOpenTask }: { member: Member; deliverables: Deliverable[]; today: string; onClose: () => void; onOpenTask: (id: string) => void }) {
  const work = deliverables.filter((item) => belongsTo(item, member));
  const memberIds = [member._id, member.legacyId].filter(Boolean);
  const loggedMinutes = work.flatMap((item) => item.worklogs).filter((entry) => memberIds.includes(entry.memberId)).reduce((total, entry) => total + entry.minutes, 0);
  const upcoming = work.filter((item) => item.dueDate && item.dueDate >= today && !['done', 'deployed'].includes(item.status)).sort((a, b) => a.dueDate!.localeCompare(b.dueDate!)).slice(0, 8);
  const overdue = work.filter((item) => item.dueDate && item.dueDate < today && !['done', 'deployed'].includes(item.status)).length;
  const initials = member.name.split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase();

  return <div className="member-dialog-backdrop" onMouseDown={onClose}>
    <section className="member-dialog" role="dialog" aria-modal="true" aria-labelledby="member-stats-title" onMouseDown={(event) => event.stopPropagation()}>
      <button className="drawer-close" aria-label="Close member statistics" onClick={onClose}><X size={18} /></button>
      <header className="member-dialog-hero"><span className="avatar large" style={{ background: member.color }}>{initials}</span><div><span className="eyebrow">Team member statistics</span><h1 id="member-stats-title">{member.name}</h1><p>{member.email}{member.title || member.department ? ` · ${member.title || member.department}` : ''}</p></div></header>
      <div className="member-dialog-body">
        <div className="member-summary-grid"><div><strong>{work.length}</strong><span>Total tasks worked on</span></div><div><strong>{(loggedMinutes / 60).toFixed(1)}h</strong><span>Total entered hours</span></div><div><strong>{(loggedMinutes / 60).toFixed(1)}h</strong><span>Verified work hours</span></div><div className={overdue ? 'attention' : ''}><strong>{overdue}</strong><span>Overdue tasks</span></div></div>
        <section><div className="section-title"><h2>Work by status</h2><span>{work.length} total</span></div><div className="member-status-grid">{STATUSES.map((status) => <div key={status}><i style={{ background: statusMeta[status].color }} /><strong>{work.filter((item) => item.status === status).length}</strong><span>{statusMeta[status].label}</span></div>)}</div></section>
        <section><div className="section-title"><h2>Upcoming deadlines</h2><span>{upcoming.length} shown</span></div><div className="member-deadlines">{upcoming.map((item) => <button key={item._id} onClick={() => onOpenTask(item._id)}><i style={{ background: statusMeta[item.status].color }} /><span><strong>{item.title}</strong><small>{statusMeta[item.status].label}</small></span><time><CalendarClock size={13} />{format(parseISO(item.dueDate!), 'dd MMM')}</time></button>)}{!upcoming.length && <div className="empty-state compact"><Clock3 />No upcoming deadlines.</div>}</div></section>
      </div>
    </section>
  </div>;
}
