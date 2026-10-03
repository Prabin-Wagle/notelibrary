import { useState, useEffect, useMemo } from 'react';
import { CheckCircle2, Circle, Plus, Loader2, ChevronLeft, ChevronRight } from 'lucide-react';
import localData from '../data/localData';
import { useAuth } from '../contexts/AuthContext';

interface Target {
    id: number;
    label: string;
    progress: number;
    is_completed: number;
    target_date: string;
}

export default function TargetCalendar() {
    const { user } = useAuth();
    const [targets, setTargets] = useState<Target[]>([]);
    const [loading, setLoading] = useState(true);
    const [newTarget, setNewTarget] = useState('');
    const [isAdding, setIsAdding] = useState(false);
    const [currentDate, setCurrentDate] = useState(new Date());
    const [selectedDate, setSelectedDate] = useState(new Date());

    const weekDays = useMemo(() => {
        const days = [];
        const start = new Date(currentDate);
        const day = currentDate.getDay();
        const diff = currentDate.getDate() - day + (day === 0 ? -6 : 1);
        start.setDate(diff);

        for (let i = 0; i < 7; i++) {
            const d = new Date(start);
            d.setDate(start.getDate() + i);
            days.push(d);
        }
        return days;
    }, [currentDate]);

    const isPastWeek = useMemo(() => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const lastDayOfWeek = new Date(weekDays[6]);
        lastDayOfWeek.setHours(23, 59, 59, 999);
        return lastDayOfWeek < today;
    }, [weekDays]);

    const filteredTargets = useMemo(() => {
        const dateStr = selectedDate.toISOString().split('T')[0];
        return targets.filter(t => t.target_date === dateStr);
    }, [targets, selectedDate]);

    const fetchTargets = async () => {
        setLoading(true);
        try {
            const response = await localData.get(`targets`, {
                params: {
                    user_id: user?.id,
                    start_date: weekDays[0].toISOString().split('T')[0],
                    end_date: weekDays[6].toISOString().split('T')[0]
                }
            });
            if (response.data.status === 'success') {
                setTargets(response.data.targets);
            }
        } catch (error) {
            console.error('Failed to fetch targets:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (user?.id) fetchTargets();
    }, [user?.id, weekDays]);

    const addTarget = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newTarget.trim() || isPastWeek) return;

        try {
            const formData = new FormData();
            formData.append('user_id', user?.id || '');
            formData.append('action', 'add');
            formData.append('label', newTarget);
            formData.append('target_date', selectedDate.toISOString().split('T')[0]);

            const response = await localData.post(`targets`, formData);
            if (response.data.status === 'success') {
                setNewTarget('');
                setIsAdding(false);
                fetchTargets();
            }
        } catch (error) {
            console.error('Failed to add target:', error);
        }
    };

    const updateProgress = async (id: number, currentProgress: number) => {
        // Only allow updates if the week is not in the past
        if (isPastWeek) return;
        try {
            const nextProgress = currentProgress >= 100 ? 0 : 100;
            const formData = new FormData();
            formData.append('user_id', user?.id || '');
            formData.append('action', 'update');
            formData.append('id', id.toString());
            formData.append('progress', nextProgress.toString());

            const response = await localData.post(`targets`, formData);
            if (response.data.status === 'success') {
                fetchTargets();
            }
        } catch (error) {
            console.error('Failed to update target:', error);
        }
    };

    const moveWeek = (direction: number) => {
        const nextDate = new Date(currentDate);
        nextDate.setDate(currentDate.getDate() + (direction * 7));
        setCurrentDate(nextDate);
    };

    return (
        <div className="bg-white dark:bg-gray-900 rounded-[2.5rem] p-8 border border-gray-100 dark:border-gray-800 shadow-sm transition-all duration-500 overflow-hidden">
            <div className="flex items-center justify-between mb-8">
                <div>
                    <div className="flex items-center gap-2">
                        <h3 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight">Focus Flow</h3>
                        {isPastWeek && <span className="bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest">History</span>}
                    </div>
                    <p className="text-xs text-gray-400 font-bold uppercase tracking-widest mt-1">Weekly targets & tasks</p>
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={() => moveWeek(-1)} className="p-2.5 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-xl transition-all">
                        <ChevronLeft size={18} className="text-gray-400" />
                    </button>
                    <button onClick={() => { setCurrentDate(new Date()); setSelectedDate(new Date()); }} className="text-[10px] font-black uppercase tracking-widest text-blue-600 dark:text-blue-400 px-2 py-1 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg">Today</button>
                    <button onClick={() => moveWeek(1)} className="p-2.5 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-xl transition-all">
                        <ChevronRight size={18} className="text-gray-400" />
                    </button>
                    {!isPastWeek && (
                        <button
                            onClick={() => setIsAdding(!isAdding)}
                            className="ml-2 p-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-600/20"
                        >
                            <Plus size={18} />
                        </button>
                    )}
                </div>
            </div>

            <div
                className="flex gap-2 mb-10 overflow-x-auto pb-2 scrollbar-hide no-scrollbar"
                style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
            >
                {weekDays.map((day, i) => {
                    const isToday = day.toDateString() === new Date().toDateString();
                    const isSelected = day.toDateString() === selectedDate.toDateString();
                    return (
                        <div
                            key={i}
                            onClick={() => setSelectedDate(day)}
                            className={`flex-1 min-w-[50px] aspect-[4/5] rounded-[1.5rem] flex flex-col items-center justify-center gap-1.5 transition-all cursor-pointer ${isSelected
                                ? 'bg-blue-600 text-white shadow-xl shadow-blue-600/30 scale-105'
                                : isToday
                                    ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 border border-blue-100 dark:border-blue-900/30'
                                    : 'bg-gray-50 dark:bg-gray-800/50 text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors'
                                }`}
                        >
                            <span className="text-[8px] font-black uppercase tracking-widest leading-none">{day.toLocaleDateString('en-US', { weekday: 'short' })}</span>
                            <span className="text-base font-black leading-none">{day.getDate()}</span>
                        </div>
                    );
                })}
            </div>

            <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2 no-scrollbar">
                {loading ? (
                    <div className="flex items-center justify-center py-20">
                        <Loader2 className="animate-spin text-blue-600" size={24} />
                    </div>
                ) : (
                    <>
                        {isAdding && (
                            <form onSubmit={addTarget} className="animate-in slide-in-from-top-2 duration-300">
                                <input
                                    autoFocus
                                    onBlur={() => !newTarget && setIsAdding(false)}
                                    value={newTarget}
                                    onChange={(e) => setNewTarget(e.target.value)}
                                    placeholder={`Task for ${selectedDate.toLocaleDateString('en-US', { day: 'numeric', month: 'short' })}...`}
                                    className="w-full px-5 py-4 bg-gray-50 dark:bg-gray-800/80 border-2 border-transparent focus:border-blue-600/30 rounded-2xl text-xs font-bold placeholder-gray-400 focus:outline-none transition-all"
                                />
                            </form>
                        )}

                        {filteredTargets.length > 0 ? (
                            filteredTargets.map((target) => (
                                <div
                                    key={target.id}
                                    onClick={() => updateProgress(target.id, target.progress)}
                                    className={`group p-4 rounded-2xl flex items-center justify-between gap-4 border border-transparent transition-all ${isPastWeek ? 'opacity-70 cursor-default bg-gray-50/50 dark:bg-gray-800/30' : 'bg-gray-50 dark:bg-gray-800/50 hover:bg-gray-100 dark:hover:bg-gray-800/80 cursor-pointer shadow-sm hover:shadow-md'
                                        }`}
                                >
                                    <div className="flex items-center gap-4 flex-1">
                                        <div className="relative shrink-0 transition-transform group-hover:scale-110">
                                            {target.progress === 100 ? (
                                                <div className="bg-green-500 rounded-full p-1 text-white shadow-lg shadow-green-500/20">
                                                    <CheckCircle2 size={18} />
                                                </div>
                                            ) : (
                                                <div className="relative">
                                                    <Circle className="text-gray-300 dark:text-gray-600" size={24} />
                                                    <div
                                                        className="absolute inset-0 border-2 border-blue-600 rounded-full transition-all duration-500"
                                                        style={{
                                                            clipPath: `inset(${100 - target.progress}% 0 0 0)`,
                                                            opacity: target.progress > 0 ? 1 : 0
                                                        }}
                                                    />
                                                </div>
                                            )}
                                        </div>
                                        <div className="flex-1">
                                            <h4 className={`text-xs font-bold tracking-tight transition-all uppercase ${target.progress === 100 ? 'text-gray-400 dark:text-gray-500 line-through' : 'text-gray-900 dark:text-white'
                                                }`}>
                                                {target.label}
                                            </h4>
                                            <p className={`text-[8px] font-bold uppercase tracking-widest mt-1 transition-colors ${target.progress === 100 ? 'text-green-500' : 'text-gray-400'}`}>
                                                {target.progress}% Complete
                                            </p>
                                        </div>
                                    </div>
                                    <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                                        <div className={`p-1.5 rounded-lg text-[8px] font-black uppercase tracking-widest ${target.progress === 100 ? 'bg-amber-100 text-amber-600' : 'bg-blue-100 text-blue-600'}`}>
                                            {target.progress === 100 ? 'UNDO' : 'DONE'}
                                        </div>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="text-center py-12 bg-gray-50/30 dark:bg-gray-800/10 rounded-3xl border border-dashed border-gray-100 dark:border-gray-800">
                                <Plus className="mx-auto text-gray-300 dark:text-gray-700 mb-2 opacity-50" size={24} />
                                <p className="text-gray-400 text-[9px] font-black uppercase tracking-widest">No tasks for this day</p>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}
