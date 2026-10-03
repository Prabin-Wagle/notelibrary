import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Loader2, BookOpen, ArrowLeft, ExternalLink } from 'lucide-react';
import localData from '../data/localData';

interface Book {
    id: number;
    chapterName: string;
    chapter: string;
    link: string;
    class: string;
    faculty: string;
    subjectName: string;
}



export default function BooksPage() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [books, setBooks] = useState<Book[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const loadBooks = async () => {
            if (!user?.class || !user?.faculty) {
                setLoading(false);
                return;
            }

            setLoading(true);

            try {
                const formData = new FormData();
                formData.append('class', user.class.toLowerCase().replace(/\s+/g, ''));
                formData.append('faculty', user.faculty.toLowerCase().replace(/\s+/g, ''));

                const response = await localData.post(
                    `books`,
                    formData
                );

                if (response.data.status === 'true' && response.data.data) {
                    setBooks(response.data.data);
                } else {
                    setBooks([]);
                }
            } catch (error) {
                console.error('Error fetching books:', error);
                setBooks([]);
            }

            setLoading(false);
        };

        loadBooks();
    }, [user?.class, user?.faculty]);

    // Group books by subject
    const booksBySubject = books.reduce((acc, book) => {
        if (!acc[book.subjectName]) {
            acc[book.subjectName] = [];
        }
        acc[book.subjectName].push(book);
        return acc;
    }, {} as Record<string, Book[]>);

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <div className="text-center">
                    <Loader2 className="h-12 w-12 animate-spin text-blue-600 dark:text-blue-400 mx-auto mb-4" />
                    <p className="text-gray-600 dark:text-gray-400 font-medium">Loading books...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="animate-in fade-in slide-in-from-top-4 duration-500">
                <button
                    onClick={() => navigate('/subjects')}
                    className="flex items-center text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white mb-6 transition-colors font-medium group"
                >
                    <ArrowLeft className="h-4 w-4 mr-2 group-hover:-translate-x-1 transition-transform" />
                    Back to Study Materials
                </button>

                <div className="bg-gradient-to-r from-red-600 to-pink-600 dark:from-red-700 dark:to-pink-800 rounded-2xl p-8 text-white shadow-lg shadow-red-600/20">
                    <h1 className="text-3xl font-black mb-2">📕 Books</h1>
                    <p className="text-red-100 font-medium opacity-90">
                        {user?.class} • {user?.faculty}
                    </p>
                </div>
            </div>

            {/* Books by Subject */}
            {Object.keys(booksBySubject).length === 0 ? (
                <div className="text-center py-20 bg-white dark:bg-gray-900 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-800 animate-in fade-in zoom-in duration-500">
                    <div className="text-6xl mb-4">📚</div>
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                        No Books Available
                    </h3>
                    <p className="text-gray-600 dark:text-gray-400 font-medium">
                        Books for your class will be added soon.
                    </p>
                </div>
            ) : (
                <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    {Object.entries(booksBySubject).map(([subject, subjectBooks]) => (
                        <div key={subject} className="bg-white dark:bg-gray-900 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-800 p-8 hover:shadow-xl dark:shadow-red-900/5 transition-all">
                            <div className="flex items-center justify-between mb-8">
                                <div className="flex items-center space-x-4">
                                    <div className="p-3.5 rounded-2xl bg-red-50 dark:bg-red-900/30">
                                        <BookOpen className="h-7 w-7 text-red-600 dark:text-red-400" />
                                    </div>
                                    <h2 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight">{subject}</h2>
                                </div>
                                <span className="bg-gray-50 dark:bg-gray-800 text-gray-500 dark:text-gray-400 px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-widest">
                                    {subjectBooks.length} {subjectBooks.length === 1 ? 'book' : 'books'}
                                </span>
                            </div>

                            <div className="grid grid-cols-1 gap-4">
                                {subjectBooks.map((book) => (
                                    <div
                                        key={book.id}
                                        className="flex flex-col sm:flex-row sm:items-center justify-between p-5 bg-gray-50 dark:bg-gray-800/50 rounded-2xl hover:bg-white dark:hover:bg-gray-800 border-2 border-transparent hover:border-red-500/20 dark:hover:border-red-500/20 hover:shadow-lg transition-all group"
                                    >
                                        <div className="flex-1 mb-4 sm:mb-0">
                                            <h3 className="text-lg font-bold text-gray-900 dark:text-white group-hover:text-red-600 dark:group-hover:text-red-400 transition-colors leading-snug">{book.chapterName}</h3>
                                            <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mt-1">{book.chapter}</p>
                                        </div>
                                        <button
                                            onClick={() => navigate('/resource/embed', {
                                                state: {
                                                    resource: book,
                                                    title: book.chapterName
                                                }
                                            })}
                                            className="inline-flex items-center justify-center px-6 py-3 bg-red-600 dark:bg-red-600 text-white rounded-xl hover:bg-red-700 dark:hover:bg-red-500 font-bold transition-all shadow-md hover:shadow-red-600/20 sm:ml-6 group/btn active:scale-95"
                                        >
                                            <ExternalLink className="h-4 w-4 mr-2 group-hover/btn:scale-110 transition-transform" />
                                            View Resource
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
