import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { apiRequest } from '../lib/api';
import { ChevronLeft, ArrowRight } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../contexts/AuthContext';

interface Attempt {
    id: number;
    attempt_number: number;
    score: number;
    total_questions: number;
    correct_count: number;
    incorrect_count: number;
    attempt_date: string;
}

const QuizHistoryPage: React.FC = () => {
    const { quizId } = useParams<{ quizId: string }>();
    const navigate = useNavigate();
    const [history, setHistory] = useState<Attempt[]>([]);
    const [loading, setLoading] = useState(true);
    const [highScore, setHighScore] = useState(0);

    const { token } = useAuth();

    useEffect(() => {
        if (!token) {
            navigate('/login');
            return;
        }
        fetchHistory();
    }, [quizId]);

    const fetchHistory = async () => {
        setLoading(true);
        try {
            const response = await apiRequest<{ history: { attempts: Attempt[]; high_score: number } }>(`/quizzes/${quizId}/history`);
            setHistory(response.history.attempts || []);
            setHighScore(Number(response.history.high_score || 0));
        } catch (err) {
            console.error("History fetch error:", err);
            toast.error("Server error");
        } finally {
            setLoading(false);
        }
    };

    if (loading) return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 dark:border-blue-400"></div>
        </div>
    );

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-950 transition-colors duration-300 pb-12">
            <div className="max-w-4xl mx-auto px-4 py-8">
                <button
                    onClick={() => navigate(-1)}
                    className="flex items-center text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white mb-6 transition-colors font-medium"
                >
                    <ChevronLeft size={20} className="mr-1" />
                    <span className="text-sm">Back</span>
                </button>

                <div className="mb-8">
                    <h1 className="text-2xl font-black text-gray-900 dark:text-white mb-3">Attempt History</h1>
                    {highScore > 0 && (
                        <div className="inline-flex items-center bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-400 px-4 py-2 rounded-xl text-sm font-bold border border-yellow-200 dark:border-yellow-800/50 shadow-sm">
                            🏆 Personal Best: {highScore.toFixed(1)} points
                        </div>
                    )}
                </div>

                {history.length === 0 ? (
                    <div className="text-center py-20 bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm">
                        <div className="text-6xl mb-4">🏆</div>
                        <p className="text-gray-500 dark:text-gray-400 mb-6 font-medium text-lg">No attempts recorded yet</p>
                        <button
                            onClick={() => navigate(`/test-series/quiz/${quizId}`)}
                            className="px-8 py-3 bg-gray-900 dark:bg-blue-600 text-white rounded-xl hover:bg-gray-800 dark:hover:bg-blue-700 font-bold transition-all shadow-lg dark:shadow-blue-900/20 active:scale-95"
                        >
                            Take Exam Now
                        </button>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {history.map((att) => (
                            <div
                                key={att.id}
                                className="bg-white dark:bg-gray-900 p-6 rounded-2xl border border-gray-200 dark:border-gray-800 hover:shadow-xl dark:shadow-blue-900/5 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-6 group"
                            >
                                <div className="flex items-center gap-6">
                                    <div className="bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-colors group-hover:bg-gray-200 dark:group-hover:bg-gray-700">
                                        #{att.attempt_number}
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="text-2xl font-black text-gray-900 dark:text-white tabular-nums">{att.score.toFixed(1)}</span>
                                            <span className="text-gray-400 dark:text-gray-500 text-[10px] font-black uppercase tracking-widest">Points</span>
                                        </div>
                                        <div className="text-xs font-bold text-gray-500 dark:text-gray-500">
                                            {new Date(att.attempt_date).toLocaleDateString(undefined, {
                                                month: 'short',
                                                day: 'numeric',
                                                year: 'numeric'
                                            })}
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center justify-between sm:justify-end gap-8">
                                    <div className="flex gap-6 text-[10px] font-black uppercase tracking-widest text-center">
                                        <div>
                                            <div className="text-green-600 dark:text-green-400 mb-0.5">{att.correct_count}</div>
                                            <div className="text-gray-400 dark:text-gray-600">Correct</div>
                                        </div>
                                        <div>
                                            <div className="text-red-600 dark:text-red-400 mb-0.5">{att.incorrect_count}</div>
                                            <div className="text-gray-400 dark:text-gray-600">Wrong</div>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => navigate(`/test-series/result/${att.id}`)}
                                        className="p-3 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white rounded-xl hover:bg-gray-900 dark:hover:bg-blue-600 hover:text-white transition-all shadow-sm"
                                    >
                                        <ArrowRight size={20} />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default QuizHistoryPage;
