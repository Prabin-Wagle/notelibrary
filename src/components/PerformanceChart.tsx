import { useEffect, useState } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import localData from '../data/localData';

interface PerformanceData {
    date: string;
    score: number;
    percentage: number;
}

export default function PerformanceChart() {
    const [data, setData] = useState<PerformanceData[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const response = await localData.get(`performance-history?mode=LIVE`);

                if (response.data.status === 'success') {
                    const processed = response.data.attempts.map((attempt: any) => ({
                        date: new Date(attempt.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
                        score: attempt.score,
                        percentage: (attempt.score / attempt.total) * 100
                    }));
                    setData(processed);
                }
            } catch (error) {
                console.error('Failed to fetch performance data:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, []);

    if (loading) return (
        <div className="h-[300px] flex items-center justify-center bg-gray-50 dark:bg-gray-800/50 rounded-3xl border border-gray-100 dark:border-gray-800">
            <div className="animate-pulse flex flex-col items-center">
                <div className="h-48 w-64 bg-gray-200 dark:bg-gray-700 rounded-lg mb-4" />
                <div className="h-4 w-32 bg-gray-200 dark:bg-gray-700 rounded" />
            </div>
        </div>
    );

    if (data.length === 0) return null;

    return (
        <div className="bg-white dark:bg-gray-900 rounded-3xl p-6 border border-gray-100 dark:border-gray-800 shadow-sm">
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h3 className="text-xl font-black text-gray-900 dark:text-white tracking-tight">Performance Trend</h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400 font-bold uppercase tracking-widest mt-1">Score percentage over recent tests</p>
                </div>
            </div>

            <div className="h-[300px] w-full">
                {data.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                            <defs>
                                <linearGradient id="colorScore" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#2563eb" stopOpacity={0.3} />
                                    <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#88888820" />
                            <XAxis
                                dataKey="date"
                                axisLine={false}
                                tickLine={false}
                                tick={{ fontSize: 10, fontWeight: 700, fill: '#9ca3af' }}
                                dy={10}
                            />
                            <YAxis
                                domain={[0, 100]}
                                axisLine={false}
                                tickLine={false}
                                tick={{ fontSize: 10, fontWeight: 700, fill: '#9ca3af' }}
                            />
                            <Tooltip
                                contentStyle={{
                                    backgroundColor: '#111827',
                                    border: 'none',
                                    borderRadius: '12px',
                                    boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)'
                                }}
                                itemStyle={{ color: '#fff', fontSize: '12px', fontWeight: 700 }}
                                labelStyle={{ color: '#9ca3af', fontSize: '10px', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}
                                cursor={{ stroke: '#2563eb', strokeWidth: 2, strokeDasharray: '5 5' }}
                            />
                            <Area
                                type="monotone"
                                dataKey="percentage"
                                stroke="#2563eb"
                                strokeWidth={4}
                                fillOpacity={1}
                                fill="url(#colorScore)"
                                animationDuration={2000}
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                ) : (
                    <div className="h-full flex flex-col items-center justify-center text-gray-400 dark:text-gray-500">
                        <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-full mb-4">
                            <ResponsiveContainer width={40} height={40}>
                                <BarChart data={[{ v: 10 }, { v: 30 }, { v: 20 }, { v: 40 }]}>
                                    <Bar dataKey="v" fill="currentColor" radius={[2, 2, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                        <p className="text-sm font-bold uppercase tracking-widest text-[10px]">No test data yet</p>
                    </div>
                )}
            </div>
        </div>
    );
}
