import { useState, useEffect, ChangeEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';
import { ChevronLeft, Save, Sparkles, Upload, Check, Trash2, Edit2, AlertTriangle, Download, Loader2, Image, FileText } from 'lucide-react';
import { DashboardLayout } from '../components/DashboardLayout';
import { useAuth } from '../context/AuthContext';
import { LatexRenderer } from '../components/LatexRenderer';
import toast from 'react-hot-toast';

const API_URL = 'https://notelibraryapp.com/api/admin/testSeries.php';
const COLLECTION_API_URL = 'https://notelibraryapp.com/api/admin/testSeriesCollection.php';
const UPLOAD_API_URL = 'https://notelibraryapp.com/api/admin/upload_question_image.php';
const DOWNLOAD_IMAGE_API_URL = 'https://notelibraryapp.com/api/admin/download_remote_image.php';
// Provider credentials must never be shipped in the browser bundle.

// ─── Utility: extract ALL image URLs from any string field ───
function extractImageUrls(text: string): string[] {
    if (!text) return [];
    const urls: string[] = [];
    const imgRegex = /<img[^>]+src=["']([^"']+)["'][^>]*\/?>/gi;
    let match;
    while ((match = imgRegex.exec(text)) !== null) {
        if (match[1] && /^https?:\/\//i.test(match[1])) {
            urls.push(match[1]);
        }
    }
    return urls;
}

// ─── Utility: encode non-ASCII characters to HTML entities to prevent DB charset corruption ───
function encodeUnicodeToHtml(str: string | null | undefined): any {
    if (typeof str !== 'string') return str;
    return str.replace(/[\u00A0-\u9999]/g, (c) => `&#${c.charCodeAt(0)};`);
}

// ─── Utility: sanitize question data before sending to backend ───
function sanitizeQuestionForApi(q: any) {
    const sanitized = { ...q };
    delete sanitized.id; // ensure internal ID is removed
    if (sanitized.questionText) sanitized.questionText = encodeUnicodeToHtml(sanitized.questionText);
    if (sanitized.explanation) sanitized.explanation = encodeUnicodeToHtml(sanitized.explanation);
    if (Array.isArray(sanitized.options)) {
        sanitized.options = sanitized.options.map((opt: any) => encodeUnicodeToHtml(String(opt)));
    }
    // Remove react internal keys if they leaked
    return sanitized;
}

// ─── Utility: scan a question for all image URLs ───
function scanQuestionForImages(q: QuizQuestion): { field: string; url: string; questionNo: number | string }[] {
    const results: { field: string; url: string; questionNo: number | string }[] = [];

    if (q.imageLink && /^https?:\/\//i.test(q.imageLink)) {
        results.push({ field: 'imageLink', url: q.imageLink, questionNo: q.questionNo });
    }

    extractImageUrls(q.questionText).forEach(url => {
        results.push({ field: 'questionText', url, questionNo: q.questionNo });
    });

    q.options.forEach((opt, idx) => {
        extractImageUrls(String(opt)).forEach(url => {
            results.push({ field: `option_${idx}`, url, questionNo: q.questionNo });
        });
    });

    if (q.explanation) {
        extractImageUrls(q.explanation).forEach(url => {
            results.push({ field: 'explanation', url, questionNo: q.questionNo });
        });
    }
    return results;
}

const AI_MODELS = [
    { id: 'minimaxai/minimax-m2.7', name: 'MiniMax M2.7 (NVIDIA)' },
    { id: 'meta/llama-3.1-405b-instruct', name: 'Meta Llama 3.1 405B' },
    { id: 'meta/llama-3.2-90b-vision-instruct', name: 'Meta Llama 3.2 90B Vision' },
    { id: 'nvidia/llama-3.1-nemotron-70b-instruct', name: 'Nemotron 70B Instruct' },
    { id: 'gemini-3.1-pro', name: 'Gemini 3.1 Pro' },
    { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash' },
    { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash' },
    { id: 'gemini-2.0-flash-exp', name: 'Gemini 2.0 Flash Experimental' },
    { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro' },
    { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash' },
    { id: 'gemma-4-31b', name: 'Gemma 4 31B' },
    { id: 'gemma-4-26b-a4b', name: 'Gemma 4 26B A4B' },
    { id: 'gemma-3-27b', name: 'Gemma 3 27B' },
    { id: 'gemma-3-12b', name: 'Gemma 3 12B' },
    { id: 'gemma-3-4b', name: 'Gemma 3 4B' },
    { id: 'gemma-3n-4b', name: 'Gemma 3n 4B' },
    { id: 'gemma-3n-2b', name: 'Gemma 3n 2B' },
    { id: 'gemma-4-26b-a4b-it', name: 'Gemma 4 26B A4B IT' }
];

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

export default function TestSeriesEditor() {
    const { token } = useAuth();
    const navigate = useNavigate();
    const { id } = useParams<{ id: string }>();
    const isEditing = !!id;

    const [collections, setCollections] = useState<TestSeriesCollection[]>([]);
    const [loading, setLoading] = useState(false);
    const [fetching, setFetching] = useState(isEditing);

    const [formData, setFormData] = useState({
        collection_id: 0,
        quiz_title: '',
        time_limit: 60,
        negative_marking: 0,
        mode: 'NORMAL' as 'LIVE' | 'NORMAL',
        start_time: '',
        end_time: ''
    });

    const [jsonInput, setJsonInput] = useState('');
    const [questions, setQuestions] = useState<QuizQuestion[]>([]);
    const [editingQuestionId, setEditingQuestionId] = useState<string | null>(null);
    const [editedQuestionData, setEditedQuestionData] = useState<QuizQuestion | null>(null);
    const [uploadingImage, setUploadingImage] = useState(false);
    const [parseSuccess, setParseSuccess] = useState<string | null>(null);
    const [parseError, setParseError] = useState<string | null>(null);
    const [isValidated, setIsValidated] = useState(false);
    const [generatingAI, setGeneratingAI] = useState(false);
    const [selectedModel, setSelectedModel] = useState(AI_MODELS[0].id);

    const [showImageQuestions, setShowImageQuestions] = useState(false);
    const [showNoExplanationQuestions, setShowNoExplanationQuestions] = useState(false);
    const [showFailedImageQuestions, setShowFailedImageQuestions] = useState(false);

    const [downloadingImages, setDownloadingImages] = useState(false);
    const [imageProgress, setImageProgress] = useState({ current: 0, total: 0 });
    const [downloadResults, setDownloadResults] = useState<{ downloaded: number; skipped: number; failed: number } | null>(null);
    const [failedDownloads, setFailedDownloads] = useState<{ questionId?: string; questionText: string; field: string; url: string }[]>([]);

    const totalQuestions = questions.length;
    const totalMarks = questions.reduce((sum, q) => sum + (typeof q.marks === 'number' ? q.marks : Number(q.marks) || 0), 0);

    useEffect(() => {
        fetchCollections();
        if (isEditing) {
            fetchTestData();
        }
    }, [id]);

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
            toast.error('Error fetching collections');
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

    const fetchTestData = async () => {
        setFetching(true);
        try {
            const response = await axios.get(`${API_URL}?id=${id}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (response.data.success) {
                const test = response.data.data[0];
                if (test) {
                    const parsedQuestions = safeParseQuizJson(test.quiz_json);
                    setFormData({
                        collection_id: test.collection_id,
                        quiz_title: test.quiz_title,
                        time_limit: test.time_limit,
                        negative_marking: test.negative_marking,
                        mode: test.mode,
                        start_time: test.start_time || '',
                        end_time: test.end_time || ''
                    });
                    setQuestions(parsedQuestions.map((q, i) => ({ ...q, id: `question-${Date.now()}-${i}` })));
                    setJsonInput(JSON.stringify(parsedQuestions, null, 2));
                }
            }
        } catch (error) {
            console.error('Error fetching test data:', error);
            toast.error('Error fetching test data');
        } finally {
            setFetching(false);
        }
    };

    const validateQuizJson = (jsonString: string): { valid: boolean; questions: QuizQuestion[]; error?: string } => {
        let parsed: any;
        try {
            const trimmed = jsonString.trim();
            if (!trimmed) return { valid: false, questions: [], error: 'Please enter JSON content' };

            try {
                parsed = JSON.parse(trimmed);
            } catch (e) {
                try {
                    parsed = JSON.parse(`[${trimmed}]`);
                } catch (e2) {
                    return { valid: false, questions: [], error: 'Invalid JSON syntax' };
                }
            }
        } catch (err) {
            return { valid: false, questions: [], error: 'Invalid JSON format' };
        }

        let questionsList: any[] = [];
        if (Array.isArray(parsed)) {
            questionsList = parsed;
        } else if (typeof parsed === 'object' && parsed !== null) {
            if (Array.isArray(parsed.questions)) {
                questionsList = parsed.questions;
            } else {
                questionsList = [parsed];
            }
        }

        if (!Array.isArray(questionsList) || questionsList.length === 0) {
            return { valid: false, questions: [], error: 'Could not find a list of questions in the provided JSON' };
        }

        const validatedQuestions: QuizQuestion[] = [];

        for (let i = 0; i < questionsList.length; i++) {
            const q = questionsList[i];
            const qNum = q.questionNo ?? (i + 1);

            // Support both 'questionText' and 'question' fields
            const questionText = q.questionText || q.question;

            if (!questionText || typeof questionText !== 'string') {
                return { valid: false, questions: [], error: `Question ${qNum}: 'questionText' or 'question' field is missing or not a string.` };
            }

            // Validate options array
            if (!Array.isArray(q.options) || !q.options.every((opt: any) => typeof opt === 'string' || typeof opt === 'number')) {
                return { valid: false, questions: [], error: `Question ${qNum}: 'options' must be an array of strings or numbers.` };
            }
            if (q.options.length < 2) {
                return { valid: false, questions: [], error: `Question ${qNum}: Must have at least 2 options.` };
            }

            // Validate correctOption
            if (typeof q.correctOption !== 'number') {
                return { valid: false, questions: [], error: `Question ${qNum}: 'correctOption' must be a number (0-based index).` };
            }
            if (q.correctOption < 0 || q.correctOption >= q.options.length) {
                return { valid: false, questions: [], error: `Question ${qNum}: 'correctOption' ${q.correctOption} is out of bounds (0-${q.options.length - 1}).` };
            }

            // Validate imageLink - accept null, undefined, or valid HTTPS URL string
            let normalizedImageLink: string | null = null;
            if (q.imageLink !== null && q.imageLink !== undefined && q.imageLink !== '') {
                if (typeof q.imageLink !== 'string') {
                    return { valid: false, questions: [], error: `Question ${qNum}: 'imageLink' must be a string URL or null.` };
                }
                // Validate that it's a proper HTTPS URL (or HTTP for local dev)
                const urlPattern = /^https?:\/\/.+/i;
                if (!urlPattern.test(q.imageLink)) {
                    return { valid: false, questions: [], error: `Question ${qNum}: 'imageLink' must be a valid HTTP/HTTPS URL.` };
                }
                normalizedImageLink = q.imageLink;
            }

            // Validate marks if present
            if (q.marks !== undefined && q.marks !== null && typeof q.marks !== 'number') {
                return { valid: false, questions: [], error: `Question ${qNum}: 'marks' must be a number.` };
            }

            // Validate explanation if present (string or null allowed)
            if (q.explanation !== undefined && q.explanation !== null && typeof q.explanation !== 'string') {
                return { valid: false, questions: [], error: `Question ${qNum}: 'explanation' must be a string or null.` };
            }

            // Validate unitId if present (string or null allowed)
            if (q.unitId !== undefined && q.unitId !== null && typeof q.unitId !== 'string') {
                return { valid: false, questions: [], error: `Question ${qNum}: 'unitId' must be a string or null.` };
            }

            // Validate chapterId if present (string or null allowed)
            if (q.chapterId !== undefined && q.chapterId !== null && typeof q.chapterId !== 'string') {
                return { valid: false, questions: [], error: `Question ${qNum}: 'chapterId' must be a string or null.` };
            }

            // Build validated question with all required fields, defaulting missing optional fields to null
            validatedQuestions.push({
                id: `question-${Date.now()}-${i}`,
                questionId: q.questionId || `QID_${Date.now()}_${i}`,
                questionNo: qNum,
                questionText: questionText,
                imageLink: normalizedImageLink,
                options: q.options.map((opt: any) => String(opt)), // Normalize all options to strings
                correctOption: q.correctOption,
                marks: typeof q.marks === 'number' ? q.marks : 1,
                unitId: typeof q.unitId === 'string' ? q.unitId : null,
                chapterId: typeof q.chapterId === 'string' ? q.chapterId : null,
                explanation: typeof q.explanation === 'string' ? q.explanation : null
            });
        }

        return { valid: true, questions: validatedQuestions };
    };

    const handleCheckQuestions = () => {
        setParseError(null);
        setParseSuccess(null);
        const result = validateQuizJson(jsonInput);
        if (result.valid) {
            // Track what fields were added/normalized
            const addedFields: string[] = [];
            let parsed: any;
            try {
                parsed = JSON.parse(jsonInput.trim());
                if (!Array.isArray(parsed)) {
                    parsed = parsed.questions || [parsed];
                }
            } catch {
                parsed = [];
            }

            // Check what fields were missing in original JSON
            if (Array.isArray(parsed) && parsed.length > 0) {
                const sample = parsed[0];
                if (!('imageLink' in sample)) addedFields.push('imageLink');
                if (!('unitId' in sample)) addedFields.push('unitId');
                if (!('chapterId' in sample)) addedFields.push('chapterId');
                if (!('explanation' in sample)) addedFields.push('explanation');
                if (!('questionId' in sample)) addedFields.push('questionId');
            }

            // Update the JSON input with the corrected/normalized JSON (without the internal 'id' field)
            const correctedJson = result.questions.map(({ id, ...rest }) => rest);
            setJsonInput(JSON.stringify(correctedJson, null, 2));

            // Build success message
            const totalMarks = result.questions.reduce((sum, q) => sum + q.marks, 0);
            let successMsg = `✓ JSON Valid: ${result.questions.length} questions found. Total marks: ${totalMarks}. Ready to parse.`;
            if (addedFields.length > 0) {
                successMsg += ` Added missing fields: ${addedFields.join(', ')} (set to null where needed).`;
            }

            setParseSuccess(successMsg);
            setIsValidated(true);
        } else {
            setParseError(result.error || 'Invalid JSON');
            setIsValidated(false);
        }
    };

    const parseQuestions = () => {
        setParseError(null);
        setParseSuccess(null);
        const result = validateQuizJson(jsonInput);
        if (result.valid) {
            setQuestions(result.questions);
            // Update the JSON input with the corrected/normalized JSON (without the internal 'id' field)
            const correctedJson = result.questions.map(({ id, ...rest }) => rest);
            setJsonInput(JSON.stringify(correctedJson, null, 2));
            const totalMarks = result.questions.reduce((sum, q) => sum + q.marks, 0);
            setParseSuccess(`Successfully loaded ${result.questions.length} questions. Total marks: ${totalMarks}. JSON has been normalized.`);
        } else {
            setParseError(result.error || 'Invalid JSON');
        }
    };


    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value } = e.target;

        if (name === 'collection_id') {
            const selectedId = parseInt(value);
            const selectedCol = collections.find(c => Number(c.id) === selectedId);

            let newTimeLimit = 60;
            let newNegativeMarking = 0;

            if (selectedCol) {
                const exam = selectedCol.competitive_exam?.toUpperCase();
                if (exam === 'CEE') {
                    newTimeLimit = 180;
                    newNegativeMarking = 0.25;
                } else if (exam === 'IOE') {
                    newTimeLimit = 120;
                    newNegativeMarking = 0.10;
                }
            }

            setFormData(prev => ({
                ...prev,
                collection_id: selectedId,
                time_limit: newTimeLimit,
                negative_marking: newNegativeMarking
            }));

        } else {
            setFormData(prev => ({
                ...prev,
                [name]: name === 'time_limit' ? (value === '' ? 0 : parseInt(value)) :
                    name === 'negative_marking' ? (value === '' ? 0 : parseFloat(value)) : value
            }));
        }
    };

    const handleEditQuestion = (question: QuizQuestion) => {
        setEditingQuestionId(question.id || null);
        setEditedQuestionData({ ...question });
    };

    const handleQuestionChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        if (editedQuestionData) {
            const { name, value } = e.target;

            if (name.startsWith("option-")) {
                const optionIndex = parseInt(name.split("-")[1], 10);
                const newOptions = [...editedQuestionData.options];
                newOptions[optionIndex] = value;
                setEditedQuestionData({ ...editedQuestionData, options: newOptions });
            } else {
                setEditedQuestionData({
                    ...editedQuestionData,
                    [name]: name === 'correctOption' ? parseInt(value, 10) :
                        name === 'marks' ? (value === '' ? 0 : parseFloat(value)) : value,
                });
            }
        }
    };

    const handleSaveQuestion = () => {
        if (editedQuestionData) {
            const updatedQuestions = questions.map(q =>
                q.id === editedQuestionData.id ? editedQuestionData : q
            );
            setQuestions(updatedQuestions);

            // Sync with JSON input
            const questionsForJson = updatedQuestions.map(({ id, ...rest }) => rest);
            setJsonInput(JSON.stringify(questionsForJson, null, 2));

            setEditingQuestionId(null);
            setEditedQuestionData(null);
        }
    };

    const handleImageSelect = async (e: ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0] && editedQuestionData) {
            const file = e.target.files[0];
            setUploadingImage(true);

            // Create custom filename: quizid_questionno_image format
            const ext = file.name.split('.').pop() || 'jpg';
            const quizPrefix = id || 'new';
            const customFileName = `${quizPrefix}_${editedQuestionData.questionNo}_image.${ext}`;

            const formDataUpload = new FormData();
            formDataUpload.append('image', file);
            formDataUpload.append('customFileName', customFileName);

            try {
                const response = await fetch(UPLOAD_API_URL, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${token}` },
                    body: formDataUpload
                });

                const result = await response.json();
                if (result.success) {
                    setEditedQuestionData({
                        ...editedQuestionData,
                        imageLink: result.url
                    });
                    toast.success('Image uploaded successfully');
                } else {
                    toast.error('Upload failed: ' + result.message);
                }
            } catch (error) {
                console.error('Error uploading image:', error);
                toast.error('Error uploading image');
            } finally {
                setUploadingImage(false);
            }
        }
    };

    const generateExplanationWithAI = async () => {
        toast.error('AI explanation generation is unavailable until a secure server-side provider is configured.');
    };
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (editingQuestionId) {
            toast.error('Please save the question you are currently editing first');
            return;
        }
        if (formData.collection_id === 0) {
            toast.error('Please select a collection');
            return;
        }
        if (questions.length === 0) {
            toast.error('Please add at least one question');
            return;
        }

        setLoading(true);

        const questionsForApi = questions.map(q => sanitizeQuestionForApi(q));
            const totalQuestions = questions.length;
            const totalMarks = questions.reduce((sum, q) => sum + (typeof q.marks === 'number' ? q.marks : Number(q.marks) || 0), 0);

        const payload = {
            collection_id: formData.collection_id,
            quiz_title: formData.quiz_title,
            time_limit: formData.time_limit,
            negative_marking: formData.negative_marking,
            mode: formData.mode,
            start_time: formData.mode === 'LIVE' ? formData.start_time : null,
            end_time: formData.mode === 'LIVE' ? formData.end_time : null,
            total_questions: totalQuestions,
            total_marks: totalMarks,
            quiz_json: questionsForApi
        };

        try {
            if (isEditing) {
                await axios.put(API_URL, { ...payload, id: id }, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                toast.success('Test series updated successfully');
            } else {
                await axios.post(API_URL, payload, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                toast.success('Test series created successfully');
            }
            navigate('/test-series');
        } catch (error: any) {
            console.error('Error saving test series:', error);
            toast.error(error.response?.data?.message || 'Error saving test series');
        } finally {
            setLoading(false);
        }
    };

    const handleDownloadAllImages = async () => {
        const allImageEntries: { entryIdx: number; field: string; url: string; questionId: string; questionNo: number | string; questionText: string }[] = [];
        questions.forEach((q) => {
            scanQuestionForImages(q).forEach((entry, entryIdx) => {
                if (!entry.url.includes('notelibraryapp.com')) {
                    allImageEntries.push({ entryIdx, questionId: q.questionId, questionText: q.questionText, ...entry });
                }
            });
        });

        if (allImageEntries.length === 0) {
            toast('No remote images found to download', { icon: '📭' });
            return;
        }

        setDownloadingImages(true);
        setImageProgress({ current: 0, total: allImageEntries.length });
        setDownloadResults(null);
        setFailedDownloads([]);

        let downloaded = 0, skipped = 0, failed = 0;
        const urlMap = new Map<string, string>();
        const failedList: { questionId?: string; questionText: string; field: string; url: string }[] = [];

        for (let i = 0; i < allImageEntries.length; i++) {
            const entry = allImageEntries[i];
            setImageProgress({ current: i + 1, total: allImageEntries.length });

            if (urlMap.has(entry.url)) {
                skipped++;
                continue;
            }

            try {
                const setIdentifier = formData.quiz_title.replace(/[^a-zA-Z0-9]/g, '_') || 'EditorSet';
                const ext = entry.url.split('.').pop()?.split('?')[0]?.toLowerCase() || 'png';
                const validExt = ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext) ? ext : 'png';
                const customName = `${formData.collection_id}_${setIdentifier}_q${entry.questionNo}_${entry.field.replace(/[^a-zA-Z0-9]/g, '')}_${i}.${validExt}`;

                const resp = await axios.post(DOWNLOAD_IMAGE_API_URL, {
                    url: entry.url,
                    customFileName: customName,
                    returnBase64: true
                }, {
                    headers: { Authorization: `Bearer ${token}` }
                });

                if (resp.data.success) {
                    const newValue = resp.data.dataUrl || resp.data.url;
                    urlMap.set(entry.url, newValue);
                    if (resp.data.skipped) skipped++;
                    else downloaded++;
                } else {
                    failed++;
                    failedList.push({ questionId: entry.questionId, questionText: entry.questionText, field: entry.field, url: entry.url });
                }
            } catch (err) {
                failed++;
                failedList.push({ questionId: entry.questionId, questionText: entry.questionText, field: entry.field, url: entry.url });
            }
        }

        if (urlMap.size > 0) {
            const updatedQuestions = questions.map(q => {
                let updated = { ...q };
                if (updated.imageLink && urlMap.has(updated.imageLink)) {
                    updated.imageLink = urlMap.get(updated.imageLink)!;
                }
                urlMap.forEach((newUrl, oldUrl) => {
                    const escaped = oldUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                    const re = new RegExp(escaped, 'g');
                    updated.questionText = updated.questionText.replace(re, newUrl);
                    updated.options = updated.options.map(opt => String(opt).replace(re, newUrl));
                    if (updated.explanation) {
                        updated.explanation = updated.explanation.replace(re, newUrl);
                    }
                });
                return updated;
            });
            setQuestions(updatedQuestions);
            setJsonInput(JSON.stringify(updatedQuestions, null, 2));
        }

        setDownloadResults({ downloaded, skipped, failed });
        setFailedDownloads(failedList);
        setDownloadingImages(false);
        toast.success(`Done! ${downloaded} downloaded, ${skipped} skipped, ${failed} failed`);
    };

    if (fetching) {
        return (
            <DashboardLayout>
                <div className="flex items-center justify-center min-h-[60vh]">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                </div>
            </DashboardLayout>
        );
    }

    return (
        <DashboardLayout>
            <div className="p-6 max-w-[95%] mx-auto pb-32">
                {/* Header Section */}
                <div className="flex items-center gap-4 mb-6">
                    <button
                        onClick={() => navigate('/test-series')}
                        className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                    >
                        <ChevronLeft size={24} className="text-gray-600" />
                    </button>
                    <h1 className="text-3xl font-bold text-gray-900">
                        {isEditing ? 'Edit Test Series' : 'Create Test Series'}
                    </h1>
                </div>

                <form onSubmit={handleSubmit} className="space-y-8">
                    {/* General Information Section */}
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-6">
                        <h2 className="text-xl font-bold text-gray-900 border-b pb-3">General Information</h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Collection *</label>
                                <select
                                    name="collection_id"
                                    value={formData.collection_id}
                                    onChange={handleInputChange}
                                    required
                                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                                >
                                    <option value={0}>Select a collection</option>
                                    {collections.map(col => (
                                        <option key={col.id} value={col.id}>{col.title} ({col.competitive_exam})</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
                                <input
                                    type="text"
                                    name="quiz_title"
                                    value={formData.quiz_title}
                                    onChange={handleInputChange}
                                    required
                                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                                    placeholder="e.g. Weekly Mock Test 01"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Time Limit (minutes) *</label>
                                <input
                                    type="number"
                                    name="time_limit"
                                    value={formData.time_limit}
                                    onChange={handleInputChange}
                                    required
                                    min="1"
                                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Negative Marking: {(formData.negative_marking || 0).toFixed(2)}
                                </label>
                                <input
                                    type="range"
                                    name="negative_marking"
                                    value={formData.negative_marking || 0}
                                    onChange={handleInputChange}
                                    min="0"
                                    max="0.5"
                                    step="0.05"
                                    className="w-full mt-3 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                                />
                            </div>
                        </div>

                        <div className="bg-gray-50 p-6 rounded-xl border border-gray-100">
                            <label className="block text-sm font-medium text-gray-700 mb-4">Test Mode</label>
                            <div className="flex gap-8 mb-6">
                                <label className="flex items-center gap-3 cursor-pointer group">
                                    <div className="relative flex items-center">
                                        <input
                                            type="radio"
                                            name="mode"
                                            value="NORMAL"
                                            checked={formData.mode === 'NORMAL'}
                                            onChange={handleInputChange}
                                            className="w-5 h-5 text-blue-600 border-gray-300 focus:ring-blue-500"
                                        />
                                    </div>
                                    <div>
                                        <span className="font-bold text-gray-900 group-hover:text-blue-600 transition-colors">Normal</span>
                                        <p className="text-xs text-gray-500">Available to students anytime</p>
                                    </div>
                                </label>
                                <label className="flex items-center gap-3 cursor-pointer group">
                                    <div className="relative flex items-center">
                                        <input
                                            type="radio"
                                            name="mode"
                                            value="LIVE"
                                            checked={formData.mode === 'LIVE'}
                                            onChange={handleInputChange}
                                            className="w-5 h-5 text-blue-600 border-gray-300 focus:ring-blue-500"
                                        />
                                    </div>
                                    <div>
                                        <span className="font-bold text-gray-900 group-hover:text-blue-600 transition-colors">Live</span>
                                        <p className="text-xs text-gray-500">Scheduled for a specific window</p>
                                    </div>
                                </label>
                            </div>

                            {formData.mode === 'LIVE' && (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in slide-in-from-top-2 duration-300">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Start Time *</label>
                                        <input
                                            type="datetime-local"
                                            name="start_time"
                                            value={formData.start_time}
                                            onChange={handleInputChange}
                                            required={formData.mode === 'LIVE'}
                                            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">End Time *</label>
                                        <input
                                            type="datetime-local"
                                            name="end_time"
                                            value={formData.end_time}
                                            onChange={handleInputChange}
                                            required={formData.mode === 'LIVE'}
                                            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                                        />
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-6">
                        <div className="flex justify-between items-center border-b pb-3">
                            <h2 className="text-xl font-bold text-gray-900">Questions Management</h2>
                            <div className="flex gap-3">
                                <button
                                    type="button"
                                    onClick={handleCheckQuestions}
                                    className="px-4 py-2 bg-yellow-50 border border-yellow-200 text-yellow-700 rounded-lg hover:bg-yellow-100 transition-colors text-sm font-bold flex items-center gap-2"
                                >
                                    <Check size={16} />
                                    Check JSON
                                </button>
                                <button
                                    type="button"
                                    onClick={parseQuestions}
                                    disabled={!isValidated}
                                    className={`px-4 py-2 rounded-lg transition-all text-sm font-bold flex items-center gap-2 ${isValidated ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-lg shadow-blue-200' : 'bg-gray-100 text-gray-400 cursor-not-allowed'}`}
                                >
                                    <Save size={16} />
                                    Parse Questions
                                </button>
                                <button
                                    type="button"
                                    onClick={handleDownloadAllImages}
                                    disabled={questions.length === 0 || downloadingImages}
                                    className="px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-600 text-white rounded-lg hover:from-amber-600 hover:to-orange-700 transition-all font-bold flex items-center gap-2 text-sm disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                                >
                                    {downloadingImages ? (
                                        <>
                                            <Loader2 size={16} className="animate-spin" />
                                            {imageProgress.current}/{imageProgress.total}
                                        </>
                                    ) : (
                                        <>
                                            <Download size={16} />
                                            Download Images
                                        </>
                                    )}
                                </button>

                                <button
                                    type="button"
                                    onClick={() => setShowImageQuestions(!showImageQuestions)}
                                    className="px-4 py-2 bg-green-50 border border-green-200 text-green-700 rounded-lg hover:bg-green-100 transition-colors text-sm font-bold flex items-center gap-2"
                                >
                                    <Image size={16} />
                                    {showImageQuestions ? 'Hide' : 'Show'} Questions with Images
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setShowNoExplanationQuestions(!showNoExplanationQuestions)}
                                    className="px-4 py-2 bg-purple-50 border border-purple-200 text-purple-700 rounded-lg hover:bg-purple-100 transition-colors text-sm font-bold flex items-center gap-2"
                                >
                                    <FileText size={16} />
                                    {showNoExplanationQuestions ? 'Hide' : 'Show'} Questions without Explanations
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setShowFailedImageQuestions(!showFailedImageQuestions)}
                                    disabled={failedDownloads.length === 0}
                                    className="px-4 py-2 bg-red-50 border border-red-200 text-red-700 rounded-lg hover:bg-red-100 transition-colors text-sm font-bold flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <AlertTriangle size={16} />
                                    {showFailedImageQuestions ? 'Hide' : 'Show'} Failed Image Downloads
                                </button>
                            </div>
                        </div>
                        <div className="flex flex-wrap gap-4 text-sm text-gray-600 mt-4">
                            <span>Total Questions: <strong className="text-gray-900">{totalQuestions}</strong></span>
                            <span>Total Marks: <strong className="text-gray-900">{totalMarks}</strong></span>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Import JSON Data</label>
                            <textarea
                                className="w-full h-[500px] p-4 border border-gray-300 rounded-xl font-mono text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none bg-gray-50"
                                value={jsonInput}
                                onChange={(e) => { setJsonInput(e.target.value); setIsValidated(false); }}
                                placeholder={`[
  {
    "questionId": "CEE_BOT_00123",
    "questionNo": 1,
    "questionText": "Question text here...",
    "options": ["Option 1", "Option 2", "Option 3", "Option 4"],
    "correctOption": 0,
    "marks": 1,
    "unitId": "UNIT_1",
    "chapterId": "CH_1",
    "explanation": "Explanation here..."
  }
]`}
                            />
                        </div>

                        {(parseSuccess || parseError) && (
                            <div className={`p-4 rounded-lg flex items-start gap-3 border ${parseSuccess ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-700'}`}>
                                {parseSuccess ? <Check size={20} className="shrink-0" /> : <AlertTriangle size={20} className="shrink-0" />}
                                <p className="text-sm font-medium">{parseSuccess || parseError}</p>
                            </div>
                        )}

                        {downloadResults && (
                            <div className="p-4 bg-green-50 rounded-lg flex justify-between items-center border border-green-200">
                                <span className="text-sm font-medium text-green-800">
                                    <Check className="inline w-4 h-4 mr-1 text-green-600 mb-0.5" />
                                    {downloadResults.downloaded} downloaded, {downloadResults.skipped} skipped, {downloadResults.failed} failed
                                </span>
                            </div>
                        )}

                        {failedDownloads.length > 0 && (
                            <div className="p-4 bg-red-50 rounded-lg border border-red-200">
                                <h4 className="text-sm font-bold text-red-800 mb-2">Failed Downloads ({failedDownloads.length})</h4>
                                <div className="space-y-2 max-h-48 overflow-y-auto">
                                    {failedDownloads.map((fail, idx) => (
                                        <div key={idx} className="text-xs text-red-700 bg-white p-2 rounded border">
                                            <div className="font-semibold text-red-800 mb-1">{fail.questionText}</div>
                                            <div><strong>Field:</strong> {fail.field}</div>
                                            <div className="break-all"><strong>URL:</strong> {fail.url}</div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {showImageQuestions && (
                            <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                                <h3 className="font-bold text-green-900 mb-4">Questions with Images ({questions.filter(q => q.imageLink).length})</h3>
                                <div className="space-y-4 max-h-96 overflow-y-auto">
                                    {questions.filter(q => q.imageLink).map(q => (
                                        <div key={q.id} className="bg-white p-4 rounded border">
                                            <p className="font-semibold mb-2">{q.questionText}</p>
                                            <img src={q.imageLink || undefined} alt="" className="max-w-full h-auto rounded" />
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {showFailedImageQuestions && (
                            <div className="bg-red-50 p-4 rounded-lg border border-red-200">
                                <h3 className="font-bold text-red-900 mb-4">Questions with Failed Image Downloads ({failedDownloads.length})</h3>
                                <div className="space-y-4 max-h-96 overflow-y-auto">
                                    {failedDownloads.map((fail, idx) => {
                                        const question = questions.find(q => q.id === fail.questionId || q.questionId === fail.questionId);
                                        return (
                                            <div key={idx} className="bg-white p-4 rounded border">
                                                <p className="font-semibold text-red-800 mb-2">{fail.questionText}</p>
                                                <div className="text-xs text-gray-600 mb-2"><strong>Field:</strong> {fail.field}</div>
                                                <div className="text-xs text-gray-600 break-all mb-3"><strong>URL:</strong> {fail.url}</div>
                                                {question && (
                                                    <button
                                                        type="button"
                                                        onClick={() => handleEditQuestion(question)}
                                                        className="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700 transition-colors text-xs font-semibold"
                                                    >
                                                        Edit Question
                                                    </button>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {showNoExplanationQuestions && (
                            <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
                                <h3 className="font-bold text-purple-900 mb-4">Questions without Explanations ({questions.filter(q => !q.explanation || q.explanation.trim() === '').length})</h3>
                                <div className="space-y-4 max-h-96 overflow-y-auto">
                                    {questions.filter(q => !q.explanation || q.explanation.trim() === '').map(q => (
                                        <div key={q.id} className="bg-white p-4 rounded border flex justify-between items-start">
                                            <p className="font-semibold flex-1 pr-4">{q.questionText}</p>
                                            <button onClick={() => handleEditQuestion(q)} className="px-3 py-1 bg-purple-600 text-white rounded hover:bg-purple-700 transition-colors">Add Explanation</button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {questions.length > 0 && (
                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <h3 className="font-bold text-gray-900">{questions.length} Questions Loaded</h3>
                                    <button
                                        type="button"
                                        onClick={() => { if (confirm('Clear all questions?')) setQuestions([]); }}
                                        className="text-red-600 hover:text-red-700 text-sm font-bold flex items-center gap-1"
                                    >
                                        <Trash2 size={14} />
                                        Clear All
                                    </button>
                                </div>
                                <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                                    {questions.map((question) => (
                                        <div key={question.id} className="bg-white border border-gray-200 rounded-xl p-5 hover:border-blue-300 transition-colors shadow-sm">
                                            {editingQuestionId === question.id && editedQuestionData ? (
                                                <div className="space-y-4">
                                                    <div className="grid grid-cols-2 gap-4">
                                                        <div>
                                                            <label className="block text-xs font-black text-gray-500 uppercase tracking-widest mb-1">Question ID</label>
                                                            <input
                                                                type="text"
                                                                name="questionId"
                                                                value={editedQuestionData.questionId}
                                                                onChange={handleQuestionChange}
                                                                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-gray-50"
                                                            />
                                                        </div>
                                                        <div>
                                                            <label className="block text-xs font-black text-gray-500 uppercase tracking-widest mb-1">Question No</label>
                                                            <input
                                                                type="text"
                                                                name="questionNo"
                                                                value={editedQuestionData.questionNo}
                                                                onChange={handleQuestionChange}
                                                                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-gray-50"
                                                            />
                                                        </div>
                                                    </div>

                                                    <div>
                                                        <label className="block text-xs font-black text-gray-500 uppercase tracking-widest mb-1 text-blue-600">Question Text (LaTeX Support)</label>
                                                        <textarea
                                                            name="questionText"
                                                            value={editedQuestionData.questionText}
                                                            onChange={handleQuestionChange}
                                                            rows={3}
                                                            className="w-full px-3 py-2 border border-blue-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                                                        />
                                                    </div>

                                                    <div className="grid grid-cols-2 gap-4">
                                                        <div>
                                                            <label className="block text-xs font-black text-gray-500 uppercase tracking-widest mb-1">Unit ID</label>
                                                            <input
                                                                type="text"
                                                                name="unitId"
                                                                value={editedQuestionData.unitId || ''}
                                                                onChange={handleQuestionChange}
                                                                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                                                            />
                                                        </div>
                                                        <div>
                                                            <label className="block text-xs font-black text-gray-500 uppercase tracking-widest mb-1">Chapter ID</label>
                                                            <input
                                                                type="text"
                                                                name="chapterId"
                                                                value={editedQuestionData.chapterId || ''}
                                                                onChange={handleQuestionChange}
                                                                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                                                            />
                                                        </div>
                                                    </div>

                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                        <div className="space-y-3">
                                                            <label className="block text-xs font-black text-gray-500 uppercase tracking-widest mb-1">Options</label>
                                                            {editedQuestionData.options.map((opt, i) => (
                                                                <div key={i} className="flex gap-2">
                                                                    <div className={`w-10 h-10 flex items-center justify-center rounded-lg font-bold shrink-0 ${editedQuestionData.correctOption === i ? 'bg-green-100 text-green-700 border-green-200' : 'bg-gray-100 text-gray-500 border-gray-200'}`}>
                                                                        {String.fromCharCode(65 + i)}
                                                                    </div>
                                                                    <input
                                                                        type="text"
                                                                        name={`option-${i}`}
                                                                        value={opt}
                                                                        onChange={handleQuestionChange}
                                                                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                                                                        placeholder={`Option ${i + 1}`}
                                                                    />
                                                                </div>
                                                            ))}
                                                        </div>

                                                        <div className="space-y-4">
                                                            <div>
                                                                <label className="block text-xs font-black text-gray-500 uppercase tracking-widest mb-1">Correct Identity</label>
                                                                <select
                                                                    name="correctOption"
                                                                    value={editedQuestionData.correctOption}
                                                                    onChange={handleQuestionChange}
                                                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
                                                                >
                                                                    {editedQuestionData.options.map((_, i) => (
                                                                        <option key={i} value={i}>Option {String.fromCharCode(65 + i)} is correct</option>
                                                                    ))}
                                                                </select>
                                                            </div>

                                                            <div>
                                                                <label className="block text-xs font-black text-gray-500 uppercase tracking-widest mb-1">Marks per Question</label>
                                                                <input
                                                                    type="number"
                                                                    name="marks"
                                                                    value={editedQuestionData.marks}
                                                                    onChange={handleQuestionChange}
                                                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                                                                />
                                                            </div>

                                                            <div>
                                                                <label className="block text-xs font-black text-gray-500 uppercase tracking-widest mb-1">Question Image</label>
                                                                <div className="flex items-center gap-3">
                                                                    <label className="cursor-pointer bg-blue-50 text-blue-600 px-4 py-2 rounded-lg text-xs font-bold hover:bg-blue-100 transition-colors flex items-center gap-2 border border-blue-200">
                                                                        <Upload size={14} />
                                                                        {uploadingImage ? 'Uploading...' : 'Upload Image'}
                                                                        <input type="file" accept="image/*" onChange={handleImageSelect} className="hidden" />
                                                                    </label>
                                                                    {editedQuestionData.imageLink && (
                                                                        <button type="button" onClick={() => setEditedQuestionData({ ...editedQuestionData, imageLink: null })} className="text-red-500 hover:text-red-600 text-[10px] font-bold">Remove</button>
                                                                    )}
                                                                </div>
                                                                {editedQuestionData.imageLink && (
                                                                    <img src={editedQuestionData.imageLink} alt="" className="mt-2 max-h-24 rounded-lg shadow-sm border p-1 bg-white" />
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <div className="bg-purple-50 p-4 rounded-xl border border-purple-100">
                                                        <label className="block text-xs font-black text-purple-700 uppercase tracking-widest mb-2 flex items-center gap-2">
                                                            <Sparkles size={14} />
                                                            Explanation & AI Generator
                                                        </label>
                                                        <textarea
                                                            name="explanation"
                                                            value={editedQuestionData.explanation || ''}
                                                            onChange={handleQuestionChange}
                                                            rows={3}
                                                            className="w-full px-3 py-2 border border-purple-200 rounded-lg text-sm mb-3 focus:ring-2 focus:ring-purple-500 outline-none"
                                                            placeholder="Why is this answer correct? Use AI to generate if needed..."
                                                        />
                                                        <div className="flex gap-3">
                                                            <select
                                                                value={selectedModel}
                                                                onChange={(e) => setSelectedModel(e.target.value)}
                                                                className="flex-1 px-3 py-2 border border-purple-200 rounded-lg text-xs bg-white"
                                                            >
                                                                {AI_MODELS.map(model => (
                                                                    <option key={model.id} value={model.id}>{model.name}</option>
                                                                ))}
                                                            </select>
                                                            <button
                                                                type="button"
                                                                onClick={generateExplanationWithAI}
                                                                disabled={generatingAI}
                                                                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 flex items-center gap-2 text-xs font-bold transition-all shadow-lg shadow-purple-200"
                                                            >
                                                                <Sparkles size={14} />
                                                                {generatingAI ? 'Generating...' : 'AI Generate'}
                                                            </button>
                                                        </div>
                                                    </div>

                                                    <div className="flex justify-end gap-3 pt-4 border-t">
                                                        <button type="button" onClick={() => { setEditingQuestionId(null); setEditedQuestionData(null); }} className="px-6 py-2 text-gray-500 hover:text-gray-700 text-sm font-bold transition-colors">Cancel</button>
                                                        <button type="button" onClick={handleSaveQuestion} className="px-8 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-bold shadow-lg shadow-green-100 transition-all">Save Changes</button>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="group/item">
                                                    <div className="flex justify-between items-start mb-4">
                                                        <div className="flex items-center gap-3">
                                                            <span className="w-10 h-10 flex items-center justify-center bg-gray-900 text-white rounded-lg font-black text-sm">#{question.questionNo}</span>
                                                            <div className="text-[10px] font-black uppercase tracking-widest text-gray-400">
                                                                ID: {question.questionId} • {question.marks} {question.marks === 1 ? 'mark' : 'marks'}
                                                            </div>
                                                        </div>
                                                        <button
                                                            type="button"
                                                            onClick={() => handleEditQuestion(question)}
                                                            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors flex items-center gap-2 text-xs font-bold"
                                                        >
                                                            <Edit2 size={14} />
                                                            Quick Edit
                                                        </button>
                                                    </div>
                                                    <div className="text-lg font-bold text-gray-900 mb-6 leading-relaxed bg-gray-50 p-4 rounded-xl border border-gray-100 italic">
                                                        <LatexRenderer>{question.questionText}</LatexRenderer>
                                                    </div>
                                                    {question.imageLink && (
                                                        <div className="mb-6 rounded-xl overflow-hidden shadow-md max-w-sm border-4 border-white ring-1 ring-gray-100">
                                                            <img src={question.imageLink} alt="" className="w-full" />
                                                        </div>
                                                    )}
                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                        {question.options.map((opt, i) => (
                                                            <div key={i} className={`flex items-center gap-4 p-4 rounded-xl border transition-all ${i === question.correctOption ? 'bg-green-50 border-green-200' : 'bg-white border-gray-100'}`}>
                                                                <div className={`w-9 h-9 flex items-center justify-center rounded-lg font-black text-sm ${i === question.correctOption ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-500'}`}>
                                                                    {String.fromCharCode(65 + i)}
                                                                </div>
                                                                <div className={`text-sm font-bold ${i === question.correctOption ? 'text-green-800' : 'text-gray-700'}`}>
                                                                    <LatexRenderer>{opt}</LatexRenderer>
                                                                </div>
                                                                {i === question.correctOption && <Check className="ml-auto text-green-600" size={18} />}
                                                            </div>
                                                        ))}
                                                    </div>
                                                    {question.explanation && (
                                                        <div className="mt-6 p-4 bg-yellow-50 rounded-xl border border-yellow-100">
                                                            <span className="text-[9px] font-black text-yellow-700 uppercase tracking-[.2em] mb-2 block">Correct Reasoning</span>
                                                            <div className="text-sm text-yellow-950 italic font-medium leading-relaxed">
                                                                <LatexRenderer>{question.explanation}</LatexRenderer>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="fixed bottom-0 left-64 right-0 bg-white/95 backdrop-blur-md p-4 border-t border-gray-200 shadow-2xl shadow-blue-900/10 flex justify-end gap-4 z-40">
                        <button
                            type="button"
                            onClick={() => navigate('/test-series')}
                            className="px-8 py-3.5 text-gray-600 hover:bg-gray-100 rounded-xl font-bold transition-all"
                        >
                            Discard Changes
                        </button>
                        <button
                            type="submit"
                            disabled={loading || formData.collection_id === 0 || questions.length === 0}
                            className="px-12 py-3.5 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-xl shadow-blue-500/20 active:scale-95 flex items-center gap-3"
                        >
                            {loading ? (
                                <><div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div> Saving...</>
                            ) : (
                                <><Save size={20} /> {isEditing ? 'Update Test Series' : 'Publish Test Series'}</>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </DashboardLayout>
    );
}
