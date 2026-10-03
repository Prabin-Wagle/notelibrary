import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, ChevronRight, Sparkles, Clock } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { fetchUnifiedResources } from '../utils/api';
import type { Resource } from '../types/resources';
import { getResourceFileUrl, getResourceReaderPath, getResourceTitle } from '../utils/resourceRoutes';

export default function LatestNotes() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [notes, setNotes] = useState<Resource[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const loadLatestNotes = async () => {
            if (!user?.class || !user?.faculty) return;
            try {
                const data = await fetchUnifiedResources(user.class, user.faculty, '');
                // Take the 4 most recent notes
                setNotes(data.slice(0, 4));
            } catch (error) {
                console.error('Failed to load latest notes:', error);
            } finally {
                setLoading(false);
            }
        };

        loadLatestNotes();
    }, [user]);

    if (loading) {
        return (
            <div className="bg-white dark:bg-gray-900 rounded-[2.5rem] p-8 border border-gray-100 dark:border-white/5 shadow-sm animate-pulse">
                <div className="h-6 w-32 bg-gray-200 dark:bg-gray-800 rounded-lg mb-6" />
                <div className="space-y-4">
                    {[1, 2, 3].map(i => (
                        <div key={i} className="h-16 bg-gray-100 dark:bg-gray-800/50 rounded-2xl" />
                    ))}
                </div>
            </div>
        );
    }

    if (notes.length === 0) return null;

    return (
        <div className="bg-white dark:bg-gray-900 rounded-[2.5rem] p-8 border border-gray-100 dark:border-white/5 shadow-sm hover:shadow-xl transition-all duration-500 group relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-blue-600/5 blur-3xl -mr-16 -mt-16 group-hover:bg-blue-600/10 transition-colors" />
            
            <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-blue-600 rounded-xl text-white shadow-lg shadow-blue-600/20">
                        <Sparkles size={18} />
                    </div>
                    <div>
                        <h3 className="text-lg font-black text-gray-900 dark:text-white tracking-tight uppercase">Latest Materials</h3>
                        <p className="text-[9px] text-gray-400 font-bold uppercase tracking-[0.2em] mt-0.5">Fresh from your curriculum</p>
                    </div>
                </div>
                <button 
                    onClick={() => navigate('/subjects')}
                    className="text-[10px] font-black uppercase tracking-widest text-blue-600 hover:text-blue-700 transition-colors flex items-center gap-1 group/btn"
                >
                    View All
                    <ChevronRight size={14} className="group-hover/btn:translate-x-1 transition-transform" />
                </button>
            </div>

            <div className="space-y-3">
                {notes.map((note) => (
                    <button
                        key={note.id}
                        onClick={() => {
                            const title = getResourceTitle(note, 'Study note');
                            const subject = note.subjectName || note.subject || 'Physics';
                            const resourceType = note.resource_type || 'note';
                            navigate(getResourceReaderPath(title), {
                                state: {
                                    resource: note,
                                    title,
                                    fileUrl: getResourceFileUrl(note),
                                    backUrl: `/subjects/${encodeURIComponent(subject)}/${resourceType}`,
                                    backState: {},
                                }
                            });
                        }}
                        className="w-full flex items-center gap-4 p-4 rounded-2xl bg-gray-50 dark:bg-white/[0.02] border border-transparent hover:border-blue-600/20 hover:bg-white dark:hover:bg-white/[0.05] transition-all text-left group/item"
                    >
                        <div className="p-3 bg-white dark:bg-gray-800 rounded-xl shadow-sm group-hover/item:scale-110 transition-transform">
                            <FileText size={20} className="text-blue-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-0.5">
                                <span className="text-[8px] font-black uppercase tracking-widest text-blue-600/60 bg-blue-600/5 px-2 py-0.5 rounded">
                                    {note.subject || 'Material'}
                                </span>
                                {note.created_at && (
                                    <span className="text-[8px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-1">
                                        <Clock size={8} />
                                        {new Date(note.created_at).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}
                                    </span>
                                )}
                            </div>
                            <h4 className="text-xs font-black text-gray-900 dark:text-white truncate uppercase tracking-tight">
                                {note.chapter_name || note.chapterName || 'Untitled Note'}
                            </h4>
                        </div>
                        <div className="w-8 h-8 rounded-full border border-gray-100 dark:border-white/10 flex items-center justify-center text-gray-300 dark:text-gray-600 group-hover/item:text-blue-600 group-hover/item:border-blue-600/20 transition-all">
                            <ChevronRight size={14} />
                        </div>
                    </button>
                ))}
            </div>
        </div>
    );
}
