import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Edit2, Trash2, Filter, Clock, AlertTriangle, Download, FileDown } from 'lucide-react';
import axios from 'axios';
import { DashboardLayout } from '../components/DashboardLayout';
import { useAuth } from '../context/AuthContext';

const API_URL = 'https://notelibraryapp.com/api/admin/testSeries.php';
const COLLECTION_API_URL = 'https://notelibraryapp.com/api/admin/testSeriesCollection.php';

interface TestSeriesCollection {
    id: number;
    title: string;
    competitive_exam: 'IOE' | 'CEE' | 'OTHER';
}

interface QuizQuestion {
    id?: string;
    questionId: string;
    questionNo: number | string;
    questionText: string;
    imageLink?: string | null;
    options: (string | number)[];
    correctOption: number;
    marks: number;
    unitId?: string | null;
    chapterId?: string | null;
    explanation?: string | null;
}

interface TestSeries {
    id: number;
    series_uid: string;
    collection_id: number;
    quiz_title: string;
    competitive_exam: string;
    time_limit: number;
    negative_marking: number;
    mode: 'LIVE' | 'NORMAL';
    start_time: string | null;
    end_time: string | null;
    quiz_json: QuizQuestion[];
    collection_title: string;
    created_at: string;
}

export default function TestSeriesManager() {
    const { token } = useAuth();
    const navigate = useNavigate();
    const [testSeries, setTestSeries] = useState<TestSeries[]>([]);
    const [collections, setCollections] = useState<TestSeriesCollection[]>([]);
    const [filterCollectionId, setFilterCollectionId] = useState<number>(0);

    const handleDelete = async (id: number) => {
        if (!confirm('Are you sure you want to delete this test series?')) return;

        try {
            await axios.delete(`${API_URL}?id=${id}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            await fetchTestSeries(filterCollectionId > 0 ? filterCollectionId : undefined);
        } catch (error) {
            console.error('Error deleting test series:', error);
            alert('Error deleting test series');
        }
    };

    const fetchCollections = async () => {
        try {
            const response = await axios.get(COLLECTION_API_URL, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (response.data.success) {
                setCollections(response.data.data);
            }
        } catch (error) {
            console.error('Error fetching collections:', error);
        }
    };

    const safeParseQuizJson = (jsonString: any): QuizQuestion[] => {
        if (!jsonString) return [];
        if (Array.isArray(jsonString)) return jsonString;
        try {
            if (typeof jsonString === 'string' && jsonString.trim().startsWith('[')) {
                return JSON.parse(jsonString);
            }
            const decoded = atob(jsonString);
            return JSON.parse(decoded);
        } catch (e) {
            console.error('Error parsing quiz JSON:', e);
            try { return JSON.parse(jsonString); } catch (e2) { return []; }
        }
    };

    const fetchTestSeries = async (collectionId?: number) => {
        try {
            const url = collectionId
                ? `${API_URL}?collection_id=${collectionId}`
                : API_URL;
            const response = await axios.get(url, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (response.data.success) {
                const decodedData = response.data.data.map((item: any) => ({
                    ...item,
                    quiz_json: safeParseQuizJson(item.quiz_json)
                }));
                setTestSeries(decodedData);
            }
        } catch (error) {
            console.error('Error fetching test series:', error);
        }
    };

    const groupedTestSeries = testSeries.reduce((acc, test) => {
        const collectionTitle = test.collection_title || 'Unknown Collection';
        if (!acc[collectionTitle]) {
            acc[collectionTitle] = { exam: test.competitive_exam, tests: [] };
        }
        acc[collectionTitle].tests.push(test);
        return acc;
    }, {} as Record<string, { exam: string; tests: TestSeries[] }>);

    const handleExportTest = (test: TestSeries) => {
        const exportData = {
            series_uid: test.series_uid,
            quiz_title: test.quiz_title,
            collection_title: test.collection_title,
            competitive_exam: test.competitive_exam,
            time_limit: test.time_limit,
            negative_marking: test.negative_marking,
            mode: test.mode,
            start_time: test.start_time,
            end_time: test.end_time,
            questions: test.quiz_json
        };
        const dataStr = JSON.stringify(exportData, null, 2);
        const blob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${test.quiz_title.replace(/[^a-zA-Z0-9]/g, '_')}.json`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const handleExportAll = () => {
        const exportData = testSeries.map(test => ({
            series_uid: test.series_uid,
            quiz_title: test.quiz_title,
            collection_title: test.collection_title,
            competitive_exam: test.competitive_exam,
            time_limit: test.time_limit,
            negative_marking: test.negative_marking,
            mode: test.mode,
            start_time: test.start_time,
            end_time: test.end_time,
            questions: test.quiz_json
        }));
        const dataStr = JSON.stringify(exportData, null, 2);
        const blob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `all_test_series_${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
    };

    useEffect(() => {
        fetchCollections();
        fetchTestSeries();
    }, []);

    useEffect(() => {
        if (filterCollectionId > 0) {
            fetchTestSeries(filterCollectionId);
        } else {
            fetchTestSeries();
        }
    }, [filterCollectionId]);

    return (
        <DashboardLayout>
            <div className="p-6">
                <div className="flex justify-between items-center mb-6">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900">Test Series</h1>
                        <p className="text-gray-600 mt-1">Build quizzes for each premium collection with live or normal scheduling.</p>
                    </div>
                    <div className="flex gap-3">
                        {testSeries.length > 0 && (
                            <button
                                onClick={handleExportAll}
                                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                            >
                                <FileDown size={20} />
                                Export All
                            </button>
                        )}
                        <button
                            onClick={() => navigate('/test-series/create')}
                            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                        >
                            <Plus size={20} />
                            Create Test
                        </button>
                    </div>
                </div>

                <div className="mb-6 flex items-center gap-3">
                    <Filter size={20} className="text-gray-600" />
                    <span className="text-gray-600">Filter by Collection:</span>
                    <select
                        value={filterCollectionId}
                        onChange={(e) => setFilterCollectionId(parseInt(e.target.value))}
                        className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                        <option value={0}>All Collections</option>
                        {collections.map(col => (
                            <option key={col.id} value={col.id}>{col.title}</option>
                        ))}
                    </select>
                </div>

                <div className="space-y-8">
                    {Object.entries(groupedTestSeries).map(([collectionTitle, { exam, tests }]) => (
                        <div key={collectionTitle} className="bg-white rounded-lg shadow-md p-6">
                            <div className="flex items-center justify-between mb-4 border-b pb-2">
                                <div className="flex items-center gap-2">
                                    <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full font-medium">
                                        {exam}
                                    </span>
                                    <h2 className="text-xl font-bold text-gray-900">{collectionTitle}</h2>
                                </div>
                                <span className="text-sm text-gray-500">{tests.length} tests</span>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {tests.map(test => (
                                    <div key={test.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                                        <div className="flex items-start justify-between mb-2">
                                            <h3 className="font-semibold text-gray-900">{test.quiz_title}</h3>
                                            <span className={`px-2 py-1 text-xs rounded-full font-medium ${test.mode === 'LIVE'
                                                ? 'bg-green-100 text-green-800'
                                                : 'bg-gray-100 text-gray-800'
                                                }`}>
                                                {test.mode}
                                            </span>
                                        </div>

                                        <div className="text-sm text-gray-600 space-y-1 mb-3">
                                            <div className="flex items-center gap-1">
                                                <Clock size={14} />
                                                {test.time_limit} minutes • Negative {test.negative_marking}
                                            </div>
                                            <div>📝 {test.quiz_json?.length || 0} questions</div>
                                            {test.mode === 'LIVE' && test.start_time && (
                                                <div className="flex items-center gap-1 text-green-600">
                                                    <AlertTriangle size={14} />
                                                    {new Date(test.start_time).toLocaleString()} - {new Date(test.end_time!).toLocaleString()}
                                                </div>
                                            )}
                                        </div>

                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => handleExportTest(test)}
                                                className="flex items-center justify-center gap-1 px-3 py-2 bg-green-100 text-green-700 rounded hover:bg-green-200 transition-colors text-sm"
                                                title="Export JSON"
                                            >
                                                <Download size={14} />
                                            </button>
                                            <button
                                                onClick={() => navigate(`/test-series/edit/${test.id}`)}
                                                className="flex-1 flex items-center justify-center gap-1 px-3 py-2 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors text-sm"
                                            >
                                                <Edit2 size={14} />
                                                Edit
                                            </button>
                                            <button
                                                onClick={() => handleDelete(test.id)}
                                                className="flex-1 flex items-center justify-center gap-1 px-3 py-2 bg-red-100 text-red-700 rounded hover:bg-red-200 transition-colors text-sm"
                                            >
                                                <Trash2 size={14} />
                                                Delete
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}

                    {testSeries.length === 0 && (
                        <div className="text-center py-12 bg-white rounded-lg shadow-md">
                            <p className="text-gray-500 text-lg">No test series found. Create your first test!</p>
                        </div>
                    )}
                </div>
            </div>
        </DashboardLayout>
    );
}