export interface Subject {
    id: number;
    subject_name: string;
    subject_code?: string;
    credit?: number;
    type?: string;
}

export interface Resource {
    id: number;
    class: string;
    faculty?: string;
    subjectName: string;
    chapter?: string;
    chapterName: string;
    driveLink?: string;
    link?: string; // Used by competitive resources
    visibility?: string;
    exam_type?: string;
    image?: string; // We will not render this, but it exists in the data

    // New unified system fields
    subject?: string;
    unit?: string;
    resource_type?: string;
    chapter_name?: string;
    upload_mode?: 'link' | 'manual';
    file_data?: string;
    created_at?: string;
}

export type ResourceType =
    | 'note'
    | 'numerical'
    | 'practical'
    | 'project'
    | 'grammar'
    | 'freewriting'
    | 'givereason'
    | 'miq'
    | 'mifs'
    | 'book';

export interface ResourceTypeConfig {
    type: ResourceType;
    label: string;
    icon: string;
    color: string;
    endpoint: string;
}

export const RESOURCE_TYPES: ResourceTypeConfig[] = [
    {
        type: 'note',
        label: 'Notes',
        icon: '📚',
        color: 'blue',
        endpoint: 'note'
    },
    {
        type: 'numerical',
        label: 'Numericals',
        icon: '🔢',
        color: 'green',
        endpoint: 'numerical'
    },
    {
        type: 'practical',
        label: 'Practicals',
        icon: '🔬',
        color: 'purple',
        endpoint: 'practical'
    },
    {
        type: 'project',
        label: 'Projects',
        icon: '🚀',
        color: 'orange',
        endpoint: 'project'
    },
    {
        type: 'grammar',
        label: 'Grammar',
        icon: '📝',
        color: 'pink',
        endpoint: 'grammar'
    },
    {
        type: 'freewriting',
        label: 'Free Writing',
        icon: '✍️',
        color: 'indigo',
        endpoint: 'freewriting'
    },
    {
        type: 'givereason',
        label: 'Give Reason',
        icon: '💡',
        color: 'yellow',
        endpoint: 'give-reason'
    },
    {
        type: 'miq',
        label: 'Most Important Questions',
        icon: '🎯',
        color: 'teal',
        endpoint: 'miq'
    },
    {
        type: 'mifs',
        label: 'Most Important Formulas',
        icon: '📖',
        color: 'cyan',
        endpoint: 'mifs'
    },
    {
        type: 'book',
        label: 'Books',
        icon: '📕',
        color: 'red',
        endpoint: 'book'
    }
];

export interface SubjectResourcesResponse {
    data: Resource[];
    status: string;
}
