import { useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import {
  BadgePercent, Bell, BookOpen, BookOpenCheck, ChevronDown, ClipboardList,
  CreditCard, Film, GraduationCap, HelpCircle, LayoutDashboard, Library, ListVideo,
  LogOut, Menu, Search, Settings2, Users, X, ArrowRight,
} from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const groups = [
  { label: 'Workspace', items: [
    { path: '/dashboard', label: 'Overview', icon: LayoutDashboard },
    { path: '/users', label: 'Students', icon: Users },
  ] },
  { label: 'Learning content', items: [
    { path: '/classmanager', label: 'Academic structure', icon: GraduationCap },
    { path: '/resources', label: 'Content library', icon: BookOpen },
    { path: '/books', label: 'Books', icon: Library },
    { path: '/notices', label: 'Notices & articles', icon: Bell },
    { path: '/video-playlists', label: 'Playlists', icon: ListVideo },
    { path: '/videos', label: 'Videos', icon: Film },
  ] },
  { label: 'Assessment', items: [
    { path: '/test-series/collections', label: 'Test collections', icon: BookOpenCheck },
    { path: '/test-series', label: 'Test series', icon: ClipboardList },
    { path: '/question-bank', label: 'Question bank', icon: HelpCircle },
  ] },
  { label: 'Operations', items: [
    { path: '/payments', label: 'Payments', icon: CreditCard },
    { path: '/promo-codes', label: 'Promo codes', icon: BadgePercent },
    { path: '/tickets', label: 'Support tickets', icon: HelpCircle },
  ] },
  { label: 'Configuration', items: [
    { path: '/settings', label: 'Workspace settings', icon: Settings2 },
  ] },
];

const quickCommands = [
  { path: '/test-series/new', label: 'Create a test series', group: 'Quick actions', icon: ClipboardList },
  { path: '/test-series/bulk', label: 'Build tests in bulk', group: 'Quick actions', icon: BookOpenCheck },
  { path: '/users', label: 'Review student accounts', group: 'Quick actions', icon: Users },
  { path: '/payments', label: 'Review payments', group: 'Quick actions', icon: CreditCard },
  { path: '/tickets', label: 'Open support inbox', group: 'Quick actions', icon: HelpCircle },
];

const commands = [
  ...groups.flatMap((group) => group.items.map((item) => ({ ...item, group: group.label }))),
  ...quickCommands,
];

export const DashboardLayout = ({ children }: { children: ReactNode }) => {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [commandOpen, setCommandOpen] = useState(false);
  const [commandQuery, setCommandQuery] = useState('');
  const commandInput = useRef<HTMLInputElement>(null);
  const title = useMemo(() => groups.flatMap((group) => group.items).find((item) =>
    location.pathname === item.path || (item.path !== '/test-series' && location.pathname.startsWith(`${item.path}/`))
  )?.label || 'Admin workspace', [location.pathname]);

  const signOut = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  const normalizedQuery = query.trim().toLowerCase();
  const normalizedCommandQuery = commandQuery.trim().toLowerCase();
  const filteredCommands = useMemo(() => commands.filter((item) =>
    !normalizedCommandQuery || `${item.label} ${item.group}`.toLowerCase().includes(normalizedCommandQuery)
  ), [normalizedCommandQuery]);

  useEffect(() => {
    const onShortcut = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const isTyping = target instanceof HTMLElement && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName));
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setCommandQuery('');
        setCommandOpen(true);
      } else if (event.key === '/' && !isTyping) {
        event.preventDefault();
        setCommandQuery('');
        setCommandOpen(true);
      }
    };
    window.addEventListener('keydown', onShortcut);
    return () => window.removeEventListener('keydown', onShortcut);
  }, []);

  useEffect(() => {
    if (!commandOpen) return;
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    commandInput.current?.focus();
    const onEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') setCommandOpen(false); };
    window.addEventListener('keydown', onEscape);
    return () => {
      document.body.style.overflow = oldOverflow;
      window.removeEventListener('keydown', onEscape);
    };
  }, [commandOpen]);

  const goToCommand = (path: string) => {
    navigate(path);
    setOpen(false);
    setCommandOpen(false);
  };

  return (
    <div className="admin-app min-h-screen text-slate-900">
      <a className="admin-skip-link" href="#admin-main">Skip to content</a>
      <button onClick={() => setOpen(!open)} aria-expanded={open} aria-label={open ? 'Close navigation' : 'Open navigation'} className="admin-mobile-menu">
        {open ? <X size={19} /> : <Menu size={19} />}
      </button>
      <aside className={`admin-sidebar ${open ? 'is-open' : ''}`}>
        <Link to="/dashboard" className="admin-brand" onClick={() => setOpen(false)}>
          <span className="admin-brand-mark"><GraduationCap size={22} /></span>
          <span><strong>Note Library</strong><small>ADMIN WORKSPACE</small></span>
          <ChevronDown className="admin-brand-chevron" size={15} />
        </Link>

        <div className="admin-nav-search">
          <Search size={15} aria-hidden="true" />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Find a tool" aria-label="Find a management tool" />
          <kbd>/</kbd>
        </div>

        <nav className="admin-nav" aria-label="Admin navigation">
          {groups.map((group) => {
            const visible = group.items.filter((item) => !normalizedQuery || item.label.toLowerCase().includes(normalizedQuery));
            if (!visible.length) return null;
            return <section key={group.label} className="admin-nav-group">
              <h2>{group.label}</h2>
              {visible.map(({ path, label, icon: Icon }) => {
                const active = location.pathname === path || (path !== '/test-series' && location.pathname.startsWith(`${path}/`));
                return <Link key={path} to={path} onClick={() => setOpen(false)} aria-current={active ? 'page' : undefined} className={`admin-nav-link ${active ? 'is-active' : ''}`}>
                  <Icon size={17} strokeWidth={1.8} /><span>{label}</span>{active && <i aria-hidden="true" />}
                </Link>;
              })}
            </section>;
          })}
          {normalizedQuery && groups.flatMap((group) => group.items).every((item) => !item.label.toLowerCase().includes(normalizedQuery)) && <p className="admin-nav-empty">No tools match “{query}”.</p>}
        </nav>

        <div className="admin-sidebar-bottom">
          <div className="admin-profile-chip">
            <span className="admin-avatar">{(user?.display_name || user?.name || user?.username || 'A').slice(0, 1).toUpperCase()}</span>
            <span className="admin-profile-copy"><strong>{user?.display_name || user?.name || user?.username || 'Administrator'}</strong><small>{user?.email}</small></span>
            <Settings2 size={15} aria-hidden="true" />
          </div>
          <button onClick={signOut} className="admin-signout"><LogOut size={16} /> Sign out</button>
        </div>
      </aside>

      {open && <button aria-label="Close navigation" className="admin-scrim" onClick={() => setOpen(false)} />}

      <main id="admin-main" className="admin-main">
        <header className="admin-topbar">
          <div><p>NOTE LIBRARY <span>/</span> ADMIN</p><h1>{title}</h1></div>
          <div className="admin-topbar-actions">
            <button onClick={() => { setCommandQuery(''); setCommandOpen(true); }} className="admin-command-trigger" aria-haspopup="dialog" aria-expanded={commandOpen}><Search size={15} /><span>Search tools</span><kbd>Ctrl / ⌘ K</kbd></button>
            <div className="admin-topbar-user"><span className="admin-online-dot" />Administrator access</div>
          </div>
        </header>
        <div key={location.pathname} className="admin-page-content admin-page-transition">{children}</div>
      </main>

      {commandOpen && <div className="admin-command-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setCommandOpen(false); }}>
        <section className="admin-command-panel" role="dialog" aria-modal="true" aria-labelledby="admin-command-title">
          <h2 id="admin-command-title" className="sr-only">Search admin tools</h2>
          <div className="admin-command-search"><Search size={18} /><input ref={commandInput} value={commandQuery} onChange={(event) => setCommandQuery(event.target.value)} placeholder="What would you like to manage?" aria-label="Search admin pages and actions" /><button onClick={() => setCommandOpen(false)} aria-label="Close search"><X size={17} /></button></div>
          <div className="admin-command-results">
            {filteredCommands.length ? filteredCommands.map((item, index) => {
              const Icon = item.icon;
              const previous = filteredCommands[index - 1];
              return <div key={`${item.group}-${item.path}`}>
                {(!previous || previous.group !== item.group) && <p className="admin-command-group">{item.group}</p>}
                <button onClick={() => goToCommand(item.path)} className="admin-command-result"><span className="admin-command-icon"><Icon size={16} /></span><span>{item.label}</span><ArrowRight className="admin-command-arrow" size={15} /></button>
              </div>;
            }) : <p className="admin-command-empty">No tools found. Try a shorter search.</p>}
          </div>
          <footer className="admin-command-footer"><span><kbd>Esc</kbd> close</span><span>Ctrl / ⌘ K or / to search</span></footer>
        </section>
      </div>}
    </div>
  );
};
