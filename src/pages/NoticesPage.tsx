import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, Bell, Calendar, ArrowRight } from 'lucide-react';
import localData from '../data/localData';

interface Blog {
    id: number;
    title: string;
    slug: string;
    excerpt: string;
    thumbnail: string;
    class: string;
    faculty: string;
    exam_type: string;
    created_at: string;
    updated_at: string;
}



export default function NoticesPage() {
    const navigate = useNavigate();
    const [blogs, setBlogs] = useState<Blog[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const loadBlogs = async () => {
            setLoading(true);

            try {
                const response = await localData.get(`blogs`);

                if (response.data.status === 'true' && response.data.data) {
                    setBlogs(response.data.data);
                } else {
                    setBlogs([]);
                }
            } catch (error) {
                console.error('Error fetching blogs:', error);
                setBlogs([]);
            }

            setLoading(false);
        };

        loadBlogs();
    }, []);

    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <div className="text-center">
                    <Loader2 className="h-12 w-12 animate-spin text-blue-600 dark:text-blue-400 mx-auto mb-4" />
                    <p className="text-gray-600 dark:text-gray-400">Loading notices...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl p-8 text-white">
                <div className="flex items-center space-x-3 mb-2">
                    <Bell className="h-8 w-8" />
                    <h1 className="text-3xl font-bold">Notices & Updates</h1>
                </div>
                <p className="text-blue-100">
                    Stay updated with the latest news, announcements, and important information.
                </p>
            </div>

            {/* Blogs List */}
            {blogs.length === 0 ? (
                <div className="text-center py-12 bg-white dark:bg-gray-900 rounded-lg shadow-sm border border-gray-200 dark:border-gray-800">
                    <div className="text-6xl mb-4 text-gray-300 dark:text-gray-700">📢</div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                        No Notices Available
                    </h3>
                    <p className="text-gray-600 dark:text-gray-400">
                        Check back later for new updates and announcements.
                    </p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {blogs.map((blog) => (
                        <div
                            key={blog.id}
                            onClick={() => navigate(`/notices/${blog.slug}`)}
                            className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800 overflow-hidden cursor-pointer transition-all hover:shadow-lg dark:hover:shadow-blue-900/20 hover:-translate-y-1 group"
                        >
                            {/* Thumbnail */}
                            <div className="h-48 overflow-hidden bg-gray-200 dark:bg-gray-800">
                                <img
                                    src={blog.thumbnail}
                                    alt={blog.title}
                                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                                    onError={(e) => {
                                        (e.target as HTMLImageElement).style.display = 'none';
                                    }}
                                />
                            </div>

                            {/* Content */}
                            <div className="p-6 text-gray-900 dark:text-white">
                                <div className="flex items-center space-x-2 text-xs text-gray-500 dark:text-gray-400 mb-3">
                                    <Calendar className="h-3 w-3" />
                                    <span>{formatDate(blog.created_at)}</span>
                                    {blog.class && blog.class !== 'All' && (
                                        <>
                                            <span>•</span>
                                            <span className="bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 px-2 py-0.5 rounded">
                                                {blog.class} {blog.faculty !== 'All' ? `- ${blog.faculty}` : ''}
                                            </span>
                                        </>
                                    )}
                                    {blog.exam_type && blog.exam_type !== 'All' && (
                                        <>
                                            <span>•</span>
                                            <span className="bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded">
                                                {blog.exam_type}
                                            </span>
                                        </>
                                    )}
                                </div>

                                <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2 line-clamp-2 transition-colors">
                                    {blog.title}
                                </h2>

                                <p className="text-gray-600 dark:text-gray-400 text-sm line-clamp-3 mb-4">
                                    {blog.excerpt}
                                </p>

                                <div className="flex items-center text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium transition-colors">
                                    Read More
                                    <ArrowRight className="h-4 w-4 ml-2 group-hover:translate-x-1 transition-transform" />
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
