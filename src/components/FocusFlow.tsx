import { useState, useEffect, useMemo, useCallback } from 'react';
import {
    CheckCircle2, Circle, Plus, ChevronLeft, ChevronRight,
    Trash2, Edit3, CalendarDays
} from 'lucide-react';
import { apiRequest, jsonBody } from '../lib/api';
import NepaliDate from 'nepali-date-converter';
import { useAuth } from '../contexts/AuthContext';
import { toast } from 'react-hot-toast';

interface Target {
    id: number;
    label: string;
    progress: number;
    is_completed: number;
    target_date: string;
}

export default function FocusFlow() {
    const { user } = useAuth();
    const [targets, setTargets] = useState<Target[]>([]);
    const [loading, setLoading] = useState(true);
    const [newTarget, setNewTarget] = useState('');
    const [isAdding, setIsAdding] = useState(false);
    const [viewDate, setViewDate] = useState(new Date());
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [editingId, setEditingId] = useState<number | null>(null);
    const [editLabel, setEditLabel] = useState('');

    // --- Date Logic ---
    const weekDays = useMemo(() => {
        const days = [];
        const start = new Date(viewDate);
        const day = viewDate.getDay();
        const diff = viewDate.getDate() - day + (day === 0 ? -6 : 1);
        start.setDate(diff);

        for (let i = 0; i < 7; i++) {
            const d = new Date(start);
            d.setDate(start.getDate() + i);
            days.push(d);
        }
        return days;
    }, [viewDate]);

    const isPastDate = (date: Date) => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        return date < today;
    };

    const isSameDay = (d1: Date, d2: Date) => {
        return d1.toDateString() === d2.toDateString();
    };

    const getDayTasks = (date: Date) => {
        const dateStr = date.toLocaleDateString('en-CA');
        return targets.filter(t => t.target_date === dateStr);
    };

    // --- API Interactions ---
    const fetchTargets = useCallback(async () => {
        setLoading(true);
        try {
            const from = weekDays[0].toLocaleDateString('en-CA');
            const to = weekDays[6].toLocaleDateString('en-CA');
            const response = await apiRequest<{ targets: Target[] }>(`/study-targets?from=${from}&to=${to}`);
            setTargets(response.targets.map((target) => ({ ...target, is_completed: Number(target.progress) === 100 ? 1 : 0, progress: Number(target.progress) })));
        } catch (error) {
            console.error('Failed to fetch targets:', error);
        } finally {
            setLoading(false);
        }
    }, [weekDays]);

    useEffect(() => {
        if (user?.id) fetchTargets();
    }, [user?.id, fetchTargets]);

    const handleAction = async (action: string, data: { id?: number; label?: string; target_date?: string; progress?: number }) => {
        try {
            if (action === 'add') await apiRequest('/study-targets', { method: 'POST', body: jsonBody(data) });
            else if (action === 'delete') await apiRequest(`/study-targets/${data.id}`, { method: 'DELETE' });
            else await apiRequest(`/study-targets/${data.id}`, { method: 'PATCH', body: jsonBody({ progress: data.progress, label: data.label }) });
            await fetchTargets();
            return true;
        } catch {
            toast.error(`Failed to ${action} task`);
            return false;
        }
    };

    const onAddTask = async (e: React.FormEvent, date?: Date) => {
        e.preventDefault();
        const targetDate = date || selectedDate;
        if (!newTarget.trim()) return;
        if (isPastDate(targetDate)) {
            toast.error("Cannot add tasks to past dates!");
            return;
        }

        const success = await handleAction('add', {
            label: newTarget,
            target_date: targetDate.toLocaleDateString('en-CA')
        });
        if (success) {
            setNewTarget('');
            setIsAdding(false);
        }
    };

    const onToggleComplete = (target: Target) => {
        if (isPastDate(new Date(target.target_date))) return;
        handleAction('update', {
            id: target.id,
            progress: Number(target.progress) >= 100 ? 0 : 100
        });
    };

    const onDelete = (id: number) => {
        if (window.confirm('Are you sure you want to delete this objective?')) {
            handleAction('delete', { id });
        }
    };

    const onStartEdit = (target: Target) => {
        if (isPastDate(new Date(target.target_date))) return;
        setEditingId(target.id);
        setEditLabel(target.label);
    };

    const onSaveEdit = async () => {
        if (!editLabel.trim() || editingId === null) return;
        const success = await handleAction('rename', {
            id: editingId,
            label: editLabel
        });
        if (success) {
            setEditingId(null);
            setEditLabel('');
        }
    };

    const filteredTargets = targets.filter(t => t.target_date === selectedDate.toLocaleDateString('en-CA'));

    return (
        <div className="surface-card relative p-5 sm:p-6 transition-colors duration-200 flex flex-col h-full overflow-hidden">
            {loading && (
                <div className="absolute inset-0 bg-white/60 dark:bg-ink-950/60 backdrop-blur-sm z-20 flex items-center justify-center anim-fade">
                    <div className="h-7 w-7 rounded-full border-2 border-brand-500/20 border-t-brand-500 animate-spin" />
                </div>
            )}

            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                <div className="flex items-center gap-3">
                    <div className="grid place-items-center h-10 w-10 rounded-xl bg-brand-500/10 text-brand-600 dark:text-brand-400 shrink-0">
                        <CalendarDays size={17} />
                    </div>
                    <div>
                        <h3 className="dashboard-card-title text-ink-900 dark:text-white">Today's plan</h3>
                        <p className="text-xs text-ink-400 dark:text-ink-500 mt-0.5">{new NepaliDate(viewDate).format('MMMM YYYY')} BS · Set goals and track your week</p>
                    </div>
                </div>

                <div className="flex items-center gap-1 self-start sm:self-auto bg-ink-50 dark:bg-white/[0.04] p-1 rounded-lg border border-ink-200 dark:border-white/[0.06]">
                    <button
                        onClick={() => {
                            const next = new Date(viewDate);
                            next.setDate(viewDate.getDate() - 7);
                            setViewDate(next);
                        }}
                        className="p-1.5 rounded-md text-ink-400 hover:text-ink-900 dark:hover:text-white hover:bg-white dark:hover:bg-white/10 transition-colors"
                        aria-label="Previous week"
                    >
                        <ChevronLeft size={16} />
                    </button>
                    <span className="px-2.5 min-w-[7rem] text-center font-display text-xs font-semibold text-ink-600 dark:text-ink-300">
                        {viewDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                    </span>
                    <button
                        onClick={() => {
                            const next = new Date(viewDate);
                            next.setDate(viewDate.getDate() + 7);
                            setViewDate(next);
                        }}
                        className="p-1.5 rounded-md text-ink-400 hover:text-ink-900 dark:hover:text-white hover:bg-white dark:hover:bg-white/10 transition-colors"
                        aria-label="Next week"
                    >
                        <ChevronRight size={16} />
                    </button>
                </div>
            </div>

            {/* Week strip */}
            <div className="flex gap-2 mb-6 overflow-x-auto pb-1 no-scrollbar">
                {weekDays.map((day, i) => {
                    const isToday = isSameDay(day, new Date());
                    const isSelected = isSameDay(day, selectedDate);
                    const dayTasks = getDayTasks(day);
                    const completedCount = dayTasks.filter(t => t.is_completed).length;

                    return (
                        <button
                            key={i}
                            onClick={() => setSelectedDate(day)}
                            className={`relative min-w-[3.75rem] flex-1 py-3 rounded-xl flex flex-col items-center transition-colors border ${isSelected
                                ? 'bg-brand-500/10 border-brand-500/40 text-brand-700 dark:text-brand-400'
                                : isToday
                                    ? 'border-ink-300 dark:border-white/20 text-ink-700 dark:text-ink-200'
                                    : 'border-ink-200 dark:border-white/[0.06] text-ink-400 dark:text-ink-500 hover:bg-ink-50 dark:hover:bg-white/[0.04]'
                                }`}
                        >
                            <span className="dashboard-eyebrow !text-[0.5rem] mb-1">{day.toLocaleDateString(undefined, { weekday: 'short' })}</span>
                            <span className="font-metric text-base font-bold tabular-nums">{day.getDate()}</span>
                            <span className="font-metric text-[.55rem] tabular-nums text-ink-400 dark:text-ink-500">{new NepaliDate(day).format('D')} BS</span>
                            {dayTasks.length > 0 && (
                                <div className="mt-1.5 flex gap-1">
                                    {[...Array(Math.min(dayTasks.length, 3))].map((_, idx) => (
                                        <div key={idx} className={`h-1 w-1 rounded-full ${idx < completedCount ? 'bg-brand-500' : isSelected ? 'bg-brand-500/40' : 'bg-ink-300 dark:bg-ink-600'}`} />
                                    ))}
                                </div>
                            )}
                            {isToday && !isSelected && (
                                <span className="absolute top-1.5 right-1.5 h-1 w-1 rounded-full bg-brand-500" />
                            )}
                        </button>
                    );
                })}
            </div>

            {/* Day goals */}
            <div className="flex-1 flex flex-col space-y-3">
                <div className="flex items-center justify-between">
                    <h4 className="dashboard-eyebrow text-ink-400 dark:text-ink-500 !text-[0.5625rem]">
                        {isSameDay(selectedDate, new Date()) ? "Today's" : "Day's"} goals
                    </h4>
                    {!isPastDate(selectedDate) && (
                        <button
                            onClick={() => setIsAdding(true)}
                            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-brand-500/10 text-brand-700 dark:text-brand-400 font-display text-xs font-semibold hover:bg-brand-500/20 transition-colors active:scale-95"
                        >
                            <Plus size={13} />
                            Add goal
                        </button>
                    )}
                </div>

                {isAdding && (
                    <form onSubmit={(e) => onAddTask(e)} className="anim-rise">
                        <input
                            autoFocus
                            value={newTarget}
                            onChange={(e) => setNewTarget(e.target.value)}
                            placeholder="Enter your priority goal…"
                            className="w-full px-4 py-3 bg-ink-50 dark:bg-white/[0.04] border border-brand-500/50 rounded-xl text-sm font-medium text-ink-900 dark:text-white placeholder:text-ink-400 focus:outline-none focus:border-brand-500 transition-colors"
                        />
                    </form>
                )}

                <div className="space-y-2 overflow-y-auto no-scrollbar flex-1 max-h-[19rem]">
                    {filteredTargets.map(target => (
                        <div
                            key={target.id}
                            className={`group flex items-center justify-between gap-3 px-4 py-3 rounded-xl border transition-colors ${target.is_completed
                                ? 'bg-brand-500/[0.06] border-brand-500/20'
                                : 'bg-ink-50 dark:bg-white/[0.03] border-ink-200 dark:border-white/[0.06] hover:border-ink-300 dark:hover:border-white/[0.12]'
                                }`}
                        >
                            <div className="flex items-center gap-3 flex-1 min-w-0">
                                <button
                                    onClick={() => onToggleComplete(target)}
                                    className="shrink-0 transition-transform active:scale-90"
                                    aria-label="Toggle complete"
                                >
                                    {target.is_completed ? (
                                        <CheckCircle2 size={18} className="text-brand-500" />
                                    ) : (
                                        <Circle size={18} className="text-ink-300 dark:text-ink-600 hover:text-brand-500 transition-colors" />
                                    )}
                                </button>
                                <div className="flex-1 truncate">
                                    {editingId === target.id ? (
                                        <input
                                            autoFocus
                                            value={editLabel}
                                            onChange={(e) => setEditLabel(e.target.value)}
                                            onKeyDown={(e) => e.key === 'Enter' && onSaveEdit()}
                                            onBlur={() => onSaveEdit()}
                                            className="w-full bg-transparent border-b border-brand-500 text-sm font-medium text-ink-900 dark:text-white focus:outline-none"
                                        />
                                    ) : (
                                        <h5 className={`text-sm font-medium truncate ${target.is_completed ? 'text-ink-400 dark:text-ink-500 line-through' : 'text-ink-900 dark:text-ink-100'}`}>
                                            {target.label}
                                        </h5>
                                    )}
                                </div>
                            </div>
                            <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity shrink-0">
                                <button onClick={() => onStartEdit(target)} className="p-1.5 rounded-lg text-ink-400 hover:text-brand-600 dark:hover:text-brand-400 hover:bg-brand-500/10 transition-colors" aria-label="Edit"><Edit3 size={13} /></button>
                                <button onClick={() => onDelete(target.id)} className="p-1.5 rounded-lg text-ink-400 hover:text-red-500 hover:bg-red-500/10 transition-colors" aria-label="Delete"><Trash2 size={13} /></button>
                            </div>
                        </div>
                    ))}
                    {filteredTargets.length === 0 && !isAdding && (
                        <div className="flex flex-col items-center justify-center py-10 rounded-xl border border-dashed border-ink-200 dark:border-white/[0.08]">
                            <CalendarDays size={24} className="text-ink-300 dark:text-ink-600 mb-2" />
                            <p className="text-sm font-medium text-ink-400 dark:text-ink-500">No goals set</p>
                            <p className="text-xs text-ink-300 dark:text-ink-600 mt-0.5">Add one to get moving</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
