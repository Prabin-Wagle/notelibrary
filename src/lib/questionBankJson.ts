export const QUESTION_BANK_SCHEMA_VERSION = 1 as const;

export type ExamCode = 'IOE' | 'CEE';

export interface ImportedQuestion {
    sourceId: string;
    sourceIndex: number;
    sourceFile: string;
    sourceSubject: string;
    chapter: string;
    sourceChapterId: string | null;
    questionText: string;
    options: string[];
    correctOption: number;
    marks: number;
    explanation: string | null;
    imageLink: string | null;
    tags: string[];
}

export interface NormalizedQuestionFile {
    questions: ImportedQuestion[];
    issues: string[];
}

const textValue = (...values: unknown[]): string => {
    const value = values.find((candidate) => typeof candidate === 'string' || typeof candidate === 'number');
    return value === undefined || value === null ? '' : String(value).trim();
};

const humanize = (value: string): string => value
    .replace(/^SetID[_\s-]*/i, '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .map((word) => {
        if (!word) return word;
        if (word.length <= 4 && word === word.toUpperCase()) return word;
        return `${word.charAt(0).toUpperCase()}${word.slice(1).toLowerCase()}`;
    })
    .join(' ');

const cleanSourceFile = (relativePath: string, examCode: ExamCode): string => {
    const normalized = relativePath.replace(/\\/g, '/').replace(/^\.\//, '');
    const rootPattern = new RegExp(`^Final[_ -]?${examCode}[_ -]?ChapterWise/`, 'i');
    return normalized.replace(rootPattern, '').slice(0, 500);
};

const subjectFrom = (question: Record<string, unknown>, relativePath: string, examCode: ExamCode): string => {
    let subject = textValue(question.unitId, question.subject, question.sourceSubject);
    subject = subject.replace(new RegExp(`^${examCode}[-_ ]`, 'i'), '');

    if (!subject) {
        const parts = relativePath.replace(/\\/g, '/').split('/').filter(Boolean);
        const startsWithExamRoot = parts[0]?.toLowerCase().includes(examCode.toLowerCase());
        subject = parts[startsWithExamRoot ? 1 : 0] || '';
    }

    const compact = subject.replace(/[_\s-]/g, '').toLowerCase();
    if (compact === 'eng' || compact === 'english') return 'English';
    if (compact === 'math') return 'Mathematics';
    if (compact === 'mat') return 'MAT';
    return humanize(subject).slice(0, 140);
};

const chapterFrom = (question: Record<string, unknown>, relativePath: string): string => {
    const explicit = textValue(question.chapter, question.chapterName, question.chapter_name);
    if (explicit) return humanize(explicit).slice(0, 200);

    const fileName = relativePath.replace(/\\/g, '/').split('/').pop() || '';
    const stem = fileName.replace(/\.json$/i, '')
        .replace(/[_\s]+(?:IOE|CEE)?[_\s]*(?:(?:Past|Practice Set Type [A-Z])[_\s]+)?Questions?$/i, '')
        .replace(/[_\s]+Most Important Questions?$/i, '')
        .replace(/[_\s]+Practice Set Type [A-Z]$/i, '');
    return humanize(stem || textValue(question.chapterId) || 'Unsorted').slice(0, 200);
};

const questionRows = (value: unknown): unknown[] => {
    if (Array.isArray(value)) return value;
    if (!value || typeof value !== 'object') return [];
    const record = value as Record<string, unknown>;
    if (Array.isArray(record.questions)) return record.questions;
    if (textValue(record.questionText, record.question_text, record.question)) return [record];
    return [];
};

const isSupportedQuestionRoot = (value: unknown): boolean => {
    if (Array.isArray(value)) return true;
    if (!value || typeof value !== 'object') return false;
    const record = value as Record<string, unknown>;
    return Array.isArray(record.questions) || Boolean(textValue(record.questionText, record.question_text, record.question));
};

export const normalizeQuestionBankFile = (
    parsed: unknown,
    relativePath: string,
    examCode: ExamCode,
): NormalizedQuestionFile => {
    const rows = questionRows(parsed);
    const sourceFile = cleanSourceFile(relativePath, examCode);
    const questions: ImportedQuestion[] = [];
    const issues: string[] = [];

    if (rows.length === 0 && !isSupportedQuestionRoot(parsed)) {
        return { questions, issues: [`${relativePath}: expected a question array or a document with a questions array.`] };
    }

    rows.forEach((item, index) => {
        if (!item || typeof item !== 'object' || Array.isArray(item)) {
            issues.push(`${relativePath}, item ${index + 1}: expected a question object.`);
            return;
        }

        const row = item as Record<string, unknown>;
        const questionText = textValue(row.questionText, row.question_text, row.question);
        const rawOptions = Array.isArray(row.options) ? row.options : [];
        const sourceOptions = rawOptions
            .map((option, originalIndex) => ({ text: String(option ?? '').trim(), originalIndex }))
            .filter((option) => option.text.length > 0);
        const options = sourceOptions.map((option) => option.text);
        const rawAnswer = row.correctOption ?? row.correct_option ?? row.answerIndex;
        const answerText = typeof rawAnswer === 'string' ? rawAnswer.trim() : '';
        const originalCorrectOption = /^[A-Z]$/i.test(answerText)
            ? answerText.toUpperCase().charCodeAt(0) - 65
            : Number(rawAnswer);
        const correctOption = sourceOptions.findIndex((option) => option.originalIndex === originalCorrectOption);
        const sourceIndexCandidate = Number(row.sourceIndex);
        const sourceIndex = Number.isInteger(sourceIndexCandidate) && sourceIndexCandidate > 0 ? sourceIndexCandidate : index + 1;
        const marks = row.marks === undefined || row.marks === null || row.marks === '' ? 1 : Number(row.marks);
        const issuePrefix = `${relativePath}, item ${index + 1}`;

        if (!questionText) {
            issues.push(`${issuePrefix}: question text is missing.`);
            return;
        }
        if (options.length < 2) {
            issues.push(`${issuePrefix}: provide at least two non-empty options.`);
            return;
        }
        if (!Number.isInteger(correctOption) || correctOption < 0 || correctOption >= options.length) {
            issues.push(`${issuePrefix}: correctOption must be a zero-based option index.`);
            return;
        }
        if (!Number.isFinite(marks) || marks < 0) {
            issues.push(`${issuePrefix}: marks must be a non-negative number.`);
            return;
        }

        const tags = Array.isArray(row.tags)
            ? row.tags.map((tag) => String(tag).trim()).filter(Boolean)
            : textValue(row.tag).split(',').map((tag) => tag.trim()).filter(Boolean);

        questions.push({
            sourceId: textValue(row.sourceId, row.questionNo, row.question_no, row.question_uid, row.id) || String(index + 1),
            sourceIndex,
            sourceFile,
            sourceSubject: subjectFrom(row, relativePath, examCode) || 'Uncategorized',
            chapter: chapterFrom(row, relativePath),
            sourceChapterId: textValue(row.chapterId, row.chapter_id) || null,
            questionText,
            options,
            correctOption,
            marks,
            explanation: textValue(row.explanation) || null,
            imageLink: textValue(row.imageLink, row.image_link, row.image_url) || null,
            tags,
        });
    });

    return { questions, issues };
};

export const inferExamCode = (relativePath: string): ExamCode | null => {
    if (/Final[_ -]?IOE[_ -]?ChapterWise/i.test(relativePath)) return 'IOE';
    if (/Final[_ -]?CEE[_ -]?ChapterWise/i.test(relativePath)) return 'CEE';
    return null;
};
