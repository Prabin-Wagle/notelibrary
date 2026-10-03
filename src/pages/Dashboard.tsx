import { useCallback, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import {
  Activity, ArrowDownToLine, ArrowRight, BookOpen, CircleDollarSign, ClipboardPlus,
  FileQuestion, Headphones, RefreshCw, Users,
} from 'lucide-react';
import { DashboardLayout } from '../components/DashboardLayout';
import { api, apiMessage } from '../lib/api';

type Stats = {
  students: number;
  active_students: number;
  resources: number;
  published_resources: number;
  quizzes: number;
  open_tickets: number;
  pending_payments: number;
};

type Audit = { id: number; action: string; entity_type?: string; admin_name?: string; admin_email?: string; created_at: string };

export const Dashboard = () => {
  const [stats, setStats] = useState<Stats | null>(null);
  const [activity, setActivity] = useState<Audit[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await api.get('/admin/dashboard');
      setStats(data.data.stats);
      setActivity(data.data.recent_activity || []);
      setUpdatedAt(new Date());
    } catch (reason) {
      setError(apiMessage(reason, 'Unable to load the dashboard.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadDashboard(); }, [loadDashboard]);

  const cards = stats ? [
    ['Students', stats.students, Users, '/users', 'Student accounts'],
    ['Active students', stats.active_students, Activity, '/users', 'Can sign in today'],
    ['Learning resources', stats.resources, BookOpen, '/resources', 'Across the library'],
    ['Published resources', stats.published_resources, BookOpen, '/resources', 'Visible to students'],
    ['Test series', stats.quizzes, FileQuestion, '/test-series', 'Assessments in the workspace'],
    ['Open support', stats.open_tickets, Headphones, '/tickets', 'Waiting for a response'],
    ['Payment review', stats.pending_payments, CircleDollarSign, '/payments', 'Requests to review'],
  ] as const : [];

  const exportReport = () => {
    if (!stats) return;
    const rows = [['Metric', 'Count'], ...cards.map(([label, value]) => [label, String(value)])];
    const csv = rows.map((row) => row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `note-library-admin-${new Date().toISOString().slice(0, 10)}.csv`;
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <DashboardLayout>
      <header className="admin-dashboard-hero">
        <div>
          <p className="admin-eyebrow">Workspace overview</p>
          <h2>Good to see you. Here’s the library today.</h2>
          <p>Live operations and learning-content totals, together in one view.</p>
        </div>
        <div className="admin-dashboard-controls">
          <span className="admin-refresh-time">{updatedAt ? `Updated ${updatedAt.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}` : 'Waiting for data'}</span>
          <button onClick={() => void loadDashboard()} disabled={loading} className="admin-quiet-button"><RefreshCw size={15} className={loading ? 'animate-spin' : ''} />Refresh</button>
          <button onClick={exportReport} disabled={!stats} className="admin-quiet-button"><ArrowDownToLine size={15} />Export CSV</button>
        </div>
      </header>
      {error && <div role="alert" className="admin-dashboard-error"><span>{error}</span><button onClick={() => void loadDashboard()}>Try again</button></div>}

      <section aria-label="Workspace totals" className="admin-metric-grid">
        {loading && !stats ? Array.from({ length: 7 }, (_, index) => <div key={index} className="admin-metric-skeleton" />) : cards.map(([label, value, Icon, path, description]) => (
          <Link key={label} to={path} className="admin-metric-card admin-stagger-item">
            <span className="admin-metric-icon"><Icon size={18} strokeWidth={1.8} /></span>
            <span className="admin-metric-number">{value.toLocaleString()}</span>
            <span className="admin-metric-label">{label}</span>
            <span className="admin-metric-description">{description}</span>
            <ArrowRight size={15} className="admin-metric-arrow" />
          </Link>
        ))}
        {!loading && !stats && !error && <div className="admin-dashboard-empty">Dashboard data is not available yet.</div>}
      </section>

      <section className="admin-quick-actions">
        <div><p className="admin-eyebrow">Start here</p><h3>Common admin tasks</h3></div>
        <div className="admin-quick-action-grid">
          <QuickAction to="/users" icon={<Users size={17} />} title="Manage students" detail="Profiles and account access" />
          <QuickAction to="/resources" icon={<BookOpen size={17} />} title="Add learning content" detail="Notes, resources, and books" />
          <QuickAction to="/test-series/new" icon={<ClipboardPlus size={17} />} title="Create a test" detail="Build a new assessment" />
          <QuickAction to="/tickets" icon={<Headphones size={17} />} title="Support inbox" detail="Reply to student requests" />
        </div>
      </section>

      <section className="admin-activity-section">
        <header><div><p className="admin-eyebrow">Audit trail</p><h3>Recent administrative activity</h3></div><span className="admin-activity-count">Last {activity.length} changes</span></header>
        {loading && activity.length === 0 ? <div className="admin-activity-skeletons">{[0, 1, 2].map((row) => <div key={row} />)}</div> : activity.length === 0 ? <div className="admin-activity-empty"><Activity size={19} /><span>No changes recorded yet. Admin actions will appear here.</span></div> : (
          <ol className="admin-activity-list">
            {activity.map((item) => (
              <li key={item.id} className="admin-activity-row">
                <span className="admin-activity-marker"><Activity size={15} /></span>
                <span className="admin-activity-copy"><strong>{item.action.replace(/[._]/g, ' ')}</strong><small>{item.admin_name || item.admin_email || 'Administrator'}{item.entity_type ? ` · ${item.entity_type}` : ''}</small></span>
                <time dateTime={item.created_at}>{new Date(item.created_at).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}</time>
              </li>
            ))}
          </ol>
        )}
      </section>
    </DashboardLayout>
  );
};

const QuickAction = ({ to, icon, title, detail }: { to: string; icon: ReactNode; title: string; detail: string }) => (
  <Link to={to} className="admin-quick-action"><span>{icon}</span><span><strong>{title}</strong><small>{detail}</small></span><ArrowRight size={15} /> </Link>
);
