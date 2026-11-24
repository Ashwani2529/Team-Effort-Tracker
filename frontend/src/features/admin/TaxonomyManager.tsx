import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Save, Trash2 } from 'lucide-react';
import { useApi } from '../../hooks/use-api';
import type { Flag, Snapshot, Tower } from '../../types';

type Taxonomy = 'towers' | 'flags';
type Item = Tower | Flag;

export function TaxonomyManager({ snapshot, projectId }: { snapshot: Snapshot; projectId: string }) {
  return <div className="taxonomy-grid"><TaxonomySection title="Towers" description="Workstreams available in every task." type="towers" items={snapshot.towers} projectId={projectId} /><TaxonomySection title="Tags" description="Colored Planner-style labels; tasks may use several." type="flags" items={snapshot.flags} projectId={projectId} /></div>;
}

function TaxonomySection({ title, description, type, items, projectId }: { title: string; description: string; type: Taxonomy; items: Item[]; projectId: string }) {
  const call = useApi(), client = useQueryClient(), [name, setName] = useState(''), [color, setColor] = useState(type === 'towers' ? '#5b7cfa' : '#8b5cf6');
  const refresh = () => client.invalidateQueries({ queryKey: ['snapshot', projectId] });
  const create = useMutation({ mutationFn: () => call(`/projects/${projectId}/${type}`, { method: 'POST', body: JSON.stringify({ name, color }) }), onSuccess: async () => { setName(''); await refresh(); } });
  return <section className="panel taxonomy-panel"><header><div><h2>{title}</h2><p>{description}</p></div></header><div className="taxonomy-create"><input value={name} onChange={(event) => setName(event.target.value)} placeholder={`New ${title.slice(0, -1).toLowerCase()} name`} /><input aria-label={`${title} color`} type="color" value={color} onChange={(event) => setColor(event.target.value)} /><button className="button primary compact" disabled={!name.trim() || create.isPending} onClick={() => create.mutate()}><Plus size={14} /> Add</button></div>{create.error && <div className="error-banner">{create.error.message}</div>}<div className="taxonomy-list">{items.map((item) => <TaxonomyRow key={item._id} item={item} type={type} projectId={projectId} onChanged={refresh} />)}{!items.length && <p className="muted taxonomy-empty">No {title.toLowerCase()} yet. Add the first one above.</p>}</div></section>;
}

function TaxonomyRow({ item, type, projectId, onChanged }: { item: Item; type: Taxonomy; projectId: string; onChanged: () => Promise<unknown> }) {
  const call = useApi(), [name, setName] = useState(item.name), [color, setColor] = useState(item.color || '#5b7cfa');
  const save = useMutation({ mutationFn: () => call(`/projects/${projectId}/${type}/${item._id}`, { method: 'PATCH', body: JSON.stringify({ name, color }) }), onSuccess: onChanged });
  const remove = useMutation({ mutationFn: () => call(`/projects/${projectId}/${type}/${item._id}`, { method: 'DELETE' }), onSuccess: onChanged });
  return <div className="taxonomy-row"><input value={name} onChange={(event) => setName(event.target.value)} /><input aria-label={`${item.name} color`} type="color" value={color} onChange={(event) => setColor(event.target.value)} /><button className="icon-button" title="Save" disabled={!name.trim() || save.isPending} onClick={() => save.mutate()}><Save size={14} /></button><button className="icon-button danger-button" title="Delete" disabled={remove.isPending} onClick={() => remove.mutate()}><Trash2 size={14} /></button>{(save.error || remove.error) && <span className="row-error">{(save.error || remove.error)?.message}</span>}</div>;
}
