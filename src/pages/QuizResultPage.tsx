import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Award, Check, HelpCircle, Clock3, RotateCcw, Target, X } from 'lucide-react';
import { LatexRenderer } from '../components/latexRender';
import { apiRequest } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';

interface ResultAnswer {
  question_id: number;
  question_text: string;
  explanation: string | null;
  marks: number;
  negative_marks: number;
  selected_option_id: number | null;
  selected_option_text: string | null;
  is_correct: boolean | number | null;
  marks_awarded: number | null;
  correct_option_text: string | null;
}

interface QuizResult {
  id: number;
  quiz_id: number;
  status: string;
  started_at: string;
  submitted_at: string;
  score: number;
  maximum_score: number;
  duration_seconds: number;
  title: string;
  pass_marks: number | null;
  answers: ResultAnswer[];
}

const number = (value: number | string | null | undefined) => Number(value || 0);

export default function QuizResultPage() {
  const { attemptId } = useParams<{ attemptId: string }>();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const [result, setResult] = useState<QuizResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isAuthenticated || !attemptId) return;
    let active = true;
    setLoading(true);
    apiRequest<{ result: QuizResult }>(`/quiz-attempts/${attemptId}/result`)
      .then(({ result: response }) => { if (active) setResult(response); })
      .catch((reason: unknown) => {
        if (active) setError(reason instanceof Error ? reason.message : 'We could not load this result.');
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [attemptId, isAuthenticated]);

  const stats = useMemo(() => {
    const answers = result?.answers || [];
    const correct = answers.filter((answer) => Number(answer.is_correct) === 1).length;
    const wrong = answers.filter((answer) => answer.selected_option_id !== null && Number(answer.is_correct) !== 1).length;
    const attempted = correct + wrong;
    return { correct, wrong, attempted, skipped: answers.length - attempted, accuracy: attempted ? Math.round(correct / attempted * 100) : 0 };
  }, [result]);

  if (loading) return <main className="mx-auto max-w-5xl space-y-5 px-4 py-10"><div className="h-56 animate-pulse rounded-[2rem] bg-ink-100 dark:bg-white/[.05]" /><div className="h-32 animate-pulse rounded-[2rem] bg-ink-100 dark:bg-white/[.05]" /></main>;
  if (error || !result) return <main className="mx-auto grid min-h-[60vh] max-w-xl place-items-center px-5 text-center"><section><HelpCircle className="mx-auto text-ink-400" size={34} /><h1 className="mt-5 font-display text-2xl font-bold">Result unavailable</h1><p className="mt-2 text-sm leading-6 text-ink-500 dark:text-ink-400">{error || 'This attempt may still be processing, or it may not belong to this account.'}</p><button onClick={() => navigate('/test-series')} className="auth-secondary mt-6">Back to test series</button></section></main>;

  const passed = result.pass_marks == null || number(result.score) >= number(result.pass_marks);
  const minutes = Math.floor(number(result.duration_seconds) / 60);
  const seconds = Math.floor(number(result.duration_seconds) % 60);
  const percentage = result.maximum_score ? Math.max(0, Math.round(number(result.score) / number(result.maximum_score) * 100)) : 0;

  return (
    <main className="mx-auto max-w-6xl space-y-8 px-4 pb-14 pt-7 md:px-8">
      <button onClick={() => navigate('/test-series')} className="group inline-flex items-center gap-2 text-sm font-semibold text-ink-500 transition hover:text-brand-700 dark:text-ink-400 dark:hover:text-brand-300"><ArrowLeft size={17} className="transition group-hover:-translate-x-1" /> Test series</button>

      <section className="relative isolate overflow-hidden rounded-[2rem] bg-ink-900 px-6 py-8 text-white dark:bg-white/[.055] md:px-10 md:py-11">
        <div className="pointer-events-none absolute -right-20 -top-24 -z-10 h-80 w-80 rounded-full bg-brand-400/15 blur-3xl" />
        <div className="grid gap-8 md:grid-cols-[1fr_auto] md:items-end">
          <div>
            <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-bold ${passed ? 'bg-brand-400/15 text-brand-200' : 'bg-amber-400/15 text-amber-200'}`}><Award size={14} /> {passed ? 'Attempt complete' : 'Keep building your score'}</span>
            <h1 className="mt-5 max-w-3xl font-display text-3xl font-extrabold tracking-[-.045em] md:text-5xl">{result.title}</h1>
            <p className="mt-3 max-w-xl text-sm leading-6 text-ink-300">Submitted {new Date(result.submitted_at).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}</p>
          </div>
          <div className="flex items-end gap-3 md:text-right"><strong className="font-display text-6xl font-extrabold tracking-[-.06em] tabular-nums">{number(result.score).toFixed(1)}</strong><span className="pb-2 text-sm text-ink-300">/ {number(result.maximum_score).toFixed(1)} marks</span></div>
        </div>
        <div className="mt-8 h-2 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-brand-300 transition-[width] duration-700" style={{ width: `${Math.min(100, percentage)}%` }} /></div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: 'Accuracy', value: `${stats.accuracy}%`, detail: 'of attempted questions', icon: Target },
          { label: 'Correct', value: stats.correct, detail: 'answers earned marks', icon: Check },
          { label: 'Incorrect', value: stats.wrong, detail: 'answers to revisit', icon: X },
          { label: 'Time spent', value: `${minutes}:${String(seconds).padStart(2, '0')}`, detail: `${stats.skipped} left unanswered`, icon: Clock3 },
        ].map(({ label, value, detail, icon: Icon }) => <article key={label} className="rounded-2xl border border-ink-200 bg-[#fbfaf7] p-5 dark:border-white/[.08] dark:bg-ink-900"><div className="flex items-center justify-between text-ink-400"><span className="text-xs font-semibold">{label}</span><Icon size={17} /></div><p className="mt-3 font-display text-3xl font-bold tracking-[-.04em] tabular-nums">{value}</p><p className="mt-1 text-xs text-ink-500 dark:text-ink-400">{detail}</p></article>)}
      </section>

      <section>
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3"><div><p className="dashboard-eyebrow text-brand-700 dark:text-brand-300">Review</p><h2 className="mt-2 font-display text-2xl font-bold tracking-[-.04em]">Question-by-question</h2></div><button onClick={() => navigate(`/test-series/quiz/${result.quiz_id}`)} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-ink-200 px-4 text-xs font-bold transition hover:border-brand-500 dark:border-white/10"><RotateCcw size={14} /> Try again</button></div>
        <div className="space-y-3">
          {result.answers.map((answer, index) => {
            const correct = Number(answer.is_correct) === 1;
            const skipped = answer.selected_option_id === null;
            return <article key={answer.question_id} className="overflow-hidden rounded-2xl border border-ink-200 bg-[#fbfaf7] dark:border-white/[.08] dark:bg-ink-900">
              <div className="flex items-start gap-4 p-5 md:p-6">
                <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl text-sm font-bold ${correct ? 'bg-brand-100 text-brand-800 dark:bg-brand-400/15 dark:text-brand-200' : skipped ? 'bg-ink-100 text-ink-500 dark:bg-white/[.06]' : 'bg-rose-100 text-rose-800 dark:bg-rose-400/10 dark:text-rose-300'}`}>{index + 1}</span>
                <div className="min-w-0 flex-1">
                  <div className="mb-3 flex flex-wrap items-center gap-2"><span className={`text-[.65rem] font-bold uppercase tracking-[.12em] ${correct ? 'text-brand-700 dark:text-brand-300' : skipped ? 'text-ink-400' : 'text-rose-700 dark:text-rose-300'}`}>{correct ? 'Correct' : skipped ? 'Skipped' : 'Review this answer'}</span><span className="text-xs text-ink-400">{number(answer.marks_awarded).toFixed(1)} / {number(answer.marks).toFixed(1)} marks</span></div>
                  <div className="font-medium leading-7 text-ink-900 dark:text-white"><LatexRenderer>{answer.question_text}</LatexRenderer></div>
                  <div className="mt-4 grid gap-2 sm:grid-cols-2">
                    <div className={`rounded-xl px-4 py-3 text-sm ${correct ? 'bg-brand-50 text-brand-900 dark:bg-brand-400/10 dark:text-brand-100' : skipped ? 'bg-ink-100 text-ink-500 dark:bg-white/[.04]' : 'bg-rose-50 text-rose-900 dark:bg-rose-400/10 dark:text-rose-100'}`}><span className="mb-1 block text-[.65rem] font-bold uppercase tracking-wider opacity-65">Your answer</span>{answer.selected_option_text || 'Not answered'}</div>
                    {!correct && <div className="rounded-xl bg-brand-50 px-4 py-3 text-sm text-brand-900 dark:bg-brand-400/10 dark:text-brand-100"><span className="mb-1 block text-[.65rem] font-bold uppercase tracking-wider opacity-65">Correct answer</span>{answer.correct_option_text || 'Not available'}</div>}
                  </div>
                  {answer.explanation && <p className="mt-4 border-t border-ink-200 pt-4 text-sm leading-6 text-ink-600 dark:border-white/[.07] dark:text-ink-300"><span className="mr-2 font-semibold text-ink-800 dark:text-ink-100">Explanation</span><LatexRenderer>{answer.explanation}</LatexRenderer></p>}
                </div>
              </div>
            </article>;
          })}
          {!result.answers.length && <p className="rounded-2xl border border-dashed border-ink-300 p-8 text-center text-sm text-ink-500 dark:border-white/10">This attempt has no recorded questions to review.</p>}
        </div>
      </section>
    </main>
  );
}
