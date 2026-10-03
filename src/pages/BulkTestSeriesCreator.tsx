import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { ChevronLeft, Upload, Download, Zap, Trash2, ChevronDown, ChevronUp, AlertTriangle, CheckCircle2, ImageIcon, FileText, Loader2, X } from 'lucide-react';
import { DashboardLayout } from '../components/DashboardLayout';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

const API_URL = 'https://notelibraryapp.com/api/admin/testSeries.php';
const COLLECTION_API_URL = 'https://notelibraryapp.com/api/admin/testSeriesCollection.php';
const DOWNLOAD_IMAGE_API_URL = 'https://notelibraryapp.com/api/admin/download_remote_image.php';

interface TestSeriesCollection {
    id: number;
    title: string;
    competitive_exam: 'IOE' | 'CEE' | 'OTHER';
}

interface QuizQuestion {
    questionId: string;
    questionNo: number;
    questionText: string;
    imageLink: string | null;
    options: string[];
    correctOption: number;
    marks: number;
    unitId: string | null;
    chapterId: string | null;
    explanation: string | null;
}

interface ParsedSet {
    id: string;
    filename: string;
    title: string;
    questions: QuizQuestion[];
    missingExplanations: number[];
    imageUrls: { field: string; url: string; questionNo: number }[];
    validationError: string | null;
    status: 'ready' | 'creating' | 'created' | 'error';
    errorMessage?: string;
    expanded: boolean;
}

// ─── Utility: extract ALL image URLs from any string field ───
function extractImageUrls(text: string): string[] {
    if (!text) return [];
    const urls: string[] = [];
    // Match <img src="URL" or <img src='URL'
    const imgRegex = /<img[^>]+src=["']([^"']+)["'][^>]*\/?>/gi;
    let match;
    while ((match = imgRegex.exec(text)) !== null) {
        if (match[1] && /^https?:\/\//i.test(match[1])) {
            urls.push(match[1]);
        }
    }
    return urls;
}

// ─── Utility: scan a question for all image URLs ───
function scanQuestionForImages(q: QuizQuestion): { field: string; url: string; questionNo: number }[] {
    const results: { field: string; url: string; questionNo: number }[] = [];
    
    // imageLink field
    if (q.imageLink && /^https?:\/\//i.test(q.imageLink)) {
        results.push({ field: 'imageLink', url: q.imageLink, questionNo: q.questionNo });
    }
    
    // questionText
    extractImageUrls(q.questionText).forEach(url => {
        results.push({ field: 'questionText', url, questionNo: q.questionNo });
    });

    // options
    q.options.forEach((opt, idx) => {
        extractImageUrls(opt).forEach(url => {
            results.push({ field: `option_${idx}`, url, questionNo: q.questionNo });
        });
    });

    // explanation
    if (q.explanation) {
        extractImageUrls(q.explanation).forEach(url => {
            results.push({ field: 'explanation', url, questionNo: q.questionNo });
        });
    }
    return results;
}

// ─── Utility: validate & normalize a single question ───
function normalizeQuestion(q: any, index: number, forceNullUnit: boolean, forceNullChapter: boolean): { question: QuizQuestion | null; error: string | null } {
    const qNum = q.questionNo ?? (index + 1);
    const questionText = q.questionText || q.question;

    if (!questionText || typeof questionText !== 'string') {
        return { question: null, error: `Q${qNum}: Missing 'questionText'` };
    }
    if (!Array.isArray(q.options) || q.options.length < 2) {
        return { question: null, error: `Q${qNum}: Need at least 2 options` };
    }
    if (typeof q.correctOption !== 'number' || q.correctOption < 0 || q.correctOption >= q.options.length) {
        return { question: null, error: `Q${qNum}: Invalid 'correctOption'` };
    }

    let imageLink: string | null = null;
    if (q.imageLink && typeof q.imageLink === 'string' && /^https?:\/\//i.test(q.imageLink)) {
        imageLink = q.imageLink;
    }

    return {
        question: {
            questionId: q.questionId || `QID_${Date.now()}_${index}`,
            questionNo: typeof qNum === 'number' ? qNum : index + 1,
            questionText,
            imageLink,
            options: q.options.map((o: any) => String(o)),
            correctOption: q.correctOption,
            marks: typeof q.marks === 'number' ? q.marks : 1,
            unitId: forceNullUnit ? null : (typeof q.unitId === 'string' ? q.unitId : null),
            chapterId: forceNullChapter ? null : (typeof q.chapterId === 'string' ? q.chapterId : null),
            explanation: (typeof q.explanation === 'string' && q.explanation.trim() !== '') ? q.explanation : null,
        },
        error: null
    };
}

// ─── Utility: derive title from filename ───
function titleFromFilename(name: string): string {
    return name
        .replace(/\.json$/i, '')
        .replace(/[_-]/g, ' ')
        .replace(/\b\w/g, c => c.toUpperCase());
}

// ═════════════════════ COMPONENT ═════════════════════
export default function BulkTestSeriesCreator() {
    const { token } = useAuth();
    const navigate = useNavigate();
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Collections
    const [collections, setCollections] = useState<TestSeriesCollection[]>([]);
    const [fetchingCollections, setFetchingCollections] = useState(true);

    // Global config
    const [collectionId, setCollectionId] = useState<number>(0);
    const [timeLimit, setTimeLimit] = useState(120);
    const [negativeMarking, setNegativeMarking] = useState(0.1);
    const [mode, setMode] = useState<'LIVE' | 'NORMAL'>('NORMAL');
    const [forceNullUnit, setForceNullUnit] = useState(true);
    const [forceNullChapter, setForceNullChapter] = useState(true);

    // Sets
    const [sets, setSets] = useState<ParsedSet[]>([]);
    const [dragOver, setDragOver] = useState(false);

    // Image download progress
    const [downloadingImages, setDownloadingImages] = useState(false);
    const [imageProgress, setImageProgress] = useState({ current: 0, total: 0 });
    const [downloadResults, setDownloadResults] = useState<{ downloaded: number; skipped: number; failed: number } | null>(null);

    // Creating progress
    const [bulkCreating, setBulkCreating] = useState(false);
    const [createProgress, setCreateProgress] = useState({ current: 0, total: 0 });

    // ─── Fetch collections ───
    useEffect(() => {
        fetchCollections();
    }, []);

    const fetchCollections = async () => {
        setFetchingCollections(true);
        try {
            const resp = await axios.get(COLLECTION_API_URL, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (resp.data.success) setCollections(resp.data.data);
        } catch {
            toast.error('Failed to fetch collections');
        } finally {
            setFetchingCollections(false);
        }
    };

    // ─── Auto-fill settings based on collection type ───
    useEffect(() => {
        const col = collections.find(c => c.id === collectionId);
        if (col) {
            if (col.competitive_exam === 'IOE') {
                setTimeLimit(120);
                setNegativeMarking(0.10);
            } else if (col.competitive_exam === 'CEE') {
                setTimeLimit(180);
                setNegativeMarking(0.25);
            }
        }
    }, [collectionId, collections]);

    // ─── Parse files ───
    const handleFiles = useCallback(async (files: FileList) => {
        const jsonFiles = Array.from(files).filter(f => f.name.toLowerCase().endsWith('.json'));
        if (jsonFiles.length === 0) {
            toast.error('No .json files found');
            return;
        }

        const newSets: ParsedSet[] = [];

        for (const file of jsonFiles) {
            try {
                const text = await file.text();
                let parsed = JSON.parse(text);
                if (!Array.isArray(parsed)) {
                    if (parsed.questions && Array.isArray(parsed.questions)) parsed = parsed.questions;
                    else parsed = [parsed];
                }

                const questions: QuizQuestion[] = [];
                let validationError: string | null = null;

                for (let i = 0; i < parsed.length; i++) {
                    const { question, error } = normalizeQuestion(parsed[i], i, forceNullUnit, forceNullChapter);
                    if (error) { validationError = error; break; }
                    if (question) questions.push(question);
                }

                // Find missing explanations
                const missingExpl = questions
                    .filter(q => !q.explanation)
                    .map(q => q.questionNo);

                // Scan for all images
                const images = questions.flatMap(q => scanQuestionForImages(q));

                newSets.push({
                    id: `set_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
                    filename: file.name,
                    title: titleFromFilename(file.name),
                    questions,
                    missingExplanations: missingExpl,
                    imageUrls: images,
                    validationError,
                    status: validationError ? 'error' : 'ready',
                    errorMessage: validationError || undefined,
                    expanded: false
                });
            } catch (err: any) {
                newSets.push({
                    id: `set_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
                    filename: file.name,
                    title: titleFromFilename(file.name),
                    questions: [],
                    missingExplanations: [],
                    imageUrls: [],
                    validationError: `Parse error: ${err.message}`,
                    status: 'error',
                    errorMessage: `Parse error: ${err.message}`,
                    expanded: false
                });
            }
        }

        setSets(prev => [...prev, ...newSets]);
        toast.success(`Loaded ${jsonFiles.length} file(s)`);
    }, [forceNullUnit, forceNullChapter]);

    // ─── Drag & Drop ───
    const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setDragOver(true); };
    const handleDragLeave = () => setDragOver(false);
    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setDragOver(false);
        if (e.dataTransfer.files.length) handleFiles(e.dataTransfer.files);
    };
    const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files?.length) handleFiles(e.target.files);
        e.target.value = '';
    };

    // ─── Remove set ───
    const removeSet = (id: string) => setSets(prev => prev.filter(s => s.id !== id));

    // ─── Toggle expand ───
    const toggleExpand = (id: string) => setSets(prev => prev.map(s => s.id === id ? { ...s, expanded: !s.expanded } : s));

    // ─── Update title ───
    const updateTitle = (id: string, title: string) => setSets(prev => prev.map(s => s.id === id ? { ...s, title } : s));

    // ─── Re-parse all sets with current null settings ───
    const reparseAllSets = useCallback(() => {
        setSets(prev => prev.map(set => {
            const updated = set.questions.map(q => ({
                ...q,
                unitId: forceNullUnit ? null : q.unitId,
                chapterId: forceNullChapter ? null : q.chapterId,
            }));
            return { ...set, questions: updated };
        }));
    }, [forceNullUnit, forceNullChapter]);

    useEffect(() => {
        if (sets.length > 0) reparseAllSets();
    }, [forceNullUnit, forceNullChapter]);

    // ─── Download all images across all sets ───
    const handleDownloadAllImages = async () => {
        // Collect all unique URLs across all sets
        const allImageEntries: { setIdx: number; entryIdx: number; field: string; url: string; questionNo: number }[] = [];
        sets.forEach((set, setIdx) => {
            set.imageUrls.forEach((entry, entryIdx) => {
                allImageEntries.push({ setIdx, entryIdx, ...entry });
            });
        });

        if (allImageEntries.length === 0) {
            toast('No images found to download', { icon: '📭' });
            return;
        }

        setDownloadingImages(true);
        setImageProgress({ current: 0, total: allImageEntries.length });
        setDownloadResults(null);

        let downloaded = 0, skipped = 0, failed = 0;
        const urlMap = new Map<string, string>(); // oldUrl -> newUrl

        for (let i = 0; i < allImageEntries.length; i++) {
            const entry = allImageEntries[i];
            setImageProgress({ current: i + 1, total: allImageEntries.length });

            // Skip if already downloaded this URL
            if (urlMap.has(entry.url)) {
                skipped++;
                continue;
            }

            try {
                // Build traceable filename
                const set = sets[entry.setIdx];
                const setIdentifier = set.filename.replace(/\.json$/i, '').replace(/[^a-zA-Z0-9]/g, '_');
                const ext = entry.url.split('.').pop()?.split('?')[0]?.toLowerCase() || 'png';
                const validExt = ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext) ? ext : 'png';
                const customName = `${collectionId}_${setIdentifier}_q${entry.questionNo}_${entry.field.replace(/[^a-zA-Z0-9]/g, '')}_${i}.${validExt}`;

                const resp = await axios.post(DOWNLOAD_IMAGE_API_URL, {
                    url: entry.url,
                    customFileName: customName
                }, {
                    headers: { Authorization: `Bearer ${token}` }
                });

                if (resp.data.success) {
                    urlMap.set(entry.url, resp.data.url);
                    if (resp.data.skipped) skipped++;
                    else downloaded++;
                } else {
                    failed++;
                }
            } catch (err) {
                failed++;
            }
        }

        // Now rewrite URLs in all sets
        if (urlMap.size > 0) {
            setSets(prev => prev.map(set => {
                const updatedQuestions = set.questions.map(q => {
                    let updated = { ...q };
                    // Replace imageLink
                    if (updated.imageLink && urlMap.has(updated.imageLink)) {
                        updated.imageLink = urlMap.get(updated.imageLink)!;
                    }
                    // Replace in all text fields
                    urlMap.forEach((newUrl, oldUrl) => {
                        const escaped = oldUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                        const re = new RegExp(escaped, 'g');
                        updated.questionText = updated.questionText.replace(re, newUrl);
                        updated.options = updated.options.map(opt => opt.replace(re, newUrl));
                        if (updated.explanation) {
                            updated.explanation = updated.explanation.replace(re, newUrl);
                        }
                    });
                    return updated;
                });

                // Re-scan for remaining images
                const newImages = updatedQuestions.flatMap(q => scanQuestionForImages(q));
                const downloadedImages = newImages.filter(img => img.url.includes('notelibraryapp.com'));
                const remainingImages = newImages.filter(img => !img.url.includes('notelibraryapp.com'));

                return { ...set, questions: updatedQuestions, imageUrls: remainingImages };
            }));
        }

        setDownloadResults({ downloaded, skipped, failed });
        setDownloadingImages(false);
        toast.success(`Done! ${downloaded} downloaded, ${skipped} skipped, ${failed} failed`);
    };

    // ─── Create all sets ───
    const handleCreateAll = async () => {
        if (!collectionId) { toast.error('Select a collection first'); return; }

        const readySets = sets.filter(s => s.status === 'ready' && s.questions.length > 0);
        if (readySets.length === 0) { toast.error('No valid sets to create'); return; }

        setBulkCreating(true);
        setCreateProgress({ current: 0, total: readySets.length });

        for (let i = 0; i < readySets.length; i++) {
            const set = readySets[i];
            setCreateProgress({ current: i + 1, total: readySets.length });

            // Mark as creating
            setSets(prev => prev.map(s => s.id === set.id ? { ...s, status: 'creating' as const } : s));

            try {
                const payload = {
                    collection_id: collectionId,
                    quiz_title: set.title,
                    time_limit: timeLimit,
                    negative_marking: negativeMarking,
                    mode,
                    quiz_json: set.questions.map(q => ({
                        questionId: q.questionId,
                        questionNo: q.questionNo,
                        questionText: q.questionText,
                        imageLink: q.imageLink,
                        options: q.options,
                        correctOption: q.correctOption,
                        marks: q.marks,
                        unitId: q.unitId,
                        chapterId: q.chapterId,
                        explanation: q.explanation
                    }))
                };

                const resp = await axios.post(API_URL, payload, {
                    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
                });

                if (resp.data.success) {
                    setSets(prev => prev.map(s => s.id === set.id ? { ...s, status: 'created' as const } : s));
                } else {
                    setSets(prev => prev.map(s => s.id === set.id ? { ...s, status: 'error' as const, errorMessage: resp.data.message || 'API error' } : s));
                }
            } catch (err: any) {
                setSets(prev => prev.map(s => s.id === set.id ? { ...s, status: 'error' as const, errorMessage: err.message } : s));
            }
        }

        setBulkCreating(false);
        const created = sets.filter(s => s.status === 'created').length;
        toast.success(`Created ${readySets.length} test series!`);
    };

    // ─── Stats ───
    const totalQuestions = sets.reduce((acc, s) => acc + s.questions.length, 0);
    const totalImages = sets.reduce((acc, s) => acc + s.imageUrls.length, 0);
    const totalMissingExpl = sets.reduce((acc, s) => acc + s.missingExplanations.length, 0);
    const readyCount = sets.filter(s => s.status === 'ready').length;
    const createdCount = sets.filter(s => s.status === 'created').length;
    const errorCount = sets.filter(s => s.status === 'error').length;

    return (
        <DashboardLayout>
            <div style={{ maxWidth: 1200, margin: '0 auto' }}>
                {/* Header */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 32 }}>
                    <button onClick={() => navigate('/test-series')} style={{
                        width: 40, height: 40, borderRadius: 10, border: '1px solid #e2e8f0',
                        background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer'
                    }}>
                        <ChevronLeft size={20} />
                    </button>
                    <div>
                        <h1 style={{ fontSize: 28, fontWeight: 800, color: '#0f172a', margin: 0 }}>Bulk Test Series Creator</h1>
                        <p style={{ color: '#64748b', margin: 0, fontSize: 14 }}>Upload multiple JSON files → create multiple test series at once</p>
                    </div>
                </div>

                {/* Global Config Card */}
                <div style={{
                    background: '#fff', borderRadius: 16, padding: 28, marginBottom: 24,
                    border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.06)'
                }}>
                    <h2 style={{ fontSize: 18, fontWeight: 700, color: '#0f172a', marginBottom: 20, margin: 0, paddingBottom: 16 }}>⚙️ Global Configuration</h2>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 20 }}>
                        {/* Collection */}
                        <div>
                            <label style={labelStyle}>Collection *</label>
                            <select value={collectionId} onChange={e => setCollectionId(Number(e.target.value))} style={inputStyle}>
                                <option value={0}>Select collection...</option>
                                {collections.map(c => (
                                    <option key={c.id} value={c.id}>{c.title} ({c.competitive_exam})</option>
                                ))}
                            </select>
                        </div>

                        {/* Time Limit */}
                        <div>
                            <label style={labelStyle}>Time Limit (min)</label>
                            <input type="number" value={timeLimit} onChange={e => setTimeLimit(Number(e.target.value))} style={inputStyle} />
                        </div>

                        {/* Negative Marking */}
                        <div>
                            <label style={labelStyle}>Negative Marking</label>
                            <input type="number" step="0.01" value={negativeMarking} onChange={e => setNegativeMarking(Number(e.target.value))} style={inputStyle} />
                        </div>

                        {/* Mode */}
                        <div>
                            <label style={labelStyle}>Mode</label>
                            <select value={mode} onChange={e => setMode(e.target.value as 'LIVE' | 'NORMAL')} style={inputStyle}>
                                <option value="NORMAL">NORMAL</option>
                                <option value="LIVE">LIVE</option>
                            </select>
                        </div>
                    </div>

                    {/* Null overrides */}
                    <div style={{ display: 'flex', gap: 24, marginTop: 20, flexWrap: 'wrap' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 14, color: '#374151' }}>
                            <input type="checkbox" checked={forceNullUnit} onChange={e => setForceNullUnit(e.target.checked)}
                                style={{ width: 18, height: 18, accentColor: '#6366f1' }} />
                            Force <code style={{ background: '#f1f5f9', padding: '2px 6px', borderRadius: 4, fontSize: 12 }}>unitId → null</code>
                        </label>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 14, color: '#374151' }}>
                            <input type="checkbox" checked={forceNullChapter} onChange={e => setForceNullChapter(e.target.checked)}
                                style={{ width: 18, height: 18, accentColor: '#6366f1' }} />
                            Force <code style={{ background: '#f1f5f9', padding: '2px 6px', borderRadius: 4, fontSize: 12 }}>chapterId → null</code>
                        </label>
                    </div>
                </div>

                {/* Upload Zone */}
                <div
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                    style={{
                        background: dragOver ? '#eef2ff' : '#f8fafc',
                        borderRadius: 16, padding: 48, marginBottom: 24,
                        border: `2px dashed ${dragOver ? '#6366f1' : '#cbd5e1'}`,
                        textAlign: 'center', cursor: 'pointer',
                        transition: 'all 0.2s'
                    }}
                >
                    <Upload size={40} style={{ color: dragOver ? '#6366f1' : '#94a3b8', marginBottom: 12 }} />
                    <p style={{ fontSize: 16, fontWeight: 600, color: '#334155', margin: '0 0 4px' }}>
                        Drop JSON files here or click to browse
                    </p>
                    <p style={{ fontSize: 13, color: '#94a3b8', margin: 0 }}>
                        Each .json file = one test series
                    </p>
                    <input ref={fileInputRef} type="file" multiple accept=".json" onChange={handleFileInput} style={{ display: 'none' }} />
                </div>

                {/* Stats Bar */}
                {sets.length > 0 && (
                    <div style={{
                        display: 'flex', gap: 16, marginBottom: 24, flexWrap: 'wrap'
                    }}>
                        <StatBadge icon="📦" label="Sets" value={sets.length} color="#6366f1" />
                        <StatBadge icon="❓" label="Total Questions" value={totalQuestions} color="#0ea5e9" />
                        <StatBadge icon="🖼️" label="Images Found" value={totalImages} color="#f59e0b" />
                        <StatBadge icon="⚠️" label="Missing Explanations" value={totalMissingExpl} color="#ef4444" />
                        <StatBadge icon="✅" label="Ready" value={readyCount} color="#22c55e" />
                        {createdCount > 0 && <StatBadge icon="🎉" label="Created" value={createdCount} color="#10b981" />}
                        {errorCount > 0 && <StatBadge icon="❌" label="Errors" value={errorCount} color="#ef4444" />}
                    </div>
                )}

                {/* Action Buttons */}
                {sets.length > 0 && (
                    <div style={{ display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
                        {/* Download Images */}
                        <button
                            onClick={handleDownloadAllImages}
                            disabled={downloadingImages || totalImages === 0}
                            style={{
                                ...actionBtnStyle,
                                background: totalImages > 0 ? 'linear-gradient(135deg, #f59e0b, #d97706)' : '#e2e8f0',
                                color: totalImages > 0 ? '#fff' : '#94a3b8'
                            }}
                        >
                            {downloadingImages ? (
                                <><Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} /> Downloading {imageProgress.current}/{imageProgress.total}...</>
                            ) : (
                                <><Download size={18} /> Download All Images ({totalImages})</>
                            )}
                        </button>

                        {/* Create All */}
                        <button
                            onClick={handleCreateAll}
                            disabled={bulkCreating || readyCount === 0 || !collectionId}
                            style={{
                                ...actionBtnStyle,
                                background: readyCount > 0 && collectionId ? 'linear-gradient(135deg, #6366f1, #4f46e5)' : '#e2e8f0',
                                color: readyCount > 0 && collectionId ? '#fff' : '#94a3b8'
                            }}
                        >
                            {bulkCreating ? (
                                <><Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} /> Creating {createProgress.current}/{createProgress.total}...</>
                            ) : (
                                <><Zap size={18} /> Create All Sets ({readyCount})</>
                            )}
                        </button>

                        {/* Clear All */}
                        <button onClick={() => setSets([])} style={{ ...actionBtnStyle, background: '#fee2e2', color: '#dc2626' }}>
                            <Trash2 size={18} /> Clear All
                        </button>
                    </div>
                )}

                {/* Download Results */}
                {downloadResults && (
                    <div style={{
                        background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 12, padding: 16, marginBottom: 24,
                        display: 'flex', gap: 20, alignItems: 'center', fontSize: 14
                    }}>
                        <CheckCircle2 size={20} style={{ color: '#16a34a' }} />
                        <span><strong>{downloadResults.downloaded}</strong> downloaded</span>
                        <span><strong>{downloadResults.skipped}</strong> skipped (cached)</span>
                        {downloadResults.failed > 0 && <span style={{ color: '#dc2626' }}><strong>{downloadResults.failed}</strong> failed</span>}
                    </div>
                )}

                {/* Sets Table */}
                {sets.map((set) => (
                    <div key={set.id} style={{
                        background: '#fff', borderRadius: 14, marginBottom: 12,
                        border: `1px solid ${set.status === 'error' ? '#fecaca' : set.status === 'created' ? '#bbf7d0' : '#e2e8f0'}`,
                        overflow: 'hidden', transition: 'all 0.2s',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
                    }}>
                        {/* Row Header */}
                        <div style={{
                            display: 'flex', alignItems: 'center', gap: 12, padding: '14px 20px',
                            cursor: 'pointer', background: set.status === 'created' ? '#f0fdf4' : set.status === 'error' ? '#fef2f2' : '#fff'
                        }}
                            onClick={() => toggleExpand(set.id)}
                        >
                            {/* Status Icon */}
                            <div style={{
                                width: 32, height: 32, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center',
                                background: set.status === 'created' ? '#dcfce7' : set.status === 'error' ? '#fee2e2' : set.status === 'creating' ? '#dbeafe' : '#f1f5f9',
                                flexShrink: 0
                            }}>
                                {set.status === 'creating' ? <Loader2 size={16} style={{ color: '#3b82f6', animation: 'spin 1s linear infinite' }} /> :
                                    set.status === 'created' ? <CheckCircle2 size={16} style={{ color: '#16a34a' }} /> :
                                        set.status === 'error' ? <AlertTriangle size={16} style={{ color: '#dc2626' }} /> :
                                            <FileText size={16} style={{ color: '#64748b' }} />}
                            </div>

                            {/* Title (editable) */}
                            <input
                                value={set.title}
                                onClick={e => e.stopPropagation()}
                                onChange={e => updateTitle(set.id, e.target.value)}
                                style={{
                                    flex: 1, border: '1px solid transparent', borderRadius: 6, padding: '4px 8px',
                                    fontSize: 15, fontWeight: 600, color: '#1e293b', background: 'transparent',
                                    outline: 'none', minWidth: 0, transition: 'border-color 0.2s'
                                }}
                                onFocus={e => { e.target.style.borderColor = '#6366f1'; e.target.style.background = '#f8fafc'; }}
                                onBlur={e => { e.target.style.borderColor = 'transparent'; e.target.style.background = 'transparent'; }}
                            />

                            {/* Mini badges */}
                            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
                                <MiniBadge label={`${set.questions.length}Q`} color="#6366f1" />
                                {set.imageUrls.length > 0 && <MiniBadge label={`${set.imageUrls.length}🖼️`} color="#f59e0b" />}
                                {set.missingExplanations.length > 0 && <MiniBadge label={`${set.missingExplanations.length}⚠️`} color="#ef4444" />}
                            </div>

                            {/* Expand/Remove */}
                            <button onClick={e => { e.stopPropagation(); removeSet(set.id); }}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: 4 }}>
                                <X size={16} />
                            </button>
                            {set.expanded ? <ChevronUp size={18} style={{ color: '#94a3b8' }} /> : <ChevronDown size={18} style={{ color: '#94a3b8' }} />}
                        </div>

                        {/* Expanded Details */}
                        {set.expanded && (
                            <div style={{ padding: '0 20px 20px', borderTop: '1px solid #f1f5f9' }}>
                                {/* Error */}
                                {set.validationError && (
                                    <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: 12, marginTop: 16, fontSize: 13, color: '#dc2626' }}>
                                        <strong>Error:</strong> {set.validationError}
                                    </div>
                                )}

                                {/* Missing Explanations */}
                                {set.missingExplanations.length > 0 && (
                                    <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, padding: 12, marginTop: 16, fontSize: 13 }}>
                                        <strong style={{ color: '#92400e' }}>Missing Explanations ({set.missingExplanations.length}):</strong>
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                                            {set.missingExplanations.map(qn => (
                                                <span key={qn} style={{
                                                    background: '#fef3c7', color: '#92400e', padding: '2px 8px', borderRadius: 4, fontSize: 12, fontWeight: 600
                                                }}>Q{qn}</span>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Images */}
                                {set.imageUrls.length > 0 && (
                                    <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, padding: 12, marginTop: 16, fontSize: 13 }}>
                                        <strong style={{ color: '#1e40af' }}>Images ({set.imageUrls.length}):</strong>
                                        <div style={{ marginTop: 8, maxHeight: 150, overflowY: 'auto' }}>
                                            {set.imageUrls.map((img, i) => (
                                                <div key={i} style={{ fontSize: 11, color: '#3b82f6', marginBottom: 4, wordBreak: 'break-all' }}>
                                                    Q{img.questionNo} [{img.field}]: {img.url.slice(0, 80)}...
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Questions Preview */}
                                <div style={{ marginTop: 16 }}>
                                    <strong style={{ fontSize: 13, color: '#475569' }}>Questions Preview:</strong>
                                    <div style={{ maxHeight: 300, overflowY: 'auto', marginTop: 8, borderRadius: 8, border: '1px solid #e2e8f0' }}>
                                        {set.questions.slice(0, 20).map((q, i) => (
                                            <div key={i} style={{
                                                padding: '10px 14px', borderBottom: '1px solid #f1f5f9',
                                                fontSize: 13, display: 'flex', gap: 10, alignItems: 'flex-start'
                                            }}>
                                                <span style={{
                                                    background: '#f1f5f9', color: '#475569', fontWeight: 700, fontSize: 11,
                                                    padding: '2px 8px', borderRadius: 4, flexShrink: 0
                                                }}>Q{q.questionNo}</span>
                                                <span style={{ color: '#334155', lineHeight: 1.4 }}>
                                                    {stripHtml(q.questionText).slice(0, 120)}{q.questionText.length > 120 ? '...' : ''}
                                                </span>
                                                <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                                                    {q.imageLink && <span title="Has imageLink" style={{ fontSize: 10 }}>🖼️</span>}
                                                    {!q.explanation && <span title="No explanation" style={{ fontSize: 10 }}>⚠️</span>}
                                                </div>
                                            </div>
                                        ))}
                                        {set.questions.length > 20 && (
                                            <div style={{ padding: '10px 14px', textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>
                                                ...and {set.questions.length - 20} more questions
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                ))}

                {sets.length === 0 && (
                    <div style={{ textAlign: 'center', padding: '60px 20px', color: '#94a3b8' }}>
                        <FileText size={48} style={{ marginBottom: 12, opacity: 0.4 }} />
                        <p style={{ fontSize: 16, fontWeight: 500 }}>No files loaded yet</p>
                        <p style={{ fontSize: 13 }}>Upload .json files to get started</p>
                    </div>
                )}
            </div>

            {/* Spin animation */}
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </DashboardLayout>
    );
}

// ─── Helper: strip HTML for preview ───
function stripHtml(html: string): string {
    return html.replace(/<[^>]*>/g, '').replace(/&[a-z]+;/gi, ' ').trim();
}

// ─── Sub-components ───
function StatBadge({ icon, label, value, color }: { icon: string; label: string; value: number; color: string }) {
    return (
        <div style={{
            background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, padding: '10px 16px',
            display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, boxShadow: '0 1px 2px rgba(0,0,0,0.04)'
        }}>
            <span>{icon}</span>
            <span style={{ color: '#64748b' }}>{label}</span>
            <strong style={{ color, fontSize: 16 }}>{value}</strong>
        </div>
    );
}

function MiniBadge({ label, color }: { label: string; color: string }) {
    return (
        <span style={{
            background: `${color}15`, color, padding: '2px 8px', borderRadius: 6, fontSize: 12, fontWeight: 600
        }}>{label}</span>
    );
}

// ─── Styles ───
const labelStyle: React.CSSProperties = {
    display: 'block', fontSize: 13, fontWeight: 600, color: '#475569', marginBottom: 6
};

const inputStyle: React.CSSProperties = {
    width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #d1d5db',
    fontSize: 14, color: '#1e293b', background: '#fff', outline: 'none',
    boxSizing: 'border-box', transition: 'border-color 0.2s'
};

const actionBtnStyle: React.CSSProperties = {
    display: 'flex', alignItems: 'center', gap: 8, padding: '10px 20px',
    borderRadius: 10, border: 'none', fontWeight: 600, fontSize: 14,
    cursor: 'pointer', transition: 'all 0.2s', boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
};
