import localData from '../data/localData';
import type { Subject, Resource, SubjectResourcesResponse, ResourceType } from '../types/resources';

// Fetch subjects based on user's class and faculty
export const fetchSubjects = async (classNum: string, faculty: string): Promise<Subject[]> => {
    try {
        // Normalize the class and faculty to match database table naming
        // e.g., "Class 12" -> "class12", "Science" -> "science"
        const normalizedClass = classNum.toLowerCase().replace(/\s+/g, '');
        const normalizedFaculty = faculty.toLowerCase().replace(/\s+/g, '');
        const tableName = `${normalizedClass}_${normalizedFaculty}`;

        const response = await localData.get(`subjects`, {
            params: {
                action: 'subjects',
                table: tableName
            }
        });

        if (response.data.success && response.data.subjects) {
            return response.data.subjects;
        }
        return [];
    } catch (error) {
        console.error('Error fetching subjects:', error);
        return [];
    }
};

// Fetch competitive exam subjects
export const fetchCompetitiveSubjects = async (examType: string): Promise<Subject[]> => {
    try {
        const formData = new FormData();
        formData.append('exam_type', examType);

        const response = await localData.post(`competitive-subjects`, formData);

        if (response.data.success && response.data.subjects) {
            return response.data.subjects;
        }
        return [];
    } catch (error) {
        console.error('Error fetching competitive subjects:', error);
        return [];
    }
};

// Fetch resources for a specific subject and resource type
export const fetchResources = async (
    classNum: string,
    faculty: string,
    subjectName: string,
    resourceType: ResourceType,
    examType?: string
): Promise<Resource[]> => {
    try {
        const formData = new FormData();
        formData.append('subjectName', subjectName);

        // Use different endpoints for competitive vs class resources
        let endpoint: string;
        if (examType) {
            // For competitive exams, use getcompetitive.php
            formData.append('exam_type', examType);
            endpoint = 'getcompetitive.php';
        } else {
            // For class resources, use appropriate endpoint
            const normalizedClass = classNum.toLowerCase().replace(/\s+/g, '');
            const normalizedFaculty = faculty.toLowerCase().replace(/\s+/g, '');
            formData.append('class', normalizedClass);
            formData.append('faculty', normalizedFaculty);
            endpoint = getResourceEndpoint(resourceType);
        }

        const response = await localData.post<SubjectResourcesResponse>(
            `subject-resources/${endpoint}`,
            formData
        );

        if (response.data.status === 'true' && response.data.data) {
            return response.data.data;
        }
        return [];
    } catch (error) {
        console.error(`Error fetching ${resourceType}:`, error);
        return [];
    }
};

// Helper function to get endpoint filename for resource type
const getResourceEndpoint = (resourceType: ResourceType): string => {
    const endpoints: Record<ResourceType, string> = {
        note: 'getnote.php',
        numerical: 'getnumerical.php',
        practical: 'getpractical.php',
        project: 'getproject.php',
        grammar: 'getgrammar.php',
        freewriting: 'getfreewritting.php',
        givereason: 'getgivereason.php',
        miq: 'getmiq.php',
        mifs: 'getmifs.php',
        book: 'getbook.php'
    };
    return endpoints[resourceType];
};

// Fetch unified resources for a subject using the new system
export const fetchUnifiedResources = async (
    classNum: string,
    faculty: string,
    subjectName: string
): Promise<Resource[]> => {
    try {
        const response = await localData.get(`resources`, {
            params: {
                class_level: classNum,
                faculty: faculty,
                subject: subjectName
            }
        });

        if (response.data.success && response.data.resources) {
            return response.data.resources;
        }
        return [];
    } catch (error) {
        console.error('Error fetching unified resources:', error);
        return [];
    }
};

// Check which resource types have data for a subject
export const checkAvailableResources = async (
    classNum: string,
    faculty: string,
    subjectName: string,
    resourceTypes: ResourceType[]
): Promise<ResourceType[]> => {
    const availableTypes: ResourceType[] = [];

    // Check each resource type in parallel
    const checks = resourceTypes.map(async (type) => {
        const resources = await fetchResources(classNum, faculty, subjectName, type);
        if (resources.length > 0) {
            availableTypes.push(type);
        }
    });

    await Promise.all(checks);
    return availableTypes;
};

// Fetch all available resources for a subject
export const fetchAllSubjectResources = async (
    classNum: string,
    faculty: string,
    subjectName: string,
    examType?: string
): Promise<Record<ResourceType, Resource[]>> => {
    const allResourceTypes: ResourceType[] = [
        'note',
        'numerical',
        'practical',
        'project',
        'grammar',
        'freewriting',
        'givereason',
        'miq',
        'mifs'
    ];

    const resourcesMap: Record<string, Resource[]> = {};

    // If it's a regular curriculum subject, use the new unified API
    if (!examType) {
        const unifiedResources = await fetchUnifiedResources(classNum, faculty, subjectName);
        const resourcesMap: Record<string, Resource[]> = {};

        unifiedResources.forEach(r => {
            const type = (r.resource_type || 'other').toLowerCase();
            if (!resourcesMap[type]) {
                resourcesMap[type] = [];
            }
            
            // Map new fields to old fields for compatibility with existing UI
            resourcesMap[type].push({
                ...r,
                chapter: r.unit || r.chapter || 'General',
                chapterName: r.chapter_name || r.chapterName || '',
                driveLink: r.upload_mode === 'link' ? r.file_data : (r.driveLink || '')
            });
        });

        return resourcesMap as Record<ResourceType, Resource[]>;
    }

    // Fallback for competitive or if we still use old endpoints
    // Fetch all resource types in parallel
    const fetches = allResourceTypes.map(async (type) => {
        const resources = await fetchResources(classNum, faculty, subjectName, type, examType);
        if (resources.length > 0) {
            resourcesMap[type] = resources;
        }
    });

    await Promise.all(fetches);
    return resourcesMap as Record<ResourceType, Resource[]>;
};
