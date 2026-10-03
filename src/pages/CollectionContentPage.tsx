import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, BookOpen, CheckCircle2, Clock3, History, LockKeyhole } from 'lucide-react';
import { apiRequest } from '../lib/api';
import PaymentModal from '../components/TestSeries/PaymentModal';

interface Quiz {
  id: number;
  title: string;
  description: string | null;
  duration_seconds: number | null;
  total_marks: number;
  question_count: number;
  negative_marking: number;
  delivery_mode: string;
  starts_at: string | null;
  ends_at: string | null;
  attempt_count: number;
  latest_attempt_id: number | null;
}

interface Collection {
  id: number;
  title: string;
  description: string | null;
  price: number;
  discount_price: number | null;
  has_access: boolean | number;
  has_pending_payment?: boolean | number;
  quizzes: Quiz[];
}

export default function CollectionContentPage() {
  const { collectionId } = useParams<{ collectionId: string }>();
  const navigate = useNavigate();
  const [collection, setCollection] = useState<Collection | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [checkoutOpen, setCheckoutOpen] = useState(false);

  const refreshCollection = () => {
    if (!collectionId) return;
    apiRequest<{ collection: Collection }>(`/quiz-collections/${collectionId}`).then(({ collection: next }) => setCollection(next)).catch(() => undefined);
  };

  useEffect(() => {
    if (!collectionId) return;
    let active = true;
    setLoading(true);
    apiRequest<{ collection: Collection }>(`/quiz-collections/${collectionId}`)
      .then(({ collection: data }) => { if (active) setCollection(data); })
      .catch((reason: unknown) => { if (active) setError(reason instanceof Error ? reason.message : 'Collection could not be loaded.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [collectionId]);

  const quizzes = useMemo(() => (collection?.quizzes || []).filter((quiz) => quiz.title.toLowerCase().includes(query.toLowerCase())), [collection, query]);

  if (loading) return <div className="mx-auto max-w-6xl space-y-5"><div className="h-52 animate-pulse rounded-[2rem] bg-ink-100 dark:bg-white/[.05]" /><div className="grid gap-4 md:grid-cols-2"><div className="h-56 animate-pulse rounded-2xl bg-ink-100 dark:bg-white/[.05]" /><div className="h-56 animate-pulse rounded-2xl bg-ink-100 dark:bg-white/[.05]" /></div></div>;

  if (error || !collection) return <main className="mx-auto grid min-h-[55vh] max-w-xl place-items-center px-5 text-center"><section><h1 className="font-display text-2xl font-bold">Collection unavailable</h1><p className="mt-2 text-sm text-ink-500 dark:text-ink-400">{error || 'This collection is no longer available.'}</p><button onClick={() => navigate('/test-series')} className="auth-secondary mt-6">Back to test series</button></section></main>;

  const canStart = Boolean(Number(collection.has_access));
  const price = Number(collection.discount_price ?? collection.price);

  return <div className="mx-auto max-w-6xl space-y-8">
    <button onClick={() => navigate('/test-series')} className="group inline-flex items-center gap-2 text-xs font-semibold text-ink-500 transition hover:text-brand-700 dark:text-ink-400 dark:hover:text-brand-300"><ArrowLeft size={16} className="transition group-hover:-translate-x-1" /> All test series</button>
    <header className="grid gap-6 border-b border-ink-200 pb-8 dark:border-white/[.08] md:grid-cols-[1fr_auto] md:items-end">
      <div><p className="dashboard-eyebrow text-brand-700 dark:text-brand-300">Test series · {collection.quizzes.length} sets</p><h1 className="mt-3 max-w-3xl font-display text-4xl font-extrabold tracking-[-.055em] md:text-5xl">{collection.title}</h1><p className="mt-4 max-w-2xl text-sm leading-7 text-ink-500 dark:text-ink-400">{collection.description || 'Choose a test, work through each question, then review your saved result and explanations.'}</p></div>
      <div className="rounded-2xl border border-ink-200 bg-[#fbfaf7] px-5 py-4 dark:border-white/[.08] dark:bg-ink-900"><p className="text-xs font-semibold text-ink-500">Collection access</p><p className="mt-1 font-display text-lg font-bold">{canStart ? 'Ready to practise' : price === 0 ? 'Not available' : `Rs. ${price}`}</p></div>
    </header>

    {!canStart && <aside className="flex flex-col gap-4 rounded-2xl border border-amber-300/60 bg-amber-50 p-5 text-amber-950 dark:border-amber-400/15 dark:bg-amber-400/[.06] dark:text-amber-100 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-start gap-3"><LockKeyhole size={19} className="mt-0.5 shrink-0" /><div><h2 className="text-sm font-bold">{Number(collection.has_pending_payment) ? 'Payment request under review' : 'Unlock this test series'}</h2><p className="mt-1 text-xs leading-5 opacity-75">{Number(collection.has_pending_payment) ? 'Your payment reference is waiting for administrator review. Access opens after it is approved.' : 'Buy access to the complete test series. You can preview published tests before enrolling.'}</p></div></div><div className="flex shrink-0 gap-2">{!Number(collection.has_pending_payment) && price > 0 && <button onClick={() => setCheckoutOpen(true)} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-brand-700 px-4 text-xs font-bold text-white transition hover:bg-brand-600 dark:bg-brand-400 dark:text-brand-950">Buy access · Rs. {price}<ArrowRight size={14} /></button>}<button onClick={() => navigate('/support')} className="auth-secondary">Contact support</button></div></aside>}

    <section className="space-y-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="dashboard-eyebrow text-ink-400">Published tests</p><h2 className="mt-2 font-display text-2xl font-bold tracking-[-.04em]">Choose a practice set</h2></div><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search tests" className="w-full rounded-xl border border-ink-200 bg-[#fbfaf7] px-4 py-3 text-sm outline-none focus:border-brand-500 dark:border-white/[.08] dark:bg-ink-900 sm:max-w-xs" /></div>
      {quizzes.length ? <div className="grid gap-4 md:grid-cols-2">{quizzes.map((quiz, index) => <article key={quiz.id} className="flex min-h-64 flex-col justify-between rounded-[1.5rem] border border-ink-200 bg-[#fbfaf7] p-6 dark:border-white/[.08] dark:bg-ink-900"><div><div className="flex items-center justify-between"><span className="font-metric text-[.65rem] font-bold uppercase tracking-[.16em] text-brand-700 dark:text-brand-300">Set {String(index + 1).padStart(2, '0')}</span>{quiz.attempt_count > 0 && <span className="inline-flex items-center gap-1.5 text-[.65rem] font-bold text-brand-700 dark:text-brand-300"><CheckCircle2 size={13} /> {quiz.attempt_count} attempts</span>}</div><h3 className="mt-5 font-display text-2xl font-bold tracking-[-.04em]">{quiz.title}</h3><p className="mt-2 text-sm leading-6 text-ink-500 dark:text-ink-400">{quiz.description || 'Review your answers and explanations after submitting.'}</p><div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-xs text-ink-500 dark:text-ink-400"><span className="inline-flex items-center gap-1.5"><Clock3 size={14} /> {quiz.duration_seconds ? `${Math.ceil(Number(quiz.duration_seconds) / 60)} min` : 'No time limit'}</span><span>{quiz.question_count} questions</span><span><BookOpen size={13} className="mr-1 inline" />{Number(quiz.total_marks).toFixed(1)} marks</span></div></div><div className="mt-7 flex flex-wrap gap-2"><button disabled={!canStart} onClick={() => navigate(`/test-series/quiz/${quiz.id}?collectionId=${collection.id}`)} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-ink-900 px-5 text-xs font-bold text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-45 dark:bg-brand-400 dark:text-brand-950">{canStart ? quiz.attempt_count ? 'Try again' : 'Start test' : 'Locked'} <ArrowRight size={15} /></button>{quiz.latest_attempt_id && <><button onClick={() => navigate(`/test-series/result/${quiz.latest_attempt_id}`)} className="auth-secondary">Latest result</button><button onClick={() => navigate(`/test-series/history/${quiz.id}`)} className="auth-secondary"><History size={14} /> History</button></>}</div></article>)}</div> : <div className="rounded-[1.5rem] border border-dashed border-ink-300 px-6 py-14 text-center dark:border-white/10"><BookOpen className="mx-auto text-ink-300" /><h3 className="mt-4 font-display text-xl font-semibold">No published tests in this collection</h3><p className="mt-2 text-sm text-ink-500">New practice sets will appear here after they are published.</p></div>}
    </section>
    <PaymentModal isOpen={checkoutOpen} onClose={() => setCheckoutOpen(false)} collectionId={collection.id} collectionTitle={collection.title} price={price} onSuccess={refreshCollection} />
  </div>;
}
