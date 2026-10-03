import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import ThemeSwitcher from '../components/ThemeSwitcher';
import PdfStudyViewer from '../components/PdfStudyViewer';

export default function PdfReader() {
    const location = useLocation();
    const navigate = useNavigate();
    const { resourceSlug = 'drawing-symbols' } = useParams<{ resourceSlug: string }>();
    const state = location.state as { fileUrl?: string; title?: string; backUrl?: string; backState?: unknown } | null;
    const fileUrl = state?.fileUrl || '/assets/drawing_symbol.pdf';
    const title = state?.title || resourceSlug.split('-').map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(' ');

    return (
        <div className="fixed inset-0 z-[70] flex min-h-[100dvh] flex-col bg-[#f7f5f0] text-ink-900 dark:bg-ink-950 dark:text-ink-100">
            <header className="flex min-h-16 items-center gap-3 border-b border-ink-200 bg-[#fbfaf7] px-4 py-2 dark:border-white/[.08] dark:bg-ink-900 md:px-5">
                <button onClick={() => navigate(state?.backUrl || `/study/${resourceSlug}`, { state: state?.backState })} className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-ink-500 transition hover:bg-ink-100 hover:text-ink-900 dark:text-ink-400 dark:hover:bg-white/[.06] dark:hover:text-white" aria-label="Back to note"><ArrowLeft size={19} /></button>
                <h1 className="min-w-0 flex-1 truncate font-display text-sm font-bold tracking-[-.02em] md:text-base">{title}</h1>
                <ThemeSwitcher />
            </header>
            <PdfStudyViewer fileUrl={fileUrl} defaultScale={1} className="flex-1" />
        </div>
    );
}
