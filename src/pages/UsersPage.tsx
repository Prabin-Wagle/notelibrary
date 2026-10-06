import { useCallback, useEffect, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import {
  Activity, ArrowUpRight, BookOpen, CalendarClock, Check, ChevronLeft, ChevronRight,
  Clock3, GraduationCap, Loader2, Mail, MapPin, Search, ShieldBan, ShieldCheck, Ticket,
  Trash2, UserRound, X,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { DashboardLayout } from '../components/DashboardLayout';
import { API_BASE_URL, api, apiMessage } from '../lib/api';
import { StudentDetails, User, UserStatus, UserStatusCounts } from '../types';

export const UsersPage = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [counts, setCounts] = useState<UserStatusCounts>({ active: 0, suspended: 0, banned: 0, deleted: 0 });
  const [queryDraft, setQueryDraft] = useState('');
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<User | null>(null);
  const [details, setDetails] = useState<StudentDetails | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [action, setAction] = useState<{ user: User; status: Exclude<UserStatus, 'deleted'> } | null>(null);
  const [actionReason, setActionReason] = useState('');
  const [suspendedUntil, setSuspendedUntil] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<User | null>(null);
  const [deleteReason, setDeleteReason] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await api.get('/admin/users', { params: { q: query, status: statusFilter || undefined, page, per_page: 20 } });
      setUsers(response.data.data.users);
      setCounts(response.data.data.counts || { active: 0, suspended: 0, banned: 0, deleted: 0 });
      const pagination = response.data.meta?.pagination;
      setTotal(Number(pagination?.total || 0));
      setLastPage(Number(pagination?.last_page || 1));
    } catch (error) {
      toast.error(apiMessage(error, 'Unable to load students.'));
    } finally {
      setLoading(false);
    }
  }, [query, statusFilter, page]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    if (!selected) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { setSelected(null); setDetails(null); }
    };
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', closeOnEscape);
    return () => {
      document.body.style.overflow = oldOverflow;
      window.removeEventListener('keydown', closeOnEscape);
    };
  }, [selected]);

  const openDetails = async (user: User) => {
    setSelected(user);
    setDetails(null);
    setDetailsLoading(true);
    try {
      const response = await api.get(`/admin/users/${user.id}`);
      setDetails(response.data.data);
    } catch (error) {
      toast.error(apiMessage(error, 'Unable to load this student record.'));
    } finally {
      setDetailsLoading(false);
    }
  };

  const refreshDetails = async () => {
    if (!selected) return;
    try {
      const response = await api.get(`/admin/users/${selected.id}`);
      setDetails(response.data.data);
    } catch { setSelected(null); setDetails(null); }
  };

  const submitSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPage(1);
    setQuery(queryDraft.trim());
  };

  const saveStatus = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!action) return;
    setSaving(true);
    try {
      await api.patch(`/admin/users/${action.user.id}/status`, {
        status: action.status,
        reason: actionReason.trim() || undefined,
        suspended_until: action.status === 'suspended' && suspendedUntil ? new Date(suspendedUntil).toISOString() : undefined,
      });
      toast.success(action.status === 'active' ? 'Account access restored' : action.status === 'banned' ? 'Student banned' : 'Student suspended');
      setAction(null);
      setActionReason('');
      setSuspendedUntil('');
      await load();
      await refreshDetails();
    } catch (error) { toast.error(apiMessage(error, 'Unable to update the account.')); }
    finally { setSaving(false); }
  };

  const remove = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!deleteTarget || confirmation !== 'DELETE') return;
    setSaving(true);
    try {
      await api.delete(`/admin/users/${deleteTarget.id}`, { data: { reason: deleteReason.trim() || undefined } });
      toast.success('Student account removed and personal details anonymized');
      if (selected?.id === deleteTarget.id) { setSelected(null); setDetails(null); }
      setDeleteTarget(null);
      setConfirmation('');
      setDeleteReason('');
      await load();
    } catch (error) { toast.error(apiMessage(error, 'Unable to remove the account.')); }
    finally { setSaving(false); }
  };

  return (
    <DashboardLayout>
      <div className="admin-page-heading">
        <div><p className="admin-eyebrow">People & access</p><h2>Students</h2><p>Review learner records, activity, and account access in one place.</p></div>
        <div className="admin-heading-icon"><UserRound size={24} /></div>
      </div>

      <section className="mb-6 grid grid-cols-2 gap-3 xl:grid-cols-4" aria-label="Student account totals">
        <StatusSummary label="Active" count={counts.active} color="text-emerald-800" tint="bg-emerald-50" />
        <StatusSummary label="Suspended" count={counts.suspended} color="text-amber-800" tint="bg-amber-50" />
        <StatusSummary label="Banned" count={counts.banned} color="text-rose-800" tint="bg-rose-50" />
        <StatusSummary label="Removed" count={counts.deleted} color="text-slate-600" tint="bg-slate-100" />
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_14px_44px_-34px_rgba(22,48,39,.28)]">
        <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
          <div><h3 className="text-base font-semibold tracking-tight text-slate-900">Student directory</h3><p className="mt-1 text-xs text-slate-500">{total.toLocaleString()} records · updated from the live student database</p></div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <form onSubmit={submitSearch} className="flex min-w-0 items-center rounded-xl border border-slate-200 bg-slate-50 px-3 focus-within:border-teal-500 focus-within:bg-white sm:w-72">
              <Search className="shrink-0 text-slate-400" size={16} /><input value={queryDraft} onChange={(event) => setQueryDraft(event.target.value)} placeholder="Name, username, or email" aria-label="Search student accounts" className="min-w-0 flex-1 bg-transparent px-2.5 py-2.5 text-sm outline-none placeholder:text-slate-400" />
              <button aria-label="Apply search" className="rounded-lg p-1.5 text-slate-500 hover:bg-white hover:text-teal-800"><ArrowUpRight size={16} /></button>
            </form>
            <select aria-label="Filter by account status" value={statusFilter} onChange={(event) => { setStatusFilter(event.target.value); setPage(1); }} className="min-h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-teal-600">
              <option value="">All non-removed</option><option value="active">Active</option><option value="suspended">Suspended</option><option value="banned">Banned</option><option value="deleted">Removed</option>
            </select>
          </div>
        </div>

        {loading ? <div className="space-y-3 p-5" aria-label="Loading student records">{[0, 1, 2, 3].map((row) => <div key={row} className="h-[68px] animate-pulse rounded-xl bg-slate-100" />)}</div> : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="bg-[#fafbf9] text-[10px] font-bold uppercase tracking-[.13em] text-slate-500"><tr><th className="px-5 py-3.5">Student</th><th className="px-4 py-3.5">Status</th><th className="px-4 py-3.5">Study path</th><th className="px-4 py-3.5">Last active</th><th className="px-4 py-3.5">Joined</th><th className="px-5 py-3.5 text-right">Record</th></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {users.map((user) => <tr key={user.id} className="group hover:bg-[#fbfcfa]">
                  <td className="px-5 py-4"><button onClick={() => void openDetails(user)} className="flex items-center gap-3 text-left">
                    <StudentAvatar user={user} size="sm" /><span className="min-w-0"><strong className="block max-w-64 truncate font-semibold text-slate-900 group-hover:text-teal-800">{user.display_name || user.username || 'Student'}</strong><span className="mt-0.5 block max-w-64 truncate text-xs text-slate-500">{user.email}</span></span>
                  </button></td>
                  <td className="px-4 py-4"><StatusBadge status={user.status || 'active'} /></td>
                  <td className="px-4 py-4"><span className="text-slate-700">{user.education_class || '—'}</span>{user.faculty && <span className="ml-1.5 text-xs text-slate-400">{user.faculty}</span>}</td>
                  <td className="px-4 py-4 text-slate-500">{formatDate(user.last_login_at)}</td>
                  <td className="px-4 py-4 text-slate-500">{formatDate(user.created_at, true)}</td>
                  <td className="px-5 py-4 text-right"><button onClick={() => void openDetails(user)} className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-xs font-semibold text-teal-800 hover:bg-teal-50">View details <ArrowUpRight size={14} /></button></td>
                </tr>)}
                {users.length === 0 && <tr><td colSpan={6} className="px-6 py-16 text-center"><div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-slate-100 text-slate-500"><Search size={20} /></div><p className="mt-3 font-semibold text-slate-800">No matching students</p><p className="mt-1 text-sm text-slate-500">Try another name or account status.</p></td></tr>}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex flex-col gap-3 border-t border-slate-100 px-5 py-3.5 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between">
          <span>Showing {total ? (page - 1) * 20 + 1 : 0}–{Math.min(page * 20, total)} of {total}</span>
          <div className="flex items-center gap-2"><button disabled={page <= 1 || loading} onClick={() => setPage((value) => Math.max(1, value - 1))} className="grid h-8 w-8 place-items-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40" aria-label="Previous page"><ChevronLeft size={16} /></button><span className="tabular-nums">Page {page} of {lastPage}</span><button disabled={page >= lastPage || loading} onClick={() => setPage((value) => Math.min(lastPage, value + 1))} className="grid h-8 w-8 place-items-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40" aria-label="Next page"><ChevronRight size={16} /></button></div>
        </div>
      </section>

      {selected && <>
        <button className="fixed inset-0 z-[70] bg-slate-950/35 backdrop-blur-[2px]" aria-label="Close student details" onClick={() => { setSelected(null); setDetails(null); }} />
        <aside role="dialog" aria-modal="true" aria-label={`Student record for ${selected.display_name || selected.email}`} className="fixed inset-y-0 right-0 z-[80] flex w-full max-w-[650px] flex-col overflow-hidden border-l border-slate-200 bg-[#fbfcfa] shadow-2xl">
          <div className="flex items-start justify-between border-b border-slate-200 bg-white px-5 py-4 sm:px-7">
            <div className="flex min-w-0 items-center gap-3"><StudentAvatar user={details?.student || selected} size="lg" /><span className="min-w-0"><span className="flex flex-wrap items-center gap-2"><strong className="truncate text-lg font-semibold tracking-tight text-slate-900">{details?.student.display_name || selected.display_name || selected.username || 'Student'}</strong><StatusBadge status={details?.student.status || selected.status || 'active'} /></span><span className="mt-1 block truncate text-sm text-slate-500">{details?.student.email || selected.email}</span></span></div>
            <button onClick={() => { setSelected(null); setDetails(null); }} className="ml-3 rounded-lg p-2 text-slate-500 hover:bg-slate-100" aria-label="Close student details"><X size={19} /></button>
          </div>
          {detailsLoading ? <div className="grid flex-1 place-items-center"><Loader2 className="animate-spin text-teal-700" /></div> : details ? <>
            <div className="flex flex-wrap gap-2 border-b border-slate-100 bg-white px-5 py-3 sm:px-7">
              {details.student.status !== 'active' && <ActionButton label="Restore access" icon={<ShieldCheck size={15} />} onClick={() => { setActionReason(''); setAction({ user: details.student, status: 'active' }); }} tone="green" />}
              {details.student.status !== 'suspended' && details.student.status !== 'banned' && details.student.status !== 'deleted' && <ActionButton label="Suspend" icon={<CalendarClock size={15} />} onClick={() => { setActionReason(''); setSuspendedUntil(''); setAction({ user: details.student, status: 'suspended' }); }} tone="amber" />}
              {details.student.status !== 'banned' && details.student.status !== 'deleted' && <ActionButton label="Ban" icon={<ShieldBan size={15} />} onClick={() => { setActionReason(''); setAction({ user: details.student, status: 'banned' }); }} tone="red" />}
              {details.student.status !== 'deleted' && <ActionButton label="Remove account" icon={<Trash2 size={15} />} onClick={() => { setDeleteReason(''); setConfirmation(''); setDeleteTarget(details.student); }} tone="plain" />}
            </div>
            {details.student.status_reason && <div className="mx-5 mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950 sm:mx-7"><strong className="block text-xs uppercase tracking-wide">Current restriction note</strong><span className="mt-1 block">{details.student.status_reason}</span>{details.student.suspended_until && <span className="mt-1 block text-xs">Access scheduled to resume {formatDate(details.student.suspended_until)}.</span>}</div>}
            <div className="flex-1 space-y-5 overflow-y-auto px-5 py-5 sm:px-7">
              <section className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                <Metric value={details.activity.completed_tests} label="Tests completed" icon={<BookOpen size={15} />} />
                <Metric value={details.activity.saved_resources} label="Saved resources" icon={<Activity size={15} />} />
                <Metric value={details.activity.resource_views} label="Study views" icon={<ArrowUpRight size={15} />} />
                <Metric value={details.activity.support_tickets} label="Support tickets" icon={<Ticket size={15} />} />
              </section>

              <DetailSection title="Personal profile" icon={<UserRound size={16} />}>
                <DetailRow icon={<Mail size={15} />} label="Email" value={details.student.email} />
                <DetailRow icon={<UserRound size={15} />} label="Username" value={details.student.username} />
                <DetailRow icon={<UserRound size={15} />} label="Phone" value={details.student.phone} />
                <DetailRow icon={<CalendarClock size={15} />} label="Date of birth" value={details.student.date_of_birth} />
                <DetailRow icon={<MapPin size={15} />} label="Location" value={[details.student.city, details.student.district, details.student.province].filter(Boolean).join(', ')} />
                {details.student.bio && <p className="mt-3 border-t border-slate-100 pt-3 text-sm leading-6 text-slate-600">{details.student.bio}</p>}
              </DetailSection>

              <DetailSection title="Study path" icon={<GraduationCap size={16} />}>
                <DetailRow icon={<GraduationCap size={15} />} label="Class / faculty" value={[details.student.education_class, details.student.faculty].filter(Boolean).join(' · ')} />
                <DetailRow icon={<BookOpen size={15} />} label="Entrance preparation" value={details.student.competition} />
                {details.enrollments.length ? <div className="mt-2 space-y-2">{details.enrollments.map((enrollment, index) => <div key={`${enrollment.program_name}-${enrollment.level_name}-${index}`} className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-3 py-2.5"><span className="text-sm font-medium text-slate-800">{enrollment.program_name} <span className="text-slate-400">/</span> {enrollment.level_name}</span>{Boolean(enrollment.is_primary) && <span className="text-[10px] font-bold uppercase tracking-wide text-teal-800">Primary</span>}</div>)}</div> : <p className="mt-2 text-sm text-slate-500">No curriculum enrollment recorded.</p>}
              </DetailSection>

              <DetailSection title="Learning activity" icon={<Activity size={16} />}>
                <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm"><DataPoint label="All attempts" value={details.activity.quiz_attempts} /><DataPoint label="Average test score" value={details.activity.average_score == null ? '—' : `${details.activity.average_score}`} /><DataPoint label="Upcoming study goals" value={details.activity.upcoming_targets} /><DataPoint label="Payment requests" value={details.activity.payment_requests} /></div>
                <div className="mt-4 border-t border-slate-100 pt-3"><h4 className="mb-2 text-[10px] font-bold uppercase tracking-[.12em] text-slate-400">Recent tests</h4>{details.recent_attempts.length ? details.recent_attempts.map((attempt, index) => <div key={`${attempt.title}-${attempt.started_at}-${index}`} className="flex items-center justify-between gap-3 border-b border-slate-50 py-2 last:border-0"><span className="min-w-0"><strong className="block truncate text-sm font-medium text-slate-800">{attempt.title}</strong><span className="text-xs text-slate-500">{formatDate(attempt.submitted_at || attempt.started_at)}</span></span><span className="shrink-0 text-xs font-semibold text-slate-600">{attempt.score == null ? attempt.status : `${attempt.score}${attempt.maximum_score == null ? '' : ` / ${attempt.maximum_score}`}`}</span></div>) : <p className="text-sm text-slate-500">No test attempts yet.</p>}</div>
              </DetailSection>

              <DetailSection title="Support and account history" icon={<Clock3 size={16} />}>
                <div className="space-y-2">{details.recent_tickets.length ? details.recent_tickets.map((ticket) => <div key={ticket.id} className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-3 py-2.5"><span className="min-w-0"><strong className="block truncate text-sm font-medium text-slate-800">{ticket.subject}</strong><span className="text-xs text-slate-500">Ticket #{ticket.id} · {formatDate(ticket.updated_at)}</span></span><span className="text-[10px] font-bold uppercase tracking-wide text-slate-500">{ticket.status}</span></div>) : <p className="text-sm text-slate-500">No support tickets.</p>}</div>
                <div className="mt-4 border-t border-slate-100 pt-3"><h4 className="mb-3 text-[10px] font-bold uppercase tracking-[.12em] text-slate-400">Access changes</h4>{details.status_history.length ? <ol className="space-y-3">{details.status_history.map((entry, index) => <li key={`${entry.created_at}-${index}`} className="relative border-l border-slate-200 pl-4"><span className="absolute -left-[4px] top-1 h-2 w-2 rounded-full bg-teal-600" /><p className="text-sm font-medium text-slate-800">{entry.previous_status} <ArrowUpRight className="mx-1 inline text-slate-400" size={12} /> {entry.new_status}</p><p className="mt-0.5 text-xs text-slate-500">{formatDate(entry.created_at)} · {entry.actor_name || entry.actor_email || 'System'}</p>{entry.reason && <p className="mt-1 text-xs leading-5 text-slate-600">{entry.reason}</p>}</li>)}</ol> : <p className="text-sm text-slate-500">No account access changes recorded.</p>}</div>
              </DetailSection>

              <DetailSection title="Preferences and account" icon={<Check size={16} />}>
                <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm"><DataPoint label="Email verified" value={details.student.email_verified_at ? 'Yes' : 'No'} /><DataPoint label="Theme" value={details.student.theme || 'system'} /><DataPoint label="Language" value={details.student.locale || 'en'} /><DataPoint label="Timezone" value={details.student.timezone || 'Asia/Kathmandu'} /><DataPoint label="Cursor" value={`${details.student.cursor_mode || 'default'} · ${details.student.cursor_size || 'medium'}`} /><DataPoint label="Member since" value={formatDate(details.student.created_at, true)} /></div>
                <div className="mt-4 border-t border-slate-100 pt-3"><h4 className="mb-2 text-[10px] font-bold uppercase tracking-[.12em] text-slate-400">Recent payment requests</h4>{details.recent_payments.length ? details.recent_payments.map((payment, index) => <div key={`${payment.created_at}-${index}`} className="flex items-center justify-between gap-3 border-b border-slate-50 py-2 last:border-0"><span><strong className="block text-sm font-medium text-slate-800">{payment.currency} {Number(payment.amount).toLocaleString()}</strong><span className="text-xs text-slate-500">{payment.provider}{payment.reference ? ` · ${payment.reference}` : ''} · {formatDate(payment.created_at)}</span></span><span className="text-[10px] font-bold uppercase tracking-wide text-slate-500">{payment.status}</span></div>) : <p className="text-sm text-slate-500">No payment requests.</p>}</div>
              </DetailSection>
            </div>
          </> : <div className="grid flex-1 place-items-center p-8 text-center text-sm text-slate-500">We couldn't load this student record. Close this panel and try again.</div>}
        </aside>
      </>}

      {action && <div className="fixed inset-0 z-[90] grid place-items-center bg-slate-950/45 p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setAction(null); }}>
        <form onSubmit={saveStatus} role="dialog" aria-modal="true" aria-labelledby="moderation-title" className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl sm:p-6">
          <div className="flex items-start justify-between gap-4"><div><p className="admin-eyebrow">Account access</p><h3 id="moderation-title" className="mt-1 text-xl font-semibold tracking-tight">{action.status === 'active' ? 'Restore student access' : action.status === 'banned' ? 'Ban this student' : 'Suspend this student'}</h3></div><button type="button" onClick={() => setAction(null)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" aria-label="Close"><X size={18} /></button></div>
          <p className="mt-2 text-sm leading-6 text-slate-600">{action.status === 'active' ? 'This restores sign-in. The student will need to log in again.' : action.status === 'banned' ? 'This blocks sign-in until an administrator restores access. All active sessions will be revoked.' : 'This blocks sign-in temporarily or until manually lifted. All active sessions will be revoked.'}</p>
          <div className="mt-4 rounded-xl bg-slate-50 px-3.5 py-3"><p className="text-sm font-semibold text-slate-800">{action.user.display_name || action.user.username}</p><p className="mt-0.5 text-xs text-slate-500">{action.user.email}</p></div>
          {action.status === 'suspended' && <label className="mt-4 grid gap-1.5 text-sm font-medium text-slate-700">Resume access at <span className="text-xs font-normal text-slate-500">Leave empty to keep suspended until manually restored.</span><input type="datetime-local" value={suspendedUntil} onChange={(event) => setSuspendedUntil(event.target.value)} className="mt-1 rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-teal-600" /></label>}
          {action.status !== 'active' && <label className="mt-4 grid gap-1.5 text-sm font-medium text-slate-700">Reason <span className="text-xs font-normal text-slate-500">Visible to administrators in the access history.</span><textarea required maxLength={500} rows={3} value={actionReason} onChange={(event) => setActionReason(event.target.value)} placeholder="Add a concise reason for this action" className="resize-y rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-teal-600" /></label>}
          {action.status === 'active' && <label className="mt-4 grid gap-1.5 text-sm font-medium text-slate-700">Note <span className="text-xs font-normal text-slate-500">Optional context for the audit history.</span><textarea maxLength={500} rows={2} value={actionReason} onChange={(event) => setActionReason(event.target.value)} placeholder="Access restored" className="resize-y rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-teal-600" /></label>}
          <div className="mt-5 flex justify-end gap-2"><button type="button" onClick={() => setAction(null)} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">Cancel</button><button disabled={saving} className={`rounded-xl px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60 ${action.status === 'banned' ? 'bg-rose-700 hover:bg-rose-800' : action.status === 'suspended' ? 'bg-amber-700 hover:bg-amber-800' : 'bg-teal-800 hover:bg-teal-900'}`}>{saving ? 'Saving…' : action.status === 'active' ? 'Restore access' : action.status === 'banned' ? 'Confirm ban' : 'Confirm suspension'}</button></div>
        </form>
      </div>}

      {deleteTarget && <div className="fixed inset-0 z-[90] grid place-items-center bg-slate-950/45 p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setDeleteTarget(null); }}>
        <form onSubmit={remove} role="dialog" aria-modal="true" aria-labelledby="delete-title" className="w-full max-w-md rounded-2xl border border-rose-100 bg-white p-5 shadow-2xl sm:p-6">
          <p className="text-xs font-bold uppercase tracking-[.16em] text-rose-700">Permanent access removal</p><h3 id="delete-title" className="mt-2 text-xl font-semibold tracking-tight text-slate-900">Remove this student?</h3><p className="mt-2 text-sm leading-6 text-slate-600">Their sessions will end and profile details will be anonymized. This cannot be undone.</p><p className="mt-3 rounded-xl bg-slate-50 px-3 py-2.5 text-sm font-semibold text-slate-800">{deleteTarget.email}</p>
          <label className="mt-4 grid gap-1.5 text-sm font-medium text-slate-700">Reason <span className="text-xs font-normal text-slate-500">Optional; kept in the access audit.</span><textarea maxLength={500} rows={2} value={deleteReason} onChange={(event) => setDeleteReason(event.target.value)} className="resize-y rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-rose-500" /></label>
          <label className="mt-3 grid gap-1.5 text-sm font-medium text-slate-700">Type DELETE to confirm<input autoFocus value={confirmation} onChange={(event) => setConfirmation(event.target.value)} className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-rose-500" /></label>
          <div className="mt-5 flex justify-end gap-2"><button type="button" onClick={() => setDeleteTarget(null)} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">Cancel</button><button disabled={saving || confirmation !== 'DELETE'} className="rounded-xl bg-rose-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-rose-800 disabled:cursor-not-allowed disabled:opacity-50">{saving ? 'Removing…' : 'Remove account'}</button></div>
        </form>
      </div>}
    </DashboardLayout>
  );
};

const StatusSummary = ({ label, count, color, tint }: { label: string; count: number; color: string; tint: string }) => <div className="flex items-center justify-between rounded-2xl border border-slate-200/80 bg-white px-4 py-3.5"><span><span className="block text-[10px] font-bold uppercase tracking-[.12em] text-slate-500">{label}</span><strong className="mt-1 block text-2xl font-semibold tracking-tight text-slate-900">{count.toLocaleString()}</strong></span><span className={`grid h-9 w-9 place-items-center rounded-xl ${tint} ${color}`}><UserRound size={17} /></span></div>;

const StatusBadge = ({ status }: { status: UserStatus }) => {
  const styles: Record<UserStatus, string> = { active: 'bg-emerald-50 text-emerald-800', suspended: 'bg-amber-50 text-amber-800', banned: 'bg-rose-50 text-rose-800', deleted: 'bg-slate-100 text-slate-600' };
  return <span className={`inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[10px] font-bold uppercase tracking-[.08em] ${styles[status]}`}><span className="h-1.5 w-1.5 rounded-full bg-current" />{status}</span>;
};

const StudentAvatar = ({ user, size }: { user: Pick<User, 'id' | 'display_name' | 'username' | 'email' | 'avatar_path'>; size: 'sm' | 'lg' }) => <span className={`relative grid shrink-0 place-items-center overflow-hidden rounded-xl bg-[#e0f2ed] font-semibold text-teal-900 ${size === 'sm' ? 'h-10 w-10 text-sm' : 'h-12 w-12 text-base'}`}><span>{(user.display_name || user.username || user.email || 'S').slice(0, 1).toUpperCase()}</span>{user.avatar_path && <img crossOrigin="use-credentials" src={`${API_BASE_URL}/admin/users/${user.id}/avatar`} alt="" className="absolute inset-0 h-full w-full object-cover" onError={(event) => { event.currentTarget.remove(); }} />}</span>;

const ActionButton = ({ label, icon, onClick, tone }: { label: string; icon: ReactNode; onClick: () => void; tone: 'green' | 'amber' | 'red' | 'plain' }) => {
  const styles = { green: 'border-emerald-200 text-emerald-800 hover:bg-emerald-50', amber: 'border-amber-200 text-amber-800 hover:bg-amber-50', red: 'border-rose-200 text-rose-800 hover:bg-rose-50', plain: 'border-slate-200 text-slate-600 hover:bg-slate-50' };
  return <button onClick={onClick} className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-2 text-xs font-semibold ${styles[tone]}`}>{icon}{label}</button>;
};

const DetailSection = ({ title, icon, children }: { title: string; icon: ReactNode; children: ReactNode }) => <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5"><h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-900"><span className="text-teal-800">{icon}</span>{title}</h3>{children}</section>;

const DetailRow = ({ icon, label, value }: { icon: ReactNode; label: string; value?: string | null }) => <div className="flex items-start gap-2.5 py-1.5"><span className="mt-0.5 text-slate-400">{icon}</span><span className="w-32 shrink-0 text-xs text-slate-500">{label}</span><span className="min-w-0 break-words text-sm font-medium text-slate-800">{value || '—'}</span></div>;

const DataPoint = ({ label, value }: { label: string; value: string | number }) => <div><p className="text-xs text-slate-500">{label}</p><p className="mt-1 font-semibold text-slate-800">{typeof value === 'number' ? value.toLocaleString() : value}</p></div>;

const Metric = ({ value, label, icon }: { value: number; label: string; icon: ReactNode }) => <div className="rounded-xl border border-slate-200 bg-white p-3"><div className="flex items-center justify-between text-teal-800">{icon}<span className="text-lg font-semibold tabular-nums text-slate-900">{Number(value || 0).toLocaleString()}</span></div><p className="mt-2 text-[10px] font-semibold leading-4 text-slate-500">{label}</p></div>;

const formatDate = (value?: string | null, dateOnly = false) => {
  if (!value) return '—';
  let parseValue = value;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) parseValue = `${value}T00:00:00Z`;
  else if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(value)) parseValue = `${value.replace(' ', 'T')}Z`;
  const date = new Date(parseValue);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat(undefined, dateOnly || value.length === 10 ? { dateStyle: 'medium' } : { dateStyle: 'medium', timeStyle: 'short' }).format(date);
};
