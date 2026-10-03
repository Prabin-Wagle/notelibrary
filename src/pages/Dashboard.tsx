import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Flame, Play, Clock3, ArrowRight, FileCheck2, Target, Award, CalendarDays } from 'lucide-react';
import { apiRequest } from '../lib/api';
import NepaliDate from 'nepali-date-converter';
import PomodoroTimer from '../components/PomodoroTimer';
import QuickActions from '../components/QuickActions';
import FocusFlow from '../components/FocusFlow';
import QuoteOfTheDay from '../components/QuoteOfTheDay';

interface ActiveQuiz {
  id: number;
  title: string;
  start_time: string;
  end_time: string;
  mode: 'LIVE';
}

interface UserStats {
  streak: number;
  completedTargets: number;
  activeQuizzes: ActiveQuiz[] | null;
}

interface QuizStats {
  totalQuizzes: number;
  avgScore: number;
  recentRank: string;
  completedTargets: number;
  streak: number;
}

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [userStats, setUserStats] = useState<UserStats | null>(null);
  const [quizStats, setQuizStats] = useState<QuizStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        const data = await apiRequest<UserStats & QuizStats>('/dashboard/summary');
        setUserStats(data);
        setQuizStats(data);
      } catch (error) {
        console.error('Dashboard data fetch failed:', error);
      } finally {
        setLoading(false);
      }
    };

    if (user?.id) fetchDashboardData();
  }, [user?.id]);

  if (loading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="flex flex-col items-center gap-4">
        <div className="h-8 w-8 rounded-full border-2 border-brand-500/20 border-t-brand-500 animate-spin" />
        <p className="dashboard-eyebrow text-ink-400 dark:text-ink-500">Preparing your workspace…</p>
      </div>
    </div>
  );

  const streak = userStats?.streak ?? 0;
  const totalQuizzes = quizStats?.totalQuizzes ?? 0;
  const avgScore = quizStats?.avgScore ?? 0;
  const rank = quizStats?.recentRank;
  const completedTargets = userStats?.completedTargets ?? 0;

  const validQuizzes = (userStats?.activeQuizzes ?? []).filter((quiz) => {
    const endTime = new Date(quiz.end_time.replace(' ', 'T'));
    return new Date() <= endTime;
  });

  const kpis = [
    { label: 'Day streak', value: String(streak), sub: streak > 0 ? 'Keep it alive' : 'Start today', icon: Flame, tone: 'text-brand-600 dark:text-brand-400 bg-brand-500/10' },
    { label: 'Tests taken', value: String(totalQuizzes), sub: totalQuizzes > 0 ? 'All time' : 'No attempts yet', icon: FileCheck2, tone: 'text-ink-500 dark:text-ink-400 bg-ink-100 dark:bg-white/[0.06]' },
    { label: 'Avg score', value: `${avgScore}%`, sub: avgScore > 0 ? 'Accuracy' : 'Take a test', icon: Target, tone: 'text-ink-500 dark:text-ink-400 bg-ink-100 dark:bg-white/[0.06]' },
    { label: 'Goals today', value: String(completedTargets), sub: completedTargets > 0 ? 'Completed' : 'Plan below', icon: ArrowRight, tone: 'text-ink-500 dark:text-ink-400 bg-ink-100 dark:bg-white/[0.06]' },
  ];

  return (
    <div className="space-y-6 anim-fade">

      {/* ── Header ─────────────────────────────────────────────── */}
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="max-w-xl">
          <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-brand-700 dark:text-brand-300">
            <p className="dashboard-eyebrow">{now.toLocaleDateString('en-NP', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Asia/Kathmandu' })} · {now.toLocaleTimeString('en-NP', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kathmandu' })} NPT</p>
            <span className="inline-flex items-center gap-1.5 rounded-lg bg-brand-500/10 px-2 py-1 text-[.65rem] font-semibold text-brand-800 dark:text-brand-200" title="Bikram Sambat date"><CalendarDays size={13} />{new NepaliDate(now).format('DD MMMM YYYY')}</span>
          </div>
          <h1 className="font-display text-2xl sm:text-[1.75rem] font-bold text-ink-900 dark:text-white tracking-[-0.03em] leading-tight">
            Good to see you, {user?.name.split(' ')[0]}.
          </h1>
          <p className="mt-1.5 text-sm text-ink-500 dark:text-ink-400">Here's where you stand and what's next.</p>
        </div>

        {rank && (
          <div className="flex items-center gap-2 h-10 px-3.5 rounded-xl bg-brand-500/10 border border-brand-500/20">
            <Award size={15} className="text-brand-600 dark:text-brand-400" />
            <span className="font-display text-xs font-bold text-brand-700 dark:text-brand-400 tracking-wide uppercase">{rank} tier</span>
          </div>
        )}
      </header>

      {/* ── KPI strip ──────────────────────────────────────────── */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {kpis.map((kpi) => (
          <div key={kpi.label} className="surface-card p-4 sm:p-5">
            <div className="flex items-start justify-between gap-2 mb-3">
              <p className="dashboard-eyebrow text-ink-400 dark:text-ink-500 !text-[0.5625rem] leading-relaxed">{kpi.label}</p>
              <div className={`grid place-items-center h-7 w-7 rounded-lg shrink-0 ${kpi.tone}`}>
                <kpi.icon size={14} />
              </div>
            </div>
            <p className="font-metric text-[1.65rem] leading-none font-bold text-ink-900 dark:text-white tabular-nums">{kpi.value}</p>
            <p className="mt-2 text-xs text-ink-400 dark:text-ink-500">{kpi.sub}</p>
            {kpi.label === 'Avg score' && (
              <div className="mt-3 h-1 rounded-full bg-ink-100 dark:bg-white/[0.08] overflow-hidden">
                <div className="h-full bg-brand-500 rounded-full transition-all duration-700" style={{ width: `${Math.min(avgScore, 100)}%` }} />
              </div>
            )}
          </div>
        ))}
      </section>

      {/* ── Test alerts — flat rows ────────────────────────────── */}
      {validQuizzes.length > 0 && (
        <section className="space-y-2.5">
          {validQuizzes.map((quiz) => {
            const startTime = new Date(`${quiz.start_time.replace(' ', 'T')}Z`);
            const endTime = new Date(`${quiz.end_time.replace(' ', 'T')}Z`);
            const now = new Date();
            const isActive = now >= startTime && now <= endTime;

            return (
              <div
                key={quiz.id}
                className={`surface-card flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-5 px-5 py-4 anim-rise ${isActive
                  ? '!border-red-300 dark:!border-red-500/30 bg-red-50/50 dark:bg-red-500/[0.04]'
                  : ''
                  }`}
              >
                <span className={`dashboard-eyebrow flex items-center gap-1.5 px-2.5 py-1 rounded-md !text-[0.5625rem] shrink-0 ${isActive
                  ? 'bg-red-600 text-white'
                  : 'bg-brand-500/10 text-brand-700 dark:text-brand-400'
                  }`}>
                  <span className={`h-1.5 w-1.5 rounded-full bg-current ${isActive ? 'animate-pulse' : ''}`} />
                  {isActive ? 'Live now' : 'Upcoming'}
                </span>

                <div className="flex-1 min-w-0">
                  <h3 className="font-display text-sm font-semibold text-ink-900 dark:text-white truncate">{quiz.title}</h3>
                  <p className="mt-0.5 flex items-center gap-1.5 text-xs text-ink-400 dark:text-ink-500">
                    <Clock3 size={11} />
                    <span className="font-metric">
                      {isActive
                        ? `Ends ${endTime.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hour12: true })}`
                        : `${startTime.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })} · ${startTime.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hour12: true })}`}
                    </span>
                  </p>
                </div>

                {isActive ? (
                  <button
                    onClick={() => navigate(`/test-series/quiz/${quiz.id}`)}
                    className="group flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-display text-xs font-bold tracking-wide transition-colors active:scale-[0.98] shrink-0"
                  >
                    <Play size={12} fill="currentColor" />
                    Take quiz
                    <ArrowRight size={12} className="group-hover:translate-x-0.5 transition-transform" />
                  </button>
                ) : (
                  <span className="hidden sm:block text-xs text-ink-400 dark:text-ink-500 shrink-0">Not started</span>
                )}
              </div>
            );
          })}
        </section>
      )}

      {/* ── Main board: plan + focus rail ──────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        <section className="lg:col-span-8 min-w-0">
          <FocusFlow />
        </section>
        <section className="lg:col-span-4 min-w-0">
          <PomodoroTimer />
        </section>
      </div>

      {/* ── Quick actions ──────────────────────────────────────── */}
      <section>
        <h2 className="dashboard-eyebrow text-ink-400 dark:text-ink-500 mb-3 px-1">Jump back in</h2>
        <QuickActions />
      </section>

      {/* ── Quote — closing band ───────────────────────────────── */}
      <QuoteOfTheDay />
    </div>
  );
}
