import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, BookOpen, FileText, Sigma, Sparkles } from 'lucide-react';
import type { Resource, ResourceType, Subject } from '../types/resources';
import { RESOURCE_TYPES } from '../types/resources';

interface Props {
  subjectName: string;
  subject?: Subject;
  resourcesMap: Record<ResourceType, Resource[]>;
  availableTypes: ResourceType[];
  userClass?: string;
  userFaculty?: string;
}

const icons: Partial<Record<ResourceType, typeof FileText>> = { note: FileText, numerical: Sigma, miq: Sparkles };

export default function ClassSubjectDetails({ subjectName, subject, resourcesMap, availableTypes, userClass, userFaculty }: Props) {
  const navigate = useNavigate();
  const decodedName = decodeURIComponent(subjectName || '');
  const total = availableTypes.reduce((sum, type) => sum + (resourcesMap[type]?.length || 0), 0);

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <button onClick={() => navigate('/subjects')} className="group inline-flex items-center gap-2 text-xs font-semibold text-ink-500 transition hover:text-brand-700 dark:text-ink-400 dark:hover:text-brand-300"><ArrowLeft size={16} className="transition group-hover:-translate-x-1" /> Back to subjects</button>

      <header className="grid gap-8 border-b border-ink-200 pb-9 dark:border-white/[.08] md:grid-cols-[1fr_auto] md:items-end">
        <div><p className="dashboard-eyebrow text-brand-700 dark:text-brand-300">{userClass} · {userFaculty}</p><h1 className="mt-3 font-display text-5xl font-extrabold tracking-[-.06em] md:text-6xl">{decodedName}</h1><p className="mt-4 max-w-xl text-sm leading-7 text-ink-500 dark:text-ink-400">Choose a material type, then work through each unit at your own pace.</p></div>
        <div className="flex gap-8"><div><strong className="block font-metric text-3xl text-ink-900 dark:text-white">{availableTypes.length}</strong><span className="mt-1 block text-xs text-ink-400">collections</span></div><div><strong className="block font-metric text-3xl text-ink-900 dark:text-white">{total}</strong><span className="mt-1 block text-xs text-ink-400">resources</span></div>{subject?.subject_code && <div><strong className="block font-metric text-sm text-brand-700 dark:text-brand-300">{subject.subject_code}</strong><span className="mt-2 block text-xs text-ink-400">subject code</span></div>}</div>
      </header>

      <section>
        <div className="mb-5 flex items-center justify-between"><div><p className="dashboard-eyebrow text-ink-400">Available materials</p><h2 className="mt-2 font-display text-2xl font-bold tracking-[-.04em]">Pick how you want to study</h2></div></div>
        {availableTypes.length ? (
          <div className="grid gap-4 md:grid-cols-2">
            {availableTypes.map((type, index) => {
              const config = RESOURCE_TYPES.find((item) => item.type === type);
              const Icon = icons[type] || BookOpen;
              const count = resourcesMap[type]?.length || 0;
              return (
                <button key={type} onClick={() => navigate(`/subjects/${subjectName}/${type}`, { state: { subject, resources: resourcesMap[type] } })} className={`group flex min-h-48 flex-col justify-between rounded-[1.5rem] border border-ink-200 bg-[#fbfaf7] p-6 text-left transition hover:-translate-y-1 hover:border-brand-400 dark:border-white/[.08] dark:bg-ink-900 ${index === 0 ? 'md:col-span-2 md:min-h-60' : ''}`}>
                  <div className="flex items-start justify-between"><span className="grid h-11 w-11 place-items-center rounded-xl bg-brand-100 text-brand-800 dark:bg-brand-500/[.12] dark:text-brand-300"><Icon size={20} /></span><span className="font-metric text-[.65rem] font-bold uppercase tracking-wider text-ink-400">{count} {count === 1 ? 'resource' : 'resources'}</span></div>
                  <div className={index === 0 ? 'mt-14' : 'mt-10'}><h3 className="font-display text-2xl font-bold tracking-[-.04em]">{config?.label || type}</h3><div className="mt-3 flex items-center justify-between"><p className="text-sm text-ink-500 dark:text-ink-400">Organized by unit for focused revision.</p><ArrowRight size={17} className="text-brand-700 transition group-hover:translate-x-1 dark:text-brand-300" /></div></div>
                </button>
              );
            })}
          </div>
        ) : <div className="rounded-[1.5rem] border border-dashed border-ink-300 px-6 py-16 text-center dark:border-white/10"><BookOpen className="mx-auto text-ink-300" /><h3 className="mt-4 font-display text-xl font-semibold">No material yet</h3><p className="mt-2 text-sm text-ink-500">This subject is ready for new resources.</p></div>}
      </section>
    </div>
  );
}
