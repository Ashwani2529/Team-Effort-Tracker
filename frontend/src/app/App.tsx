import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import { ArrowRight, FolderKanban, LoaderCircle, LockKeyhole, Plus } from 'lucide-react';
import { useApi } from '../hooks/use-api';
import type { PublicProject } from '../types';
import { Shell } from './Shell';
import { Page } from '../routes/Page';

export default function App() {
  const call = useApi();
  const projects = useQuery({ queryKey: ['projects'], queryFn: () => call<PublicProject[]>('/projects') });
  if (projects.isLoading) return <Centered icon={<LoaderCircle className="spin" />} title="Loading projects" text="Preparing the delivery workspace…" />;
  if (projects.isError) return <Centered icon={<LockKeyhole />} title="Workspace unavailable" text={projects.error.message} action={<button className="button" onClick={() => projects.refetch()}>Try again</button>} />;
  return <Routes>
    <Route path="/" element={<Landing projects={projects.data || []} />} />
    <Route path="/p/:projectId" element={<Shell projects={projects.data || []} />}><Route index element={<Navigate to="overview" replace />} /><Route path=":view" element={<Page />} /></Route>
    <Route path="*" element={<Navigate to="/" replace />} />
  </Routes>;
}

function Landing({ projects }: { projects: PublicProject[] }) {
  const [creating, setCreating] = useState(projects.length === 0);
  return <div className="auth-page landing"><div className="brand-mark">E</div><div className="landing-card"><div className="landing-head"><span className="eyebrow">Effort Tracker</span><h1>Choose a project</h1><p>Open a delivery workspace with your registered email and its Team password.</p></div>
    <div className="project-list">{projects.map((project) => <Link key={project._id} to={'/p/' + project._id + '/overview'}><div className="project-icon"><FolderKanban size={19} /></div><div><strong>{project.name}</strong><span>{project.portfolioName}{project.key ? ' · ' + project.key : ''}</span></div><ArrowRight size={16} /></Link>)}{!projects.length && !creating && <p className="muted">No projects have been created yet.</p>}</div>
    {creating ? <CreateProject onCancel={projects.length ? () => setCreating(false) : undefined} /> : <button className="button primary" onClick={() => setCreating(true)}><Plus size={16} /> New project</button>}
  </div></div>;
}

function CreateProject({ onCancel }: { onCancel?: () => void }) {
  const call = useApi(), navigate = useNavigate(), client = useQueryClient();
  const [form, setForm] = useState({ applicationPassword: '', portfolioName: 'Delivery Portfolio', name: '', key: '', creatorName: '', creatorEmail: '', teamPassword: '', adminPassword: '' });
  const update = (key: keyof typeof form, value: string) => setForm((current) => ({ ...current, [key]: value }));
  const create = useMutation({
    mutationFn: () => call<PublicProject>('/projects', { method: 'POST', body: JSON.stringify(form) }),
    onSuccess: async (project) => { await client.invalidateQueries({ queryKey: ['projects'] }); navigate('/p/' + project._id + '/overview'); }
  });
  const valid = form.applicationPassword.length >= 8 && form.portfolioName.trim().length >= 2 && form.name.trim().length >= 2 && form.creatorName.trim().length >= 2 && form.creatorEmail.includes('@') && form.teamPassword.length >= 8 && form.adminPassword.length >= 8 && form.teamPassword !== form.adminPassword;
  return <div className="create-project"><div><span className="eyebrow">Application protected</span><h2>Create a project</h2><p>The creator becomes the first team member and starts in Admin mode. Team and Admin authorization are remembered for 30 days.</p></div><div className="form-grid compact">
    <label>Application password<input type="password" autoComplete="current-password" value={form.applicationPassword} onChange={(e) => update('applicationPassword', e.target.value)} /></label>
    <label>Portfolio name<input value={form.portfolioName} onChange={(e) => update('portfolioName', e.target.value)} /></label>
    <label>Project name<input value={form.name} onChange={(e) => update('name', e.target.value)} /></label>
    <label>Project key<input value={form.key} maxLength={12} onChange={(e) => update('key', e.target.value)} placeholder="Optional" /></label>
    <label>Your name<input value={form.creatorName} autoComplete="name" onChange={(e) => update('creatorName', e.target.value)} /></label>
    <label>Your email<input type="email" value={form.creatorEmail} autoComplete="email" onChange={(e) => update('creatorEmail', e.target.value)} /></label>
    <label>Shared team password<input type="password" autoComplete="new-password" value={form.teamPassword} onChange={(e) => update('teamPassword', e.target.value)} /></label>
    <label>Admin password<input type="password" autoComplete="new-password" value={form.adminPassword} onChange={(e) => update('adminPassword', e.target.value)} /></label>
  </div>{create.error && <div className="error-banner">{create.error.message}</div>}<div className="form-actions">{onCancel && <button className="button" onClick={onCancel}>Cancel</button>}<button className="button primary" disabled={!valid || create.isPending} onClick={() => create.mutate()}><Plus size={16} /> {create.isPending ? 'Creating…' : 'Create project'}</button></div></div>;
}

function Centered({ icon, title, text, action }: { icon: React.ReactNode; title: string; text: string; action?: React.ReactNode }) {
  return <div className="auth-page"><div className="brand-mark">E</div><div className="setup-card center"><div className="gate-icon">{icon}</div><span className="eyebrow">Effort Tracker</span><h1>{title}</h1><p>{text}</p>{action}</div></div>;
}
