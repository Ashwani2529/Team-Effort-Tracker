import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, NavLink, Outlet, useNavigate, useParams } from 'react-router-dom';
import { Activity, ArrowLeft, BarChart3, Bell, Blocks, CalendarDays, CircleGauge, Clock3, Columns3, FolderKanban, List, LockKeyhole, LogOut, Menu, Moon, Search, Settings2, ShieldCheck, Sun, Users, X } from 'lucide-react';
import { io } from 'socket.io-client';
import { useApi } from '../hooks/use-api';
import { ApiError } from '../lib/api';
import { searchDeliverables } from '../lib/search';
import type { PublicProject, Snapshot } from '../types';

const groups = [
  ['Workspace', [['overview', 'Overview', CircleGauge], ['framework', 'Delivery Framework', Blocks]]],
  ['Work', [['board', 'Board', Columns3], ['list', 'List', List], ['assignees', 'Assignees', Users], ['timeline', 'Timeline', Clock3], ['calendar', 'Calendar', CalendarDays]]],
  ['People', [['team', 'Team', Users], ['roster', 'Shift Roster', CalendarDays]]],
  ['Insights', [['reports', 'Reports', BarChart3], ['activity', 'Activity', Activity]]],
  ['Manage', [['admin', 'Admin', Settings2]]]
] as const;
const premium = new Set(['reports', 'admin']);

export interface PageContext { snapshot: Snapshot; search: string; setSearch: (v: string) => void; period: string; setPeriod: (v: string) => void; openTask: (id?: string) => void }
export function Shell({ projects }: { projects: PublicProject[] }) {
  const { projectId = '' } = useParams(), call = useApi(), navigate = useNavigate(), client = useQueryClient();
  const [mobile, setMobile] = useState(false), [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'dark'), [search, setSearch] = useState(''), [searchFocused, setSearchFocused] = useState(false), [period, setPeriod] = useState('active'), [bell, setBell] = useState(false), [taskId, setTaskId] = useState<string | undefined>(), [adminDialog, setAdminDialog] = useState(false), [adminPassword, setAdminPassword] = useState('');
  const searchInput = useRef<HTMLInputElement>(null);
  const snapshot = useQuery({ queryKey: ['snapshot', projectId], queryFn: () => call<Snapshot>('/projects/' + projectId + '/snapshot'), retry: false });
  useEffect(() => { document.documentElement.dataset.theme = theme; localStorage.setItem('theme', theme); }, [theme]);
  useEffect(() => { const focusSearch = (event: KeyboardEvent) => { if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); searchInput.current?.focus(); } }; window.addEventListener('keydown', focusSearch); return () => window.removeEventListener('keydown', focusSearch); }, []);
  useEffect(() => {
    if (!snapshot.data) return;
    const socket = io('/', { withCredentials: true });
    socket.emit('project:join', projectId);
    ['deliverable:created', 'deliverable:updated', 'deliverable:deleted', 'roster:updated'].forEach((event) => socket.on(event, () => { client.invalidateQueries({ queryKey: ['snapshot', projectId] }); client.invalidateQueries({ queryKey: ['analytics', projectId] }); }));
    return () => { socket.disconnect(); };
  }, [client, projectId, snapshot.data]);
  const admin = useMutation({ mutationFn: (password?: string) => call('/projects/' + projectId + '/admin-mode', { method: 'POST', body: JSON.stringify(password ? { password } : {}) }), onSuccess: async () => { setAdminDialog(false); setAdminPassword(''); await client.invalidateQueries({ queryKey: ['snapshot', projectId] }); }, onError: (error) => { if (error instanceof ApiError && error.payload?.error === 'admin_password_required') setAdminDialog(true); } });
  const team = useMutation({ mutationFn: () => call('/projects/' + projectId + '/team-mode', { method: 'POST' }), onSuccess: async () => { if (premium.has(location.pathname.split('/').at(-1) || '')) navigate('/p/' + projectId + '/overview'); await client.invalidateQueries({ queryKey: ['snapshot', projectId] }); } });
  const lock = useMutation({ mutationFn: () => call('/projects/' + projectId + '/lock', { method: 'POST' }), onSuccess: () => { client.removeQueries({ queryKey: ['snapshot', projectId] }); navigate('/'); } });
  const project = projects.find((item) => item._id === projectId);
  const unread = snapshot.data?.notifications.filter((notification) => !notification.readAt).length || 0;
  const searchResults = useMemo(() => snapshot.data ? searchDeliverables(snapshot.data, search).slice(0, 8) : [], [snapshot.data, search]);
  const ctx = useMemo<PageContext | undefined>(() => snapshot.data ? { snapshot: snapshot.data, search, setSearch, period, setPeriod, openTask: setTaskId } : undefined, [snapshot.data, search, period]);
  if (snapshot.isLoading) return <div className="loading-screen"><Loader /></div>;
  if (snapshot.error instanceof ApiError && snapshot.error.status === 401) return <UnlockProject project={project} projectId={projectId} onUnlocked={() => snapshot.refetch()} />;
  if (snapshot.isError || !snapshot.data || !ctx) return <div className="loading-screen"><div className="error-banner">{snapshot.error?.message || 'Project unavailable'}</div></div>;
  const isAdmin = snapshot.data.access.role === 'admin';
  return <div className="app-shell">
    {mobile && <button className="scrim" aria-label="Close navigation" onClick={() => setMobile(false)} />}
    <aside className={mobile ? 'sidebar open' : 'sidebar'}><div className="side-brand"><Link to="/" className="brand-mark small">E</Link><div><strong>Effort Tracker</strong><span>Delivery operations</span></div><button className="icon-button mobile-only" onClick={() => setMobile(false)}><X size={18} /></button></div>
      <div className="switchers"><Link className="project-home-link" to="/"><ArrowLeft size={15} /><span>All projects</span></Link></div>
      <nav>{groups.map(([group, links]) => { const visible = links.filter(([path]) => isAdmin || !premium.has(path)); return visible.length ? <div className="nav-group" key={group}><span>{group}</span>{visible.map(([path, label, Icon]) => <NavLink key={path} to={path} onClick={() => setMobile(false)} className={({ isActive }: { isActive: boolean }) => isActive ? 'active' : ''}><Icon size={17} />{label}</NavLink>)}</div> : null; })}</nav>
      <div className="sidebar-foot"><div className={isAdmin ? 'avatar admin' : 'avatar'}>{isAdmin ? <ShieldCheck size={16} /> : <Users size={16} />}</div><div><strong>{snapshot.data.access.memberName}</strong><span>{isAdmin ? 'Admin mode' : 'Team mode'}</span></div><button className="icon-button" title="Logout from project" onClick={() => lock.mutate()}><LogOut size={15} /></button></div>
    </aside>
    <main><header className="topbar"><button className="icon-button mobile-only" aria-label="Open navigation" onClick={() => setMobile(true)}><Menu size={19} /></button><div className="crumb"><FolderKanban size={16} /><span>{project?.name}</span></div><div className="global-search"><Search size={16} /><input ref={searchInput} aria-label="Search deliverables" placeholder="Search tasks, people, towers, tags…" value={search} onFocus={() => setSearchFocused(true)} onBlur={() => window.setTimeout(() => setSearchFocused(false), 120)} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => { if (e.key === 'Escape') { setSearch(''); setSearchFocused(false); searchInput.current?.blur(); } }} /><kbd>Ctrl K</kbd>{searchFocused && search.trim() && <div className="search-results">{searchResults.map((item) => <button key={item._id} onMouseDown={(event) => { event.preventDefault(); setTaskId(item._id); setSearchFocused(false); }}><strong>{item.title}</strong><span>{item.ticket || 'No ticket'} · {snapshot.data.towers.find((tower) => tower._id === item.towerId || tower.legacyId === item.towerId)?.name || 'No tower'}</span></button>)}{!searchResults.length && <p>No matching tasks.</p>}</div>}</div>
      <button className={isAdmin ? 'admin-toggle on' : 'admin-toggle'} title={isAdmin ? 'Return to Team mode' : 'Switch to Admin mode'} onClick={() => isAdmin ? team.mutate() : snapshot.data.access.adminVerified ? admin.mutate(undefined) : setAdminDialog(true)}><span>Admin</span><i /></button>
      <button className="icon-button" title="Toggle theme" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>{theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}</button><div className="popover-wrap"><button className="icon-button" title="Notifications" onClick={() => setBell(!bell)}><Bell size={18} />{unread > 0 && <i>{unread}</i>}</button>{bell && <div className="notification-popover"><div><strong>Notifications</strong><span>{unread} unread</span></div>{snapshot.data.notifications.length ? snapshot.data.notifications.map((notification) => <button key={notification._id} className={notification.readAt ? '' : 'unread'} onClick={() => notification.entityId && setTaskId(notification.entityId)}><strong>{notification.title}</strong><span>{notification.body}</span></button>) : <p>You're all caught up.</p>}</div>}</div></header>
      <Outlet context={{ ...ctx, openTask: setTaskId, taskId, closeTask: () => setTaskId(undefined) }} />
    </main>
    {adminDialog && <div className="modal-backdrop" role="presentation" onMouseDown={() => setAdminDialog(false)}><div className="password-dialog" role="dialog" aria-modal="true" aria-labelledby="admin-title" onMouseDown={(event) => event.stopPropagation()}><button className="dialog-close" onClick={() => setAdminDialog(false)}><X size={16} /></button><div className="gate-icon"><ShieldCheck /></div><span className="eyebrow">Premium access</span><h2 id="admin-title">Switch to Admin mode</h2><p>Enter this project's Admin password once. The authorization remains available for mode switching until this 30-day project session expires.</p><label>Admin password<input type="password" autoFocus autoComplete="current-password" value={adminPassword} onChange={(e) => setAdminPassword(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && adminPassword.length >= 8 && admin.mutate(adminPassword)} /></label>{admin.error && <div className="error-banner">{admin.error.message}</div>}<button className="button primary" disabled={adminPassword.length < 8 || admin.isPending} onClick={() => admin.mutate(adminPassword)}>{admin.isPending ? 'Checking…' : 'Switch mode'}</button></div></div>}
  </div>;
}

function UnlockProject({ project, projectId, onUnlocked }: { project?: PublicProject; projectId: string; onUnlocked: () => void }) {
  const call = useApi(), [email, setEmail] = useState(''), [password, setPassword] = useState('');
  const unlock = useMutation({ mutationFn: () => call('/projects/' + projectId + '/unlock', { method: 'POST', body: JSON.stringify({ email, password }) }), onSuccess: onUnlocked });
  const valid = email.includes('@') && password.length >= 8;
  return <div className="auth-page"><div className="brand-mark">E</div><div className="setup-card center"><div className="gate-icon"><LockKeyhole /></div><span className="eyebrow">{project?.portfolioName || 'Project workspace'}</span><h1>{project?.name || 'Open project'}</h1><p>Enter the email an Admin added to this project and the shared Team password. Access is remembered for 30 days.</p><label>Email address<input type="email" autoFocus autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} /></label><label>Team password<input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && valid && unlock.mutate()} /></label>{unlock.error && <div className="error-banner">{unlock.error.message}</div>}<button className="button primary" disabled={!valid || unlock.isPending} onClick={() => unlock.mutate()}>{unlock.isPending ? 'Opening…' : 'Open project'}</button><Link className="text-link" to="/">Choose another project</Link></div></div>;
}
function Loader() { return <div className="loader"><span /><p>Connecting to your workspace…</p></div>; }
