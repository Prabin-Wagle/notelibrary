import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, CheckCircle2, Clock3, LifeBuoy, MessageSquareText, Plus, Search, Send, TicketCheck } from 'lucide-react';
import toast from 'react-hot-toast';
import { apiRequest, jsonBody } from '../lib/api';

interface SupportTicket {
  id: number;
  subject: string;
  message: string;
  admin_reply: string | null;
  status: 'open' | 'pending' | 'answered' | 'closed';
  created_at: string;
  updated_at: string;
}

export default function HelpCenterPage() {
  const navigate = useNavigate();
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [query, setQuery] = useState('');
  const [showComposer, setShowComposer] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadTickets = async () => {
    setLoading(true);
    try {
      const response = await apiRequest<{ tickets: SupportTicket[] }>('/support/tickets');
      setTickets(response.tickets || []);
    } catch {
      toast.error('Could not load your support requests. Try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadTickets(); }, []);

  const filtered = useMemo(() => tickets.filter((ticket) =>
    `${ticket.subject} ${ticket.message}`.toLowerCase().includes(query.toLowerCase())
  ), [tickets, query]);

  const createTicket = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!subject.trim() || !message.trim()) {
      toast.error('Add a subject and a short description.');
      return;
    }
    try {
      const { ticket } = await apiRequest<{ ticket: SupportTicket }>('/support/tickets', {
        method: 'POST', body: jsonBody({ subject: subject.trim(), message: message.trim() }),
      });
      setTickets((current) => [ticket, ...current]);
      setSubject('');
      setMessage('');
      setShowComposer(false);
      toast.success('Your request was sent to support.');
    } catch {
      toast.error('Your request could not be sent. Please try again.');
    }
  };

  const statusMeta = (status: SupportTicket['status']) => {
    if (status === 'answered') return { label: 'Answered', icon: CheckCircle2, className: 'text-brand-700 bg-brand-50 dark:bg-brand-400/10 dark:text-brand-300' };
    if (status === 'closed') return { label: 'Closed', icon: TicketCheck, className: 'text-ink-500 bg-ink-100 dark:bg-white/[.06] dark:text-ink-300' };
    return { label: 'Waiting', icon: Clock3, className: 'text-amber-700 bg-amber-50 dark:bg-amber-400/10 dark:text-amber-300' };
  };

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <header className="grid gap-6 rounded-[2rem] bg-ink-900 p-7 text-white dark:bg-white/[.045] md:grid-cols-[1fr_auto] md:items-end md:p-10">
        <div>
          <span className="inline-flex items-center gap-2 font-metric text-[.68rem] font-bold uppercase tracking-[.2em] text-brand-300"><LifeBuoy size={15} /> Help center</span>
          <h1 className="mt-4 max-w-2xl font-display text-4xl font-extrabold tracking-[-.05em] md:text-5xl">Questions, requests, and replies in one place.</h1>
          <p className="mt-4 max-w-xl text-sm leading-7 text-ink-300">Create a request and follow the conversation with the support team. Your messages stay with your account across devices.</p>
        </div>
        <button onClick={() => setShowComposer((value) => !value)} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-brand-400 px-5 font-display text-sm font-bold text-brand-950 transition hover:bg-brand-300 active:scale-[.98]"><Plus size={18} /> New request</button>
      </header>

      {showComposer && (
        <section className="anim-pop grid gap-8 rounded-[2rem] border border-ink-200 bg-[#fbfaf7] p-6 dark:border-white/[.08] dark:bg-ink-900 md:grid-cols-[.72fr_1.28fr] md:p-8">
          <div>
            <p className="dashboard-eyebrow text-brand-700 dark:text-brand-300">Start a conversation</p>
            <h2 className="mt-3 font-display text-2xl font-bold tracking-[-.04em]">What do you need help with?</h2>
            <p className="mt-3 text-sm leading-6 text-ink-500 dark:text-ink-400">Include the page or feature you were using and what you expected to happen.</p>
          </div>
          <form onSubmit={createTicket} className="space-y-4">
            <label className="block"><span className="mb-2 block text-xs font-semibold text-ink-600 dark:text-ink-300">Subject</span><input value={subject} onChange={(event) => setSubject(event.target.value)} placeholder="e.g. Reviewing a test attempt" className="w-full rounded-xl border border-ink-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-brand-500 focus:ring-4 focus:ring-brand-500/10 dark:border-white/10 dark:bg-white/[.04]" /></label>
            <label className="block"><span className="mb-2 block text-xs font-semibold text-ink-600 dark:text-ink-300">Details</span><textarea value={message} onChange={(event) => setMessage(event.target.value)} rows={5} placeholder="Tell us what happened…" className="w-full resize-none rounded-xl border border-ink-200 bg-white px-4 py-3 text-sm leading-6 outline-none transition focus:border-brand-500 focus:ring-4 focus:ring-brand-500/10 dark:border-white/10 dark:bg-white/[.04]" /></label>
            <div className="flex justify-end gap-3"><button type="button" onClick={() => setShowComposer(false)} className="auth-secondary">Cancel</button><button className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-brand-700 px-5 text-xs font-bold text-white transition hover:bg-brand-600 active:scale-[.98] dark:bg-brand-400 dark:text-brand-950"><Send size={15} /> Save request</button></div>
          </form>
        </section>
      )}

      <section>
        <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div><p className="dashboard-eyebrow text-ink-400">Your conversations</p><h2 className="mt-2 font-display text-2xl font-bold tracking-[-.035em]">{tickets.length} {tickets.length === 1 ? 'request' : 'requests'}</h2></div>
          <label className="relative block w-full sm:max-w-xs"><Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search requests" className="w-full rounded-xl border border-ink-200 bg-[#fbfaf7] py-3 pl-10 pr-4 text-sm outline-none transition focus:border-brand-500 dark:border-white/[.08] dark:bg-white/[.04]" /></label>
        </div>

        {loading ? <div className="grid gap-3">{[1, 2].map((item) => <div key={item} className="h-28 animate-pulse rounded-2xl bg-ink-100 dark:bg-white/[.04]" />)}</div> : filtered.length ? (
          <div className="divide-y divide-ink-200 overflow-hidden rounded-[1.5rem] border border-ink-200 bg-[#fbfaf7] dark:divide-white/[.07] dark:border-white/[.08] dark:bg-ink-900">
            {filtered.map((ticket) => { const meta = statusMeta(ticket.status); const StatusIcon = meta.icon; return (
              <button key={ticket.id} onClick={() => navigate(`/support-tickets/${ticket.id}`)} className="group grid w-full gap-4 p-5 text-left transition hover:bg-brand-50/60 dark:hover:bg-brand-500/[.05] sm:grid-cols-[auto_1fr_auto] sm:items-center md:p-6">
                <span className="grid h-11 w-11 place-items-center rounded-xl bg-ink-100 text-ink-500 transition group-hover:bg-brand-100 group-hover:text-brand-800 dark:bg-white/[.05] dark:text-ink-300"><MessageSquareText size={19} /></span>
                <span className="min-w-0"><strong className="block truncate font-display text-base font-semibold text-ink-900 dark:text-white">{ticket.subject}</strong><span className="mt-1 block truncate text-sm text-ink-500 dark:text-ink-400">{ticket.message}</span><span className="mt-2 block font-metric text-[.62rem] uppercase tracking-wider text-ink-400">#{String(ticket.id).slice(-5)} · {new Date(ticket.updated_at).toLocaleDateString()}</span></span>
                <span className="flex items-center gap-3"><span className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[.66rem] font-bold ${meta.className}`}><StatusIcon size={13} /> {meta.label}</span><ArrowRight size={17} className="text-ink-300 transition group-hover:translate-x-1 group-hover:text-brand-600" /></span>
              </button>
            ); })}
          </div>
        ) : (
          <div className="rounded-[1.5rem] border border-dashed border-ink-300 px-6 py-14 text-center dark:border-white/10"><MessageSquareText className="mx-auto text-ink-300" size={30} /><h3 className="mt-4 font-display text-lg font-semibold">No matching requests</h3><p className="mt-2 text-sm text-ink-500">Create a new request or try a different search.</p></div>
        )}
      </section>
    </div>
  );
}
