import { useEffect, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import type { Subject, Resource } from '../types/resources';
import { Loader2 } from 'lucide-react';
import CompetitiveSubjectDetails from '../components/CompetitiveSubjectDetails';
import localData from '../data/localData';

// Get JWT token from localStorage


export default function CompetitiveSubjectPage() {
    const { subjectName } = useParams<{ subjectName: string }>();
    const { user } = useAuth();
    const location = useLocation();
    const navigate = useNavigate();
    const subject = location.state?.subject as Subject | undefined;

    const [resources, setResources] = useState<Resource[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const loadResources = async () => {
            if (!subjectName) {
                setLoading(false);
                return;
            }

            setLoading(true);
            const decodedSubject = decodeURIComponent(subjectName);

            // Determine exam type from subject code or user competition
            let examType: string | undefined = undefined;
            if (subject?.subject_code && ['CEE', 'IOE', 'NEB', 'MBBS', 'BDS'].includes(subject.subject_code)) {
                examType = subject.subject_code;
            } else if (user?.competition && user?.competition !== 'None') {
                examType = user.competition;
            }

            if (!examType) {
                console.error('No exam type found for competitive subject');
                setLoading(false);
                navigate('/subjects');
                return;
            }

            try {
                // Call getcompetitive.php directly
                const formData = new FormData();
                formData.append('exam_type', examType);
                formData.append('subjectName', decodedSubject);

                const response = await localData.post(
                    `competitive-resources`,
                    formData
                );

                if (response.data.status === 'true' && response.data.data) {
                    setResources(response.data.data);
                } else {
                    setResources([]);
                }
            } catch (error) {
                console.error('Error fetching competitive resources:', error);
                setResources([]);
            }

            setLoading(false);
        };

        loadResources();
    }, [user?.competition, subjectName, subject, navigate]);

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <div className="text-center">
                    <Loader2 className="h-12 w-12 animate-spin text-blue-600 dark:text-blue-400 mx-auto mb-4" />
                    <p className="text-gray-600 dark:text-gray-400 font-medium">Loading resources...</p>
                </div>
            </div>
        );
    }

    return (
        <CompetitiveSubjectDetails
            subjectName={subjectName || ''}
            subject={subject}
            resources={resources}
        />
    );
}
