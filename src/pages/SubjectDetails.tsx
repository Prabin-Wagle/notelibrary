import { useEffect, useState } from 'react';
import { useParams, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { fetchAllSubjectResources } from '../utils/api';
import type { Subject, Resource, ResourceType } from '../types/resources';
import { Loader2 } from 'lucide-react';
import ClassSubjectDetails from '../components/ClassSubjectDetails';

export default function SubjectDetails() {
    const { subjectName } = useParams<{ subjectName: string }>();
    const { user } = useAuth();
    const location = useLocation();
    const subject = location.state?.subject as Subject | undefined;

    const [resourcesMap, setResourcesMap] = useState<Record<ResourceType, Resource[]>>({} as Record<ResourceType, Resource[]>);
    const [loading, setLoading] = useState(true);
    const [availableTypes, setAvailableTypes] = useState<ResourceType[]>([]);

    useEffect(() => {
        const loadResources = async () => {
            // Check if we have class info
            const hasClassInfo = user?.class && user?.faculty;

            if (!subjectName || !hasClassInfo) {
                setLoading(false);
                return;
            }

            setLoading(true);
            const decodedSubject = decodeURIComponent(subjectName);

            const resources = await fetchAllSubjectResources(
                user?.class || '',
                user?.faculty || '',
                decodedSubject
            );
            setResourcesMap(resources);
            setAvailableTypes(Object.keys(resources) as ResourceType[]);

            setLoading(false);
        };

        loadResources();
    }, [user?.class, user?.faculty, subjectName]);

    if (loading) {
        const userClass = user?.class;
        const userFaculty = user?.faculty;
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <div className="bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-700 dark:to-indigo-800 rounded-2xl p-8 text-white shadow-lg shadow-blue-600/20 animate-in fade-in zoom-in duration-500">
                    <h1 className="text-3xl font-black mb-2">{decodeURIComponent(subjectName || '')}</h1>
                    <p className="text-blue-100 font-medium opacity-90">
                        {userClass} • {userFaculty}
                    </p>
                    {subject?.subject_code && (
                        <span className="inline-block mt-4 bg-white/20 backdrop-blur-sm px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest">
                            {subject.subject_code}
                        </span>
                    )}
                    <div className="mt-8 flex justify-center">
                        <Loader2 className="h-8 w-8 animate-spin text-white opacity-80" />
                    </div>
                </div>
            </div>
        );
    }

    return (
        <ClassSubjectDetails
            subjectName={subjectName || ''}
            subject={subject}
            resourcesMap={resourcesMap}
            availableTypes={availableTypes}
            userClass={user?.class}
            userFaculty={user?.faculty}
        />
    );
}
