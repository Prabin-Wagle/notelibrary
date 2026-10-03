import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, BookOpen, FileText, FolderOpen, Search } from 'lucide-react';
import type { Resource, ResourceType, Subject } from '../types/resources';
import { RESOURCE_TYPES } from '../types/resources';
import { useAuth } from '../contexts/AuthContext';
import { fetchAllSubjectResources } from '../utils/api';
import { getResourceFileUrl, getResourceReaderPath, getResourceTitle } from '../utils/resourceRoutes';

export default function ResourceView() {
  const { subjectName, resourceType } = useParams<{ subjectName: string; resourceType: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const state = location.state as { subject?: Subject; resources?: Resource[]; selectedUnit?: string } | null;
  const [resources, setResources] = useState<Resource[]>(state?.resources || []);
  const [loading, setLoading] = useState(!state?.resources);
  const [selectedUnit, setSelectedUnit] = useState<string | null>(state?.selectedUnit || null);
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (state?.resources || !subjectName) return;
    setLoading(true);
    fetchAllSubjectResources(user?.class || '', user?.faculty || '', decodeURIComponent(subjectName))
      .then((map) => setResources(map[resourceType as ResourceType] || []))
      .finally(() => setLoading(false));
  }, [resourceType, state?.resources, subjectName, user?.class, user?.faculty]);

  const groups = useMemo(() => resources.reduce<Record<string, Resource[]>>((result, item) => {
    const unit = item.unit || item.chapter || 'General';
    (result[unit] ||= []).push(item);
    return result;
  }, {}), [resources]);
  const units = Object.keys(groups);
  const shownResources = (selectedUnit ? groups[selectedUnit] || [] : []).filter((item) => `${item.chapterName} ${item.chapter_name}`.toLowerCase().includes(query.toLowerCase()));
  const config = RESOURCE_TYPES.find((item) => item.type === resourceType) || { label: resourceType || 'Resources', icon: '•' };
  const subject = decodeURIComponent(subjectName || 'Subject');
  const openResource = (resource: Resource) => {
    const title = getResourceTitle(resource);
    navigate(getResourceReaderPath(title), {
      state: {
        resource,
        title,
        fileUrl: getResourceFileUrl(resource),
        backUrl: `/subjects/${encodeURIComponent(subject)}/${resourceType}`,
        backState: {},
      },
    });
  };

  if (loading) return <div className="mx-auto max-w-6xl space-y-4">{[1, 2, 3].map((item) => <div key={item} className="h-28 animate-pulse rounded-2xl bg-ink-100 dark:bg-white/[.04]" />)}</div>;

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <button onClick={() => selectedUnit ? setSelectedUnit(null) : navigate(`/subjects/${subjectName}`)} className="group inline-flex items-center gap-2 text-xs font-semibold text-ink-500 transition hover:text-brand-700 dark:text-ink-400 dark:hover:text-brand-300"><ArrowLeft size={16} className="transition group-hover:-translate-x-1" /> {selectedUnit ? 'Back to units' : `Back to ${subject}`}</button>
      <header className="grid gap-7 border-b border-ink-200 pb-9 dark:border-white/[.08] md:grid-cols-[1fr_auto] md:items-end">
        <div><p className="dashboard-eyebrow text-brand-700 dark:text-brand-300">{subject} · study library</p><h1 className="mt-3 font-display text-5xl font-extrabold tracking-[-.06em] md:text-6xl">{selectedUnit || config.label}</h1><p className="mt-4 max-w-xl text-sm leading-7 text-ink-500 dark:text-ink-400">{selectedUnit ? `Resources filed under ${selectedUnit}.` : `Choose a unit to explore your ${config.label.toLowerCase()}.`}</p></div>
        <div><strong className="block font-metric text-3xl text-ink-900 dark:text-white">{selectedUnit ? shownResources.length : resources.length}</strong><span className="mt-1 block text-xs text-ink-400">{selectedUnit ? 'in this unit' : 'total resources'}</span></div>
      </header>

      {!resources.length ? (
        <div className="rounded-[1.5rem] border border-dashed border-ink-300 px-6 py-16 text-center dark:border-white/10"><FolderOpen className="mx-auto text-ink-300" size={30} /><h2 className="mt-4 font-display text-xl font-semibold">No resources in this collection</h2><p className="mt-2 text-sm text-ink-500">Return to the subject and choose another material type.</p></div>
      ) : !selectedUnit ? (
        <section><p className="dashboard-eyebrow mb-5 text-ink-400">{units.length} study units</p><div className="grid gap-4 md:grid-cols-2">{units.map((unit, index) => (
          <button key={unit} onClick={() => setSelectedUnit(unit)} className={`group flex min-h-52 flex-col justify-between rounded-[1.5rem] border border-ink-200 bg-[#fbfaf7] p-6 text-left transition hover:-translate-y-1 hover:border-brand-400 dark:border-white/[.08] dark:bg-ink-900 ${index === 0 && units.length > 2 ? 'md:row-span-2 md:min-h-[27rem]' : ''}`}><div className="flex justify-between"><span className="grid h-11 w-11 place-items-center rounded-xl bg-brand-100 text-brand-800 dark:bg-brand-500/[.12] dark:text-brand-300"><BookOpen size={19} /></span><span className="font-metric text-[.65rem] font-bold uppercase tracking-wider text-ink-400">{groups[unit].length} items</span></div><div><h2 className="font-display text-2xl font-bold tracking-[-.04em]">{unit}</h2><span className="mt-4 inline-flex items-center gap-2 text-xs font-bold text-brand-700 dark:text-brand-300">Open unit <ArrowRight size={15} className="transition group-hover:translate-x-1" /></span></div></button>
        ))}</div></section>
      ) : (
        <section className="space-y-5">
          <label className="relative block max-w-md"><Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={`Search ${selectedUnit}`} className="w-full rounded-xl border border-ink-200 bg-[#fbfaf7] py-3.5 pl-11 pr-4 text-sm outline-none transition focus:border-brand-500 dark:border-white/[.08] dark:bg-ink-900" /></label>
          <div className="divide-y divide-ink-200 overflow-hidden rounded-[1.5rem] border border-ink-200 bg-[#fbfaf7] dark:divide-white/[.07] dark:border-white/[.08] dark:bg-ink-900">{shownResources.map((resource, index) => (
            <button key={resource.id} onClick={() => openResource(resource)} className="group grid w-full gap-4 p-5 text-left transition hover:bg-brand-50/60 dark:hover:bg-brand-500/[.05] sm:grid-cols-[auto_1fr_auto] sm:items-center"><span className="grid h-11 w-11 place-items-center rounded-xl bg-ink-100 text-ink-500 group-hover:bg-brand-100 group-hover:text-brand-800 dark:bg-white/[.05]"><FileText size={19} /></span><span><span className="font-metric text-[.62rem] font-bold uppercase tracking-wider text-ink-400">Resource {String(index + 1).padStart(2, '0')}</span><strong className="mt-1 block font-display text-base font-semibold text-ink-900 dark:text-white">{resource.chapterName || resource.chapter_name}</strong></span><ArrowRight size={17} className="text-ink-300 transition group-hover:translate-x-1 group-hover:text-brand-600" /></button>
          ))}{!shownResources.length && <div className="px-6 py-12 text-center text-sm text-ink-500">No resources match “{query}”.</div>}</div>
        </section>
      )}
    </div>
  );
}
