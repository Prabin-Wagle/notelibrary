import React, { useEffect, useState } from 'react';
import { X, Trophy, Timer, Medal, Search, Crown } from 'lucide-react';
import localData from '../data/localData';

interface LeaderboardEntry {
    rank: number;
    name: string;
    profile_image: string | null;
    score: number;
    total_time: number;
}

interface LiveLeaderboardModalProps {
    isOpen: boolean;
    onClose: () => void;
    quizId: number;
    quizTitle: string;
}

const LiveLeaderboardModal: React.FC<LiveLeaderboardModalProps> = ({ isOpen, onClose, quizId, quizTitle }) => {
    const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');

    useEffect(() => {
        if (isOpen && quizId) {
            fetchLeaderboard();
        }
    }, [isOpen, quizId]);

    const fetchLeaderboard = async () => {
        setLoading(true);
        try {
            const res = await localData.get(`leaderboard?quiz_id=${quizId}`);
            if (res.data.status === 'true') {
                setLeaderboard(res.data.data);
            }
        } catch (error) {
            console.error("Leaderboard fetch error:", error);
        } finally {
            setLoading(false);
        }
    };

    const formatTime = (seconds: number) => {
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${m}m ${s}s`;
    };

    const filteredData = leaderboard.filter(item =>
        item.name.toLowerCase().includes(search.toLowerCase())
    );

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
            <div className="bg-white dark:bg-gray-900 w-full max-w-4xl rounded-3xl shadow-2xl relative z-10 flex flex-col max-h-[90vh] overflow-hidden border border-gray-100 dark:border-gray-800 animate-in fade-in zoom-in-95 duration-200">

                {/* Header */}
                <div className="p-6 md:p-8 bg-gradient-to-r from-slate-900 to-slate-800 text-white shrink-0 relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-8 opacity-10">
                        <Trophy size={120} />
                    </div>
                    <button
                        onClick={onClose}
                        className="absolute top-4 right-4 p-2 bg-white/10 hover:bg-white/20 rounded-full transition-colors"
                    >
                        <X size={20} />
                    </button>

                    <div className="relative z-10">
                        <div className="flex items-center gap-3 mb-2">
                            <span className="px-3 py-1 bg-yellow-400 text-yellow-900 text-xs font-black uppercase tracking-widest rounded-full">Official Ranking</span>
                        </div>
                        <h2 className="text-3xl font-black mb-2 leading-tight">{quizTitle}</h2>
                        <p className="text-slate-300 flex items-center gap-2 text-sm font-medium">
                            <Crown size={16} className="text-yellow-400" />
                            Top {leaderboard.length} Performers
                        </p>
                    </div>
                </div>

                {/* Toolbar */}
                <div className="p-4 border-b border-gray-100 dark:border-gray-800 flex items-center gap-4 bg-gray-50/50 dark:bg-gray-900/50">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                        <input
                            type="text"
                            placeholder="Search student..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                        />
                    </div>
                    <div className="text-xs font-bold text-gray-500 bg-white dark:bg-gray-800 px-4 py-2.5 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm">
                        Total: {leaderboard.length}
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center h-64 gap-4">
                            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-slate-900 dark:border-white"></div>
                            <p className="text-sm text-gray-500 font-medium">Loading rankings...</p>
                        </div>
                    ) : filteredData.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-64 text-center">
                            <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mb-4 text-gray-400">
                                <Search size={24} />
                            </div>
                            <p className="text-gray-500 dark:text-gray-400 font-medium">No students found matching "{search}"</p>
                        </div>
                    ) : (
                        <div className="grid gap-2">
                            {filteredData.map((item) => (
                                <div
                                    key={item.rank}
                                    className={`
                                        group flex items-center justify-between p-4 rounded-xl border transition-all hover:scale-[1.01] hover:shadow-md
                                        ${item.rank === 1 ? 'bg-gradient-to-r from-yellow-50 to-amber-50 dark:from-yellow-900/20 dark:to-amber-900/20 border-yellow-200 dark:border-yellow-700/50' :
                                            item.rank === 2 ? 'bg-slate-50 dark:bg-slate-800/30 border-slate-200 dark:border-slate-700' :
                                                item.rank === 3 ? 'bg-orange-50 dark:bg-orange-900/10 border-orange-200 dark:border-orange-700' :
                                                    'bg-white dark:bg-gray-800 border-gray-100 dark:border-gray-700 hover:border-blue-200 dark:hover:border-blue-800'}
                                    `}
                                >
                                    <div className="flex items-center gap-4">
                                        <div className={`
                                            w-10 h-10 rounded-xl flex items-center justify-center font-black text-lg shadow-sm
                                            ${item.rank === 1 ? 'bg-yellow-400 text-yellow-900 ring-4 ring-yellow-100 dark:ring-yellow-900/30' :
                                                item.rank === 2 ? 'bg-slate-300 text-slate-800' :
                                                    item.rank === 3 ? 'bg-orange-300 text-orange-900' :
                                                        'bg-gray-100 dark:bg-gray-700 text-gray-500'}
                                        `}>
                                            {item.rank <= 3 ? <Medal size={20} /> : item.rank}
                                        </div>
                                        <div className="flex items-center gap-3">
                                            {item.profile_image ? (
                                                <img
                                                    src={item.profile_image}
                                                    alt={item.name}
                                                    className="w-10 h-10 rounded-full object-cover ring-2 ring-gray-100 dark:ring-gray-700"
                                                />
                                            ) : (
                                                <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 font-bold text-sm">
                                                    {item.name.charAt(0)}
                                                </div>
                                            )}
                                            <div>
                                                <h3 className="font-bold text-gray-900 dark:text-white group-hover:text-blue-600 transition-colors">
                                                    {item.name}
                                                </h3>
                                                {item.rank === 1 && <span className="text-[10px] bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded font-bold uppercase tracking-wide">Champion</span>}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-8 md:gap-12">
                                        <div className="text-right">
                                            <div className="text-xs text-gray-400 font-bold uppercase tracking-wider mb-0.5">Score</div>
                                            <div className="font-black text-lg text-slate-900 dark:text-white">{item.score.toFixed(1)}</div>
                                        </div>
                                        <div className="text-right w-20">
                                            <div className="text-xs text-gray-400 font-bold uppercase tracking-wider mb-0.5 flex items-center justify-end gap-1">
                                                <Timer size={10} /> Time
                                            </div>
                                            <div className="font-bold text-gray-600 dark:text-gray-300 font-mono">{formatTime(item.total_time)}</div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default LiveLeaderboardModal;
