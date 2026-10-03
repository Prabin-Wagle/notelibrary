import { useState, useEffect, useCallback, useRef } from 'react';
import { Play, Pause, RotateCcw, Timer, Coffee, Zap, Music, Maximize2, Minimize2, SkipBack, SkipForward, Volume2, ListMusic, Repeat, Repeat1, GripVertical } from 'lucide-react';
import localData from '../data/localData';

type TimerType = 'focus' | 'break';

interface LofiTrack {
    title: string;
    artist: string;
    url: string;
}

// Static style maps — Tailwind can't compile dynamic class names like bg-${color}-500
const configs = {
    focus: {
        label: 'Focus Session',
        ring: '#14b8a6',
        chip: 'bg-brand-500/10 text-brand-700 dark:text-brand-400',
        toggleActive: 'bg-brand-600 dark:bg-brand-500 text-white dark:text-ink-950',
        play: 'bg-brand-600 hover:bg-brand-500 dark:bg-brand-500 dark:hover:bg-brand-400 text-white dark:text-ink-950',
        input: 'border-brand-500',
    },
    break: {
        label: 'Break Time',
        ring: '#10b981',
        chip: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
        toggleActive: 'bg-emerald-600 dark:bg-emerald-500 text-white dark:text-ink-950',
        play: 'bg-emerald-600 hover:bg-emerald-500 dark:bg-emerald-500 dark:hover:bg-emerald-400 text-white dark:text-ink-950',
        input: 'border-emerald-500',
    },
} as const;

export default function PomodoroTimer() {
    const [timerType, setTimerType] = useState<TimerType>('focus');
    const [focusHours, setFocusHours] = useState(0);
    const [focusMinutes, setFocusMinutes] = useState(25);
    const [breakHours, setBreakHours] = useState(0);
    const [breakMinutes, setBreakMinutes] = useState(5);

    const [timeLeft, setTimeLeft] = useState(25 * 60);
    const [isActive, setIsActive] = useState(false);
    const [showMusic, setShowMusic] = useState(false);
    const [isFullScreen, setIsFullScreen] = useState(false);
    const [showSettings, setShowSettings] = useState(false);
    const [fsBackground, setFsBackground] = useState('bg-[#090b10]');
    const [bgType, setBgType] = useState<'color' | 'video'>('color');
    const [, setVideoUrl] = useState('');
    const [showPlaylist, setShowPlaylist] = useState(false);

    // Body scroll locking
    useEffect(() => {
        if (isFullScreen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'unset';
            setBgType('color'); // Reset to color on exit for performance
        }
        return () => { document.body.style.overflow = 'unset'; };
    }, [isFullScreen]);

    // Helper for theme selection
    const handleThemeChange = (theme: { class: string, label: string }) => {
        setBgType('color');
        setFsBackground(theme.class);
        setVideoUrl('');
    };

    // --- Music Player State ---
    const [tracks, setTracks] = useState<LofiTrack[]>([]);
    const [currentTrackIndex, setCurrentTrackIndex] = useState(0);
    const [isMusicPlaying, setIsMusicPlaying] = useState(false);
    const [volume, setVolume] = useState(0.5);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [loadingTracks, setLoadingTracks] = useState(true);
    const [isLooping, setIsLooping] = useState(false);
    const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
    const audioRef = useRef<HTMLAudioElement | null>(null);

    useEffect(() => {
        fetchTracks();
    }, []);

    const fetchTracks = async () => {
        try {
            setLoadingTracks(true);
            const response = await localData.get('lofi-tracks');
            if (response.data.status === 'success' && response.data.data.length > 0) {
                setTracks(response.data.data);
            }
        } catch (error) {
            console.error('Local tracks could not be loaded:', error);
            setTracks([]);
        } finally {
            setLoadingTracks(false);
        }
    };

    const getDuration = (type: TimerType) => {
        if (type === 'focus') return (focusHours * 3600) + (focusMinutes * 60);
        return (breakHours * 3600) + (breakMinutes * 60);
    };

    const toggleTimerType = useCallback(() => {
        const nextType = timerType === 'focus' ? 'break' : 'focus';
        setTimerType(nextType);
        setTimeLeft(getDuration(nextType));
        setIsActive(false);
    }, [timerType, focusHours, focusMinutes, breakHours, breakMinutes]);

    useEffect(() => {
        let interval: any = null;
        if (isActive && timeLeft > 0) {
            interval = setInterval(() => {
                setTimeLeft((prev) => prev - 1);
            }, 1000);
        } else if (timeLeft === 0) {
            setIsActive(false);
            const AudioContextClass = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
            if (AudioContextClass) {
                const context = new AudioContextClass();
                const oscillator = context.createOscillator();
                const gain = context.createGain();
                oscillator.frequency.value = 640;
                gain.gain.setValueAtTime(0.08, context.currentTime);
                gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.35);
                oscillator.connect(gain); gain.connect(context.destination); oscillator.start(); oscillator.stop(context.currentTime + 0.35);
            }
            if (window.confirm(`${configs[timerType].label} finished! Switch to ${timerType === 'focus' ? 'Break' : 'Focus'}?`)) {
                toggleTimerType();
            }
        }
        return () => clearInterval(interval);
    }, [isActive, timeLeft]);

    // --- Music Controller Functions ---
    const handleVolumeChange = (newVolume: number) => {
        setVolume(newVolume);
        if (audioRef.current) {
            audioRef.current.volume = newVolume;
        }
    };

    useEffect(() => {
        if (audioRef.current) {
            audioRef.current.volume = volume;
            audioRef.current.onplay = () => {
                if (audioRef.current) audioRef.current.volume = volume;
            };
        }
    }, [volume, currentTrackIndex]);

    useEffect(() => {
        if (isMusicPlaying) {
            audioRef.current?.play().catch(() => setIsMusicPlaying(false));
        } else {
            audioRef.current?.pause();
        }
    }, [isMusicPlaying, currentTrackIndex]);

    const handleDragStart = (index: number) => {
        setDraggedIndex(index);
    };

    const handleDragOver = (e: React.DragEvent, index: number) => {
        e.preventDefault();
        if (draggedIndex === null || draggedIndex === index) return;

        const newTracks = [...tracks];
        const item = newTracks[draggedIndex];
        newTracks.splice(draggedIndex, 1);
        newTracks.splice(index, 0, item);

        setDraggedIndex(index);
        setTracks(newTracks);

        // Adjust currentTrackIndex if current playing track was moved
        if (currentTrackIndex === draggedIndex) {
            setCurrentTrackIndex(index);
        } else if (currentTrackIndex > draggedIndex && currentTrackIndex <= index) {
            setCurrentTrackIndex(currentTrackIndex - 1);
        } else if (currentTrackIndex < draggedIndex && currentTrackIndex >= index) {
            setCurrentTrackIndex(currentTrackIndex + 1);
        }
    };

    const handleDragEnd = () => {
        setDraggedIndex(null);
    };

    const handleNextTrack = () => {
        if (tracks.length === 0) return;
        setCurrentTrackIndex((prev) => (prev + 1) % tracks.length);
    };

    const handlePrevTrack = () => {
        if (tracks.length === 0) return;
        setCurrentTrackIndex((prev) => (prev - 1 + tracks.length) % tracks.length);
    };

    const formatTime = (seconds: number) => {
        const hrs = Math.floor(seconds / 3600);
        const mins = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;
        if (hrs > 0) {
            return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        }
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    const currentDuration = getDuration(timerType);
    const progress = (timeLeft / (currentDuration || 1)) * 100;
    const activeConfig = configs[timerType];

    const handleTimeChange = (timer: 'focus' | 'break', unit: 'h' | 'm', value: string) => {
        const val = Math.max(0, parseInt(value) || 0);
        if (timer === 'focus') {
            if (unit === 'h') setFocusHours(Math.min(val, 23));
            else setFocusMinutes(Math.min(val, 59));
        } else {
            if (unit === 'h') setBreakHours(Math.min(val, 23));
            else setBreakMinutes(Math.min(val, 59));
        }
        setIsActive(false);
    };

    useEffect(() => {
        if (!isActive) {
            setTimeLeft(getDuration(timerType));
        }
    }, [focusHours, focusMinutes, breakHours, breakMinutes, timerType]);

    const currentTrack = tracks[currentTrackIndex];

    const GhostButton = ({ onClick, active, activeClass, children, title }: { onClick: () => void; active?: boolean; activeClass?: string; children: React.ReactNode; title: string }) => (
        <button
            onClick={onClick}
            title={title}
            aria-label={title}
            className={`grid place-items-center p-2 rounded-lg transition-colors ${active
                ? activeClass
                : 'bg-ink-100 dark:bg-white/[0.06] text-ink-500 dark:text-ink-400 hover:text-ink-900 dark:hover:text-white'
                }`}
        >
            {children}
        </button>
    );

    return (
        <div className="surface-card relative overflow-hidden h-full flex flex-col transition-colors duration-200">
            <style>{`
                .custom-scrollbar::-webkit-scrollbar {
                    width: 4px;
                }
                .custom-scrollbar::-webkit-scrollbar-track {
                    background: rgba(127, 127, 127, 0.08);
                    border-radius: 10px;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                    background: rgba(20, 184, 166, 0.4);
                    border-radius: 10px;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                    background: rgba(20, 184, 166, 0.7);
                }
            `}</style>

            {currentTrack && (
                <audio
                    ref={audioRef}
                    src={currentTrack.url}
                    onEnded={isLooping ? undefined : handleNextTrack}
                    loop={isLooping}
                    preload="auto"
                    onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
                    onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
                />
            )}

            <div className="relative z-10 flex flex-col h-full p-5">
                {/* Header: mode toggle + tool buttons */}
                <div className="flex items-center justify-between gap-2 mb-6">
                    <div className="flex items-center bg-ink-100 dark:bg-white/[0.05] rounded-lg p-1">
                        {(['focus', 'break'] as const).map((type) => {
                            const active = timerType === type;
                            return (
                                <button
                                    key={type}
                                    onClick={() => {
                                        if (timerType !== type) {
                                            setTimerType(type);
                                            setTimeLeft(getDuration(type));
                                            setIsActive(false);
                                        }
                                    }}
                                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-display text-[0.6875rem] font-bold uppercase tracking-[0.08em] transition-colors ${active
                                        ? activeConfig.toggleActive
                                        : 'text-ink-500 dark:text-ink-400 hover:text-ink-900 dark:hover:text-white'
                                        }`}
                                >
                                    {type === 'focus' ? <Zap size={11} /> : <Coffee size={11} />}
                                    {type}
                                </button>
                            );
                        })}
                    </div>

                    <div className="flex items-center gap-1.5">
                        <GhostButton onClick={() => setShowSettings(!showSettings)} active={showSettings} activeClass="bg-ink-900 dark:bg-white text-white dark:text-ink-950" title="Duration settings">
                            <Timer size={15} />
                        </GhostButton>
                        <GhostButton onClick={() => setIsFullScreen(true)} title="Fullscreen mode">
                            <Maximize2 size={15} />
                        </GhostButton>
                        <GhostButton onClick={() => setShowMusic(!showMusic)} active={showMusic} activeClass="bg-brand-500/10 text-brand-600 dark:text-brand-400" title="Focus music">
                            <Music size={15} />
                        </GhostButton>
                    </div>
                </div>

                {/* Body */}
                <div className="flex flex-col items-center justify-center flex-1">
                    {showSettings ? (
                        <div className="w-full space-y-6 anim-pop">
                            <div className="space-y-3">
                                <p className="dashboard-eyebrow text-ink-400 dark:text-ink-500 text-center !text-[0.5625rem]">Focus duration</p>
                                <div className="flex justify-center gap-3">
                                    <div className="text-center">
                                        <input type="number" value={focusHours} onChange={(e) => handleTimeChange('focus', 'h', e.target.value)} className={`font-metric w-16 bg-ink-50 dark:bg-white/[0.05] border-b-2 ${activeConfig.input} text-xl font-bold text-center text-ink-900 dark:text-white focus:outline-none rounded-t-lg py-1.5`} />
                                        <p className="dashboard-eyebrow text-ink-400 dark:text-ink-500 mt-1.5 !text-[0.5rem]">hrs</p>
                                    </div>
                                    <div className="text-center">
                                        <input type="number" value={focusMinutes} onChange={(e) => handleTimeChange('focus', 'm', e.target.value)} className={`font-metric w-16 bg-ink-50 dark:bg-white/[0.05] border-b-2 ${activeConfig.input} text-xl font-bold text-center text-ink-900 dark:text-white focus:outline-none rounded-t-lg py-1.5`} />
                                        <p className="dashboard-eyebrow text-ink-400 dark:text-ink-500 mt-1.5 !text-[0.5rem]">min</p>
                                    </div>
                                </div>
                            </div>
                            <div className="space-y-3">
                                <p className="dashboard-eyebrow text-ink-400 dark:text-ink-500 text-center !text-[0.5625rem]">Break duration</p>
                                <div className="flex justify-center gap-3">
                                    <div className="text-center">
                                        <input type="number" value={breakHours} onChange={(e) => handleTimeChange('break', 'h', e.target.value)} className="font-metric w-16 bg-ink-50 dark:bg-white/[0.05] border-b-2 border-emerald-500 text-xl font-bold text-center text-ink-900 dark:text-white focus:outline-none rounded-t-lg py-1.5" />
                                        <p className="dashboard-eyebrow text-ink-400 dark:text-ink-500 mt-1.5 !text-[0.5rem]">hrs</p>
                                    </div>
                                    <div className="text-center">
                                        <input type="number" value={breakMinutes} onChange={(e) => handleTimeChange('break', 'm', e.target.value)} className="font-metric w-16 bg-ink-50 dark:bg-white/[0.05] border-b-2 border-emerald-500 text-xl font-bold text-center text-ink-900 dark:text-white focus:outline-none rounded-t-lg py-1.5" />
                                        <p className="dashboard-eyebrow text-ink-400 dark:text-ink-500 mt-1.5 !text-[0.5rem]">min</p>
                                    </div>
                                </div>
                            </div>
                            <button onClick={() => setShowSettings(false)} className="w-full py-2.5 bg-ink-900 dark:bg-white text-white dark:text-ink-950 rounded-xl dashboard-eyebrow transition-colors active:scale-[0.98]">
                                Save settings
                            </button>
                        </div>
                    ) : (
                        <div className="relative inline-block scale-90 sm:scale-100 transition-transform">
                            <svg className="w-44 h-44 transform -rotate-90 relative" viewBox="0 0 192 192">
                                <circle cx="96" cy="96" r="90" stroke="currentColor" strokeWidth="4" fill="transparent" className="text-ink-100 dark:text-white/[0.07]" />
                                <circle
                                    cx="96" cy="96" r="90" stroke={activeConfig.ring} strokeWidth="4" fill="transparent"
                                    strokeDasharray={565} strokeDashoffset={565 - (565 * progress) / 100}
                                    className="transition-all duration-1000 ease-linear"
                                    strokeLinecap="round"
                                />
                            </svg>
                            <div className="absolute inset-0 flex flex-col items-center justify-center">
                                <span className="dashboard-eyebrow text-ink-400 dark:text-ink-500 mb-2 !text-[0.5625rem]">{isActive ? 'Session running' : 'Ready'}</span>
                                <span className="font-metric text-[2.5rem] leading-none font-bold text-ink-900 dark:text-white tracking-[-0.04em] tabular-nums">{formatTime(timeLeft)}</span>
                                <span className={`dashboard-eyebrow !text-[0.5625rem] mt-3 px-2.5 py-1 rounded-md ${activeConfig.chip}`}>
                                    {activeConfig.label}
                                </span>
                            </div>
                        </div>
                    )}

                    {/* Music + controls */}
                    <div className="w-full space-y-4 mt-6">
                        {showMusic ? (
                            <div className="bg-ink-50 dark:bg-white/[0.04] rounded-xl p-3.5 border border-ink-200 dark:border-white/[0.06] anim-pop">
                                {loadingTracks ? (
                                    <div className="flex items-center justify-center p-2.5">
                                        <div className="h-5 w-5 rounded-full border-2 border-brand-500/20 border-t-brand-500 animate-spin" />
                                    </div>
                                ) : currentTrack ? (
                                    <div className="flex flex-col gap-3">
                                        <div className="flex items-center gap-3">
                                            <button
                                                onClick={() => setShowPlaylist(!showPlaylist)}
                                                className="w-10 h-10 rounded-lg bg-brand-500/10 text-brand-600 dark:text-brand-400 grid place-items-center shrink-0"
                                                title="Show queue"
                                            >
                                                <Music size={16} />
                                            </button>
                                            <div className="flex-1 min-w-0">
                                                <p className="font-display text-xs font-semibold text-ink-900 dark:text-white truncate">{currentTrack.title}</p>
                                                <p className="text-[0.625rem] text-ink-400 dark:text-ink-500 truncate mt-0.5">{currentTrack.artist}</p>
                                            </div>
                                            <div className="flex items-center gap-0.5 shrink-0">
                                                <button onClick={handlePrevTrack} className="p-1.5 rounded-md text-ink-400 hover:text-ink-900 dark:hover:text-white hover:bg-ink-200/60 dark:hover:bg-white/[0.08] transition-colors" aria-label="Previous track">
                                                    <SkipBack size={14} fill="currentColor" />
                                                </button>
                                                <button
                                                    onClick={() => setIsMusicPlaying(!isMusicPlaying)}
                                                    className="w-8 h-8 bg-ink-900 dark:bg-white text-white dark:text-ink-950 rounded-full grid place-items-center hover:opacity-90 active:scale-95 transition-all mx-0.5"
                                                    aria-label={isMusicPlaying ? 'Pause' : 'Play'}
                                                >
                                                    {isMusicPlaying ? <Pause size={13} fill="currentColor" /> : <Play size={13} className="translate-x-px" fill="currentColor" />}
                                                </button>
                                                <button onClick={handleNextTrack} className="p-1.5 rounded-md text-ink-400 hover:text-ink-900 dark:hover:text-white hover:bg-ink-200/60 dark:hover:bg-white/[0.08] transition-colors" aria-label="Next track">
                                                    <SkipForward size={14} fill="currentColor" />
                                                </button>
                                                <button
                                                    onClick={() => setIsLooping(!isLooping)}
                                                    className={`p-1.5 rounded-md transition-colors ${isLooping ? 'text-brand-600 dark:text-brand-400' : 'text-ink-400 hover:text-ink-900 dark:hover:text-white hover:bg-ink-200/60 dark:hover:bg-white/[0.08]'}`}
                                                    title={isLooping ? 'Disable loop' : 'Enable loop'}
                                                >
                                                    {isLooping ? <Repeat1 size={14} /> : <Repeat size={14} />}
                                                </button>
                                            </div>
                                        </div>

                                        {showPlaylist && (
                                            <div className="max-h-40 overflow-y-auto space-y-0.5 custom-scrollbar anim-rise pr-1">
                                                {tracks.map((track, idx) => (
                                                    <div
                                                        key={`${track.url}-${idx}`}
                                                        draggable
                                                        onDragStart={() => handleDragStart(idx)}
                                                        onDragOver={(e) => handleDragOver(e, idx)}
                                                        onDragEnd={handleDragEnd}
                                                        className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg transition-colors cursor-move group/item ${currentTrackIndex === idx ? 'bg-brand-500/10' : 'hover:bg-ink-200/50 dark:hover:bg-white/[0.06]'}`}
                                                    >
                                                        <GripVertical size={11} className="text-ink-300 dark:text-ink-600 shrink-0" />
                                                        <button
                                                            onClick={() => {
                                                                setCurrentTrackIndex(idx);
                                                                setIsMusicPlaying(true);
                                                            }}
                                                            className="flex-1 flex items-center gap-2.5 text-left truncate"
                                                        >
                                                            {currentTrackIndex === idx && isMusicPlaying ? (
                                                                <span className="flex items-end gap-[2px] h-3 shrink-0">
                                                                    <span className="eq-bar w-[2px] h-full bg-brand-500 rounded-full" />
                                                                    <span className="eq-bar w-[2px] h-full bg-brand-500 rounded-full" style={{ animationDelay: '-0.3s' }} />
                                                                    <span className="eq-bar w-[2px] h-full bg-brand-500 rounded-full" style={{ animationDelay: '-0.6s' }} />
                                                                </span>
                                                            ) : (
                                                                <span className={`font-metric text-[0.625rem] shrink-0 ${currentTrackIndex === idx ? 'text-brand-600 dark:text-brand-400' : 'text-ink-300 dark:text-ink-600'}`}>{String(idx + 1).padStart(2, '0')}</span>
                                                            )}
                                                            <p className={`text-xs font-medium truncate ${currentTrackIndex === idx ? 'text-brand-700 dark:text-brand-400' : 'text-ink-600 dark:text-ink-300'}`}>{track.title}</p>
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                        )}

                                        <div className="flex items-center gap-2.5">
                                            <Volume2 size={13} className="text-ink-400 dark:text-ink-500 shrink-0" />
                                            <input
                                                type="range"
                                                min="0"
                                                max="1"
                                                step="0.01"
                                                value={volume}
                                                onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
                                                className="flex-1 h-1 rounded-lg appearance-none cursor-pointer accent-brand-500 bg-ink-200 dark:bg-white/10"
                                                style={{
                                                    background: `linear-gradient(to right, #14b8a6 ${volume * 100}%, rgba(127,127,127,0.2) ${volume * 100}%)`
                                                }}
                                                aria-label="Volume"
                                            />
                                        </div>
                                    </div>
                                ) : (
                                    <p className="dashboard-eyebrow text-ink-400 dark:text-ink-500 text-center !text-[0.5625rem]">No tracks available</p>
                                )}
                            </div>
                        ) : (
                            <button
                                onClick={() => setShowMusic(true)}
                                className="w-full bg-ink-50 dark:bg-white/[0.03] rounded-xl px-4 py-3 border border-dashed border-ink-200 dark:border-white/[0.08] flex items-center gap-3 text-left hover:border-brand-500/50 transition-colors group"
                            >
                                <div className="w-9 h-9 rounded-lg bg-ink-100 dark:bg-white/[0.06] grid place-items-center text-ink-400 dark:text-ink-500 group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors shrink-0">
                                    <Music size={15} />
                                </div>
                                <div>
                                    <p className="font-display text-[0.8125rem] font-semibold text-ink-900 dark:text-white leading-none">Focus music</p>
                                    <p className="text-[0.6875rem] text-ink-400 dark:text-ink-500 mt-1">Tap to open the lo-fi player</p>
                                </div>
                            </button>
                        )}

                        <div className="flex items-center gap-2.5">
                            <button
                                onClick={() => setIsActive(!isActive)}
                                className={`flex-1 flex items-center justify-center gap-2 py-3.5 rounded-xl font-display text-sm font-bold tracking-wide transition-colors active:scale-[0.98] ${isActive
                                    ? 'bg-ink-900 dark:bg-white text-white dark:text-ink-950'
                                    : activeConfig.play
                                    }`}
                            >
                                {isActive ? <><Pause size={16} fill="currentColor" /> Pause</> : <><Play size={15} fill="currentColor" /> Start focus</>}
                            </button>
                            <button
                                onClick={() => {
                                    setIsActive(false);
                                    setTimeLeft(getDuration(timerType));
                                }}
                                className="p-3.5 bg-ink-100 dark:bg-white/[0.06] text-ink-400 hover:text-red-500 rounded-xl transition-colors active:scale-95"
                                title="Reset timer"
                                aria-label="Reset timer"
                            >
                                <RotateCcw size={16} />
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* ── Fullscreen mode ── */}
            {isFullScreen && (
                <div className={`fixed inset-0 z-[100] ${bgType === 'color' ? fsBackground : 'bg-black'} flex flex-col items-center justify-center anim-fade overflow-hidden select-none`}>
                    {/* Top controls */}
                    <div className="absolute top-6 left-0 right-0 px-6 sm:px-8 flex items-center justify-between z-50">
                        <div className="flex items-center gap-2 bg-white/[0.06] p-1.5 rounded-xl border border-white/10">
                            {[
                                { class: 'bg-[#090b10]', label: 'Deep Space' },
                                { class: 'bg-[#064e3b]', label: 'Evergreen' },
                                { class: 'bg-[#451a03]', label: 'Solar' },
                                { class: 'bg-[#1e1b4b]', label: 'Midnight' },
                                { class: 'bg-[#312e81]', label: 'Ocean' },
                            ].map((bg, i) => (
                                <button
                                    key={i}
                                    onClick={() => handleThemeChange(bg)}
                                    className={`w-6 h-6 rounded-full border-2 transition-transform hover:scale-110 ${bg.class} ${fsBackground === bg.class ? 'border-white scale-110' : 'border-white/15'}`}
                                    title={bg.label}
                                />
                            ))}
                        </div>
                        <button
                            onClick={() => setIsFullScreen(false)}
                            className="p-3 bg-white/[0.06] text-white/60 hover:text-red-400 rounded-xl transition-colors border border-white/10"
                            title="Exit fullscreen"
                        >
                            <Minimize2 size={20} />
                        </button>
                    </div>

                    {/* Timer */}
                    <div className="relative z-10 flex flex-col items-center justify-center space-y-8 max-w-2xl w-full px-6 flex-1 pt-10">
                        <div className="text-center space-y-1.5">
                            <span className="dashboard-eyebrow text-white/30 !text-[0.625rem]">
                                Focus integrated
                            </span>
                            <h2 className="font-display text-xl font-bold text-white tracking-[-0.01em]">
                                {activeConfig.label}
                            </h2>
                        </div>

                        <div className="relative">
                            <svg className="w-64 h-64 sm:w-72 sm:h-72 transform -rotate-90" viewBox="0 0 280 280">
                                <circle cx="140" cy="140" r="130" stroke="rgba(255,255,255,0.07)" strokeWidth="4" fill="transparent" />
                                <circle
                                    cx="140" cy="140" r="130" stroke={activeConfig.ring} strokeWidth="5" fill="transparent"
                                    strokeDasharray={817} strokeDashoffset={817 - (817 * progress) / 100}
                                    className="transition-all duration-1000 ease-linear"
                                    strokeLinecap="round"
                                />
                            </svg>
                            <div className="absolute inset-0 flex flex-col items-center justify-center">
                                <span className="font-metric text-5xl sm:text-6xl font-bold text-white tracking-[-0.04em] tabular-nums">
                                    {formatTime(timeLeft)}
                                </span>
                                <span className="dashboard-eyebrow text-white/40 mt-3 !text-[0.5625rem]">
                                    {isActive ? 'Session running' : 'Ready'}
                                </span>
                            </div>
                        </div>

                        <div className="flex items-center gap-3.5 w-full max-w-xs">
                            <button
                                onClick={() => setIsActive(!isActive)}
                                className={`flex-1 flex items-center justify-center gap-2.5 py-4 rounded-2xl font-display font-bold uppercase tracking-[0.12em] text-sm transition-colors active:scale-[0.98] ${isActive
                                    ? 'bg-white text-black'
                                    : `${activeConfig.ring === '#14b8a6' ? 'bg-brand-500 hover:bg-brand-400 text-ink-950' : 'bg-emerald-500 hover:bg-emerald-400 text-ink-950'}`
                                    }`}
                            >
                                {isActive ? <><Pause size={20} fill="currentColor" /> Pause</> : <><Play size={20} fill="currentColor" /> Start</>}
                            </button>
                            <button
                                onClick={() => {
                                    setIsActive(false);
                                    setTimeLeft(getDuration(timerType));
                                }}
                                className="p-4 bg-white/[0.06] text-white/50 hover:text-white rounded-2xl transition-colors active:scale-90 border border-white/[0.08]"
                                title="Reset"
                            >
                                <RotateCcw size={20} />
                            </button>
                        </div>
                    </div>

                    {/* Floating music widget */}
                    {currentTrack && (
                        <div className={`absolute bottom-6 right-4 left-4 sm:left-auto sm:right-8 sm:bottom-8 sm:w-80 bg-[#111111] border border-white/10 rounded-2xl shadow-2xl anim-slide-up z-50 group/widget overflow-hidden transition-all ${showPlaylist ? 'h-[28rem]' : 'h-auto'}`}>
                            {/* Playlist overlay */}
                            {showPlaylist && (
                                <div className="absolute inset-0 bg-[#0d0d0d] z-50 anim-fade flex flex-col pt-12 pb-6 px-4">
                                    <div className="flex items-center justify-between mb-4 px-2">
                                        <div className="space-y-0.5">
                                            <h3 className="dashboard-eyebrow text-brand-400 !text-[0.625rem]">Queue</h3>
                                            <p className="text-[0.625rem] text-white/30">Next in stack</p>
                                        </div>
                                        <button onClick={() => setShowPlaylist(false)} className="p-2 bg-white/5 rounded-lg text-white/40 hover:text-white transition-colors" aria-label="Close queue">
                                            <Minimize2 size={14} />
                                        </button>
                                    </div>
                                    <div className="flex-1 overflow-y-auto space-y-1 custom-scrollbar pr-1 pb-4">
                                        {tracks.map((track, idx) => (
                                            <div
                                                key={`${track.url}-${idx}`}
                                                draggable
                                                onDragStart={() => handleDragStart(idx)}
                                                onDragOver={(e) => handleDragOver(e, idx)}
                                                onDragEnd={handleDragEnd}
                                                className={`w-full flex items-center gap-3 p-2.5 rounded-xl transition-colors cursor-move group/track relative overflow-hidden ${currentTrackIndex === idx ? 'bg-brand-500/10 border border-brand-500/25' : 'hover:bg-white/[0.05] border border-transparent'}`}
                                            >
                                                {currentTrackIndex === idx && (
                                                    <div className="absolute left-0 top-0 bottom-0 w-[2px] bg-brand-500" />
                                                )}
                                                <GripVertical size={13} className="text-white/15 group-hover/track:text-white/30 transition-colors shrink-0" />
                                                <button
                                                    onClick={() => {
                                                        setCurrentTrackIndex(idx);
                                                        setIsMusicPlaying(true);
                                                        setShowPlaylist(false);
                                                    }}
                                                    className="flex-1 flex items-center gap-3.5 min-w-0"
                                                >
                                                    <div className={`w-9 h-9 rounded-lg grid place-items-center shrink-0 ${currentTrackIndex === idx ? 'bg-brand-500/15 text-brand-400' : 'bg-white/[0.06] text-white/30'}`}>
                                                        <Music size={14} />
                                                    </div>
                                                    <div className="flex-1 text-left min-w-0">
                                                        <p className={`font-display text-xs font-semibold truncate ${currentTrackIndex === idx ? 'text-brand-300' : 'text-white'}`}>{track.title}</p>
                                                        <p className={`text-[0.625rem] truncate mt-0.5 ${currentTrackIndex === idx ? 'text-white/40' : 'text-white/25'}`}>{track.artist}</p>
                                                    </div>
                                                </button>
                                                {currentTrackIndex === idx && isMusicPlaying && (
                                                    <div className="flex items-end gap-[2.5px] h-4 pr-1">
                                                        <span className="eq-bar w-[3px] h-full bg-brand-400 rounded-full" />
                                                        <span className="eq-bar w-[3px] h-full bg-brand-400 rounded-full" style={{ animationDelay: '-0.3s' }} />
                                                        <span className="eq-bar w-[3px] h-full bg-brand-400 rounded-full" style={{ animationDelay: '-0.6s' }} />
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <div className="p-4">
                                <div className="flex gap-3.5">
                                    {/* Artwork */}
                                    <button
                                        onClick={() => setShowPlaylist(!showPlaylist)}
                                        className="w-16 h-16 rounded-xl bg-white/[0.06] border border-white/[0.08] grid place-items-center relative overflow-hidden shrink-0 group/art"
                                        title="Show queue"
                                    >
                                        <Music size={24} className={`text-white transition-opacity ${isMusicPlaying ? 'opacity-90' : 'opacity-40'}`} />
                                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/art:opacity-100 transition-opacity grid place-items-center">
                                            <ListMusic size={16} className="text-white/70" />
                                        </div>
                                    </button>

                                    <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5">
                                        <div className="space-y-0.5">
                                            <h4 className="font-display text-sm font-semibold text-white truncate">
                                                {currentTrack.title}
                                            </h4>
                                            <p className="text-[0.625rem] text-white/40 truncate">
                                                {currentTrack.artist}
                                            </p>
                                        </div>

                                        {/* Progress */}
                                        <div className="space-y-1.5">
                                            <div className="relative h-1 bg-white/10 rounded-full overflow-hidden">
                                                <div
                                                    className="absolute inset-y-0 left-0 bg-brand-400 transition-all duration-300"
                                                    style={{ width: `${(currentTime / (duration || 1)) * 100}%` }}
                                                />
                                            </div>
                                            <div className="flex justify-between items-center font-metric text-[0.5625rem] text-white/30 leading-none tabular-nums">
                                                <span>{Math.floor(currentTime / 60)}:{(Math.floor(currentTime % 60)).toString().padStart(2, '0')}</span>
                                                <span>{duration ? `${Math.floor(duration / 60)}:${(Math.floor(duration % 60)).toString().padStart(2, '0')}` : '0:00'}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Controls */}
                                <div className="mt-4 flex items-center justify-between px-1">
                                    <div className="flex items-center gap-3.5">
                                        <button onClick={handlePrevTrack} className="text-white/40 hover:text-white transition-colors" aria-label="Previous">
                                            <SkipBack size={17} fill="currentColor" />
                                        </button>
                                        <button
                                            onClick={() => setIsMusicPlaying(!isMusicPlaying)}
                                            className="w-9 h-9 bg-white text-black rounded-full grid place-items-center hover:opacity-90 active:scale-95 transition-all"
                                            aria-label={isMusicPlaying ? 'Pause' : 'Play'}
                                        >
                                            {isMusicPlaying ? <Pause size={17} fill="currentColor" /> : <Play size={17} className="translate-x-px" fill="currentColor" />}
                                        </button>
                                        <button onClick={handleNextTrack} className="text-white/40 hover:text-white transition-colors" aria-label="Next">
                                            <SkipForward size={17} fill="currentColor" />
                                        </button>
                                        <button
                                            onClick={() => setIsLooping(!isLooping)}
                                            className={`p-1.5 rounded-md transition-colors ${isLooping ? 'text-brand-400' : 'text-white/40 hover:text-white hover:bg-white/5'}`}
                                            title={isLooping ? 'Disable loop' : 'Enable loop'}
                                        >
                                            {isLooping ? <Repeat1 size={16} /> : <Repeat size={16} />}
                                        </button>
                                        <button
                                            onClick={() => setShowPlaylist(!showPlaylist)}
                                            className={`p-1.5 rounded-md transition-colors ${showPlaylist ? 'bg-brand-500/15 text-brand-400' : 'text-white/40 hover:text-white hover:bg-white/5'}`}
                                            title="Queue"
                                        >
                                            <ListMusic size={16} />
                                        </button>
                                    </div>
                                    <div className="hidden sm:flex items-center gap-2 w-24">
                                        <Volume2 size={13} className="text-white/30 shrink-0" />
                                        <input
                                            type="range" min="0" max="1" step="0.01" value={volume}
                                            onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
                                            className="flex-1 h-1 rounded-lg appearance-none cursor-pointer accent-white"
                                            style={{
                                                background: `linear-gradient(to right, white ${volume * 100}%, rgba(255,255,255,0.1) ${volume * 100}%)`
                                            }}
                                            aria-label="Volume"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
