import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, Clock3, Lock, MessageSquareText, Send, UserRound } from 'lucide-react';
import toast from 'react-hot-toast';
import { apiRequest, jsonBody } from '../lib/api';

interface Reply { id: number; user_id: number; message: string; created_at: string; is_admin: boolean; }
interface Ticket { id: number; subject: string; message: string; status: 'open' | 'pending' | 'answered' | 'closed'; created_at: string; updated_at: string; replies: Reply[]; }

export default function SupportTicketDetailsPage() {
  const { ticketId } = useParams<{ ticketId: string }>();
  const navigate = useNavigate();
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [replies, setReplies] = useState<Reply[]>([]);
  const [reply, setReply] = useState('');
  const [showClose, setShowClose] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let active = true;
    if (!ticketId) return;
    apiRequest<{ ticket: Ticket }>(`/support/tickets/${ticketId}`)
      .then(({ ticket: detail }) => { if (active) { setTicket(detail); setReplies(detail.replies || []); } })
      .catch(() => { if (active) { toast.error('Support request could not be found.'); navigate('/support'); } });
    return () => { active = false; };
  }, [ticketId]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [replies]);

  const sendReply = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!reply.trim()) return;
    try {
      const { ticket: updated } = await apiRequest<{ ticket: Ticket }>(`/support/tickets/${ticketId}/replies`, { method: 'POST', body: jsonBody({ message: reply.trim() }) });
      setTicket(updated);
      setReplies(updated.replies || []);
      setReply('');
      toast.success('Reply sent.');
    } catch { toast.error('Reply could not be sent.'); }
  };

  const closeTicket = () => {
    if (!ticket) return;
    apiRequest<{ ticket: Ticket }>(`/support/tickets/${ticketId}/close`, { method: 'PATCH', body: jsonBody({}) })
      .then(({ ticket: closed }) => { setTicket(closed); setShowClose(false); toast.success('Request closed.'); })
      .catch(() => toast.error('Request could not be closed.'));
  };

  const statusLabel = ticket?.status === 'answered' ? 'Answered' : ticket?.status === 'closed' ? 'Closed' : 'Waiting for support';

  if (!ticket) return <div className="h-96 animate-pulse rounded-[2rem] bg-ink-100 dark:bg-white/[.04]" />;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <button onClick={() => navigate('/support')} className="group inline-flex items-center gap-2 text-xs font-semibold text-ink-500 transition hover:text-brand-700 dark:text-ink-400 dark:hover:text-brand-300"><ArrowLeft size={16} className="transition group-hover:-translate-x-1" /> Back to help center</button>

      <header className="grid gap-6 border-b border-ink-200 pb-8 dark:border-white/[.08] md:grid-cols-[1fr_auto] md:items-end">
        <div><div className="flex items-center gap-2"><span className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[.66rem] font-bold ${ticket.status === 'answered' ? 'bg-brand-50 text-brand-700 dark:bg-brand-400/10 dark:text-brand-300' : ticket.status === 'closed' ? 'bg-ink-100 text-ink-500 dark:bg-white/[.06]' : 'bg-amber-50 text-amber-700 dark:bg-amber-400/10 dark:text-amber-300'}`}><CheckCircle2 size={13} /> {statusLabel}</span><span className="font-metric text-[.65rem] text-ink-400">#{String(ticket.id).slice(-5)}</span></div><h1 className="mt-4 font-display text-3xl font-extrabold tracking-[-.05em] md:text-4xl">{ticket.subject}</h1><p className="mt-3 flex items-center gap-2 text-xs text-ink-400"><Clock3 size={14} /> Opened {new Date(ticket.created_at).toLocaleDateString()}</p></div>
        {ticket.status !== 'closed' && <button onClick={() => setShowClose(true)} className="auth-secondary self-start md:self-auto">Close request</button>}
      </header>

      <section className="min-h-[28rem] rounded-[1.5rem] border border-ink-200 bg-[#fbfaf7] p-5 dark:border-white/[.08] dark:bg-ink-900 md:p-7">
        <div className="max-w-[82%] space-y-2"><span className="flex items-center gap-2 text-[.7rem] font-semibold text-ink-500"><UserRound size={14} /> You · {new Date(ticket.created_at).toLocaleString()}</span><div className="rounded-2xl rounded-tl-sm bg-ink-100 px-5 py-4 text-sm leading-6 text-ink-700 dark:bg-white/[.06] dark:text-ink-200">{ticket.message}</div></div>
        <div className="my-8 flex items-center gap-3"><span className="h-px flex-1 bg-ink-200 dark:bg-white/[.07]" /><span className="font-metric text-[.6rem] uppercase tracking-wider text-ink-400">Conversation</span><span className="h-px flex-1 bg-ink-200 dark:bg-white/[.07]" /></div>
        <div className="space-y-6">{replies.map((item) => <div key={item.id} className={`max-w-[82%] space-y-2 ${item.is_admin ? 'ml-auto' : ''}`}><span className={`flex items-center gap-2 text-[.7rem] font-semibold text-ink-500 ${item.is_admin ? 'justify-end' : ''}`}>{item.is_admin ? <MessageSquareText size={14} /> : <UserRound size={14} />}{item.is_admin ? 'Note Library support' : 'You'} · {new Date(item.created_at).toLocaleString()}</span><div className={`rounded-2xl px-5 py-4 text-sm leading-6 ${item.is_admin ? 'rounded-tr-sm bg-brand-800 text-white' : 'rounded-tl-sm bg-ink-100 text-ink-700 dark:bg-white/[.06] dark:text-ink-200'}`}>{item.message}</div></div>)}</div>
        <div ref={endRef} />
      </section>

      {ticket.status === 'closed' ? <div className="flex items-center justify-center gap-2 rounded-2xl bg-ink-100 py-5 text-sm text-ink-500 dark:bg-white/[.05]"><Lock size={16} /> This conversation is closed.</div> : <form onSubmit={sendReply} className="flex gap-3 rounded-[1.5rem] border border-ink-200 bg-[#fbfaf7] p-3 dark:border-white/[.08] dark:bg-ink-900"><textarea value={reply} onChange={(event) => setReply(event.target.value)} rows={2} placeholder="Write a reply…" className="min-h-14 flex-1 resize-none bg-transparent px-3 py-2 text-sm outline-none" /><button disabled={!reply.trim()} className="grid w-14 place-items-center rounded-xl bg-brand-700 text-white transition hover:bg-brand-600 disabled:opacity-35 dark:bg-brand-400 dark:text-brand-950" aria-label="Send reply"><Send size={19} /></button></form>}

      {showClose && <div className="fixed inset-0 z-[60] grid place-items-center bg-ink-950/65 p-4 backdrop-blur-sm"><section role="dialog" aria-modal="true" className="anim-pop w-full max-w-sm rounded-[1.5rem] bg-[#fbfaf7] p-7 dark:bg-ink-900"><Lock className="text-ink-400" /><h2 className="mt-5 font-display text-xl font-semibold">Close this request?</h2><p className="mt-2 text-sm leading-6 text-ink-500">The conversation will stay visible, but you will no longer be able to reply.</p><div className="mt-7 flex gap-3"><button onClick={() => setShowClose(false)} className="auth-secondary flex-1">Keep open</button><button onClick={closeTicket} className="min-h-11 flex-1 rounded-xl bg-ink-900 text-xs font-bold text-white dark:bg-white dark:text-ink-950">Close request</button></div></section></div>}
    </div>
  );
}
