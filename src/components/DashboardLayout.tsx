import { ReactNode, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import ThemeSwitcher from './ThemeSwitcher';
import { BookOpen, ChevronRight, GraduationCap, Home, Library, LifeBuoy, LogOut, Menu, Newspaper, UserRound, X } from 'lucide-react';

interface DashboardLayoutProps { children: ReactNode; }

const navigation = [
  {
    label: 'Learn',
    links: [
      { name: 'Dashboard', shortName: 'Home', path: '/dashboard', icon: Home },
      { name: 'Test series', shortName: 'Tests', path: '/test-series', icon: BookOpen },
      { name: 'Study library', shortName: 'Library', path: '/subjects', icon: Library },
      { name: 'Notices', shortName: 'News', path: '/notices', icon: Newspaper },
    ],
  },
  {
    label: 'Account',
    links: [
      { name: 'Profile', shortName: 'Profile', path: '/profile', icon: UserRound },
      { name: 'Help center', shortName: 'Help', path: '/support', icon: LifeBuoy },
    ],
  },
];

const mobileLinks = [navigation[0].links[0], navigation[0].links[1], navigation[0].links[2], navigation[1].links[0]];

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const { user, logout } = useAuth();
  useTheme();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const isActive = (path: string) => path === '/dashboard' ? location.pathname === path : location.pathname.startsWith(path);
  const profilePicture = user?.profile_picture || null;

  const Sidebar = ({ mobile = false }: { mobile?: boolean }) => (
    <aside className="flex h-full flex-col bg-[#fbfaf7] dark:bg-ink-900">
      <div className="flex h-[4.75rem] items-center gap-3 border-b border-ink-200/80 px-5 dark:border-white/[.07]">
        <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-700 text-white shadow-lg shadow-brand-900/15 dark:bg-brand-400 dark:text-brand-950"><GraduationCap size={20} strokeWidth={2.4} /></span>
        <span className="min-w-0">
          <strong className="block font-display text-sm font-bold leading-tight tracking-[-.02em] text-ink-900 dark:text-white">Note Library</strong>
          <small className="block text-[.5rem] font-bold uppercase tracking-[.16em] text-brand-700 dark:text-brand-300">Student workspace</small>
        </span>
        {mobile && <button onClick={() => setMenuOpen(false)} className="ml-auto grid h-9 w-9 place-items-center rounded-lg text-ink-400 hover:bg-ink-100 dark:hover:bg-white/[.07]" aria-label="Close navigation"><X size={20} /></button>}
      </div>

      <nav className="no-scrollbar flex-1 overflow-y-auto px-3 py-6" aria-label="Main navigation">
        {navigation.map((group, index) => (
          <section key={group.label} className={index ? 'mt-7' : ''}>
            <p className="dashboard-eyebrow mb-2 px-3 text-ink-400 dark:text-ink-500">{group.label}</p>
            <div className="space-y-1">
              {group.links.map((item) => {
                const active = isActive(item.path);
                return (
                  <Link key={item.path} to={item.path} onClick={() => mobile && setMenuOpen(false)} aria-current={active ? 'page' : undefined} className={`group relative flex items-center gap-3 overflow-hidden rounded-xl px-3 py-3 font-display text-[.78rem] font-semibold transition ${active ? 'bg-brand-100/80 text-brand-900 dark:bg-brand-500/[.12] dark:text-brand-300' : 'text-ink-500 hover:bg-ink-100/80 hover:text-ink-900 dark:text-ink-400 dark:hover:bg-white/[.05] dark:hover:text-white'}`}>
                    {active && <span className="absolute inset-y-2 left-0 w-0.5 rounded-full bg-brand-600 dark:bg-brand-400" />}
                    <item.icon size={17} strokeWidth={active ? 2.4 : 2} className={active ? 'text-brand-700 dark:text-brand-300' : ''} />
                    <span>{item.name}</span>
                    {active && <ChevronRight size={14} className="ml-auto" />}
                  </Link>
                );
              })}
            </div>
          </section>
        ))}
      </nav>

      <div className="border-t border-ink-200/80 p-3 dark:border-white/[.07]">
        <Link to="/profile" onClick={() => mobile && setMenuOpen(false)} className="flex items-center gap-3 rounded-xl p-2.5 transition hover:bg-ink-100/80 dark:hover:bg-white/[.05]">
          <span className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-xl bg-brand-100 text-xs font-bold text-brand-800 dark:bg-brand-500/[.15] dark:text-brand-300">{profilePicture ? <img src={profilePicture} alt={`${user?.name || 'User'} profile`} className="h-full w-full object-cover" /> : user?.name?.charAt(0).toUpperCase()}</span>
          <span className="min-w-0 flex-1"><strong className="block truncate font-display text-xs font-semibold text-ink-800 dark:text-ink-100">{user?.name}</strong><small className="mt-0.5 block truncate text-[.63rem] text-ink-400">{user?.email}</small></span>
        </Link>
        <div className="mt-2 flex items-center justify-between px-2">
          <ThemeSwitcher />
          <button onClick={() => { if (mobile) setMenuOpen(false); setShowLogoutConfirm(true); }} className="grid h-9 w-9 place-items-center rounded-lg text-ink-400 transition hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10 dark:hover:text-red-400" aria-label="Log out"><LogOut size={17} /></button>
        </div>
      </div>
    </aside>
  );

  return (
    <div className="min-h-[100dvh] bg-[#f7f5f0] text-ink-900 transition-colors dark:bg-ink-950 dark:text-ink-100">
      <a href="#main-content" className="skip-link">Skip to content</a>

      <div className="fixed inset-y-0 left-0 z-40 hidden w-[17.5rem] border-r border-ink-200/80 md:block dark:border-white/[.07]"><Sidebar /></div>

      <header className="fixed inset-x-0 top-0 z-40 flex h-16 items-center border-b border-ink-200/80 bg-[#fbfaf7]/92 px-4 backdrop-blur-xl md:hidden dark:border-white/[.07] dark:bg-ink-900/92">
        <Link to="/dashboard" className="flex items-center gap-2.5"><span className="grid h-9 w-9 place-items-center rounded-xl bg-brand-700 text-white dark:bg-brand-400 dark:text-brand-950"><GraduationCap size={19} /></span><strong className="font-display text-sm font-bold tracking-[-.02em]">Note Library</strong></Link>
        <button onClick={() => setMenuOpen(true)} className="ml-auto grid h-10 w-10 place-items-center rounded-xl text-ink-500 hover:bg-ink-100 dark:text-ink-400 dark:hover:bg-white/[.07]" aria-label="Open navigation"><Menu size={21} /></button>
      </header>

      {menuOpen && <div className="fixed inset-0 z-50 md:hidden"><button className="absolute inset-0 bg-ink-950/55 backdrop-blur-sm" onClick={() => setMenuOpen(false)} aria-label="Close navigation" /><div className="anim-slide-right absolute inset-y-0 left-0 w-[18rem] max-w-[88vw] border-r border-ink-200 shadow-2xl dark:border-white/10"><Sidebar mobile /></div></div>}

      <div className="md:pl-[17.5rem]">
        <main id="main-content" className="mx-auto max-w-[88rem] px-4 pb-28 pt-20 sm:px-6 md:pb-14 md:pt-10 lg:px-8">{children}</main>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-ink-200 bg-[#fbfaf7]/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl md:hidden dark:border-white/[.08] dark:bg-ink-950/95" aria-label="Quick navigation">
        <div className="mx-auto grid max-w-md grid-cols-4 px-2">{mobileLinks.map((item) => { const active = isActive(item.path); return <Link key={item.path} to={item.path} aria-current={active ? 'page' : undefined} className={`relative flex flex-col items-center gap-1 py-2.5 ${active ? 'text-brand-700 dark:text-brand-300' : 'text-ink-400'}`}>{active && <span className="absolute top-0 h-0.5 w-8 rounded-full bg-brand-600" />}<item.icon size={19} strokeWidth={active ? 2.4 : 2} /><span className="font-display text-[.6rem] font-semibold">{item.shortName}</span></Link>; })}</div>
      </nav>

      {showLogoutConfirm && (
        <div className="fixed inset-0 z-[60] grid place-items-center bg-ink-950/65 p-4 backdrop-blur-sm">
          <section role="dialog" aria-modal="true" aria-labelledby="logout-title" className="anim-pop w-full max-w-sm rounded-3xl border border-ink-200 bg-[#fbfaf7] p-7 shadow-2xl dark:border-white/10 dark:bg-ink-900">
            <span className="grid h-11 w-11 place-items-center rounded-xl bg-red-100 text-red-600 dark:bg-red-500/10 dark:text-red-400"><LogOut size={19} /></span>
            <h2 id="logout-title" className="mt-5 font-display text-xl font-semibold tracking-[-.035em] text-ink-900 dark:text-white">Log out for now?</h2>
            <p className="mt-2 text-sm leading-6 text-ink-500 dark:text-ink-400">Your study plan and progress will be ready when you return.</p>
            <div className="mt-7 flex gap-3"><button onClick={() => setShowLogoutConfirm(false)} className="auth-secondary flex-1">Stay signed in</button><button onClick={logout} className="flex min-h-11 flex-1 items-center justify-center rounded-xl bg-red-600 px-4 text-xs font-bold text-white transition hover:bg-red-500 active:scale-[.98]">Log out</button></div>
          </section>
        </div>
      )}
    </div>
  );
}
