import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Expand } from 'lucide-react';
import type { Resource } from '../types/resources';
import PdfStudyViewer from '../components/PdfStudyViewer';
import { getResourceFileUrl } from '../utils/resourceRoutes';

export default function ResourceEmbed() {
    const location = useLocation();
    const navigate = useNavigate();
    const { resourceSlug = 'drawing-symbols' } = useParams<{ resourceSlug: string }>();
    const state = location.state as { resource?: Resource; title?: string; fileUrl?: string; backUrl?: string; backState?: { selectedUnit?: string } } | null;
    const resource = state?.resource;
    const displayTitle = state?.title || resource?.chapterName || resourceSlug.split('-').map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(' ');
    const section = resource?.chapter || resource?.unit || 'Study library';
    const fileUrl = state?.fileUrl || getResourceFileUrl(resource);
    const backUrl = state?.backUrl || '/subjects/Physics/note';
    const backState = state?.backState || {};

    return (
        <div className="space-y-6">
            <header className="flex flex-col gap-4 border-b border-ink-200 pb-6 dark:border-white/[.08] sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center space-x-5">
                    <button
                        onClick={() => navigate(backUrl, { state: backState })}
                        className="group rounded-xl p-2.5 text-ink-500 transition hover:bg-ink-100 hover:text-ink-900 dark:text-ink-400 dark:hover:bg-white/[.06] dark:hover:text-white"
                        title="Back to unit"
                        aria-label="Back to unit"
                    >
                        <ArrowLeft className="h-6 w-6 group-hover:-translate-x-1 transition-transform" />
                    </button>
                    <div>
                        <h1 className="max-w-md truncate font-display text-xl font-bold tracking-[-.03em] text-ink-900 dark:text-white md:max-w-xl">
                            {displayTitle}
                        </h1>
                        <p className="mt-1 font-metric text-[.65rem] font-bold uppercase tracking-[.18em] text-ink-400">
                            {section}
                        </p>
                    </div>
                </div>
                <button onClick={() => navigate(`/study/${resourceSlug}/fullscreen`, { state: { fileUrl, title: displayTitle, backUrl: location.pathname, backState: state } })} className="auth-secondary self-start"><Expand size={15} /> Full-screen reader</button>
            </header>

            <PdfStudyViewer fileUrl={fileUrl} defaultScale={0.85} className="h-[calc(100dvh-13rem)] min-h-[36rem] rounded-[1.5rem] border border-ink-200 dark:border-white/[.08]" />
        </div>
    );
}
