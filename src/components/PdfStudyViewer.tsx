import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { SpecialZoomLevel, Viewer, Worker, type RenderPageProps } from '@react-pdf-viewer/core';
import { defaultLayoutPlugin, type ToolbarProps, type ToolbarSlot } from '@react-pdf-viewer/default-layout';
import { Eraser, Highlighter, Maximize2, MessageSquareText, MousePointer2, Pencil, RotateCcw, RotateCw, Type, X } from 'lucide-react';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.js?url';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { loadEncryptedNotes, saveEncryptedNotes } from '../utils/encryptedNotes';

import '@react-pdf-viewer/core/lib/styles/index.css';
import '@react-pdf-viewer/default-layout/lib/styles/index.css';

type AnnotationTool = 'view' | 'pen' | 'highlight' | 'text' | 'eraser';
type Point = { x: number; y: number };
type Stroke = { id: string; pageIndex: number; tool: 'pen' | 'highlight'; points: Point[]; color?: string; width?: number };
type TextAnnotation = { id: string; pageIndex: number; x: number; y: number; text: string; color: string; fontSize: number; rotation?: number };
type TextDraft = Omit<TextAnnotation, 'text'> & { text: string; draftKey: string };
type TextTransform = { mode: 'move' | 'resize' | 'rotate'; id: string; startPoint: Point; startAnnotation: TextAnnotation };

interface PdfStudyViewerProps { fileUrl: string; defaultScale?: number; className?: string }

const ANNOTATION_KEY = 'nl_pdf_annotations_drawing_symbol';
const TEXT_KEY = 'nl_pdf_text_annotations_drawing_symbol';
const LEGACY_NOTES_KEY = 'nl_pdf_notes_drawing_symbol';
const ENCRYPTED_NOTES_KEY = 'nl_pdf_notes_encrypted_drawing_symbol';
const PEN_COLORS = ['#0f766e', '#2563eb', '#dc2626', '#1c1917', '#f8fafc'];
const HIGHLIGHT_COLORS = ['#fde047', '#86efac', '#67e8f9', '#f9a8d4', '#fdba74'];
const TEXT_COLORS = ['#1c1917', '#0f766e', '#2563eb', '#dc2626', '#f8fafc'];
const SIZE_OPTIONS = {
    pen: [{ label: 'S', value: 3 }, { label: 'M', value: 5 }, { label: 'L', value: 8 }],
    highlight: [{ label: 'S', value: 22 }, { label: 'M', value: 34 }, { label: 'L', value: 48 }],
    eraser: [{ label: 'S', value: 18 }, { label: 'M', value: 30 }, { label: 'L', value: 48 }],
    text: [{ label: 'S', value: 14 }, { label: 'M', value: 18 }, { label: 'L', value: 24 }],
};

const readStored = <T,>(key: string, fallback: T): T => {
    try { return JSON.parse(localStorage.getItem(key) || '') as T; } catch { return fallback; }
};

const renderToolbar = (Toolbar: (props: ToolbarProps) => React.ReactElement) => (
    <Toolbar>
        {(slots: ToolbarSlot) => {
            const { CurrentPageInput, Download, GoToNextPage, GoToPreviousPage, NumberOfPages, ShowSearchPopover, Zoom } = slots;
            return <div className="flex h-11 w-full items-center justify-between gap-2 border-b border-ink-200 bg-[#fbfaf7] px-3 dark:border-white/[.08] dark:bg-ink-900">
                <div className="flex items-center gap-1"><ShowSearchPopover /><GoToPreviousPage /><span className="flex items-center gap-1 px-1 font-metric text-[.68rem] font-bold text-ink-600 dark:text-ink-300"><CurrentPageInput /> / <NumberOfPages /></span><GoToNextPage /></div>
                <Zoom>{({ scale, onZoom }) => <div className="flex h-8 items-center rounded-lg border border-ink-200 bg-white dark:border-white/10 dark:bg-white/[.04]">
                    <button type="button" onClick={() => onZoom(SpecialZoomLevel.PageFit)} className="h-full border-r border-ink-200 px-2 text-[.65rem] font-bold text-ink-500 dark:border-white/10 dark:text-ink-300">Fit</button>
                    <button type="button" onClick={() => onZoom(Math.max(.5, Number((scale - .1).toFixed(2))))} className="grid h-full w-8 place-items-center text-base text-ink-500 dark:text-ink-300" aria-label="Zoom out">−</button>
                    <span className="w-11 text-center font-metric text-[.65rem] font-bold text-ink-700 dark:text-ink-200">{Math.round(scale * 100)}%</span>
                    <button type="button" onClick={() => onZoom(Math.min(2.5, Number((scale + .1).toFixed(2))))} className="grid h-full w-8 place-items-center text-base text-ink-500 dark:text-ink-300" aria-label="Zoom in">+</button>
                </div>}</Zoom>
                <div className="flex items-center gap-1"><Download /></div>
            </div>;
        }}
    </Toolbar>
);

const distanceToSegment = (point: Point, start: Point, end: Point) => {
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    if (dx === 0 && dy === 0) return Math.hypot(point.x - start.x, point.y - start.y);
    const ratio = Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / (dx * dx + dy * dy)));
    return Math.hypot(point.x - (start.x + ratio * dx), point.y - (start.y + ratio * dy));
};

const textHitByEraser = (annotation: TextAnnotation, point: Point, radius: number) => {
    const angle = -((annotation.rotation || 0) * Math.PI) / 180;
    const dx = point.x - annotation.x;
    const dy = point.y - annotation.y;
    const localX = dx * Math.cos(angle) - dy * Math.sin(angle);
    const localY = dx * Math.sin(angle) + dy * Math.cos(angle);
    const width = Math.max(28, annotation.text.length * annotation.fontSize * .98);
    const halfHeight = Math.max(10, annotation.fontSize * 1.05);
    return localX >= -radius && localX <= width + radius && Math.abs(localY) <= halfHeight + radius;
};

export default function PdfStudyViewer({ fileUrl, defaultScale = 1, className = '' }: PdfStudyViewerProps) {
    const { theme } = useTheme();
    const { user } = useAuth();
    const [tool, setTool] = useState<AnnotationTool>('view');
    const [strokes, setStrokes] = useState<Stroke[]>(() => readStored<Stroke[]>(ANNOTATION_KEY, []));
    const [textAnnotations, setTextAnnotations] = useState<TextAnnotation[]>(() => readStored<TextAnnotation[]>(TEXT_KEY, []));
    const [notes, setNotes] = useState<Record<number, string>>({});
    const [notesReady, setNotesReady] = useState(false);
    const [noteStatus, setNoteStatus] = useState<'loading' | 'saving' | 'saved'>('loading');
    const [notesOpen, setNotesOpen] = useState(false);
    const [currentPage, setCurrentPage] = useState(0);
    const [penColor, setPenColor] = useState(PEN_COLORS[0]);
    const [highlightColor, setHighlightColor] = useState(HIGHLIGHT_COLORS[0]);
    const [textColor, setTextColor] = useState(TEXT_COLORS[0]);
    const [penSize, setPenSize] = useState(5);
    const [highlightSize, setHighlightSize] = useState(34);
    const [eraserSize, setEraserSize] = useState(30);
    const [textSize, setTextSize] = useState(18);
    const [textDraft, setTextDraft] = useState<TextDraft | null>(null);
    const [selectedTextId, setSelectedTextId] = useState<string | null>(null);
    const [eraserPoint, setEraserPoint] = useState<(Point & { pageIndex: number }) | null>(null);
    const [systemDark, setSystemDark] = useState(() => window.matchMedia('(prefers-color-scheme: dark)').matches);
    const drawingRef = useRef<string | null>(null);
    const erasingRef = useRef(false);
    const textDraftRef = useRef<TextDraft | null>(null);
    const textTransformRef = useRef<TextTransform | null>(null);
    const toolRef = useRef<AnnotationTool>('view');
    const penColorRef = useRef(penColor);
    const highlightColorRef = useRef(highlightColor);
    const penSizeRef = useRef(penSize);
    const highlightSizeRef = useRef(highlightSize);
    const eraserSizeRef = useRef(eraserSize);
    const textColorRef = useRef(textColor);
    const textSizeRef = useRef(textSize);
    toolRef.current = tool;
    penColorRef.current = penColor;
    highlightColorRef.current = highlightColor;
    penSizeRef.current = penSize;
    highlightSizeRef.current = highlightSize;
    eraserSizeRef.current = eraserSize;
    textColorRef.current = textColor;
    textSizeRef.current = textSize;
    textDraftRef.current = textDraft;
    const viewerTheme = theme === 'system' ? (systemDark ? 'dark' : 'light') : theme;
    const ownerScope = user?.id || user?.email || 'local-student';
    const documentId = fileUrl.split('/').pop() || 'document';
    const encryptedNotesKey = `${ENCRYPTED_NOTES_KEY}:${encodeURIComponent(ownerScope)}:${encodeURIComponent(documentId)}`;
    const defaultLayoutPluginInstance = defaultLayoutPlugin({ renderToolbar, sidebarTabs: () => [] });

    useEffect(() => { localStorage.setItem(ANNOTATION_KEY, JSON.stringify(strokes)); }, [strokes]);
    useEffect(() => { localStorage.setItem(TEXT_KEY, JSON.stringify(textAnnotations)); }, [textAnnotations]);
    useEffect(() => {
        let active = true;
        setNotesReady(false);
        setNoteStatus('loading');
        void loadEncryptedNotes(encryptedNotesKey, ownerScope, documentId).then((encrypted) => {
            if (!active) return;
            const legacy = readStored<Record<number, string>>(LEGACY_NOTES_KEY, {});
            setNotes(Object.keys(encrypted).length ? encrypted : legacy);
            setNotesReady(true);
            setNoteStatus('saved');
        });
        return () => { active = false; };
    }, [documentId, encryptedNotesKey, ownerScope]);
    useEffect(() => {
        if (!notesReady) return;
        setNoteStatus('saving');
        const timeout = window.setTimeout(() => {
            void saveEncryptedNotes(encryptedNotesKey, notes, ownerScope, documentId).then(() => {
                localStorage.removeItem(LEGACY_NOTES_KEY);
                setNoteStatus('saved');
            });
        }, 350);
        return () => window.clearTimeout(timeout);
    }, [documentId, encryptedNotesKey, notes, notesReady, ownerScope]);
    useEffect(() => {
        const query = window.matchMedia('(prefers-color-scheme: dark)');
        const update = (event: MediaQueryListEvent) => setSystemDark(event.matches);
        query.addEventListener('change', update);
        return () => query.removeEventListener('change', update);
    }, []);

    const pointFromEvent = (event: ReactPointerEvent<SVGSVGElement>): Point => {
        const bounds = event.currentTarget.getBoundingClientRect();
        return { x: ((event.clientX - bounds.left) / bounds.width) * 1000, y: ((event.clientY - bounds.top) / bounds.height) * 1000 };
    };

    const eraseAt = (pageIndex: number, point: Point) => {
        const radius = eraserSizeRef.current;
        setStrokes((current) => current.filter((stroke) => {
            if (stroke.pageIndex !== pageIndex) return true;
            if (stroke.points.length === 1) return Math.hypot(point.x - stroke.points[0].x, point.y - stroke.points[0].y) > radius;
            return !stroke.points.slice(1).some((end, index) => distanceToSegment(point, stroke.points[index], end) <= radius + (stroke.width || 4) / 2);
        }));
        setTextAnnotations((current) => current.filter((annotation) => annotation.pageIndex !== pageIndex || !textHitByEraser(annotation, point, radius)));
    };

    const commitTextDraft = (draft: TextDraft) => {
        if (!draft.text.trim()) return;
        const id = draft.id;
        const annotation: TextAnnotation = { id, pageIndex: draft.pageIndex, x: draft.x, y: draft.y, text: draft.text.trim(), color: draft.color, fontSize: draft.fontSize, rotation: draft.rotation || 0 };
        setTextAnnotations((current) => current.some((item) => item.id === id) ? current.map((item) => item.id === id ? annotation : item) : [...current, annotation]);
        setSelectedTextId(id);
        setTextDraft((current) => current?.draftKey === draft.draftKey ? null : current);
    };

    const beginStroke = (pageIndex: number, event: ReactPointerEvent<SVGSVGElement>) => {
        const activeTool = toolRef.current;
        const point = pointFromEvent(event);
        if (activeTool === 'text') {
            if (textDraftRef.current?.text.trim()) commitTextDraft(textDraftRef.current);
            setSelectedTextId(null);
            const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
            setTextDraft({ id, pageIndex, x: point.x, y: point.y, text: '', color: textColorRef.current, fontSize: textSizeRef.current, rotation: 0, draftKey: id });
            return;
        }
        if (activeTool === 'eraser') {
            event.currentTarget.setPointerCapture(event.pointerId);
            erasingRef.current = true;
            setEraserPoint({ ...point, pageIndex });
            eraseAt(pageIndex, point);
            return;
        }
        if (activeTool !== 'pen' && activeTool !== 'highlight') return;
        event.currentTarget.setPointerCapture(event.pointerId);
        const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
        drawingRef.current = id;
        setStrokes((current) => [...current, { id, pageIndex, tool: activeTool, points: [point], color: activeTool === 'pen' ? penColorRef.current : highlightColorRef.current, width: activeTool === 'pen' ? penSizeRef.current : highlightSizeRef.current }]);
    };

    const extendStroke = (pageIndex: number, event: ReactPointerEvent<SVGSVGElement>) => {
        const point = pointFromEvent(event);
        if (toolRef.current === 'eraser') {
            setEraserPoint({ ...point, pageIndex });
            if (erasingRef.current) eraseAt(pageIndex, point);
            return;
        }
        if (!drawingRef.current || !event.currentTarget.hasPointerCapture(event.pointerId)) return;
        setStrokes((current) => current.map((stroke) => stroke.id === drawingRef.current ? { ...stroke, points: [...stroke.points, point] } : stroke));
    };

    const finishStroke = (event: ReactPointerEvent<SVGSVGElement>) => {
        if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
        drawingRef.current = null;
        erasingRef.current = false;
    };

    const pointFromTextEvent = (event: ReactPointerEvent<HTMLElement>): Point => {
        const page = event.currentTarget.closest('.pdf-page-shell');
        const bounds = page?.getBoundingClientRect();
        if (!bounds) return { x: 0, y: 0 };
        return { x: ((event.clientX - bounds.left) / bounds.width) * 1000, y: ((event.clientY - bounds.top) / bounds.height) * 1000 };
    };

    const startTextTransform = (mode: TextTransform['mode'], annotation: TextAnnotation, event: ReactPointerEvent<HTMLElement>) => {
        event.preventDefault();
        event.stopPropagation();
        event.currentTarget.setPointerCapture(event.pointerId);
        setSelectedTextId(annotation.id);
        textTransformRef.current = { mode, id: annotation.id, startPoint: pointFromTextEvent(event), startAnnotation: { ...annotation } };
    };

    const updateTextTransform = (event: ReactPointerEvent<HTMLElement>) => {
        const transform = textTransformRef.current;
        if (!transform) return;
        const point = pointFromTextEvent(event);
        const { startAnnotation, startPoint } = transform;
        setTextAnnotations((current) => current.map((annotation) => {
            if (annotation.id !== transform.id) return annotation;
            if (transform.mode === 'move') return { ...annotation, x: Math.max(0, Math.min(1000, startAnnotation.x + point.x - startPoint.x)), y: Math.max(0, Math.min(1000, startAnnotation.y + point.y - startPoint.y)) };
            if (transform.mode === 'resize') {
                const startDistance = Math.max(1, Math.hypot(startPoint.x - startAnnotation.x, startPoint.y - startAnnotation.y));
                const nextDistance = Math.max(1, Math.hypot(point.x - startAnnotation.x, point.y - startAnnotation.y));
                return { ...annotation, fontSize: Math.max(10, Math.min(72, startAnnotation.fontSize * (nextDistance / startDistance))) };
            }
            const rotation = Math.atan2(point.y - startAnnotation.y, point.x - startAnnotation.x) * (180 / Math.PI) + 90;
            return { ...annotation, rotation: Math.round(rotation) };
        }));
    };

    const finishTextTransform = (event: ReactPointerEvent<HTMLElement>) => {
        if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
        textTransformRef.current = null;
    };

    const editTextAnnotation = (annotation: TextAnnotation) => {
        setSelectedTextId(null);
        setTextDraft({ ...annotation, draftKey: `${Date.now()}-${Math.random().toString(36).slice(2)}` });
    };

    const saveTextDraft = () => {
        if (textDraft) commitTextDraft(textDraft);
    };

    const undoLast = () => {
        const lastStroke = strokes[strokes.length - 1];
        const lastText = textAnnotations[textAnnotations.length - 1];
        if (!lastStroke && !lastText) return;
        const strokeTime = Number(lastStroke?.id.split('-')[0] || 0);
        const textTime = Number(lastText?.id.split('-')[0] || 0);
        if (strokeTime >= textTime) setStrokes((current) => current.slice(0, -1));
        else setTextAnnotations((current) => current.slice(0, -1));
    };

    const renderPage = (props: RenderPageProps) => <div className="pdf-page-shell relative" style={{ height: props.height, width: props.width }}>
        {props.canvasLayer.children}{props.textLayer.children}{props.annotationLayer.children}
        <svg viewBox="0 0 1000 1000" preserveAspectRatio="none" className="pdf-annotation-layer absolute inset-0 z-10 h-full w-full touch-none" onPointerDown={(event) => beginStroke(props.pageIndex, event)} onPointerMove={(event) => extendStroke(props.pageIndex, event)} onPointerUp={finishStroke} onPointerCancel={finishStroke} onPointerLeave={() => { if (!erasingRef.current) setEraserPoint(null); }}>
            {strokes.filter((stroke) => stroke.pageIndex === props.pageIndex).map((stroke) => <path key={stroke.id} d={stroke.points.map((point, index) => `${index ? 'L' : 'M'} ${point.x} ${point.y}`).join(' ')} fill="none" stroke={stroke.color || (stroke.tool === 'highlight' ? '#fde047' : '#0f766e')} strokeOpacity={stroke.tool === 'highlight' ? .38 : .95} strokeWidth={stroke.width || (stroke.tool === 'highlight' ? 34 : 4)} strokeLinecap="round" strokeLinejoin="round" className="pointer-events-none" />)}
            {tool === 'eraser' && eraserPoint?.pageIndex === props.pageIndex && <circle cx={eraserPoint.x} cy={eraserPoint.y} r={eraserSize} fill="rgba(255,255,255,.35)" stroke={viewerTheme === 'dark' ? '#f8fafc' : '#1c1917'} strokeWidth="2" className="pointer-events-none" />}
        </svg>
        <div className={`pointer-events-none absolute inset-0 z-20 ${tool === 'text' || tool === 'view' ? '[&>*]:pointer-events-auto' : ''}`}>
            {textAnnotations.filter((annotation) => annotation.pageIndex === props.pageIndex && textDraft?.id !== annotation.id).map((annotation) => {
                const selected = (tool === 'text' || tool === 'view') && selectedTextId === annotation.id;
                return <div key={annotation.id} role="button" tabIndex={0} aria-label={`Text annotation: ${annotation.text}`} onPointerDown={(event) => { if (!(event.target as HTMLElement).closest('[data-text-handle]')) startTextTransform('move', annotation, event); }} onPointerMove={updateTextTransform} onPointerUp={finishTextTransform} onPointerCancel={finishTextTransform} onDoubleClick={() => editTextAnnotation(annotation)} style={{ left: `${annotation.x / 10}%`, top: `${annotation.y / 10}%`, color: annotation.color, fontSize: annotation.fontSize * props.scale, transform: `translateY(-50%) rotate(${annotation.rotation || 0}deg)`, transformOrigin: 'left center' }} className={`absolute max-w-[70%] select-none whitespace-pre-wrap rounded px-1 text-left font-semibold leading-tight ${selected ? 'cursor-move outline outline-1 outline-dashed outline-brand-600 outline-offset-4' : 'hover:bg-white/70 dark:hover:bg-black/40'}`}>
                    {annotation.text}
                    {selected && <>
                        <button type="button" data-text-handle aria-label="Rotate text" title="Drag to rotate" onPointerDown={(event) => startTextTransform('rotate', annotation, event)} onPointerMove={updateTextTransform} onPointerUp={finishTextTransform} onPointerCancel={finishTextTransform} className="absolute -top-8 left-1/2 z-10 grid h-6 w-6 -translate-x-1/2 place-items-center rounded-full border border-brand-300 bg-white text-brand-700 shadow-md dark:border-brand-700 dark:bg-ink-900 dark:text-brand-300"><RotateCw size={12} /></button>
                        <button type="button" data-text-handle aria-label="Resize text" title="Drag to resize" onPointerDown={(event) => startTextTransform('resize', annotation, event)} onPointerMove={updateTextTransform} onPointerUp={finishTextTransform} onPointerCancel={finishTextTransform} className="absolute -bottom-3 -right-3 z-10 grid h-6 w-6 place-items-center rounded-md border border-brand-300 bg-white text-brand-700 shadow-md dark:border-brand-700 dark:bg-ink-900 dark:text-brand-300"><Maximize2 size={12} /></button>
                    </>}
                </div>;
            })}
            {textDraft?.pageIndex === props.pageIndex && <form onSubmit={(event) => { event.preventDefault(); saveTextDraft(); }} onPointerDown={(event) => event.stopPropagation()} style={{ left: `${textDraft.x / 10}%`, top: `${textDraft.y / 10}%`, transform: `translateY(-50%) rotate(${textDraft.rotation || 0}deg)`, transformOrigin: 'left center' }} className="pointer-events-auto absolute z-30"><input autoFocus value={textDraft.text} onChange={(event) => setTextDraft((current) => current ? { ...current, text: event.target.value } : current)} onBlur={() => { if (textDraft.text.trim()) commitTextDraft(textDraft); }} onKeyDown={(event) => { if (event.key === 'Escape') setTextDraft(null); }} placeholder="Type text…" style={{ color: textDraft.color, fontSize: textDraft.fontSize * props.scale }} className="w-52 rounded-lg border border-brand-500 bg-white/95 px-2 py-1.5 font-semibold shadow-lg outline-none dark:bg-ink-900" /></form>}
        </div>
    </div>;

    const tools: Array<{ id: AnnotationTool; label: string; icon: typeof Pencil }> = [
        { id: 'view', label: 'View', icon: MousePointer2 }, { id: 'pen', label: 'Draw', icon: Pencil }, { id: 'highlight', label: 'Highlight', icon: Highlighter }, { id: 'text', label: 'Text', icon: Type }, { id: 'eraser', label: 'Erase', icon: Eraser },
    ];
    const activeColors = tool === 'pen' ? PEN_COLORS : tool === 'highlight' ? HIGHLIGHT_COLORS : tool === 'text' ? TEXT_COLORS : [];
    const activeColor = tool === 'pen' ? penColor : tool === 'highlight' ? highlightColor : textColor;
    const setActiveColor = (color: string) => {
        if (tool === 'pen') setPenColor(color);
        else if (tool === 'highlight') setHighlightColor(color);
        else {
            setTextColor(color);
            if (selectedTextId) setTextAnnotations((current) => current.map((annotation) => annotation.id === selectedTextId ? { ...annotation, color } : annotation));
        }
    };
    const sizeOptions = tool === 'pen' ? SIZE_OPTIONS.pen : tool === 'highlight' ? SIZE_OPTIONS.highlight : tool === 'eraser' ? SIZE_OPTIONS.eraser : tool === 'text' ? SIZE_OPTIONS.text : [];
    const activeSize = tool === 'pen' ? penSize : tool === 'highlight' ? highlightSize : tool === 'eraser' ? eraserSize : textSize;
    const setActiveSize = (size: number) => {
        if (tool === 'pen') setPenSize(size);
        else if (tool === 'highlight') setHighlightSize(size);
        else if (tool === 'eraser') setEraserSize(size);
        else {
            setTextSize(size);
            if (selectedTextId) setTextAnnotations((current) => current.map((annotation) => annotation.id === selectedTextId ? { ...annotation, fontSize: size } : annotation));
        }
    };

    return <section data-annotation-tool={tool} className={`pdf-study-viewer native-cursor-zone relative flex min-h-0 flex-col overflow-hidden bg-ink-100 dark:bg-ink-950 ${className}`}>
        <div className="flex min-h-12 shrink-0 items-center gap-1 overflow-x-auto border-b border-ink-200 bg-[#fbfaf7] px-3 dark:border-white/[.08] dark:bg-ink-900">
            {tools.map(({ id, label, icon: Icon }) => <button key={id} onClick={() => setTool(id)} className={`inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg px-3 text-xs font-semibold transition ${tool === id ? 'bg-brand-100 text-brand-900 dark:bg-brand-500/[.15] dark:text-brand-300' : 'text-ink-500 hover:bg-ink-100 dark:text-ink-400 dark:hover:bg-white/[.06]'}`}><Icon size={15} /> {label}</button>)}
            {!!sizeOptions.length && <div className="ml-1 flex h-8 shrink-0 items-center rounded-lg border border-ink-200 p-0.5 dark:border-white/10">{sizeOptions.map((option) => <button key={option.label} type="button" onClick={() => setActiveSize(option.value)} className={`grid h-6 w-7 place-items-center rounded text-[.62rem] font-bold ${activeSize === option.value ? 'bg-ink-900 text-white dark:bg-white dark:text-ink-900' : 'text-ink-400'}`} title={`${option.label} size`}>{option.label}</button>)}</div>}
            {!!activeColors.length && <div className="ml-1 flex shrink-0 items-center gap-1.5 px-1">{activeColors.map((color) => <button key={color} type="button" onClick={() => setActiveColor(color)} aria-label={`Use ${color}`} className={`h-5 w-5 rounded-full border shadow-sm ${activeColor === color ? 'ring-2 ring-brand-500 ring-offset-2 dark:ring-offset-ink-900' : 'border-black/15 dark:border-white/20'}`} style={{ backgroundColor: color }} />)}</div>}
            <button onClick={undoLast} disabled={!strokes.length && !textAnnotations.length} className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg px-3 text-xs font-semibold text-ink-500 transition hover:bg-ink-100 disabled:opacity-35 dark:text-ink-400 dark:hover:bg-white/[.06]"><RotateCcw size={15} /> Undo</button>
            <button onClick={() => setNotesOpen((open) => !open)} className={`inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg px-3 text-xs font-semibold transition ${notesOpen ? 'bg-brand-100 text-brand-900 dark:bg-brand-500/[.15] dark:text-brand-300' : 'text-ink-500 hover:bg-ink-100 dark:text-ink-400 dark:hover:bg-white/[.06]'}`}><MessageSquareText size={15} /> Notes</button>
        </div>
        <div className="relative min-h-0 flex-1" onContextMenu={(event) => event.preventDefault()}>
            <Worker workerUrl={workerUrl}><Viewer fileUrl={fileUrl} plugins={[defaultLayoutPluginInstance]} defaultScale={defaultScale} enableSmoothScroll={false} theme={viewerTheme} renderPage={renderPage} onPageChange={(event) => setCurrentPage(event.currentPage)} /></Worker>
            {notesOpen && <aside className="absolute inset-y-0 right-0 z-30 flex w-72 flex-col border-l border-ink-200 bg-[#fbfaf7] shadow-[-18px_0_40px_rgba(28,25,23,.08)] dark:border-white/[.08] dark:bg-ink-900 dark:shadow-[-18px_0_40px_rgba(0,0,0,.25)]"><div className="flex items-center justify-between border-b border-ink-200 px-4 py-3 dark:border-white/[.08]"><div><h2 className="font-display text-sm font-bold">Page {currentPage + 1} notes</h2><p className="mt-0.5 text-[.68rem] text-ink-400">{noteStatus === 'loading' ? 'Decrypting notes…' : noteStatus === 'saving' ? 'Encrypting changes…' : 'Encrypted · saved locally'}</p></div><button onClick={() => setNotesOpen(false)} className="grid h-8 w-8 place-items-center rounded-lg text-ink-400 hover:bg-ink-100 dark:hover:bg-white/[.06]" aria-label="Close notes"><X size={16} /></button></div><textarea disabled={!notesReady} value={notes[currentPage] || ''} onChange={(event) => setNotes((current) => ({ ...current, [currentPage]: event.target.value }))} placeholder="Write a reminder, definition, or question for this page…" className="min-h-0 flex-1 resize-none bg-transparent p-4 text-sm leading-7 outline-none placeholder:text-ink-300 disabled:opacity-50 dark:placeholder:text-ink-600" /></aside>}
        </div>
    </section>;
}
