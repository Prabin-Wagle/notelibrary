import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { LatexRenderer } from '../components/latexRender';
import { decodeContent } from '../utils/data-handler';
import { Clock, ChevronLeft, ChevronRight, CheckCircle, Bookmark, Timer, LogOut, ArrowRight, LayoutGrid, X, List, FileText } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../contexts/AuthContext';
import { apiRequest, jsonBody } from '../lib/api';

interface Question {
    questionId: string;
    questionNo: number | string;
    questionText: string;
    imageLink?: string | null;
    question?: string;
    options: string[];
    optionIds: number[];
    correctOption: number;
    marks: number;
    explanation: string;
    unitId?: string | null;
    chapterId?: string | null;
    originalIndex: number;
    shuffledOptions?: number[];
    is_scrambled?: boolean;
}

interface QuizData {
    id: number;
    title: string;
    time_limit: number;
    negative_marking: number;
    questions: Question[];
    mode?: string;
    start_time?: string | null;
    end_time?: string | null;
    server_time?: string;
    attempt_count?: number;
    quiz_session_id?: string;
}

const DecoyText: React.FC = () => {
    const decoys = ["notelib", "exam", "secure", "test", "prop", "math", "verify", "ans", "correct", "question"];
    const randomDecoy = decoys[Math.floor(Math.random() * decoys.length)];
    return (
        <span style={{ display: 'none', width: 0, height: 0, overflow: 'hidden', opacity: 0 }} aria-hidden="true">
            {randomDecoy}
        </span>
    );
};

const QuizPlayerPage: React.FC = () => {
    const { quizId } = useParams<{ quizId: string }>();
    const collectionId = new URLSearchParams(window.location.search).get('collectionId');
    const navigate = useNavigate();

    const [quizData, setQuizData] = useState<QuizData | null>(null);
    const [attemptId, setAttemptId] = useState<number | null>(null);
    const [loading, setLoading] = useState(true);
    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
    const [selectedOptions, setSelectedOptions] = useState<{ [key: number]: number }>({});
    const [timeLeft, setTimeLeft] = useState(0);
    const [hasStarted, setHasStarted] = useState(false);
    const [bookmarkedQuestions, setBookmarkedQuestions] = useState<Set<number>>(new Set());
    const [submitting, setSubmitting] = useState(false);

    // Per-question timer - use object to track all times at once
    const [questionTimes, setQuestionTimes] = useState<{ [key: number]: number }>({});

    const [hasAttempted, setHasAttempted] = useState(false);
    const [warningShown, setWarningShown] = useState(false);
    const [showMobileSidebar, setShowMobileSidebar] = useState(false);
    const [isTimeUp, setIsTimeUp] = useState(false);
    const [readonly, setReadonly] = useState(false);
    const [viewMode, setViewMode] = useState<'single' | 'list'>('single');

    const isExiting = useRef(false);
    const quizLoadStarted = useRef<string | null>(null);
    const answerSaveQueue = useRef<Promise<unknown>>(Promise.resolve());
    const unsavedAnswers = useRef(new Map<string, number>());
    const answerRevision = useRef(0);
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const questionTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const { token } = useAuth();

    const [randomClasses] = useState(() => ({
        questionBox: 'qb_' + Math.random().toString(36).substring(2, 7),
        optionBtn: 'ob_' + Math.random().toString(36).substring(2, 7),
        optionIdx: 'oi_' + Math.random().toString(36).substring(2, 7),
        optionText: 'ot_' + Math.random().toString(36).substring(2, 7),
        optionRow: 'or_' + Math.random().toString(36).substring(2, 7),
        decoyDiv: 'dd_' + Math.random().toString(36).substring(2, 7),
        questionId: 'qid_' + Math.random().toString(36).substring(2, 7),
        optionsContainerId: 'ocid_' + Math.random().toString(36).substring(2, 7)
    }));

    useEffect(() => {
        if (!hasStarted) return;

        document.documentElement.style.overflow = 'hidden';
        document.body.style.overflow = 'hidden';
        document.body.style.height = '100%';

        return () => {
            document.documentElement.style.overflow = '';
            document.body.style.overflow = '';
            document.body.style.height = '';
        };
    }, [hasStarted]);

    useEffect(() => {
        if (!token) {
            navigate('/login');
            return;
        }

        if (quizLoadStarted.current === quizId) return;
        quizLoadStarted.current = quizId || null;
        loadQuiz();
    }, [quizId]);

    const loadQuiz = async () => {
        setLoading(true);
        try {
            const { quiz } = await apiRequest<{ quiz: { id: number; title: string; duration_seconds: number | null; questions: Array<{ id: number; question_text: string; image_url: string | null; marks: number; negative_marks: number; options: Array<{ id: number; option_text: string }> }> } }>(`/quizzes/${quizId}`);
            const { attempt_id } = await apiRequest<{ attempt_id: number }>(`/quizzes/${quizId}/attempts`, { method: 'POST', body: jsonBody({}) });
            setAttemptId(attempt_id);
            localStorage.removeItem(`quiz_progress_${quizId}`);
            const data: QuizData = {
                id: quiz.id,
                title: quiz.title,
                time_limit: Math.max(1, Math.ceil((quiz.duration_seconds || 1200) / 60)),
                negative_marking: 0,
                mode: 'PRACTICE',
                questions: quiz.questions.map((question, idx) => ({
                    questionId: String(question.id),
                    questionNo: idx + 1,
                    questionText: question.question_text,
                    imageLink: question.image_url,
                    options: question.options.map((option) => option.option_text),
                    optionIds: question.options.map((option) => option.id),
                    correctOption: -1,
                    marks: Number(question.marks),
                    explanation: '',
                    originalIndex: idx,
                })),
            };

                if (!data.questions || !Array.isArray(data.questions)) {
                    toast.error("Quiz data is corrupted or empty");
                    setLoading(false);
                    return;
                }

                // Check for live attempt limit
                if (data.mode === 'LIVE' && (data.attempt_count || 0) > 0) {
                    setHasAttempted(true);
                }

                const questionsWithOriginalIndex = data.questions.map((q: Question, idx: number) => {
                    const optionIndices = q.options.map((_, i: number) => i);

                    return {
                        ...q,
                        questionText: q.questionText || q.question || '',
                        originalIndex: q.originalIndex !== undefined ? q.originalIndex : idx,
                        shuffledOptions: optionIndices,
                        options: q.options,
                        correctOption: q.correctOption
                    };
                });

                const shuffledQuestions = questionsWithOriginalIndex;

                // --- PERSISTENCE RESTORATION ---
                const savedProgress: string | null = null;
                let finalQuestions = shuffledQuestions;

                if (savedProgress) {
                    try {
                        const state = JSON.parse(savedProgress);
                        const lastSaved = state.lastSaved || 0;
                        const ageInSeconds = Math.floor((new Date().getTime() - lastSaved) / 1000);
                        if (ageInSeconds <= 600) { // Extended to 10 mins
                            // Check if questions are scrambled with old non-ASCII characters
                            const firstQ = state.questions?.[0];
                            const textToCheck = firstQ?.questionText || firstQ?.question || '';
                            const hasOldUnicode = [...String(textToCheck)].some((char) => char.charCodeAt(0) > 127);
                            
                            if (hasOldUnicode) {
                                localStorage.removeItem(`quiz_progress_${quizId}`);
                            } else if (state.questions) {
                                finalQuestions = state.questions;
                                setSelectedOptions(state.selectedOptions || {});
                                setBookmarkedQuestions(new Set(state.bookmarkedQuestions || []));
                                setQuestionTimes(state.questionTimes || {});
                                setCurrentQuestionIndex(state.currentQuestionIndex || 0);
                                setHasStarted(state.hasStarted || false);

                                if (data.mode !== 'LIVE' && state.timeLeft) {
                                    setTimeLeft(state.timeLeft);
                                }
                                if (state.readonly) {
                                    setReadonly(true);
                                }
                            }
                        } else {
                            localStorage.removeItem(`quiz_progress_${quizId}`);
                        }
                    } catch {
                        localStorage.removeItem(`quiz_progress_${quizId}`);
                    }
                }

                setQuizData({
                    ...data,
                    questions: finalQuestions
                });

                // --- LIVE QUIZ TIME SYNC LOGIC ---
                if (data.mode === 'LIVE' && data.start_time && data.end_time) {
                    const now = new Date().getTime();
                    const startTs = new Date(data.start_time.replace(' ', 'T')).getTime();
                    const endTs = new Date(data.end_time.replace(' ', 'T')).getTime();

                    // The actual limit is the smaller of configured limit OR total window duration
                    const windowSeconds = Math.floor((endTs - startTs) / 1000);
                    const configSeconds = data.time_limit * 60;
                    const effectiveLimitSeconds = Math.min(configSeconds, windowSeconds);

                    if (now < startTs) {
                        setTimeLeft(effectiveLimitSeconds);
                    } else if (now > endTs) {
                        setTimeLeft(0);
                    } else {
                        const globalRemaining = Math.floor((endTs - now) / 1000);
                        setTimeLeft(Math.min(effectiveLimitSeconds, globalRemaining));
                    }
                } else if (!savedProgress) {
                    // Normal Quiz - only set if no saved progress
                    setTimeLeft(data.time_limit * 60);
                }

            
        } catch (err) {
            console.error("Load error:", err);
            toast.error(err instanceof Error ? err.message : 'Could not load this test.');
        } finally {
            setLoading(false);
        }
    };

    // Overall quiz timer
    useEffect(() => {
        // Run timer if:
        // 1. Quiz has been started by user
        // 2. OR it's a LIVE quiz and it's already past start time (ongoing)
        const isLiveOngoing = quizData?.mode === 'LIVE' && quizData.start_time && new Date().getTime() >= new Date(quizData.start_time.replace(' ', 'T')).getTime();

        if ((hasStarted || isLiveOngoing) && timeLeft > 0) {
            timerRef.current = setInterval(() => {
                setTimeLeft(prev => {
                    if (prev === 300 && !warningShown) {
                        toast("5 minutes remaining!", { icon: '⏰', duration: 5000 });
                        setWarningShown(true);
                    }
                    if (prev <= 1) {
                        // Time's up logic
                        setTimeLeft(0);
                        setIsTimeUp(true);
                        setReadonly(true);
                        return 0;
                    }
                    return prev - 1;
                });
            }, 1000);
        }
        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
        };
    }, [hasStarted, timeLeft, quizData]);

    // Per-question timer - runs continuously
    useEffect(() => {
        if (!hasStarted) return;

        questionTimerRef.current = setInterval(() => {
            setQuestionTimes(prev => ({
                ...prev,
                [currentQuestionIndex]: (prev[currentQuestionIndex] || 0) + 1
            }));
        }, 1000);

        return () => {
            if (questionTimerRef.current) clearInterval(questionTimerRef.current);
        };
    }, [currentQuestionIndex, hasStarted]);

    // Save progress to localStorage
    useEffect(() => {
        if (!quizData || submitting || isExiting.current) return;

        const state = {
            questions: quizData.questions,
            selectedOptions,
            bookmarkedQuestions: Array.from(bookmarkedQuestions),
            questionTimes,
            currentQuestionIndex,
            hasStarted,
            timeLeft,
            readonly,
            lastSaved: new Date().getTime()
        };

        localStorage.setItem(`quiz_progress_${quizId}`, JSON.stringify(state));
    }, [selectedOptions, bookmarkedQuestions, questionTimes, currentQuestionIndex, hasStarted, timeLeft, quizData, submitting, quizId, readonly]);

    const handleQuestionChange = (newIndex: number) => {
        setCurrentQuestionIndex(newIndex);
        if (viewMode === 'list') {
            setTimeout(() => {
                const el = document.getElementById(`q-card-${newIndex}`);
                if (el) {
                    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
            }, 50);
        }
    };

    const handleOptionSelect = (idx: number) => {
        if (readonly) {
            toast.error("Time expired. You can only view questions now.");
            return;
        }
        const question = quizData?.questions[currentQuestionIndex];
        const currentAttempt = attemptId;
        if (!question || !currentAttempt) return;
        setSelectedOptions(prev => ({ ...prev, [currentQuestionIndex]: idx }));
        const optionId = question.optionIds[idx];
        if (optionId) {
            const questionId = question.questionId;
            const revision = ++answerRevision.current;
            unsavedAnswers.current.set(questionId, revision);
            answerSaveQueue.current = answerSaveQueue.current.then(async () => {
                try {
                    await apiRequest(`/quiz-attempts/${currentAttempt}/answers/${questionId}`, {
                        method: 'PATCH', body: jsonBody({ selected_option_id: optionId }),
                    });
                    if (unsavedAnswers.current.get(questionId) === revision) unsavedAnswers.current.delete(questionId);
                } catch (error) {
                    toast.error(error instanceof Error ? error.message : 'Answer could not be saved.');
                }
            });
        }
    };

    const toggleBookmark = () => {
        if (readonly) return;
        setBookmarkedQuestions(prev => {
            const next = new Set(prev);
            if (next.has(currentQuestionIndex)) {
                next.delete(currentQuestionIndex);
            } else {
                next.add(currentQuestionIndex);
            }
            return next;
        });
    };

    const handleExit = () => {
        const confirmed = window.confirm("Are you sure you want to exit? Your progress will be lost.");
        if (confirmed) {
            isExiting.current = true;
            localStorage.removeItem(`quiz_progress_${quizId}`);
            if (collectionId) {
                navigate(`/test-series/${collectionId}`);
            } else {
                navigate('/test-series');
            }
        }
    };

    const handleBackToLibrary = () => {
        isExiting.current = true;
        localStorage.removeItem(`quiz_progress_${quizId}`);
        if (collectionId) {
            navigate(`/test-series/${collectionId}`);
        } else {
            navigate('/test-series');
        }
    };

    const handleSubmit = async (isAuto = false) => {
        if (!quizData || submitting) return;

        const answeredCount = Object.keys(selectedOptions).length;
        if (answeredCount === 0 && !isAuto) {
            toast.error("Please attempt at least 1 question before submitting!");
            return;
        }

        if (!isAuto) {
            const confirmed = window.confirm(`You have answered ${answeredCount} out of ${quizData.questions.length} questions. Submit your test?`);
            if (!confirmed) return;
        }

        setSubmitting(true);
        const loadingToast = toast.loading("Submitting...");

        try {
            if (!attemptId) throw new Error('The test attempt was not started. Reload the test and try again.');
            await answerSaveQueue.current;
            if (unsavedAnswers.current.size) throw new Error('An answer is still not saved. Check your connection and try again.');
            await apiRequest(`/quiz-attempts/${attemptId}/submit`, { method: 'POST', body: jsonBody({}) });
            toast.success('Test submitted.', { id: loadingToast });
            isExiting.current = true;
            localStorage.removeItem(`quiz_progress_${quizId}`);
            navigate(`/test-series/result/${attemptId}`);
        } catch (err) {
            console.error("Submit error:", err);
            toast.error("Connection error", { id: loadingToast });
        } finally {
            setSubmitting(false);
        }
    };

    const formatTime = (seconds: number) => {
        const hrs = Math.floor(seconds / 3600);
        const mins = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;
        return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    const getStatusColor = (idx: number) => {
        if (selectedOptions[idx] !== undefined) return 'bg-green-500 dark:bg-green-600 text-white border-transparent';
        if (bookmarkedQuestions.has(idx)) return 'bg-yellow-500 dark:bg-yellow-600 text-white border-transparent';
        return 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:border-gray-900 dark:hover:border-blue-500';
    };

    if (loading) return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950">
            <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 dark:border-blue-400 mx-auto mb-4"></div>
                <p className="text-gray-500 text-xs font-bold uppercase tracking-widest">Loading Quiz Data...</p>
            </div>
        </div>
    );

    const currentQ = quizData?.questions[currentQuestionIndex];
    const currentQuestionTime = questionTimes[currentQuestionIndex] || 0;

    return (
        <div className="h-screen bg-white dark:bg-gray-950 flex flex-col overflow-hidden transition-colors duration-300">
            {!hasStarted ? (
                <div className="flex-1 flex items-center justify-center p-6 bg-gradient-to-b from-gray-50 to-white dark:from-gray-950 dark:to-gray-900">
                    <div className="max-w-md w-full text-center">
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 text-[10px] font-bold uppercase tracking-widest mb-6 border border-blue-100 dark:border-blue-900/30">
                            Security Verified
                        </div>
                        <h1 className="text-3xl font-black mb-4 text-gray-900 dark:text-white leading-tight">
                            {quizData ? quizData.title : "Ready to Begin"}
                        </h1>
                        <p className="text-gray-500 dark:text-gray-400 mb-8 text-sm leading-relaxed px-4">
                            Ensure a stable connection. For LIVE quizzes, the timer syncs with the exam schedule even if you refresh.
                        </p>

                        <div className="grid grid-cols-2 gap-4 mb-8">
                            <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm transition-all hover:border-blue-200 dark:hover:border-blue-900/50 group">
                                <div className="text-[9px] text-gray-400 dark:text-gray-500 mb-1 uppercase tracking-widest font-black group-hover:text-blue-500 transition-colors">Time Limit</div>
                                <div className="text-3xl font-black text-gray-900 dark:text-white tabular-nums">
                                    {timeLeft < 60 ? `${timeLeft}s` : `${Math.floor(timeLeft / 60)}m`}
                                </div>
                            </div>
                            <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm transition-all hover:border-blue-200 dark:hover:border-blue-900/50 group">
                                <div className="text-[9px] text-gray-400 dark:text-gray-500 mb-1 uppercase tracking-widest font-black group-hover:text-blue-500 transition-colors">Questions</div>
                                <div className="text-3xl font-black text-gray-900 dark:text-white tabular-nums">{quizData?.questions.length || 0}</div>
                            </div>
                        </div>

                        {hasAttempted ? (
                            <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900/30 rounded-xl mb-6">
                                <p className="text-red-600 dark:text-red-400 text-xs font-bold font-sans">
                                    You have already attempted this Live Quiz. Only one attempt is allowed.
                                </p>
                            </div>
                        ) : (
                            (
                                <button
                                    onClick={() => setHasStarted(true)}
                                    className="w-full py-4 bg-blue-600 dark:bg-blue-600 text-white rounded-xl hover:bg-blue-700 dark:hover:bg-blue-700 font-bold mb-4 transition-all shadow-xl shadow-blue-200 dark:shadow-blue-900/20 active:scale-95 flex items-center justify-center gap-2 group animate-in fade-in slide-in-from-bottom-4 duration-500"
                                >
                                    <span>START EXAMINATION</span>
                                    <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                                </button>
                            )
                        )}

                        <div className="flex flex-col gap-4">
                            <button
                                onClick={handleBackToLibrary}
                                className="text-sm font-bold text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors flex items-center justify-center gap-1"
                            >
                                <ChevronLeft size={16} />
                                <span>Back to Library</span>
                            </button>
                        </div>
                    </div>
                </div>
            ) : (
                <>
                    <header className="px-6 py-4 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between sticky top-0 bg-white dark:bg-gray-950 z-30 transition-colors">
                        <div className="flex items-center gap-4">
                            <button
                                onClick={handleExit}
                                className="flex items-center gap-2 px-3 py-2 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg text-gray-500 hover:text-red-600 transition-all group"
                                title="Exit Quiz"
                            >
                                <LogOut size={18} className="group-hover:-translate-x-1 transition-transform" />
                                <span className="text-xs font-bold uppercase tracking-wider hidden sm:inline">Exit</span>
                            </button>
                            <div className="h-6 w-px bg-gray-200 dark:bg-gray-800"></div>
                            <div className="hidden xs:block">
                                <h2 className="text-sm font-black text-gray-900 dark:text-white truncate max-w-[120px] sm:max-w-[200px]">{quizData?.title}</h2>
                            </div>
                        </div>

                        {/* Layout Toggle Option (Single Question vs Single Page) */}
                        <div className="flex items-center bg-gray-100 dark:bg-gray-900 p-1 rounded-xl border border-gray-200/50 dark:border-gray-800">
                            <button
                                onClick={() => setViewMode('single')}
                                className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-1.5 ${
                                    viewMode === 'single'
                                        ? 'bg-white dark:bg-gray-800 text-blue-600 dark:text-blue-400 shadow-sm'
                                        : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'
                                }`}
                            >
                                <FileText size={12} />
                                <span className="hidden sm:inline">One-by-One</span>
                                <span className="sm:hidden">1by1</span>
                            </button>
                            <button
                                onClick={() => setViewMode('list')}
                                className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-1.5 ${
                                    viewMode === 'list'
                                        ? 'bg-white dark:bg-gray-800 text-blue-600 dark:text-blue-400 shadow-sm'
                                        : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'
                                }`}
                            >
                                <List size={12} />
                                <span className="hidden sm:inline">Single Page</span>
                                <span className="sm:hidden">All</span>
                            </button>
                        </div>

                        <div className="flex items-center gap-3">
                            <div className={`flex items-center gap-2 px-4 py-2 rounded-xl font-black border transition-all shadow-sm ${timeLeft < 300 ? 'bg-red-500 text-white border-red-600 animate-pulse' : 'bg-gray-900 dark:bg-blue-600 text-white border-gray-900 dark:border-blue-700'
                                }`}>
                                <Clock size={16} />
                                <span className="text-sm tabular-nums tracking-tighter">{formatTime(timeLeft)}</span>
                            </div>
                            <button
                                onClick={() => handleSubmit(false)}
                                disabled={submitting}
                                className="px-5 py-2.5 bg-green-500 hover:bg-green-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest disabled:opacity-50 transition-all shadow-lg shadow-green-500/20 active:scale-95 flex items-center gap-2"
                            >
                                {submitting ? '...' : (
                                    <>
                                        <CheckCircle size={14} />
                                        <span>Finish</span>
                                    </>
                                )}
                            </button>
                        </div>
                    </header>

                    <main className="flex-1 flex overflow-hidden">
                        <div className="flex-1 overflow-y-auto px-6 py-12">
                            <div className="max-w-3xl mx-auto">
                                {viewMode === 'single' ? (
                                    <>
                                        <div className="flex items-center justify-between mb-8">
                                            <div className="flex items-center gap-2">
                                                <span className="text-3xl font-black text-gray-900 dark:text-white">Q{currentQuestionIndex + 1}</span>
                                                <span className="text-gray-400 dark:text-gray-600 font-bold">/ {quizData?.questions.length}</span>
                                            </div>
                                            
                                            {/* Specific question elapsed timer beside bookmark! */}
                                            <div className="flex items-center gap-3">
                                                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-800 text-gray-600 dark:text-gray-400">
                                                    <Timer size={14} className="text-gray-400" />
                                                    <span className="text-xs font-black tabular-nums">{formatTime(currentQuestionTime)}</span>
                                                </div>
                                                <button
                                                    onClick={toggleBookmark}
                                                    className={`p-2.5 rounded-xl border transition-all ${bookmarkedQuestions.has(currentQuestionIndex)
                                                        ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 border-yellow-300 dark:border-yellow-700 shadow-md'
                                                        : 'bg-white dark:bg-gray-800 text-gray-400 dark:text-gray-500 border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700'
                                                        }`}
                                                >
                                                    <Bookmark size={22} fill={bookmarkedQuestions.has(currentQuestionIndex) ? "currentColor" : "none"} />
                                                </button>
                                            </div>
                                        </div>

                                        <div id={randomClasses.questionId} className={`${randomClasses.questionBox} text-xl font-bold text-gray-900 dark:text-white mb-8 leading-relaxed`}>
                                            <LatexRenderer>
                                                {currentQ?.is_scrambled ? decodeContent(currentQ.questionText) : (currentQ?.questionText || currentQ?.question || '')}
                                            </LatexRenderer>
                                            <DecoyText />
                                        </div>

                                        {currentQ?.imageLink && (
                                            <div className="mb-8 rounded-2xl overflow-hidden border border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 p-4 transition-colors">
                                                <img src={currentQ.imageLink} alt="Question" className="max-w-full mx-auto" />
                                            </div>
                                        )}

                                        <div id={randomClasses.optionsContainerId} className={`${randomClasses.optionRow} space-y-4`}>
                                            {currentQ?.options.map((opt, idx) => (
                                                <button
                                                    key={idx}
                                                    id={`${randomClasses.optionBtn}_${idx}`}
                                                    onClick={() => handleOptionSelect(idx)}
                                                    className={`${randomClasses.optionBtn} w-full text-left p-5 rounded-2xl border-2 transition-all flex items-center gap-4 group ${selectedOptions[currentQuestionIndex] === idx
                                                        ? 'bg-gray-900 dark:bg-blue-600 text-white border-gray-900 dark:border-blue-600 shadow-xl dark:shadow-blue-900/20'
                                                        : 'bg-white dark:bg-gray-900 border-gray-100 dark:border-gray-800 text-gray-700 dark:text-gray-300 hover:border-gray-900 dark:hover:border-blue-500'
                                                        }`}
                                                >
                                                    <div className={`${randomClasses.optionIdx} w-9 h-9 rounded-xl flex items-center justify-center text-sm font-black transition-all ${selectedOptions[currentQuestionIndex] === idx ? 'bg-white text-gray-900 dark:text-blue-600' : 'bg-gray-100 dark:bg-gray-800 group-hover:bg-gray-200 dark:group-hover:bg-gray-700'
                                                        }`}>
                                                        {String.fromCharCode(65 + idx)}
                                                    </div>
                                                    <div className={`${randomClasses.optionText} flex-1 font-bold`}>
                                                        <DecoyText />
                                                        <LatexRenderer>
                                                            {currentQ?.is_scrambled ? decodeContent(opt, true) : opt}
                                                        </LatexRenderer>
                                                        <DecoyText />
                                                    </div>
                                                    {selectedOptions[currentQuestionIndex] === idx && (
                                                        <CheckCircle size={22} className="text-white" />
                                                    )}
                                                </button>
                                            ))}
                                        </div>
                                    </>
                                ) : (
                                    <>
                                        {(() => {
                                            if (!quizData) return null;
                                            const questionsPerPage = 25;
                                            const currentPage = Math.floor(currentQuestionIndex / questionsPerPage);
                                            const startIdx = currentPage * questionsPerPage;
                                            const endIdx = Math.min(startIdx + questionsPerPage, quizData.questions.length);
                                            const pageQuestions = quizData.questions.slice(startIdx, endIdx);

                                            return pageQuestions.map((q, relativeIdx) => {
                                                const idx = startIdx + relativeIdx;
                                                const isBookmarked = bookmarkedQuestions.has(idx);
                                                const selectedOpt = selectedOptions[idx];
                                                const qTime = questionTimes[idx] || 0;

                                                return (
                                                    <div 
                                                        key={idx} 
                                                        id={`q-card-${idx}`}
                                                        onClick={() => setCurrentQuestionIndex(idx)}
                                                        className={`mb-8 p-6 bg-white dark:bg-gray-900 border rounded-3xl shadow-sm transition-all hover:shadow-md ${
                                                            currentQuestionIndex === idx
                                                                ? 'border-blue-500 dark:border-blue-500 ring-2 ring-blue-500/10'
                                                                : 'border-gray-100 dark:border-gray-800'
                                                        }`}
                                                    >
                                                        <div className="flex items-center justify-between mb-6">
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-2xl font-black text-gray-900 dark:text-white">Q{idx + 1}</span>
                                                            </div>
                                                            
                                                            {/* Question Timer + Bookmark beside it! */}
                                                            <div className="flex items-center gap-3">
                                                                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 text-gray-600 dark:text-gray-400">
                                                                    <Timer size={14} className="text-gray-400" />
                                                                    <span className="text-xs font-black tabular-nums">{formatTime(qTime)}</span>
                                                                </div>
                                                                <button
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        setBookmarkedQuestions(prev => {
                                                                            const next = new Set(prev);
                                                                            if (next.has(idx)) {
                                                                                next.delete(idx);
                                                                            } else {
                                                                                next.add(idx);
                                                                            }
                                                                            return next;
                                                                        });
                                                                    }}
                                                                    className={`p-2.5 rounded-xl border transition-all ${isBookmarked
                                                                        ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 border-yellow-300 dark:border-yellow-700 shadow-md'
                                                                        : 'bg-white dark:bg-gray-800 text-gray-400 dark:text-gray-500 border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700'
                                                                        }`}
                                                                >
                                                                    <Bookmark size={22} fill={isBookmarked ? "currentColor" : "none"} />
                                                                </button>
                                                            </div>
                                                        </div>

                                                        <div className="text-lg font-bold text-gray-900 dark:text-white mb-6 leading-relaxed">
                                                            <LatexRenderer>
                                                                {q.is_scrambled ? decodeContent(q.questionText) : (q.questionText || q.question || '')}
                                                            </LatexRenderer>
                                                        </div>

                                                        {q.imageLink && (
                                                            <div className="mb-6 rounded-2xl overflow-hidden border border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 p-4">
                                                                <img src={q.imageLink} alt="Question" className="max-w-full mx-auto" />
                                                            </div>
                                                        )}

                                                        <div className="space-y-3">
                                                            {q.options?.map((opt, optIdx) => (
                                                                <button
                                                                    key={optIdx}
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        setCurrentQuestionIndex(idx);
                                                                        setSelectedOptions(prev => ({
                                                                            ...prev,
                                                                            [idx]: optIdx
                                                                        }));
                                                                    }}
                                                                    className={`w-full text-left p-4 rounded-xl border-2 transition-all flex items-center gap-4 group ${selectedOpt === optIdx
                                                                        ? 'bg-gray-900 dark:bg-blue-600 text-white border-gray-900 dark:border-blue-600 shadow-lg dark:shadow-blue-900/20'
                                                                        : 'bg-white dark:bg-gray-900 border-gray-100 dark:border-gray-800 text-gray-700 dark:text-gray-300 hover:border-gray-900 dark:hover:border-blue-500'
                                                                        }`}
                                                                >
                                                                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-black transition-all ${selectedOpt === optIdx ? 'bg-white text-gray-900 dark:text-blue-600' : 'bg-gray-100 dark:bg-gray-800 group-hover:bg-gray-200 dark:group-hover:bg-gray-700'
                                                                        }`}>
                                                                        {String.fromCharCode(65 + optIdx)}
                                                                    </div>
                                                                    <div className="flex-1 font-bold">
                                                                        <LatexRenderer>
                                                                            {q.is_scrambled ? decodeContent(opt, true) : opt}
                                                                        </LatexRenderer>
                                                                    </div>
                                                                    {selectedOpt === optIdx && (
                                                                        <CheckCircle size={18} className="text-white" />
                                                                    )}
                                                                </button>
                                                            ))}
                                                        </div>
                                                    </div>
                                                );
                                            });
                                        })()}
                                    </>
                                )}
                            </div>
                        </div>

                        <div className="lg:hidden fixed bottom-6 right-6 z-50">
                            <button
                                onClick={() => setShowMobileSidebar(true)}
                                className="w-14 h-14 bg-blue-600 text-white rounded-full shadow-2xl flex items-center justify-center active:scale-95 transition-all"
                            >
                                <LayoutGrid size={24} />
                            </button>
                        </div>

                        {showMobileSidebar && (
                            <div
                                className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 lg:hidden"
                                onClick={() => setShowMobileSidebar(false)}
                            ></div>
                        )}

                        <aside className={`
                            w-72 border-l border-gray-200 dark:border-gray-800 flex flex-col bg-white dark:bg-gray-950 transition-all z-50
                            fixed inset-y-0 right-0 lg:static lg:translate-x-0
                            ${showMobileSidebar ? 'translate-x-0' : 'translate-x-full lg:flex'}
                            shadow-[-10px_0_30px_rgba(0,0,0,0.1)] lg:shadow-none
                        `}>
                            <div className="p-6 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 flex justify-between items-center transition-colors">
                                <h3 className="text-[10px] font-black text-gray-500 dark:text-gray-500 uppercase tracking-widest">Question Grid</h3>
                                <button className="lg:hidden text-gray-400" onClick={() => setShowMobileSidebar(false)}>
                                    <X size={18} />
                                </button>
                            </div>



                            <div className="p-6 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 hidden lg:block transition-colors">
                                <div className="flex flex-col gap-2 text-[10px] font-bold uppercase tracking-wider">
                                    <div className="flex items-center gap-3">
                                        <div className="w-3 h-3 rounded-full bg-green-500 shadow-sm shadow-green-500/20"></div>
                                        <span className="text-gray-600 dark:text-gray-400">Answered</span>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <div className="w-3 h-3 rounded-full bg-yellow-500 shadow-sm shadow-yellow-500/20"></div>
                                        <span className="text-gray-600 dark:text-gray-400">Bookmarked</span>
                                    </div>
                                </div>
                            </div>
                            <div className="flex-1 overflow-y-auto p-6">
                                {(() => {
                                    if (!quizData) return null;
                                    const questionsPerPage = 25;
                                    const totalPages = Math.ceil(quizData.questions.length / questionsPerPage);
                                    const currentPage = Math.floor(currentQuestionIndex / questionsPerPage);
                                    const startIdx = currentPage * questionsPerPage;
                                    const endIdx = Math.min(startIdx + questionsPerPage, quizData.questions.length);
                                    const pageQuestions = quizData.questions.slice(startIdx, endIdx);

                                    return (
                                        <>
                                            <div className="mb-4">
                                                <div className="text-[10px] font-black text-gray-400 dark:text-gray-500 mb-3 text-center uppercase tracking-widest">
                                                    Questions {startIdx + 1} - {endIdx}
                                                </div>
                                                <div className="grid grid-cols-5 gap-2">
                                                    {pageQuestions.map((_, relativeIdx) => {
                                                        const idx = startIdx + relativeIdx;
                                                        const isCurrent = currentQuestionIndex === idx;
                                                        return (
                                                            <button
                                                                key={idx}
                                                                onClick={() => handleQuestionChange(idx)}
                                                                className={`w-11 h-11 rounded-xl flex items-center justify-center text-xs font-black transition-all ${isCurrent ? 'ring-2 ring-blue-500 dark:ring-blue-400 scale-110 z-10 shadow-lg' : ''
                                                                    } ${getStatusColor(idx)}`}
                                                            >
                                                                {idx + 1}
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            </div>

                                            {totalPages > 1 && (
                                                <div className="pt-6 border-t border-gray-200 dark:border-gray-800">
                                                    <div className="text-[10px] font-black text-gray-400 dark:text-gray-500 mb-4 text-center uppercase tracking-widest">
                                                        Page {currentPage + 1} of {totalPages}
                                                    </div>
                                                    <div className="flex flex-wrap gap-2 justify-center">
                                                        {Array.from({ length: totalPages }, (_, pageIdx) => {
                                                            const pageStart = pageIdx * questionsPerPage + 1;
                                                            const pageEnd = Math.min((pageIdx + 1) * questionsPerPage, quizData.questions.length);
                                                            return (
                                                                <button
                                                                    key={pageIdx}
                                                                    onClick={() => handleQuestionChange(pageIdx * questionsPerPage)}
                                                                    className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all border ${currentPage === pageIdx
                                                                        ? 'bg-gray-900 dark:bg-blue-600 text-white border-gray-900 dark:border-blue-600 shadow-md'
                                                                        : 'bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400 border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700'
                                                                        }`}
                                                                >
                                                                    {pageStart}-{pageEnd}
                                                                </button>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            )}
                                        </>
                                    );
                                })()}
                            </div>

                            <div className="p-6 border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 mt-auto">
                                <div className="grid grid-cols-2 gap-3 mb-6">
                                    <button
                                        onClick={() => handleQuestionChange(Math.max(0, currentQuestionIndex - 1))}
                                        disabled={currentQuestionIndex === 0}
                                        className="flex items-center justify-center py-3 rounded-xl border border-gray-200 dark:border-gray-800 text-gray-700 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-20 disabled:grayscale transition-all font-black text-[10px] uppercase tracking-widest"
                                    >
                                        <ChevronLeft size={16} className="mr-1" />
                                        <span>Prev</span>
                                    </button>
                                    <button
                                        onClick={() => {
                                            if (quizData && currentQuestionIndex < quizData.questions.length - 1) {
                                                handleQuestionChange(currentQuestionIndex + 1);
                                            } else {
                                                handleSubmit(false);
                                            }
                                        }}
                                        className="flex items-center justify-center py-3 bg-blue-600 dark:bg-blue-600 text-white rounded-xl hover:bg-blue-700 dark:hover:bg-blue-500 transition-all shadow-lg shadow-blue-500/10 font-black text-[10px] uppercase tracking-widest active:scale-95"
                                    >
                                        <span>
                                            {(quizData && currentQuestionIndex === quizData.questions.length - 1) ? 'Submit' : 'Next'}
                                        </span>
                                        <ChevronRight size={16} className="ml-1" />
                                    </button>
                                </div>

                                <div>
                                    <div className="flex justify-between items-end mb-2">
                                        <span className="text-[9px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest">Progress</span>
                                        <div className="text-xs font-black text-gray-900 dark:text-white flex items-center gap-1">
                                            <span className="text-blue-600 dark:text-blue-400">{Object.keys(selectedOptions).length}</span>
                                            <span className="text-gray-300 dark:text-gray-700">/</span>
                                            <span>{quizData?.questions.length || 0}</span>
                                        </div>
                                    </div>
                                    <div className="h-1.5 w-full bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-blue-600 transition-all duration-500 ease-out shadow-[0_0_8px_rgba(37,99,235,0.4)]"
                                            style={{ width: `${((Object.keys(selectedOptions).length || 0) / (quizData?.questions.length || 1)) * 100}%` }}
                                        ></div>
                                    </div>
                                </div>
                            </div>
                        </aside>
                    </main>
                </>
            )}

            {isTimeUp && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-gray-950/80 backdrop-blur-sm">
                    <div className="bg-white dark:bg-gray-900 rounded-3xl p-8 max-w-sm w-full shadow-2xl border border-gray-100 dark:border-gray-800 text-center animate-in zoom-in duration-300">
                        <div className="w-16 h-16 bg-red-50 dark:bg-red-900/20 text-red-600 rounded-2xl flex items-center justify-center mx-auto mb-6">
                            <Clock size={32} className="animate-pulse" />
                        </div>
                        <h2 className="text-2xl font-black text-gray-900 dark:text-white mb-2">Time is Up!</h2>
                        <p className="text-gray-500 dark:text-gray-400 text-sm mb-8">
                            Your examination time has concluded. You can either submit your responses now or take a moment to review them.
                        </p>
                        <div className="flex flex-col gap-3">
                            <button
                                onClick={() => handleSubmit(true)}
                                className="w-full py-4 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-500/20 active:scale-95"
                            >
                                Submit Exam Now
                            </button>
                            <button
                                onClick={() => setIsTimeUp(false)}
                                className="w-full py-4 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-xl font-bold hover:bg-gray-200 dark:hover:bg-gray-700 transition-all active:scale-95"
                            >
                                Review Questions
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default QuizPlayerPage;
