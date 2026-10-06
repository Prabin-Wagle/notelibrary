import { useState, useEffect, useCallback, useRef, ChangeEvent } from 'react';
import { createPortal } from 'react-dom';
import axios from 'axios';
import { DashboardLayout } from '../components/DashboardLayout';
import { useAuth } from '../context/AuthContext';
import { LatexRenderer } from '../components/LatexRenderer';
import { Plus, Trash2, Edit2, Search, Upload, Save, X, FileJson, FolderOpen, Download, ChevronLeft, ChevronRight } from 'lucide-react';
import toast from 'react-hot-toast';
import {
    ExamCode,
    ImportedQuestion,
    inferExamCode,
    normalizeQuestionBankFile,
    QUESTION_BANK_SCHEMA_VERSION,
} from '../lib/questionBankJson';

const API_URL = 'https://notelibraryapp.com/api/admin/questionBank.php';
const UPLOAD_API_URL = 'https://notelibraryapp.com/api/admin/upload_question_image.php';

interface Unit {
    id: string; // Table name e.g. qb_physics
    name: string; // Display name e.g. Physics
}

interface Question {
    id: number;
    unit_id?: number | string | null;
    question_uid: string;
    chapter: string;
    question_text: string;
    options: string[];
    correct_option: number;
    marks: number;
    explanation: string;
    image_link: string | null;
    exam_code?: ExamCode | null;
    source_subject?: string | null;
    source_file?: string | null;
    source_id?: string | null;
    source_index?: number | null;
    source_chapter_id?: string | null;
    tags?: string[];
}

interface ImportPlan {
    files: File[];
    examCode: ExamCode;
    questionCount: number;
    skippedCount: number;
    issues: string[];
}

interface Pagination {
    page: number;
    page_size: number;
    total: number;
    total_pages: number;
}

const PAGE_SIZE = 50;

export default function QuestionBankManager() {
    const { token } = useAuth();
    const [units, setUnits] = useState<Unit[]>([]);
    const [selectedUnit, setSelectedUnit] = useState<string>('');
    const [selectedExam, setSelectedExam] = useState<'ALL' | ExamCode>('ALL');
    const [selectedSubject, setSelectedSubject] = useState('');
    const [subjects, setSubjects] = useState<Unit[]>([]);
    const [questions, setQuestions] = useState<Question[]>([]);
    const [loading, setLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [page, setPage] = useState(1);
    const [pagination, setPagination] = useState<Pagination>({ page: 1, page_size: PAGE_SIZE, total: 0, total_pages: 1 });

    // Modal State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);
    const [formData, setFormData] = useState<Partial<Question>>({
        question_uid: '',
        question_text: '',
        options: ['', '', '', ''],
        correct_option: 0,
        marks: 1,
        chapter: '',
        explanation: '',
        image_link: null
    });
    const [uploadingImage, setUploadingImage] = useState(false);

    const [formUnitId, setFormUnitId] = useState('');

    // JSON import state
    const [isImportOpen, setIsImportOpen] = useState(false);
    const [importExam, setImportExam] = useState<ExamCode>('IOE');
    const [importPlan, setImportPlan] = useState<ImportPlan | null>(null);
    const [importing, setImporting] = useState(false);
    const [preparingImport, setPreparingImport] = useState(false);
    const [importProgress, setImportProgress] = useState({ processed: 0, inserted: 0, updated: 0, skipped: 0 });
    const filesInputRef = useRef<HTMLInputElement>(null);
    const folderInputRef = useRef<HTMLInputElement>(null);

    // Generator State
    const [isGeneratorOpen, setIsGeneratorOpen] = useState(false);
    const [generatorCount, setGeneratorCount] = useState(20);
    const [generatorExam, setGeneratorExam] = useState<ExamCode>('IOE');
    const [generatedJson, setGeneratedJson] = useState('');
    const [showGeneratedResult, setShowGeneratedResult] = useState(false);

    useEffect(() => {
        folderInputRef.current?.setAttribute('webkitdirectory', '');
        folderInputRef.current?.setAttribute('directory', '');
    }, []);

    const fetchUnits = useCallback(async () => {
        try {
            const res = await axios.get(`${API_URL}?action=list_units`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.data.success) {
                setUnits(res.data.data);
            }
        } catch (error) {
            console.error(error);
            toast.error('Failed to load units');
        }
    }, [token]);

    const fetchSubjects = useCallback(async () => {
        try {
            const params = new URLSearchParams({ action: 'list_subjects' });
            if (selectedExam !== 'ALL') params.set('exam_code', selectedExam);
            const res = await axios.get(`${API_URL}?${params}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.data.success) setSubjects(res.data.data || []);
        } catch (error) {
            console.error(error);
            setSubjects([]);
        }
    }, [selectedExam, token]);

    const fetchQuestions = useCallback(async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams({ action: 'list_questions', page: String(page), limit: String(PAGE_SIZE) });
            if (selectedUnit) params.set('unit', selectedUnit);
            if (selectedExam !== 'ALL') params.set('exam_code', selectedExam);
            if (selectedSubject) params.set('source_subject', selectedSubject);
            if (searchTerm.trim()) params.set('search', searchTerm.trim());
            const res = await axios.get(`${API_URL}?${params}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.data.success) {
                setQuestions(res.data.data || []);
                if (res.data.pagination) setPagination(res.data.pagination);
            }
        } catch (error) {
            console.error(error);
            toast.error('Failed to load questions');
        } finally {
            setLoading(false);
        }
    }, [page, searchTerm, selectedExam, selectedSubject, selectedUnit, token]);

    useEffect(() => { void fetchUnits(); }, [fetchUnits]);
    useEffect(() => { void fetchSubjects(); }, [fetchSubjects]);
    useEffect(() => {
        const timer = window.setTimeout(() => { void fetchQuestions(); }, 250);
        return () => window.clearTimeout(timer);
    }, [fetchQuestions]);

    const handleGenerateSet = async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams({ action: 'generate_random_set', exam_code: generatorExam });
            if (selectedUnit) params.set('unit', selectedUnit);
            if (selectedSubject) params.set('source_subject', selectedSubject);
            const res = await axios.post(`${API_URL}?${params}`, { config: { count: generatorCount } }, {
                headers: { Authorization: `Bearer ${token}` }
            });

            if (res.data.success) {
                const document = {
                    schemaVersion: QUESTION_BANK_SCHEMA_VERSION,
                    examCode: generatorExam,
                    questions: (res.data.data as Question[]).map((question, index) => ({
                        sourceId: question.source_id || question.question_uid,
                        sourceIndex: Number(question.source_index) || index + 1,
                        sourceFile: question.source_file || 'admin/manual',
                        sourceSubject: question.source_subject || 'Uncategorized',
                        chapter: question.chapter || 'Unsorted',
                        sourceChapterId: question.source_chapter_id || null,
                        questionText: question.question_text,
                        options: question.options || [],
                        correctOption: Number(question.correct_option) || 0,
                        marks: Number(question.marks) || 1,
                        explanation: question.explanation || null,
                        imageLink: question.image_link || null,
                        tags: question.tags || [],
                    })),
                };
                setGeneratedJson(JSON.stringify(document, null, 2));
                setShowGeneratedResult(true);
                setIsGeneratorOpen(false);
                toast.success(`Generated set with ${res.data.data.length} questions`);
            }
        } catch (error) {
            console.error(error);
            toast.error('Failed to generate set');
        } finally {
            setLoading(false);
        }
    };

    const copyToClipboard = () => {
        navigator.clipboard.writeText(generatedJson);
        toast.success('JSON copied to clipboard!');
    };

    const handleDelete = async (id: number) => {
        if (!confirm('Are you sure you want to delete this question?')) return;
        try {
            const res = await axios.delete(`${API_URL}?unit=${selectedUnit}&id=${id}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.data.success) {
                toast.success('Question deleted');
                await fetchQuestions();
            }
        } catch (error) {
            console.error(error);
            toast.error('Failed to delete question');
        }
    };

    const openModal = (question?: Question) => {
        if (question) {
            setEditingQuestion(question);
            setFormData({ ...question });
            setFormUnitId(question.unit_id ? String(question.unit_id) : '');
        } else {
            setEditingQuestion(null);
            setFormUnitId(selectedUnit);
            setFormData({
                question_uid: `Q_${Date.now()}`,
                question_text: '',
                options: ['', '', '', ''],
                correct_option: 0,
                marks: 1,
                chapter: '',
                explanation: '',
                image_link: null
            });
        }
        setIsModalOpen(true);
    };

    const handleFormChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        if (name.startsWith('option_')) {
            const index = parseInt(name.split('_')[1]);
            const newOptions = [...(formData.options || [])];
            newOptions[index] = value;
            setFormData({ ...formData, options: newOptions });
        } else {
            setFormData({ ...formData, [name]: value });
        }
    };

    const handleImageUpload = async (e: ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            setUploadingImage(true);
            const data = new FormData();
            data.append('image', file);
            data.append('customFileName', `qb_${Date.now()}_img.${file.name.split('.').pop()}`);

            try {
                const res = await axios.post(UPLOAD_API_URL, data, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (res.data.success) {
                    setFormData({ ...formData, image_link: res.data.url });
                    toast.success('Image uploaded');
                }
            } catch {
                toast.error('Image upload failed');
            } finally {
                setUploadingImage(false);
            }
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        try {
            const payload = {
                ...formData,
                unit_id: formUnitId || null,
                id: editingQuestion?.id
            };

            const res = await axios.post(API_URL, payload, {
                headers: { Authorization: `Bearer ${token}` }
            });

            if (res.data.success) {
                toast.success(editingQuestion ? 'Question updated' : 'Question added');
                setIsModalOpen(false);
                setPage(1);
                await fetchQuestions();
            }
        } catch (error: unknown) {
            console.error(error);
            const message = axios.isAxiosError<{ message?: string }>(error)
                ? error.response?.data?.message
                : undefined;
            toast.error(message || 'Failed to save question');
        }
    };

    const inspectJsonFiles = async (files: File[], examCode: ExamCode) => {
        setPreparingImport(true);
        setImportPlan(null);
        let questionCount = 0;
        let skippedCount = 0;
        const issues: string[] = [];

        try {
            for (const file of files) {
                try {
                    const parsed = JSON.parse(await file.text()) as unknown;
                    const normalized = normalizeQuestionBankFile(parsed, file.webkitRelativePath || file.name, examCode);
                    questionCount += normalized.questions.length;
                    skippedCount += normalized.issues.length;
                    issues.push(...normalized.issues.slice(0, Math.max(0, 20 - issues.length)));
                } catch {
                    skippedCount++;
                    if (issues.length < 20) issues.push(`${file.name}: the file does not contain valid JSON.`);
                }
            }

            setImportPlan({ files, examCode, questionCount, skippedCount, issues });
        } finally {
            setPreparingImport(false);
        }
    };

    const handleJsonSelection = async (selection: FileList | null) => {
        const jsonFiles = Array.from(selection || []).filter((file) => file.name.toLowerCase().endsWith('.json'));
        if (jsonFiles.length === 0) {
            toast.error('Choose one or more .json files, or a folder containing JSON files.');
            return;
        }

        const inferredExams = new Set(jsonFiles
            .map((file) => inferExamCode(file.webkitRelativePath || file.name))
            .filter((exam): exam is ExamCode => exam !== null));
        const detectedExam = inferredExams.size === 1 ? Array.from(inferredExams)[0] : importExam;
        setImportExam(detectedExam);
        await inspectJsonFiles(jsonFiles, detectedExam);
    };

    const importJsonQuestions = async () => {
        if (!importPlan || importPlan.questionCount === 0) return;
        setImporting(true);
        const totals = { processed: 0, inserted: 0, updated: 0, skipped: importPlan.skippedCount };
        setImportProgress(totals);
        let batch: ImportedQuestion[] = [];

        const sendBatch = async () => {
            if (batch.length === 0) return;
            const currentBatch = batch;
            const response = await axios.post(`${API_URL}?action=import_json`, {
                schemaVersion: QUESTION_BANK_SCHEMA_VERSION,
                examCode: importPlan.examCode,
                questions: currentBatch,
            }, { headers: { Authorization: `Bearer ${token}` } });

            if (!response.data.success) throw new Error(response.data.message || 'The server rejected this JSON batch.');
            totals.processed += currentBatch.length;
            totals.inserted += Number(response.data.inserted) || 0;
            totals.updated += Number(response.data.updated) || 0;
            totals.skipped += Number(response.data.skipped) || 0;
            setImportProgress({ ...totals });
            batch = [];
        };

        try {
            for (const file of importPlan.files) {
                const parsed = JSON.parse(await file.text()) as unknown;
                const normalized = normalizeQuestionBankFile(parsed, file.webkitRelativePath || file.name, importPlan.examCode);
                for (const question of normalized.questions) {
                    batch.push(question);
                    if (batch.length >= 500) await sendBatch();
                }
            }
            await sendBatch();
            toast.success(`Import complete: ${totals.inserted.toLocaleString()} added, ${totals.updated.toLocaleString()} refreshed.`);
            setSelectedExam(importPlan.examCode);
            setSelectedSubject('');
            setSelectedUnit('');
            setPage(1);
            setIsImportOpen(false);
            setImportPlan(null);
        } catch (error) {
            console.error(error);
            toast.error(`Import stopped after ${totals.processed.toLocaleString()} questions. Retry is safe; duplicate source rows are updated.`);
        } finally {
            setImporting(false);
        }
    };

    const downloadPageJson = () => {
        if (selectedExam === 'ALL') {
            toast.error('Choose IOE or CEE before exporting a versioned JSON file.');
            return;
        }
        const jsonDocument = {
            schemaVersion: QUESTION_BANK_SCHEMA_VERSION,
            examCode: selectedExam,
            questions: questions.map((question, index) => ({
                sourceId: question.source_id || question.question_uid,
                sourceIndex: Number(question.source_index) || index + 1,
                sourceFile: question.source_file || 'admin/manual',
                sourceSubject: question.source_subject || units.find((unit) => unit.id === String(question.unit_id))?.name || 'Uncategorized',
                chapter: question.chapter || 'Unsorted',
                sourceChapterId: question.source_chapter_id || null,
                questionText: question.question_text,
                options: question.options || [],
                correctOption: Number(question.correct_option) || 0,
                marks: Number(question.marks) || 1,
                explanation: question.explanation || null,
                imageLink: question.image_link || null,
                tags: question.tags || [],
            })),
        };
        const blobUrl = URL.createObjectURL(new Blob([JSON.stringify(jsonDocument, null, 2)], { type: 'application/json' }));
        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = `question-bank-${selectedExam.toLowerCase()}-page-${page}.json`;
        link.click();
        URL.revokeObjectURL(blobUrl);
    };

    return (
        <DashboardLayout>
            <div className="p-6 max-w-7xl mx-auto pb-20">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900">Question Bank</h1>
                        <p className="text-gray-500">Manage and edit your global question repository</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <button
                            onClick={() => {
                                setGeneratorCount(20);
                                setGeneratorExam(selectedExam === 'CEE' ? 'CEE' : 'IOE');
                                setIsGeneratorOpen(true);
                            }}
                            className="bg-slate-900 text-white px-4 py-2.5 rounded-xl font-semibold flex items-center gap-2 hover:bg-slate-800 transition-colors"
                        >
                            <Search size={18} /> Generate set
                        </button>
                        <button
                            onClick={() => { setIsImportOpen(true); setImportPlan(null); setImportProgress({ processed: 0, inserted: 0, updated: 0, skipped: 0 }); }}
                            className="bg-emerald-600 text-white px-4 py-2.5 rounded-xl font-semibold flex items-center gap-2 hover:bg-emerald-700 transition-colors"
                        >
                            <FileJson size={18} /> Import JSON
                        </button>
                        <button
                            onClick={downloadPageJson}
                            disabled={!questions.length || selectedExam === 'ALL'}
                            title={selectedExam === 'ALL' ? 'Select IOE or CEE to export a versioned JSON document' : 'Export the current page as JSON'}
                            className="bg-white border border-gray-200 text-gray-700 px-4 py-2.5 rounded-xl font-semibold flex items-center gap-2 hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <Download size={18} /> Export page
                        </button>
                        <button
                            onClick={() => openModal()}
                            className="bg-teal-600 text-white px-4 py-2.5 rounded-xl font-semibold flex items-center gap-2 hover:bg-teal-700 transition-colors"
                        >
                            <Plus size={18} /> Add question
                        </button>
                    </div>
                </div>

                {/* Filters */}
                <div className="bg-white p-4 rounded-2xl border border-gray-200 mb-5 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-[minmax(130px,0.7fr)_minmax(150px,1fr)_minmax(160px,1.2fr)_minmax(220px,1.4fr)] gap-3">
                    <label className="text-xs font-semibold text-gray-500">
                        Exam
                        <select
                            value={selectedExam}
                            onChange={(e) => { setSelectedExam(e.target.value as 'ALL' | ExamCode); setSelectedSubject(''); setPage(1); }}
                            className="mt-1.5 block w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm font-medium text-gray-900 focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-600/15"
                        >
                            <option value="ALL">All exams</option>
                            <option value="IOE">IOE</option>
                            <option value="CEE">CEE</option>
                        </select>
                    </label>
                    <label className="text-xs font-semibold text-gray-500">
                        Subject
                        <select
                            value={selectedSubject}
                            onChange={(e) => { setSelectedSubject(e.target.value); setPage(1); }}
                            className="mt-1.5 block w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm font-medium text-gray-900 focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-600/15"
                        >
                            <option value="">All subjects</option>
                            {subjects.map((subject) => <option key={subject.id} value={subject.id}>{subject.name}</option>)}
                        </select>
                    </label>
                    <label className="text-xs font-semibold text-gray-500">
                        Curriculum unit
                        <select
                            value={selectedUnit}
                            onChange={(e) => { setSelectedUnit(e.target.value); setPage(1); }}
                            className="mt-1.5 block w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm font-medium text-gray-900 focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-600/15"
                        >
                            <option value="">All units</option>
                            {units.map((unit) => <option key={unit.id} value={unit.id}>{unit.name}</option>)}
                        </select>
                    </label>
                    <label className="text-xs font-semibold text-gray-500">
                        Search question bank
                        <input
                            type="text"
                            className="mt-1.5 block w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm font-medium text-gray-900 placeholder:font-normal placeholder:text-gray-400 focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-600/15"
                            placeholder="Question, ID, subject or chapter"
                            value={searchTerm}
                            onChange={(e) => { setSearchTerm(e.target.value); setPage(1); }}
                        />
                    </label>
                </div>

                {/* Table */}
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                    {loading ? (
                        <div className="p-12 text-center text-gray-500">Loading questions...</div>
                    ) : questions.length === 0 ? (
                        <div className="p-12 text-center text-gray-500">No questions match these filters. Import a chapter-wise JSON folder or add a question.</div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left text-gray-500">
                                <thead className="text-xs text-gray-700 uppercase bg-gray-50 border-b">
                                    <tr>
                                        <th className="px-6 py-3">ID</th>
                                        <th className="px-6 py-3 w-1/2">Question</th>
                                        <th className="px-6 py-3">Exam / subject</th>
                                        <th className="px-6 py-3">Chapter</th>
                                        <th className="px-6 py-3">Marks</th>
                                        <th className="px-6 py-3 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {questions.map((q) => (
                                        <tr key={q.id} className="bg-white border-b hover:bg-gray-50">
                                            <td className="px-6 py-4 font-bold text-gray-900">{q.question_uid}</td>
                                            <td className="px-6 py-4">
                                                <div className="line-clamp-2 max-h-16 overflow-hidden">
                                                    <LatexRenderer>{q.question_text}</LatexRenderer>
                                                </div>
                                                {q.image_link && <span className="text-[10px] text-blue-600 font-bold bg-blue-50 px-1.5 py-0.5 rounded mt-1 inline-block">Image</span>}
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="font-semibold text-gray-800">{q.exam_code || 'Manual'}</div>
                                                <div className="text-xs text-gray-500">{q.source_subject || units.find((unit) => unit.id === String(q.unit_id))?.name || 'General'}</div>
                                            </td>
                                            <td className="px-6 py-4">{q.chapter}</td>
                                            <td className="px-6 py-4">{q.marks}</td>
                                            <td className="px-6 py-4 text-right">
                                                <button onClick={() => openModal(q)} className="text-blue-600 hover:text-blue-900 font-bold mr-3"><Edit2 size={16} /></button>
                                                <button onClick={() => handleDelete(q.id)} className="text-red-600 hover:text-red-900 font-bold"><Trash2 size={16} /></button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                    <div className="flex flex-col gap-3 border-t border-gray-100 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                        <p className="text-sm text-gray-500">
                            {pagination.total === 0 ? 'No questions' : `Showing ${(page - 1) * PAGE_SIZE + 1}–${Math.min(page * PAGE_SIZE, pagination.total)} of ${pagination.total.toLocaleString()} questions`}
                        </p>
                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                onClick={() => setPage((current) => Math.max(1, current - 1))}
                                disabled={page <= 1 || loading}
                                className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
                            >
                                <ChevronLeft size={16} /> Previous
                            </button>
                            <span className="px-2 text-sm tabular-nums text-gray-500">{page} / {pagination.total_pages}</span>
                            <button
                                type="button"
                                onClick={() => setPage((current) => Math.min(pagination.total_pages, current + 1))}
                                disabled={page >= pagination.total_pages || loading}
                                className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
                            >
                                Next <ChevronRight size={16} />
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {isImportOpen && createPortal(
                <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm" onMouseDown={(event) => { if (event.target === event.currentTarget && !importing) setIsImportOpen(false); }}>
                    <section role="dialog" aria-modal="true" aria-labelledby="question-import-title" className="flex max-h-[min(92dvh,860px)] w-full max-w-2xl flex-col overflow-hidden rounded-3xl border border-white/70 bg-white shadow-[0_32px_100px_-32px_rgba(15,23,42,0.55)]">
                        <header className="flex items-start justify-between border-b border-gray-100 px-6 py-5 sm:px-7">
                            <div className="flex items-start gap-3">
                                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-teal-50 text-teal-700"><FileJson size={21} /></span>
                                <div>
                                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-teal-700">Versioned question data</p>
                                    <h2 id="question-import-title" className="mt-1 text-xl font-bold text-gray-900">Import chapter-wise JSON</h2>
                                    <p className="mt-1 max-w-xl text-sm leading-5 text-gray-500">Choose an IOE or CEE folder. We validate it first, then import in small, resumable database batches.</p>
                                </div>
                            </div>
                            <button type="button" aria-label="Close import" disabled={importing} onClick={() => setIsImportOpen(false)} className="rounded-xl p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700 disabled:opacity-40"><X size={20} /></button>
                        </header>

                        <div className="space-y-5 overflow-y-auto px-6 py-5 sm:px-7">
                            <label className="block text-sm font-semibold text-gray-700">
                                Exam for this import
                                <select
                                    value={importExam}
                                    disabled={importing || preparingImport}
                                    onChange={(event) => {
                                        const exam = event.target.value as ExamCode;
                                        setImportExam(exam);
                                        if (importPlan) void inspectJsonFiles(importPlan.files, exam);
                                    }}
                                    className="mt-1.5 block w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 font-medium text-gray-900 focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-600/15"
                                >
                                    <option value="IOE">IOE</option>
                                    <option value="CEE">CEE</option>
                                </select>
                            </label>

                            <div className="grid gap-3 sm:grid-cols-2">
                                <input ref={folderInputRef} type="file" multiple accept=".json,application/json" className="sr-only" onChange={(event) => { void handleJsonSelection(event.currentTarget.files); event.currentTarget.value = ''; }} />
                                <input ref={filesInputRef} type="file" multiple accept=".json,application/json" className="sr-only" onChange={(event) => { void handleJsonSelection(event.currentTarget.files); event.currentTarget.value = ''; }} />
                                <button type="button" disabled={importing || preparingImport} onClick={() => folderInputRef.current?.click()} className="flex min-h-24 items-center gap-3 rounded-2xl border border-dashed border-teal-200 bg-teal-50/50 px-4 text-left transition-colors hover:border-teal-400 hover:bg-teal-50 disabled:opacity-50">
                                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white text-teal-700 shadow-sm"><FolderOpen size={19} /></span>
                                    <span><span className="block text-sm font-semibold text-gray-800">Choose a folder</span><span className="mt-1 block text-xs text-gray-500">Best for a full chapter-wise dataset</span></span>
                                </button>
                                <button type="button" disabled={importing || preparingImport} onClick={() => filesInputRef.current?.click()} className="flex min-h-24 items-center gap-3 rounded-2xl border border-dashed border-gray-300 bg-gray-50/70 px-4 text-left transition-colors hover:border-gray-400 hover:bg-gray-100 disabled:opacity-50">
                                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white text-gray-600 shadow-sm"><Upload size={18} /></span>
                                    <span><span className="block text-sm font-semibold text-gray-800">Choose JSON files</span><span className="mt-1 block text-xs text-gray-500">Select one or more .json files</span></span>
                                </button>
                            </div>

                            {preparingImport && <p role="status" className="rounded-xl bg-slate-50 px-4 py-3 text-sm text-gray-600">Reading and validating JSON files…</p>}

                            {importPlan && !preparingImport && (
                                <div className="space-y-4 rounded-2xl border border-gray-200 bg-gray-50/80 p-4 sm:p-5">
                                    <div className="grid grid-cols-3 gap-2 sm:gap-3">
                                        <div className="rounded-xl bg-white p-3"><div className="text-xl font-bold tabular-nums text-gray-900">{importPlan.files.length.toLocaleString()}</div><div className="mt-1 text-xs text-gray-500">JSON files</div></div>
                                        <div className="rounded-xl bg-white p-3"><div className="text-xl font-bold tabular-nums text-teal-700">{importPlan.questionCount.toLocaleString()}</div><div className="mt-1 text-xs text-gray-500">Ready to import</div></div>
                                        <div className="rounded-xl bg-white p-3"><div className="text-xl font-bold tabular-nums text-amber-700">{importPlan.skippedCount.toLocaleString()}</div><div className="mt-1 text-xs text-gray-500">Items to skip</div></div>
                                    </div>
                                    <p className="text-xs leading-5 text-gray-500">Files are normalized to the app’s <code className="rounded bg-white px-1 py-0.5 text-gray-700">question-bank.v1</code> format. Source file, subject, chapter, question number, tags, image, and correct-answer index are retained. Re-importing the same source updates it instead of duplicating it.</p>
                                    {importPlan.issues.length > 0 && (
                                        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
                                            <p className="text-sm font-semibold text-amber-900">Some entries will be skipped</p>
                                            <ul className="mt-2 max-h-28 list-disc space-y-1 overflow-y-auto pl-5 text-xs text-amber-800">
                                                {importPlan.issues.slice(0, 8).map((issue, index) => <li key={`${index}-${issue}`}>{issue}</li>)}
                                            </ul>
                                        </div>
                                    )}
                                </div>
                            )}

                            {importing && (
                                <div className="space-y-2 rounded-xl border border-teal-100 bg-teal-50/50 p-4" role="status" aria-live="polite">
                                    <div className="flex justify-between gap-3 text-sm"><span className="font-semibold text-gray-800">Importing {importPlan?.examCode} questions</span><span className="tabular-nums text-gray-600">{importProgress.processed.toLocaleString()} / {(importPlan?.questionCount || 0).toLocaleString()}</span></div>
                                    <div className="h-2 overflow-hidden rounded-full bg-white"><div className="h-full rounded-full bg-teal-600 transition-[width] duration-300" style={{ width: `${Math.min(100, (importProgress.processed / Math.max(1, importPlan?.questionCount || 0)) * 100)}%` }} /></div>
                                    <p className="text-xs text-gray-500">{importProgress.inserted.toLocaleString()} added · {importProgress.updated.toLocaleString()} refreshed · {importProgress.skipped.toLocaleString()} skipped</p>
                                </div>
                            )}
                        </div>

                        <footer className="flex flex-col-reverse gap-2 border-t border-gray-100 bg-white px-6 py-4 sm:flex-row sm:justify-end sm:px-7">
                            <button type="button" disabled={importing} onClick={() => setIsImportOpen(false)} className="rounded-xl px-4 py-2.5 text-sm font-semibold text-gray-600 transition-colors hover:bg-gray-100 disabled:opacity-40">Cancel</button>
                            <button type="button" disabled={!importPlan || importPlan.questionCount === 0 || importing || preparingImport} onClick={() => void importJsonQuestions()} className="inline-flex items-center justify-center gap-2 rounded-xl bg-teal-700 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-40">
                                <FileJson size={17} /> {importing ? 'Importing…' : `Import ${importPlan?.questionCount.toLocaleString() || 0} questions`}
                            </button>
                        </footer>
                    </section>
                </div>,
                document.body,
            )}

            {/* Modal */}
            {isModalOpen && createPortal(
                <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm" onMouseDown={(event) => { if (event.target === event.currentTarget) setIsModalOpen(false); }}>
                    <div role="dialog" aria-modal="true" aria-labelledby="question-editor-title" className="max-h-[min(90dvh,860px)] w-full max-w-4xl overflow-y-auto rounded-3xl border border-white/70 bg-white shadow-[0_32px_100px_-32px_rgba(15,23,42,0.55)]">
                        <form onSubmit={handleSubmit}>
                            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-100 bg-white/95 px-6 py-5 backdrop-blur-lg">
                                <h2 id="question-editor-title" className="text-xl font-bold text-gray-900">
                                    {editingQuestion ? 'Edit Question' : 'Add New Question'}
                                </h2>
                                <button type="button" onClick={() => setIsModalOpen(false)} aria-label="Close question editor" className="rounded-xl p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700">
                                    <X size={24} />
                                </button>
                            </div>

                            <div className="p-6 space-y-6">
                                <div className="rounded-2xl border border-teal-100 bg-teal-50/70 p-4">
                                    <label className="block text-sm font-semibold text-gray-700" htmlFor="question-unit">Curriculum unit <span className="font-normal text-gray-400">(optional)</span></label>
                                    <select id="question-unit" className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-600/15" value={formUnitId} onChange={(event) => setFormUnitId(event.target.value)}>
                                        <option value="">No curriculum unit</option>
                                        {units.map((unit) => <option key={unit.id} value={unit.id}>{unit.name}</option>)}
                                    </select>
                                    <p className="mt-2 text-xs text-gray-500">Manage curriculum units from Academic structure.</p>
                                </div>

                                <div className="grid grid-cols-2 gap-6">
                                    <div>
                                        <label className="block text-sm font-bold text-gray-700 mb-1">Unique ID</label>
                                        <input name="question_uid" value={formData.question_uid} onChange={handleFormChange} className="w-full border p-2 rounded-lg" required />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold text-gray-700 mb-1">Chapter</label>
                                        <input name="chapter" value={formData.chapter} onChange={handleFormChange} className="w-full border p-2 rounded-lg" placeholder="e.g. WAVES" />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-1">Question Text (LaTeX supported)</label>
                                    <textarea name="question_text" rows={3} value={formData.question_text} onChange={handleFormChange} className="w-full border p-2 rounded-lg" required />
                                </div>

                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-1">Image</label>
                                    <div className="flex gap-4 items-center">
                                        <label className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-lg cursor-pointer font-bold text-sm flex items-center gap-2">
                                            <Upload size={16} />
                                            {uploadingImage ? 'Uploading...' : 'Upload Image'}
                                            <input type="file" className="hidden" accept="image/*" onChange={handleImageUpload} />
                                        </label>
                                        {formData.image_link && (
                                            <div className="flex items-center gap-2 bg-green-50 px-3 py-1 rounded border border-green-200">
                                                <span className="text-xs text-green-700 truncate max-w-[200px]">{formData.image_link}</span>
                                                <button type="button" onClick={() => setFormData({ ...formData, image_link: null })} className="text-red-500 font-bold ml-2">x</button>
                                            </div>
                                        )}
                                    </div>
                                    {formData.image_link && <img src={formData.image_link} className="mt-2 h-20 rounded border" />}
                                </div>

                                <div className="space-y-3">
                                    <label className="block text-sm font-bold text-gray-700">Options</label>
                                    {formData.options?.map((opt, i) => (
                                        <div key={i} className="flex gap-2 items-center">
                                            <span className="font-bold w-6">{String.fromCharCode(65 + i)}</span>
                                            <input
                                                name={`option_${i}`}
                                                value={opt}
                                                onChange={handleFormChange}
                                                className={`flex-1 border p-2 rounded-lg ${formData.correct_option === i ? 'border-green-500 ring-1 ring-green-500' : ''}`}
                                                placeholder={`Option ${i + 1}`}
                                                required
                                            />
                                            <input
                                                type="radio"
                                                name="correct_option"
                                                checked={formData.correct_option === i}
                                                onChange={() => setFormData({ ...formData, correct_option: i })}
                                                className="w-5 h-5 text-green-600 focus:ring-green-500"
                                            />
                                        </div>
                                    ))}
                                </div>

                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-1">Explanation</label>
                                    <textarea name="explanation" rows={2} value={formData.explanation} onChange={handleFormChange} className="w-full border p-2 rounded-lg" />
                                </div>

                                <div className="flex items-center gap-4">
                                    <div className="w-1/3">
                                        <label className="block text-sm font-bold text-gray-700 mb-1">Marks</label>
                                        <input type="number" name="marks" value={formData.marks} onChange={(event: ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, marks: Number.parseFloat(event.target.value) })} className="w-full border p-2 rounded-lg" required step="0.5" />
                                    </div>
                                </div>

                            </div>

                            <div className="p-6 border-t bg-gray-50 rounded-b-2xl flex justify-end gap-3">
                                <button type="button" onClick={() => setIsModalOpen(false)} className="px-6 py-2 text-gray-600 font-bold hover:bg-gray-200 rounded-lg">Cancel</button>
                                <button type="submit" disabled={loading} className="px-6 py-2 bg-green-600 text-white font-bold rounded-lg hover:bg-green-700 shadow-lg shadow-green-200">
                                    {loading ? 'Saving...' : 'Save Question'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>,
                document.body,
            )}
            {/* Generator Modal */}
            {isGeneratorOpen && createPortal(
                <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm" onMouseDown={(event) => { if (event.target === event.currentTarget) setIsGeneratorOpen(false); }}>
                    <section role="dialog" aria-modal="true" aria-labelledby="question-set-title" className="w-full max-w-lg overflow-hidden rounded-3xl border border-white/70 bg-white shadow-[0_32px_100px_-32px_rgba(15,23,42,0.55)]">
                        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-5">
                            <div>
                                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-teal-700">Question bank</p>
                                <h2 id="question-set-title" className="mt-1 text-xl font-bold text-gray-900">Generate a practice set</h2>
                            </div>
                            <button type="button" aria-label="Close generator" onClick={() => setIsGeneratorOpen(false)} className="rounded-xl p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700"><X size={20} /></button>
                        </div>
                        <div className="space-y-4 p-6">
                            <label className="block text-sm font-semibold text-gray-700">
                                Exam
                                <select value={generatorExam} onChange={(event) => setGeneratorExam(event.target.value as ExamCode)} className="mt-1.5 block w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 font-medium text-gray-900 focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-600/15">
                                    <option value="IOE">IOE</option>
                                    <option value="CEE">CEE</option>
                                </select>
                            </label>
                            <label className="block text-sm font-semibold text-gray-700">
                                Number of questions
                                <input type="number" min="1" max="100" value={generatorCount} onChange={(event) => setGeneratorCount(Math.max(1, Math.min(100, Number(event.target.value) || 1)))} className="mt-1.5 block w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 font-medium text-gray-900 focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-600/15" />
                            </label>
                            <p className="text-sm leading-6 text-gray-500">Questions are sampled from the selected exam and current subject or unit filters. The result is a versioned JSON document ready to reuse.</p>
                        </div>
                        <div className="flex justify-end gap-2 border-t border-gray-100 bg-gray-50/70 px-6 py-4">
                            <button type="button" onClick={() => setIsGeneratorOpen(false)} className="rounded-xl px-4 py-2.5 text-sm font-semibold text-gray-600 transition-colors hover:bg-gray-100">Cancel</button>
                            <button type="button" onClick={handleGenerateSet} disabled={loading} className="flex items-center gap-2 rounded-xl bg-teal-700 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-teal-800 disabled:opacity-60">
                                {loading && <div className="h-4 w-4 animate-spin rounded-full border-b-2 border-white" />}
                                Generate set
                            </button>
                        </div>
                    </section>
                </div>,
                document.body,
            )}

            {/* Result JSON Modal */}
            {showGeneratedResult && createPortal(
                <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm">
                    <div role="dialog" aria-modal="true" aria-labelledby="generated-question-json-title" className="flex h-[min(84dvh,900px)] w-full max-w-5xl flex-col overflow-hidden rounded-3xl border border-white/70 bg-white shadow-[0_32px_100px_-32px_rgba(15,23,42,0.55)]">
                        <div className="p-6 border-b flex justify-between items-center bg-green-50">
                            <div className="flex items-center gap-3">
                                <h2 id="generated-question-json-title" className="text-xl font-bold text-gray-900">Generated practice set</h2>
                                <span className="bg-teal-100 text-teal-800 text-xs px-2 py-1 rounded-full font-semibold">JSON v1</span>
                            </div>
                            <button onClick={() => setShowGeneratedResult(false)} className="text-gray-400 hover:text-gray-600"><X size={24} /></button>
                        </div>
                        <div className="p-0 flex-1 relative">
                            <textarea
                                className="w-full h-full p-6 font-mono text-xs bg-gray-50 resize-none outline-none"
                                value={generatedJson}
                                readOnly
                            />
                            <button
                                onClick={copyToClipboard}
                                className="absolute top-4 right-4 bg-white border border-gray-200 shadow-lg px-4 py-2 rounded-lg text-sm font-bold text-blue-600 hover:bg-blue-50 flex items-center gap-2"
                            >
                                <Save size={16} /> Copy to Clipboard
                            </button>
                        </div>
                        <div className="p-4 border-t bg-white flex justify-end">
                            <button onClick={() => setShowGeneratedResult(false)} className="px-6 py-2 bg-gray-800 text-white font-bold rounded-lg hover:bg-gray-900">Close</button>
                        </div>
                    </div>
                </div>,
                document.body,
            )}

        </DashboardLayout>
    );
}
