import { Resource, Subject } from '../types/resources';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, FileText, ExternalLink } from 'lucide-react';
import { getResourceFileUrl, getResourceReaderPath, getResourceTitle } from '../utils/resourceRoutes';

interface CompetitiveSubjectDetailsProps {
    subjectName: string;
    subject?: Subject;
    resources: Resource[];
}

export default function CompetitiveSubjectDetails({ subjectName, subject, resources }: CompetitiveSubjectDetailsProps) {
    const navigate = useNavigate();

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <button
                    onClick={() => navigate('/subjects')}
                    className="flex items-center text-gray-600 hover:text-gray-900 mb-4 transition-colors"
                >
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Back to Subjects
                </button>

                <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl p-8 text-white">
                    <h1 className="text-3xl font-bold mb-2">{decodeURIComponent(subjectName || '')}</h1>
                    {subject?.subject_code && (
                        <span className="inline-block mt-3 bg-white/20 backdrop-blur-sm px-3 py-1 rounded-full text-sm">
                            {subject.subject_code}
                        </span>
                    )}
                </div>
            </div>

            {/* Resource List */}
            {resources.length === 0 ? (
                <div className="text-center py-12 bg-white rounded-lg shadow-sm border border-gray-200">
                    <div className="text-6xl mb-4">📚</div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">
                        No Resources Available
                    </h3>
                    <p className="text-gray-600">
                        Resources for this subject will be added soon.
                    </p>
                </div>
            ) : (
                <div className="grid grid-cols-1 gap-4">
                    {resources.map((resource) => (
                        <div key={resource.id} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 transition-all hover:shadow-md">
                            <div className="flex items-start justify-between">
                                <div className="flex-1">
                                    <div className="flex items-center space-x-3 mb-2">
                                        <div className="p-2 rounded-lg bg-blue-100">
                                            <FileText className="h-5 w-5 text-blue-700" />
                                        </div>
                                        <div>
                                            <h3 className="text-lg font-semibold text-gray-900">{resource.chapterName}</h3>
                                            <p className="text-sm text-blue-700 font-medium">{resource.chapter}</p>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center space-x-3 ml-4">
                                    <button
                                        onClick={() => navigate(getResourceReaderPath(getResourceTitle(resource)), {
                                            state: {
                                                resource,
                                                title: getResourceTitle(resource),
                                                fileUrl: getResourceFileUrl(resource),
                                                backUrl: `/competitive/${encodeURIComponent(subjectName)}`,
                                            }
                                        })}
                                        className="flex items-center px-4 py-2 rounded-lg text-white text-sm font-medium transition-colors bg-blue-600 hover:bg-blue-700"
                                    >
                                        <ExternalLink className="h-4 w-4 mr-2" />
                                        Open Resource
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
