import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, GraduationCap, Library, School, Sparkles } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { fetchCompetitiveSubjects, fetchSubjects } from '../utils/api';
import type { Subject } from '../types/resources';

type ViewMode = 'selection' | 'class' | 'competitive';

const subjectCopy: Record<string, string> = {
  Physics: 'Motion, forces, energy and the laws behind the physical world.',
  Chemistry: 'Matter, reactions and the patterns connecting each element.',
  Mathematics: 'Build fluency through concepts, proofs and worked problems.',
  English: 'Read closely, communicate clearly and write with confidence.',
};

export default function SubjectResources() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>('selection');

  useEffect(() => {
    if (user && (!user.competition || user.competition.toLowerCase() === 'none')) setViewMode('class');
  }, [user]);

  useEffect(() => {
    if (!user || viewMode === 'selection') { setLoading(false); return; }
    setLoading(true);
    const request = viewMode === 'class' ? fetchSubjects(user.class, user.faculty) : fetchCompetitiveSubjects(user.competition);
    request.then(setSubjects).finally(() => setLoading(false));
  }, [user, viewMode]);

  const openSubject = (subject: Subject) => {
    const root = viewMode === 'competitive' ? '/competitive' : '/subjects';
    navigate(`${root}/${encodeURIComponent(subject.subject_name)}`, { state: { subject } });
  };

  if (loading) return <div className="grid min-h-[60vh] place-items-center"><div className="w-full max-w-5xl space-y-4">{[1, 2, 3].map((item) => <div key={item} className="h-28 animate-pulse rounded-2xl bg-ink-100 dark:bg-white/[.04]" />)}</div></div>;

  if (viewMode === 'selection') return (
    <div className="mx-auto max-w-6xl space-y-8">
      <header><p className="dashboard-eyebrow text-brand-700 dark:text-brand-300">Study library</p><h1 className="mt-3 max-w-3xl font-display text-4xl font-extrabold tracking-[-.05em] md:text-5xl">Choose the path you are studying today.</h1><p className="mt-4 max-w-2xl text-sm leading-7 text-ink-500 dark:text-ink-400">Move between your class curriculum and entrance preparation without losing your place.</p></header>
      <div className="grid gap-4 md:grid-cols-[1.25fr_.75fr]">
        <button onClick={() => setViewMode('class')} className="group min-h-72 rounded-[2rem] border border-ink-200 bg-[#fbfaf7] p-7 text-left text-ink-900 transition hover:-translate-y-1 hover:border-brand-400 dark:border-white/[.08] dark:bg-ink-900 dark:text-white md:p-9"><School className="text-brand-700 dark:text-brand-300" size={30} /><p className="mt-14 font-metric text-[.65rem] font-bold uppercase tracking-[.18em] text-brand-700 dark:text-brand-300">{user?.class} · {user?.faculty}</p><h2 className="mt-3 font-display text-3xl font-bold tracking-[-.04em]">Class curriculum</h2><p className="mt-3 max-w-lg text-sm leading-6 text-ink-500 dark:text-ink-400">Subject notes, practice material and revision resources arranged around your current course.</p><span className="mt-7 inline-flex items-center gap-2 text-sm font-semibold text-brand-700 dark:text-brand-300">Browse subjects <ArrowRight size={16} className="transition group-hover:translate-x-1" /></span></button>
        <button onClick={() => setViewMode('competitive')} className="group flex min-h-72 flex-col justify-between rounded-[1.5rem] border border-ink-200 bg-[#fbfaf7] p-6 text-left transition hover:-translate-y-1 hover:border-brand-400 dark:border-white/[.08] dark:bg-ink-900"><GraduationCap className="text-brand-700 dark:text-brand-300" /><div><h2 className="font-display text-2xl font-semibold tracking-[-.03em]">{user?.competition}</h2><p className="mt-2 text-sm text-ink-500">Entrance-focused study sets and practice.</p><span className="mt-7 inline-flex items-center gap-2 text-sm font-semibold text-brand-700 dark:text-brand-300">Browse preparation <ArrowRight size={16} className="transition group-hover:translate-x-1" /></span></div></button>
      </div>
    </div>
  );

  const title = viewMode === 'class' ? `${user?.class?.replace(/class/i, 'Class ')} subjects` : `${user?.competition} preparation`;
  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <header className="flex flex-col gap-6 border-b border-ink-200 pb-8 dark:border-white/[.08] md:flex-row md:items-end md:justify-between">
        <div><p className="dashboard-eyebrow text-brand-700 dark:text-brand-300">Study library</p><h1 className="mt-3 font-display text-4xl font-extrabold tracking-[-.05em] md:text-5xl">{title}</h1><p className="mt-3 text-sm text-ink-500 dark:text-ink-400">Pick a subject and continue from the material that matters now.</p></div>
        {user?.competition && user.competition !== 'None' && <button onClick={() => setViewMode('selection')} className="auth-secondary self-start md:self-auto">Change study path</button>}
      </header>

      {subjects.length ? (
        <div className="grid auto-rows-fr gap-4 md:grid-cols-2">
          {subjects.map((subject, index) => (
            <button key={subject.id || subject.subject_name} onClick={() => openSubject(subject)} className="group relative flex min-h-64 h-full flex-col justify-between overflow-hidden rounded-[1.5rem] border border-ink-200 bg-[#fbfaf7] p-6 text-left transition hover:-translate-y-1 hover:border-brand-400 dark:border-white/[.08] dark:bg-ink-900">
              <div className="flex items-start justify-between"><span className="grid h-11 w-11 place-items-center rounded-xl bg-brand-100 text-brand-800 dark:bg-brand-500/[.12] dark:text-brand-300"><Library size={20} /></span><span className="font-metric text-[.62rem] font-bold uppercase tracking-widest text-ink-400">{subject.subject_code || `0${index + 1}`}</span></div>
              <div className="mt-12"><h2 className="font-display text-2xl font-bold tracking-[-.04em] text-ink-900 dark:text-white">{subject.subject_name}</h2><p className="mt-2 max-w-md text-sm leading-6 text-ink-500 dark:text-ink-400">{subjectCopy[subject.subject_name] || 'Focused notes and practice resources for this subject.'}</p><span className="mt-5 inline-flex items-center gap-2 text-xs font-bold text-brand-700 dark:text-brand-300">Open subject <ArrowRight size={15} className="transition group-hover:translate-x-1" /></span></div>
            </button>
          ))}
        </div>
      ) : <div className="rounded-[1.5rem] border border-dashed border-ink-300 py-16 text-center dark:border-white/10"><Sparkles className="mx-auto text-ink-300" /><h2 className="mt-4 font-display text-xl font-semibold">Materials are being organized</h2><p className="mt-2 text-sm text-ink-500">Try another study path for now.</p></div>}
    </div>
  );
}
