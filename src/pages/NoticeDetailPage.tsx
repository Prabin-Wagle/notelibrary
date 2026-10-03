import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Loader2, ArrowLeft, Calendar, Clock } from 'lucide-react';
import localData from '../data/localData';
import BlogContentRenderer from '../components/BlogContentRenderer';

interface Blog {
    id: number;
    title: string;
    slug: string;
    excerpt: string;
    thumbnail: string;
    class: string;
    faculty: string;
    exam_type: string;
    content: string;
    created_at: string;
    updated_at: string;
}



export default function NoticeDetailPage() {
    const { slug } = useParams<{ slug: string }>();
    const navigate = useNavigate();
    const [blog, setBlog] = useState<Blog | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const loadBlog = async () => {
            if (!slug) {
                navigate('/notices');
                return;
            }

            setLoading(true);

            try {
                const response = await localData.get(`blog?slug=${slug}`);

                if (response.data.status === 'true' && response.data.data) {
                    setBlog(response.data.data);
                } else {
                    navigate('/notices');
                }
            } catch (error) {
                console.error('Error fetching blog:', error);
                navigate('/notices');
            }

            setLoading(false);
        };

        loadBlog();
    }, [slug, navigate]);



    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <div className="text-center">
                    <Loader2 className="h-12 w-12 animate-spin text-blue-600 dark:text-blue-400 mx-auto mb-4" />
                    <p className="text-gray-600 dark:text-gray-400 font-medium">Loading notice...</p>
                </div>
            </div>
        );
    }

    if (!blog) {
        return null;
    }

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            {/* Header */}
            <button
                onClick={() => navigate('/notices')}
                className="flex items-center text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors font-medium"
            >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Notices
            </button>

            {/* Article */}
            <article className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-800 overflow-hidden transition-colors">
                {/* Thumbnail */}
                {blog.thumbnail && (
                    <div className="h-96 overflow-hidden bg-gray-100 dark:bg-gray-800 border-b border-gray-100 dark:border-gray-800">
                        <img
                            src={blog.thumbnail}
                            alt={blog.title}
                            className="w-full h-full object-cover"
                        />
                    </div>
                )}

                <div className="p-8">
                    {/* Meta */}
                    <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500 dark:text-gray-400 mb-6">
                        <div className="flex items-center space-x-2 bg-gray-50 dark:bg-gray-800 px-3 py-1.5 rounded-lg">
                            <Calendar className="h-4 w-4" />
                            <span className="font-medium">{formatDate(blog.created_at)}</span>
                        </div>
                        {blog.updated_at && blog.updated_at !== blog.created_at && (
                            <div className="flex items-center space-x-2 bg-gray-50 dark:bg-gray-800 px-3 py-1.5 rounded-lg">
                                <Clock className="h-4 w-4" />
                                <span className="font-medium">Updated {formatDate(blog.updated_at)}</span>
                            </div>
                        )}
                        {blog.exam_type && (
                            <span className="bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider">
                                {blog.exam_type}
                            </span>
                        )}
                        {blog.class && (
                            <span className="bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider">
                                {blog.class} - {blog.faculty}
                            </span>
                        )}
                    </div>

                    {/* Title */}
                    <h1 className="text-4xl font-black text-gray-900 dark:text-white mb-6 leading-tight">
                        {blog.title}
                    </h1>

                    {/* Excerpt */}
                    {blog.excerpt && (
                        <p className="text-xl text-gray-600 dark:text-gray-400 mb-8 pb-8 border-b border-gray-100 dark:border-gray-800 font-medium italic">
                            {blog.excerpt}
                        </p>
                    )}

                    {/* TinyMCE Content */}
                    {/* TinyMCE Content - Now rendered via BlogContentRenderer for interactive PDFs */}
                    <div className="tinymce-content text-lg dark:text-gray-200">
                        <BlogContentRenderer content={blog.content} />
                    </div>
                </div>
            </article>
        </div>
    );
}
