import { useEffect, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Check, ChevronLeft, ClipboardList, GitBranch, Link2, MessageSquare, Pencil, Plus, Save, Search, Send, Timer, Trash2, X } from 'lucide-react';
import { deliverableInputSchema, PRIORITIES, STATUSES, type DeliverableInput, type Status } from '@effort-tracker/shared';
import { z } from 'zod';
import { useParams } from 'react-router-dom';
import { useApi } from '../../hooks/use-api';
import type { Comment, Deliverable, Flag, Snapshot, Worklog } from '../../types';

const labels: Record<Status, string> = {
  backlog: 'Backlog', todo: 'Not started', doing: 'In progress', review: 'In review', done: 'Delivered', deployed: 'Deployed'
};

export function TaskDrawer({ snapshot, id, onClose }: { snapshot: Snapshot; id: string; onClose: () => void }) {
  const [activeId, setActiveId] = useState(id), [trail, setTrail] = useState<string[]>([]);
  useEffect(() => { setActiveId(id); setTrail([]); }, [id]);
  const item = snapshot.deliverables.find((value) => value._id === activeId), create = activeId === 'new';
  const openTask = (nextId: string) => { if (nextId !== activeId) { setTrail((values) => [...values, activeId]); setActiveId(nextId); } };
  const goBack = () => setTrail((values) => { const copy = [...values], previous = copy.pop(); if (previous) setActiveId(previous); return copy; });
  return <Dialog.Root open onOpenChange={(open: boolean) => !open && onClose()}>
    <Dialog.Portal>
      <Dialog.Overlay className="drawer-overlay" />
      <Dialog.Content className="drawer">
        <Dialog.Title className="sr-only">{create ? 'New deliverable' : item?.title}</Dialog.Title>
        {trail.length > 0 && <button className="drawer-back" aria-label="Back to previous task" onClick={goBack}><ChevronLeft size={18} /></button>}
        <Dialog.Close className="drawer-close"><X size={19} /></Dialog.Close>
        {create ? <CreateTask snapshot={snapshot} onDone={onClose} /> : item ? <TaskDetails key={item._id} item={item} snapshot={snapshot} onClose={onClose} onOpenTask={openTask} /> : <div className="empty-state">This deliverable is no longer available.</div>}
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>;
}

function EditTask({ item, snapshot, onDone }: { item: Deliverable; snapshot: Snapshot; onDone: () => void }) {
  const { projectId = '' } = useParams(), call = useApi(), client = useQueryClient();
  const form = useForm<z.input<typeof deliverableInputSchema>, unknown, DeliverableInput>({
    resolver: zodResolver(deliverableInputSchema),
    defaultValues: {
      title: item.title, description: item.description || '', ticket: item.ticket || 'N/A', towerId: item.towerId || snapshot.towers[0]?._id || '',
      status: item.status, priority: item.priority, primaryAssigneeId: item.primaryAssigneeId || snapshot.members[0]?._id || '', contributorIds: item.contributorIds || [],
      flagIds: item.flagIds || [], startDate: item.startDate?.slice(0, 10) || snapshot.serverDate, dueDate: item.dueDate?.slice(0, 10) || snapshot.serverDate,
      completionDate: item.completionDate?.slice(0, 10) || null, deploymentDate: item.deploymentDate?.slice(0, 10) || null,
      estimatedHours: item.estimatedHours || 0, blocked: Boolean(item.blocked), blockReason: item.blockReason || '', toBeDeployed: Boolean(item.toBeDeployed),
      plannedDeploymentDate: item.plannedDeploymentDate?.slice(0, 10) || null, defects: item.defects || 0, escapedDefects: item.escapedDefects || 0,
      testsTotal: item.testsTotal || 0, testsAutomated: item.testsAutomated || 0, automatedDeployment: Boolean(item.automatedDeployment), hoursSaved: item.hoursSaved || 0
    }
  });
  const mutation = useMutation({
    mutationFn: (value: DeliverableInput) => call(`/projects/${projectId}/deliverables/${item._id}`, { method: 'PUT', headers: { 'If-Match': String(item.__v) }, body: JSON.stringify(value) }),
    onSuccess: async () => { await client.invalidateQueries({ queryKey: ['snapshot', projectId] }); await client.invalidateQueries({ queryKey: ['analytics', projectId] }); onDone(); },
    onError: (error) => window.alert(error.message)
  });
  const status = form.watch('status'), blocked = form.watch('blocked'), toBeDeployed = form.watch('toBeDeployed'), selectedFlags = form.watch('flagIds') || [];
  return <form className="drawer-form" onSubmit={form.handleSubmit((value) => mutation.mutate(value))}>
    <div className="drawer-hero">
      <span className="eyebrow">Edit deliverable</span>
      <input aria-label="Deliverable title" className="title-input" autoFocus {...form.register('title')} />
      <textarea aria-label="Deliverable description" placeholder="Add a concise description, acceptance notes, or context…" {...form.register('description')} />
      {form.formState.errors.title && <small className="field-error">{form.formState.errors.title.message}</small>}
    </div>
    <div className="form-grid">
      <Field label="Stage"><select {...form.register('status')}>{STATUSES.map((value) => <option key={value} value={value}>{labels[value]}</option>)}</select></Field>
      <Field label="Priority"><select {...form.register('priority')}>{PRIORITIES.map((value) => <option key={value} value={value}>{value[0]!.toUpperCase() + value.slice(1)}</option>)}</select></Field>
      <Field label="Tower"><select {...form.register('towerId')}>{snapshot.towers.map((tower) => <option key={tower._id} value={tower._id}>{tower.name}</option>)}</select></Field>
      <Field label="Tags"><TagPicker flags={snapshot.flags} selected={selectedFlags} onChange={(flagIds) => form.setValue('flagIds', flagIds, { shouldDirty: true })} /></Field>
      <Field label="Primary assignee"><select {...form.register('primaryAssigneeId')}>{snapshot.members.map((member) => <option key={member._id} value={member._id}>{member.name}</option>)}</select></Field>
      <Field label="Ticket or N/A"><input {...form.register('ticket')} /></Field>
      <Field label="Estimated Efforts"><input type="number" min="0.5" step="0.5" {...form.register('estimatedHours', { valueAsNumber: true })} /></Field>
      <Field label="Start date"><input type="date" {...form.register('startDate')} /></Field>
      <Field label="Due date"><input type="date" {...form.register('dueDate')} /></Field>
      {(status === 'done' || status === 'deployed') && <Field label="Completion date"><input type="date" {...form.register('completionDate')} /></Field>}
      {status === 'deployed' && <Field label="Deployment date"><input type="date" {...form.register('deploymentDate')} /></Field>}
    </div>
    <div className="option-row">
      <label><input type="checkbox" {...form.register('blocked')} /><AlertTriangle size={16} /> Blocked</label>
      <label><input type="checkbox" {...form.register('toBeDeployed')} /><GitBranch size={16} /> To be deployed</label>
      <label><input type="checkbox" {...form.register('automatedDeployment')} /><Check size={16} /> Automated deployment</label>
    </div>
    {blocked && <Field label="Block reason"><input {...form.register('blockReason')} /></Field>}
    {toBeDeployed && <Field label="Planned deployment"><input type="date" {...form.register('plannedDeploymentDate')} /></Field>}
    <div className="form-errors">
      {Object.entries(form.formState.errors).map(([key, error]) => <span key={key}>{key}: {error?.message as string}</span>)}
      {mutation.error && <span>{mutation.error.message}</span>}
    </div>
    <footer><button type="button" className="button" onClick={onDone}>Cancel</button><button className="button primary" disabled={mutation.isPending}><Save size={15} /> {mutation.isPending ? 'Saving…' : 'Save changes'}</button></footer>
  </form>;
}

function CreateTask({ snapshot, onDone }: { snapshot: Snapshot; onDone: () => void }) {
  const { projectId = '' } = useParams(), call = useApi(), client = useQueryClient();
  const form = useForm<z.input<typeof deliverableInputSchema>, unknown, DeliverableInput>({
    resolver: zodResolver(deliverableInputSchema),
    defaultValues: {
      title: '', description: '', ticket: '', towerId: snapshot.towers[0]?._id || '', status: 'todo', priority: 'medium',
      primaryAssigneeId: snapshot.members[0]?._id || '', contributorIds: [], flagIds: [], startDate: snapshot.serverDate,
      dueDate: snapshot.serverDate, completionDate: null, deploymentDate: null, estimatedHours: 0, blocked: false,
      blockReason: '', toBeDeployed: false, plannedDeploymentDate: null, defects: 0, escapedDefects: 0,
      testsTotal: 0, testsAutomated: 0, automatedDeployment: false, hoursSaved: 0
    }
  });
  const mutation = useMutation({
    mutationFn: (value: DeliverableInput) => call(`/projects/${projectId}/deliverables`, { method: 'POST', body: JSON.stringify(value) }),
    onSuccess: async () => { await client.invalidateQueries({ queryKey: ['snapshot', projectId] }); onDone(); }
  });
  const status = form.watch('status'), blocked = form.watch('blocked'), toBeDeployed = form.watch('toBeDeployed'), selectedFlags = form.watch('flagIds') || [];
  return <form className="drawer-form" onSubmit={form.handleSubmit((value) => mutation.mutate(value))}>
    <div className="drawer-hero">
      <span className="eyebrow">New project work</span>
      <input className="title-input" placeholder="Deliverable title" autoFocus {...form.register('title')} />
      <textarea placeholder="Add a concise description, acceptance notes, or context…" {...form.register('description')} />
      {form.formState.errors.title && <small className="field-error">{form.formState.errors.title.message}</small>}
    </div>
    <div className="form-grid">
      <Field label="Stage"><select {...form.register('status')}>{STATUSES.filter((value) => value !== 'deployed').map((value) => <option key={value} value={value}>{labels[value]}</option>)}</select></Field>
      <Field label="Priority"><select {...form.register('priority')}>{PRIORITIES.map((value) => <option key={value} value={value}>{value[0]!.toUpperCase() + value.slice(1)}</option>)}</select></Field>
      <Field label="Tower"><select {...form.register('towerId')}>{snapshot.towers.map((tower) => <option key={tower._id} value={tower._id}>{tower.name}</option>)}</select></Field>
      <Field label="Tags"><TagPicker flags={snapshot.flags} selected={selectedFlags} onChange={(flagIds) => form.setValue('flagIds', flagIds, { shouldDirty: true })} /></Field>
      <Field label="Primary assignee"><select {...form.register('primaryAssigneeId')}>{snapshot.members.map((member) => <option key={member._id} value={member._id}>{member.name}</option>)}</select></Field>
      <Field label="Ticket or N/A"><input {...form.register('ticket')} /></Field>
      <Field label="Estimated Efforts"><input type="number" min="0.5" step="0.5" {...form.register('estimatedHours', { valueAsNumber: true })} /></Field>
      <Field label="Start date"><input type="date" {...form.register('startDate')} /></Field>
      <Field label="Due date"><input type="date" {...form.register('dueDate')} /></Field>
      {(status === 'done' || status === 'deployed') && <Field label="Completion date"><input type="date" {...form.register('completionDate')} /></Field>}
      {status === 'deployed' && <Field label="Deployment date"><input type="date" {...form.register('deploymentDate')} /></Field>}
    </div>
    <div className="option-row">
      <label><input type="checkbox" {...form.register('blocked')} /><AlertTriangle size={16} /> Blocked</label>
      <label><input type="checkbox" {...form.register('toBeDeployed')} /><GitBranch size={16} /> To be deployed</label>
      <label><input type="checkbox" {...form.register('automatedDeployment')} /><Check size={16} /> Automated deployment</label>
    </div>
    {blocked && <Field label="Block reason"><input {...form.register('blockReason')} /></Field>}
    {toBeDeployed && <Field label="Planned deployment"><input type="date" {...form.register('plannedDeploymentDate')} /></Field>}
    <div className="form-errors">
      {Object.entries(form.formState.errors).map(([key, error]) => <span key={key}>{key}: {error?.message as string}</span>)}
      {mutation.error && <span>{mutation.error.message}</span>}
    </div>
    <footer><button type="button" className="button" onClick={onDone}>Cancel</button><button className="button primary" disabled={mutation.isPending}>{mutation.isPending ? 'Creating…' : 'Create deliverable'}</button></footer>
  </form>;
}

function TaskDetails({ item, snapshot, onClose, onOpenTask }: { item: Deliverable; snapshot: Snapshot; onClose: () => void; onOpenTask: (id: string) => void }) {
  const { projectId = '' } = useParams(), call = useApi(), client = useQueryClient();
  const [tab, setTab] = useState<'details' | 'effort' | 'activity'>('details'), [editing, setEditing] = useState(false), [comment, setComment] = useState(''), [minutes, setMinutes] = useState(60), [note, setNote] = useState(''), [visibleComments, setVisibleComments] = useState(5);
  const refresh = async () => { await client.invalidateQueries({ queryKey: ['snapshot', projectId] }); await client.invalidateQueries({ queryKey: ['analytics', projectId] }); };
  const status = useMutation({ mutationFn: (next: Status) => call(`/projects/${projectId}/deliverables/${item._id}/status`, { method: 'PATCH', body: JSON.stringify({ status: next, version: item.__v }) }), onSuccess: refresh, onError: (error) => window.alert(error.message) });
  const updateFlags = useMutation({ mutationFn: (flagIds: string[]) => call(`/projects/${projectId}/deliverables/${item._id}/flags`, { method: 'PATCH', body: JSON.stringify({ flagIds, version: item.__v }) }), onSuccess: refresh });
  const addComment = useMutation({ mutationFn: () => call(`/projects/${projectId}/deliverables/${item._id}/comments`, { method: 'POST', body: JSON.stringify({ text: comment }) }), onSuccess: async () => { setComment(''); await refresh(); } });
  const addWorklog = useMutation({ mutationFn: () => call(`/projects/${projectId}/deliverables/${item._id}/worklogs`, { method: 'POST', body: JSON.stringify({ workDate: snapshot.serverDate, minutes, note }) }), onSuccess: async () => { setNote(''); setTab('details'); await refresh(); } });
  const updateComment = useMutation({ mutationFn: ({ id, text }: { id: string; text: string }) => call(`/projects/${projectId}/deliverables/${item._id}/comments/${id}`, { method: 'PATCH', body: JSON.stringify({ text }) }), onSuccess: refresh });
  const deleteComment = useMutation({ mutationFn: (id: string) => call(`/projects/${projectId}/deliverables/${item._id}/comments/${id}`, { method: 'DELETE' }), onSuccess: refresh });
  const updateWorklog = useMutation({ mutationFn: ({ id, workDate, minutes: nextMinutes, note: nextNote }: { id: string; workDate: string; minutes: number; note: string }) => call(`/projects/${projectId}/deliverables/${item._id}/worklogs/${id}`, { method: 'PATCH', body: JSON.stringify({ workDate, minutes: nextMinutes, note: nextNote }) }), onSuccess: refresh });
  const deleteWorklog = useMutation({ mutationFn: (id: string) => call(`/projects/${projectId}/deliverables/${item._id}/worklogs/${id}`, { method: 'DELETE' }), onSuccess: refresh });
  const deleteTask = useMutation({ mutationFn: () => call(`/projects/${projectId}/deliverables/${item._id}`, { method: 'DELETE' }), onSuccess: async () => { await refresh(); onClose(); } });
  const owner = snapshot.members.find((member) => member._id === item.primaryAssigneeId || member.legacyId === item.primaryAssigneeId);
  const tower = snapshot.towers.find((value) => value._id === item.towerId || value.legacyId === item.towerId);
  const unfinishedDependencies = (item.dependencyIds || []).map((id) => snapshot.deliverables.find((value) => value._id === id)).filter((value): value is Deliverable => Boolean(value && !['done', 'deployed'].includes(value.status)));
  if (editing) return <EditTask item={item} snapshot={snapshot} onDone={() => setEditing(false)} />;
  return <div className="task-detail">
    <div className="drawer-hero">
      <div className="task-detail-actions">
        <button className="button compact" onClick={() => setEditing(true)}><Pencil size={14} /> Edit deliverable</button>
        {snapshot.access.role === 'admin' && <button className="button compact danger-button" disabled={deleteTask.isPending} onClick={() => window.confirm('Delete this deliverable? This removes it from the project.') && deleteTask.mutate()}><Trash2 size={14} /> Delete</button>}
      </div>
      <div className="task-path"><span>{tower?.name || 'No tower'}</span><i>/</i><code>{item.ticket || 'No ticket'}</code></div>
      <h1>{item.title}</h1><p>{item.description || 'No additional description was provided.'}</p>
      <div className="detail-controls">
        <select value={item.status} disabled={status.isPending || updateFlags.isPending} onChange={(event) => status.mutate(event.target.value as Status)}>{STATUSES.map((value) => <option key={value} value={value}>{labels[value]}</option>)}</select>
        <span className={`priority ${item.priority}`}>{item.priority} priority</span>
        {item.blocked && <span className="chip danger"><AlertTriangle size={13} /> Blocked</span>}
        {unfinishedDependencies.length > 0 && <span className="chip danger"><Link2 size={13} /> Blocked by {unfinishedDependencies.length}</span>}
      </div>
      {status.error && <small className="field-error">{status.error.message}</small>}
      {deleteTask.error && <small className="field-error">{deleteTask.error.message}</small>}
      <div className="task-tags"><span>Tags</span><TagPicker flags={snapshot.flags} selected={item.flagIds || []} disabled={updateFlags.isPending || status.isPending} onChange={(flagIds) => updateFlags.mutate(flagIds)} />{updateFlags.error && <small className="field-error">{updateFlags.error.message}</small>}</div>
    </div>
    <div className="drawer-tabs">
      <button className={tab === 'details' ? 'active' : ''} onClick={() => setTab('details')}><ClipboardList size={15} /> Details</button>
      <button className={tab === 'effort' ? 'active' : ''} onClick={() => setTab('effort')}><Timer size={15} /> Effort</button>
      <button className={tab === 'activity' ? 'active' : ''} onClick={() => setTab('activity')}><MessageSquare size={15} /> Activity</button>
    </div>
    {tab === 'details' && <div className="detail-body">
      <section className="properties"><h2>Properties</h2><dl>
        <Prop label="Assignee" value={owner?.name || 'Unassigned'} avatar={owner?.color} />
        <Prop label="Tower" value={tower?.name || 'None'} />
        <Prop label="Start" value={item.startDate || 'Not recorded'} />
        <Prop label="Due" value={item.dueDate || 'Not recorded'} />
        <Prop label="Completed" value={item.completionDate || '—'} />
        <Prop label="Deployed" value={item.deploymentDate || '—'} />
        <Prop label="Estimated Efforts" value={`${item.estimatedHours || 0} hours`} />
        <Prop label="Verified effort" value={`${((item.worklogMinutes || 0) / 60).toFixed(1)} hours`} />
      </dl></section>
      <TaskRelationships item={item} snapshot={snapshot} projectId={projectId} onOpenTask={onOpenTask} />
      <section><div className="section-title"><h2>Verified work notes</h2><span>{item.worklogs?.length || 0}</span></div><div className="worklog-list">
        {(item.worklogs || []).map((worklog) => <WorklogRow key={worklog._id} worklog={worklog} canManage={snapshot.access.role === 'admin' || worklog.memberId === snapshot.access.memberId} pending={updateWorklog.isPending || deleteWorklog.isPending} onSave={(value) => updateWorklog.mutateAsync({ id: worklog._id, ...value })} onDelete={() => deleteWorklog.mutateAsync(worklog._id)} />)}
        {!item.worklogs?.length && <p className="muted">No verified work has been added yet.</p>}
      </div>{(updateWorklog.error || deleteWorklog.error) && <div className="error-banner">{(updateWorklog.error || deleteWorklog.error)?.message}</div>}</section>
    </div>}
    {tab === 'effort' && <div className="detail-body">
      <section><h2>Add verified worklog</h2><div className="worklog-form">
        <Field label="Minutes"><input type="number" min="1" max="1440" value={minutes} onChange={(event) => setMinutes(Number(event.target.value))} /></Field>
        <Field label="Work note"><input value={note} onChange={(event) => setNote(event.target.value)} placeholder="What changed?" /></Field>
        <button className="button primary" onClick={() => addWorklog.mutate()} disabled={addWorklog.isPending || minutes < 1 || !note.trim()}><Plus size={15} /> Add worklog</button>
      </div>{addWorklog.error && <div className="error-banner">{addWorklog.error.message}</div>}</section>
      <section><h2>Effort accounting</h2><div className="effort-summary"><div><span>Estimated Efforts</span><strong>{item.estimatedHours || 0}h</strong></div><div><span>Verified actual</span><strong>{((item.worklogMinutes || 0) / 60).toFixed(1)}h</strong></div><div><span>Remaining effort</span><strong>{Math.max((item.estimatedHours || 0) - (item.worklogMinutes || 0) / 60, 0).toFixed(1)}h</strong></div></div></section>
    </div>}
    {tab === 'activity' && <div className="detail-body">
      <section><h2>Comments</h2><div className="comment-box"><textarea value={comment} onChange={(event) => setComment(event.target.value)} placeholder="Write an update…" /><button className="button primary compact" disabled={!comment.trim() || addComment.isPending} onClick={() => addComment.mutate()}><Send size={14} /> Send</button></div>{(addComment.error || updateComment.error || deleteComment.error) && <div className="error-banner">{(addComment.error || updateComment.error || deleteComment.error)?.message}</div>}<div className="comments">{[...(item.comments || [])].reverse().slice(0, visibleComments).map((entry) => <CommentRow key={entry._id} entry={entry} canManage={snapshot.access.role === 'admin' || entry.authorId === snapshot.access.memberId} pending={updateComment.isPending || deleteComment.isPending} onSave={(text) => updateComment.mutateAsync({ id: entry._id, text })} onDelete={() => deleteComment.mutateAsync(entry._id)} />)}</div>{visibleComments < (item.comments?.length || 0) && <button className="button compact load-more" onClick={() => setVisibleComments((value) => value + 5)}>Load 5 more</button>}</section>
      <section><h2>Status history</h2><div className="history">{[...(item.statusHistory || [])].reverse().map((entry, index) => <div key={`${entry.at}-${index}`}><i /><span>Moved to <strong>{labels[entry.status]}</strong></span><time>{new Date(entry.at).toLocaleString()}</time></div>)}</div></section>
    </div>}
  </div>;
}

function TaskRelationships({ item, snapshot, projectId, onOpenTask }: { item: Deliverable; snapshot: Snapshot; projectId: string; onOpenTask: (id: string) => void }) {
  const call = useApi(), client = useQueryClient();
  const [subtaskSearch, setSubtaskSearch] = useState(''), [dependencySearch, setDependencySearch] = useState('');
  const refresh = () => client.invalidateQueries({ queryKey: ['snapshot', projectId] });
  const add = useMutation({ mutationFn: ({ type, targetId }: { type: 'subtask' | 'dependency'; targetId: string }) => call(`/projects/${projectId}/deliverables/${item._id}/relationships`, { method: 'POST', body: JSON.stringify({ type, targetId }) }), onSuccess: async () => { setSubtaskSearch(''); setDependencySearch(''); await refresh(); } });
  const remove = useMutation({ mutationFn: ({ type, targetId }: { type: 'subtask' | 'dependency'; targetId: string }) => call(`/projects/${projectId}/deliverables/${item._id}/relationships/${type}/${targetId}`, { method: 'DELETE' }), onSuccess: refresh });
  const children = snapshot.deliverables.filter((value) => value.parentDeliverableId === item._id);
  const dependencies = (item.dependencyIds || []).flatMap((id) => { const target = snapshot.deliverables.find((value) => value._id === id); return target ? [target] : []; });
  const parent = item.parentDeliverableId ? snapshot.deliverables.find((value) => value._id === item.parentDeliverableId) : undefined;
  const matches = (query: string, type: 'subtask' | 'dependency') => {
    const text = query.trim().toLowerCase();
    if (!text) return [];
    const linked = new Set((type === 'subtask' ? children : dependencies).map((value) => value._id));
    return snapshot.deliverables.filter((value) => value._id !== item._id && !linked.has(value._id) && (type !== 'subtask' || !value.parentDeliverableId) && [value.title, value.ticket, value.description, snapshot.members.find((member) => member._id === value.primaryAssigneeId || member.legacyId === value.primaryAssigneeId)?.name].some((field) => field?.toLowerCase().includes(text))).slice(0, 6);
  };
  return <div className="relationship-sections">
    {parent && <section><div className="section-title"><h2>Parent task</h2></div><RelationshipRows values={[parent]} type="subtask" removable={false} onOpen={onOpenTask} onRemove={() => undefined} /></section>}
    <RelationshipPicker title="Subtasks" type="subtask" query={subtaskSearch} setQuery={setSubtaskSearch} values={children} results={matches(subtaskSearch, 'subtask')} pending={add.isPending || remove.isPending} onOpen={onOpenTask} onAdd={(targetId) => add.mutate({ type: 'subtask', targetId })} onRemove={(targetId) => remove.mutate({ type: 'subtask', targetId })} />
    <RelationshipPicker title="Dependencies" type="dependency" query={dependencySearch} setQuery={setDependencySearch} values={dependencies} results={matches(dependencySearch, 'dependency')} pending={add.isPending || remove.isPending} onOpen={onOpenTask} onAdd={(targetId) => add.mutate({ type: 'dependency', targetId })} onRemove={(targetId) => remove.mutate({ type: 'dependency', targetId })} />
    {(add.error || remove.error) && <div className="error-banner">{(add.error || remove.error)?.message}</div>}
  </div>;
}

function RelationshipPicker({ title, type, query, setQuery, values, results, pending, onOpen, onAdd, onRemove }: { title: string; type: 'subtask' | 'dependency'; query: string; setQuery: (value: string) => void; values: Deliverable[]; results: Deliverable[]; pending: boolean; onOpen: (id: string) => void; onAdd: (id: string) => void; onRemove: (id: string) => void }) {
  return <section><div className="section-title"><h2>{title}</h2><span>{values.length}</span></div><div className="relationship-search"><Search size={14} /><input aria-label={`Search ${title.toLowerCase()}`} value={query} onChange={(event) => setQuery(event.target.value)} placeholder={`Search tasks to add as ${type}…`} />{query.trim() && <div className="relationship-results">{results.map((value) => <button key={value._id} disabled={pending} onClick={() => onAdd(value._id)}><span><strong>{value.title}</strong><small>{value.ticket || 'No ticket'} · {labels[value.status]}</small></span><Plus size={14} /></button>)}{!results.length && <p>No available tasks match.</p>}</div>}</div><RelationshipRows values={values} type={type} removable onOpen={onOpen} onRemove={onRemove} /></section>;
}

function RelationshipRows({ values, type, removable, onOpen, onRemove }: { values: Deliverable[]; type: 'subtask' | 'dependency'; removable: boolean; onOpen: (id: string) => void; onRemove: (id: string) => void }) {
  return <div className="relationship-list">{values.map((value) => <div key={value._id}><button className="relationship-main" onClick={() => onOpen(value._id)}><span className={`status-dot ${value.status}`} /><span><strong>{value.title}</strong><small>{labels[value.status]} · {value.ticket || 'No ticket'}{type === 'dependency' && !['done', 'deployed'].includes(value.status) ? ' · Blocking' : ''}</small></span></button>{removable && <button className="relationship-remove" aria-label={`Remove ${value.title}`} onClick={() => onRemove(value._id)}><X size={14} /></button>}</div>)}{!values.length && <p className="muted">No {type === 'subtask' ? 'subtasks' : 'dependencies'} linked.</p>}</div>;
}

function WorklogRow({ worklog, canManage, pending, onSave, onDelete }: { worklog: Worklog; canManage: boolean; pending: boolean; onSave: (value: Pick<Worklog, 'workDate' | 'minutes' | 'note'>) => Promise<unknown>; onDelete: () => Promise<unknown> }) {
  const [editing, setEditing] = useState(false), [workDate, setWorkDate] = useState(worklog.workDate), [minutes, setMinutes] = useState(worklog.minutes), [note, setNote] = useState(worklog.note);
  const save = async () => { await onSave({ workDate, minutes, note: note.trim() }); setEditing(false); };
  if (editing) return <article className="entry-editor"><div className="worklog-edit-grid">
    <Field label="Work date"><input type="date" value={workDate} onChange={(event) => setWorkDate(event.target.value)} /></Field>
    <Field label="Minutes"><input type="number" min="1" max="1440" value={minutes} onChange={(event) => setMinutes(Number(event.target.value))} /></Field>
  </div><Field label="Work note"><input value={note} maxLength={1000} onChange={(event) => setNote(event.target.value)} /></Field><div className="entry-editor-actions"><button className="button compact" onClick={() => setEditing(false)}>Cancel</button><button className="button primary compact" disabled={pending || !workDate || minutes < 1 || !note.trim()} onClick={save}><Save size={13} /> Save</button></div>
  </article>;
  return <article><div><strong>{worklog.authorName}</strong><time>{new Date(worklog.createdAt || `${worklog.workDate}T00:00:00`).toLocaleString()} · Work date {worklog.workDate}</time></div><p>{worklog.note}</p><span>{formatMinutes(worklog.minutes)}</span>{canManage && <div className="entry-actions"><button aria-label="Edit worklog" title="Edit worklog" onClick={() => setEditing(true)}><Pencil size={13} /></button><button aria-label="Delete worklog" title="Delete worklog" disabled={pending} onClick={() => window.confirm('Delete this worklog?') && onDelete()}><Trash2 size={13} /></button></div>}</article>;
}

function CommentRow({ entry, canManage, pending, onSave, onDelete }: { entry: Comment; canManage: boolean; pending: boolean; onSave: (text: string) => Promise<unknown>; onDelete: () => Promise<unknown> }) {
  const [editing, setEditing] = useState(false), [text, setText] = useState(entry.text);
  const save = async () => { await onSave(text.trim()); setEditing(false); };
  return <article><div className="avatar mini">{entry.authorName?.[0] || '?'}</div><div className="comment-content"><div className="comment-heading"><span><strong>{entry.authorName}</strong><time>{new Date(entry.at).toLocaleString()}</time></span>{canManage && !editing && <span className="entry-actions"><button aria-label="Edit comment" title="Edit comment" onClick={() => setEditing(true)}><Pencil size={13} /></button><button aria-label="Delete comment" title="Delete comment" disabled={pending} onClick={() => window.confirm('Delete this comment?') && onDelete()}><Trash2 size={13} /></button></span>}</div>{editing ? <div className="comment-editor"><textarea value={text} maxLength={10000} onChange={(event) => setText(event.target.value)} /><div className="entry-editor-actions"><button className="button compact" onClick={() => { setText(entry.text); setEditing(false); }}>Cancel</button><button className="button primary compact" disabled={pending || !text.trim()} onClick={save}><Save size={13} /> Save</button></div></div> : <p>{entry.text}</p>}</div></article>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="field"><span>{label}</span>{children}</label>; }
function Prop({ label, value, avatar }: { label: string; value: string; avatar?: string }) { return <div><dt>{label}</dt><dd>{avatar && <i className="avatar-dot" style={{ background: avatar }} />}{value}</dd></div>; }
function formatMinutes(minutes: number) { return minutes >= 60 ? `${Math.floor(minutes / 60)}h ${minutes % 60 ? `${minutes % 60}m` : ''}`.trim() : `${minutes}m`; }

function TagPicker({ flags, selected, onChange, disabled = false }: { flags: Flag[]; selected: string[]; onChange: (ids: string[]) => void; disabled?: boolean }) {
  const active = flags.filter((flag) => selected.includes(flag._id));
  const toggle = (id: string) => onChange(selected.includes(id) ? selected.filter((value) => value !== id) : [...selected, id]);
  return <details className="tag-picker">
    <summary>{active.length ? <span className="selected-tags">{active.map((flag) => <i key={flag._id} style={{ background: flag.color }}>{flag.name}</i>)}</span> : <span className="muted">{flags.length ? 'Select tags' : 'No tags configured'}</span>}</summary>
    {flags.length > 0 && <div className="tag-menu">{flags.map((flag) => <button type="button" key={flag._id} className={selected.includes(flag._id) ? 'selected' : ''} disabled={disabled} onClick={() => toggle(flag._id)} style={{ '--tag-color': flag.color } as React.CSSProperties}><i />{flag.name}{selected.includes(flag._id) && <Check size={12} />}</button>)}</div>}
  </details>;
}
