import { useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Check, ClipboardList, GitBranch, MessageSquare, Plus, Send, Timer, X } from 'lucide-react';
import { deliverableInputSchema, STATUSES, type DeliverableInput, type Status } from '@effort-tracker/shared';
import { z } from 'zod';
import { useParams } from 'react-router-dom';
import { useApi } from '../../hooks/use-api';
import type { Deliverable, Flag, Snapshot } from '../../types';

const labels: Record<Status, string> = {
  backlog: 'Backlog', todo: 'Not started', doing: 'In progress', review: 'In review', done: 'Delivered', deployed: 'Deployed'
};

export function TaskDrawer({ snapshot, id, onClose }: { snapshot: Snapshot; id: string; onClose: () => void }) {
  const item = snapshot.deliverables.find((value) => value._id === id), create = id === 'new';
  return <Dialog.Root open onOpenChange={(open: boolean) => !open && onClose()}>
    <Dialog.Portal>
      <Dialog.Overlay className="drawer-overlay" />
      <Dialog.Content className="drawer">
        <Dialog.Title className="sr-only">{create ? 'New deliverable' : item?.title}</Dialog.Title>
        <Dialog.Close className="drawer-close"><X size={19} /></Dialog.Close>
        {create ? <CreateTask snapshot={snapshot} onDone={onClose} /> : item ? <TaskDetails item={item} snapshot={snapshot} /> : <div className="empty-state">This deliverable is no longer available.</div>}
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>;
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
      <Field label="Stage"><select {...form.register('status')}>{STATUSES.map((value) => <option key={value} value={value}>{labels[value]}</option>)}</select></Field>
      <Field label="Priority"><select {...form.register('priority')}><option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option></select></Field>
      <Field label="Tower"><select {...form.register('towerId')}>{snapshot.towers.map((tower) => <option key={tower._id} value={tower._id}>{tower.name}</option>)}</select></Field>
      <Field label="Tags"><TagPicker flags={snapshot.flags} selected={selectedFlags} onChange={(flagIds) => form.setValue('flagIds', flagIds, { shouldDirty: true })} /></Field>
      <Field label="Primary assignee"><select {...form.register('primaryAssigneeId')}>{snapshot.members.map((member) => <option key={member._id} value={member._id}>{member.name}</option>)}</select></Field>
      <Field label="Ticket or N/A"><input {...form.register('ticket')} /></Field>
      <Field label="Estimated hours"><input type="number" min="0.5" step="0.5" {...form.register('estimatedHours', { valueAsNumber: true })} /></Field>
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

function TaskDetails({ item, snapshot }: { item: Deliverable; snapshot: Snapshot }) {
  const { projectId = '' } = useParams(), call = useApi(), client = useQueryClient();
  const [tab, setTab] = useState<'details' | 'effort' | 'activity'>('details'), [comment, setComment] = useState(''), [minutes, setMinutes] = useState(60), [note, setNote] = useState('');
  const refresh = () => client.invalidateQueries({ queryKey: ['snapshot', projectId] });
  const status = useMutation({ mutationFn: (next: Status) => call(`/projects/${projectId}/deliverables/${item._id}/status`, { method: 'PATCH', body: JSON.stringify({ status: next, version: item.__v }) }), onSuccess: refresh });
  const updateFlags = useMutation({ mutationFn: (flagIds: string[]) => call(`/projects/${projectId}/deliverables/${item._id}/flags`, { method: 'PATCH', body: JSON.stringify({ flagIds, version: item.__v }) }), onSuccess: refresh });
  const addComment = useMutation({ mutationFn: () => call(`/projects/${projectId}/deliverables/${item._id}/comments`, { method: 'POST', body: JSON.stringify({ text: comment }) }), onSuccess: async () => { setComment(''); await refresh(); } });
  const addWorklog = useMutation({ mutationFn: () => call(`/projects/${projectId}/deliverables/${item._id}/worklogs`, { method: 'POST', body: JSON.stringify({ workDate: snapshot.serverDate, minutes, note }) }), onSuccess: async () => { setNote(''); setTab('details'); await refresh(); } });
  const owner = snapshot.members.find((member) => member._id === item.primaryAssigneeId || member.legacyId === item.primaryAssigneeId);
  const tower = snapshot.towers.find((value) => value._id === item.towerId || value.legacyId === item.towerId);
  return <div className="task-detail">
    <div className="drawer-hero">
      <div className="task-path"><span>{tower?.name || 'No tower'}</span><i>/</i><code>{item.ticket || 'No ticket'}</code></div>
      <h1>{item.title}</h1><p>{item.description || 'No additional description was provided.'}</p>
      <div className="detail-controls">
        <select value={item.status} disabled={status.isPending} onChange={(event) => status.mutate(event.target.value as Status)}>{STATUSES.map((value) => <option key={value} value={value}>{labels[value]}</option>)}</select>
        <span className={`priority ${item.priority}`}>{item.priority} priority</span>
        {item.blocked && <span className="chip danger"><AlertTriangle size={13} /> Blocked</span>}
      </div>
      {status.error && <small className="field-error">{status.error.message}</small>}
      <div className="task-tags"><span>Tags</span><TagPicker flags={snapshot.flags} selected={item.flagIds || []} disabled={updateFlags.isPending} onChange={(flagIds) => updateFlags.mutate(flagIds)} />{updateFlags.error && <small className="field-error">{updateFlags.error.message}</small>}</div>
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
        <Prop label="Estimate" value={`${item.estimatedHours || 0} hours`} />
        <Prop label="Verified effort" value={`${((item.worklogMinutes || 0) / 60).toFixed(1)} hours`} />
      </dl></section>
      {item.dataQualityWarnings?.length ? <section><h2>Historical data quality</h2><div className="warning-box"><AlertTriangle size={17} /><div><strong>Preserved source gaps</strong><p>{item.dataQualityWarnings.map((warning) => warning.replaceAll('_', ' ')).join(' · ')}</p></div></div></section> : null}
      <section><div className="section-title"><h2>Verified work notes</h2><span>{item.worklogs?.length || 0}</span></div><div className="worklog-list">
        {(item.worklogs || []).map((worklog) => <article key={worklog._id}><div><strong>{worklog.authorName}</strong><time>{new Date(worklog.createdAt || `${worklog.workDate}T00:00:00`).toLocaleString()}</time></div><p>{worklog.note}</p><span>{formatMinutes(worklog.minutes)}</span></article>)}
        {!item.worklogs?.length && <p className="muted">No verified work has been added yet.</p>}
      </div></section>
    </div>}
    {tab === 'effort' && <div className="detail-body">
      <section><h2>Add verified worklog</h2><div className="worklog-form">
        <Field label="Minutes"><input type="number" min="1" max="1440" value={minutes} onChange={(event) => setMinutes(Number(event.target.value))} /></Field>
        <Field label="Work note"><input value={note} onChange={(event) => setNote(event.target.value)} placeholder="What changed?" /></Field>
        <button className="button primary" onClick={() => addWorklog.mutate()} disabled={addWorklog.isPending || minutes < 1 || !note.trim()}><Plus size={15} /> Add worklog</button>
      </div>{addWorklog.error && <div className="error-banner">{addWorklog.error.message}</div>}</section>
      <section><h2>Effort accounting</h2><div className="effort-summary"><div><span>Estimated</span><strong>{item.estimatedHours || 0}h</strong></div><div><span>Verified actual</span><strong>{((item.worklogMinutes || 0) / 60).toFixed(1)}h</strong></div><div><span>Legacy reference</span><strong>{(item.legacyActualHours || 0).toFixed(1)}h</strong></div></div></section>
    </div>}
    {tab === 'activity' && <div className="detail-body">
      <section><h2>Comments</h2><div className="comment-box"><textarea value={comment} onChange={(event) => setComment(event.target.value)} placeholder="Write an update…" /><button className="button primary compact" disabled={!comment.trim() || addComment.isPending} onClick={() => addComment.mutate()}><Send size={14} /> Send</button></div>{addComment.error && <div className="error-banner">{addComment.error.message}</div>}<div className="comments">{[...(item.comments || [])].reverse().slice(0, 30).map((entry) => <article key={entry._id}><div className="avatar mini">{entry.authorName?.[0] || '?'}</div><div><strong>{entry.authorName}</strong><time>{new Date(entry.at).toLocaleString()}</time><p>{entry.text}</p></div></article>)}</div></section>
      <section><h2>Status history</h2><div className="history">{[...(item.statusHistory || [])].reverse().map((entry, index) => <div key={`${entry.at}-${index}`}><i /><span>Moved to <strong>{labels[entry.status]}</strong></span><time>{new Date(entry.at).toLocaleString()}</time></div>)}</div></section>
    </div>}
  </div>;
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
