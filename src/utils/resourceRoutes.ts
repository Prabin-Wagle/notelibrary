import type { Resource } from '../types/resources';

export const slugifyResourceName = (value: string) => value
    .trim()
    .toLowerCase()
    .replace(/\.[a-z0-9]+$/i, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'study-document';

export const getResourceTitle = (resource?: Partial<Resource>, fallback = 'Drawing symbols') =>
    resource?.chapterName || resource?.chapter_name || fallback;

export const getResourceFileUrl = (resource?: Partial<Resource>) =>
    resource?.file_data || resource?.driveLink || resource?.link || '/assets/drawing_symbol.pdf';

export const getResourceReaderPath = (title: string) => `/study/${slugifyResourceName(title)}`;

