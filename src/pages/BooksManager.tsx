import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Plus, Pencil, Trash2, Search, Book } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { DashboardLayout } from '../components/DashboardLayout';

interface Book {
    id: number;
    title: string;
    drive_link: string;
    description: string;
    class_level: string;
    faculty: string;
    subject: string;
    created_at: string;
}

const API_URL = 'https://notelibraryapp.com/api/admin/books.php';

export default function BooksManager() {
    const { token } = useAuth();
    const [books, setBooks] = useState<Book[]>([]);
    const [classes, setClasses] = useState<string[]>([]);
    const [faculties, setFaculties] = useState<string[]>([]);
    const [availableSubjects, setAvailableSubjects] = useState<string[]>([]);
    const [loading, setLoading] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingBook, setEditingBook] = useState<Book | null>(null);

    // Filter states
    const [selectedClass, setSelectedClass] = useState('');
    const [selectedFaculty, setSelectedFaculty] = useState('');
    const [selectedSubject, setSelectedSubject] = useState('');
    const [searchQuery, setSearchQuery] = useState('');

    // Form states
    const [formData, setFormData] = useState({
        title: '',
        drive_link: '',
        description: '',
        class_level: '',
        faculty: '',
        subject: ''
    });

    useEffect(() => {
        fetchAdminMetadata();
    }, [token]);

    const fetchAdminMetadata = async () => {
        if (!token) return;
        try {
            const response = await axios.get('https://notelibraryapp.com/api/admin/subjects.php', {
                params: { action: 'init' },
                headers: { Authorization: `Bearer ${token}` }
            });
            if (response.data.success) {
                setClasses(response.data.classes.filter((c: string) => c.toLowerCase() !== 'none'));
                setFaculties(response.data.faculties.filter((f: string) => f.toLowerCase() !== 'none'));
            }
        } catch (error) {
            console.error('Failed to fetch admin metadata:', error);
        }
    };

    useEffect(() => {
        fetchBooks();
    }, [selectedClass, selectedFaculty, selectedSubject, token]);

    useEffect(() => {
        const fetchSubjects = async () => {
            const formClass = formData.class_level || selectedClass;
            const formFaculty = formData.faculty || selectedFaculty;

            if (formClass) {
                const normalizedClass = formClass.toLowerCase().replace(/\s+/g, '');
                const normalizedFaculty = formFaculty ? formFaculty.toLowerCase().replace(/\s+/g, '_') : 'none';
                const tableName = `${normalizedClass}_${normalizedFaculty}`;

                try {
                    const response = await axios.get('https://notelibraryapp.com/api/admin/subjects.php', {
                        params: { action: 'subjects', table: tableName },
                        headers: { Authorization: `Bearer ${token}` }
                    });
                    if (response.data.success) {
                        setAvailableSubjects(response.data.subjects.map((s: any) => s.subject_name));
                    } else {
                        setAvailableSubjects([]);
                    }
                } catch (error) {
                    console.error('Failed to fetch subjects:', error);
                    setAvailableSubjects([]);
                }
            } else {
                setAvailableSubjects([]);
            }
        };

        fetchSubjects();
    }, [formData.class_level, formData.faculty, selectedClass, selectedFaculty, token]);

    const fetchBooks = async () => {
        if (!token) return;
        setLoading(true);
        try {
            const params: any = {};
            if (selectedClass) params.class_level = selectedClass;
            if (selectedFaculty) params.faculty = selectedFaculty;
            if (selectedSubject) params.subject = selectedSubject;

            const response = await axios.get(API_URL, {
                params,
                headers: { Authorization: `Bearer ${token}` }
            });

            if (response.data.success) {
                setBooks(response.data.data);
            }
        } catch (error) {
            console.error('Failed to fetch books:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleInputFilterChange = (field: 'class' | 'faculty' | 'subject', value: string) => {
        if (field === 'class') setSelectedClass(value);
        if (field === 'faculty') setSelectedFaculty(value);
        if (field === 'subject') setSelectedSubject(value);
    };

    const handleFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData(prev => {
            const next = { ...prev, [name]: value };
            if (name === 'class_level' && ['Class 8', 'Class 9', 'Class 10'].includes(value)) {
                next.faculty = 'None';
            }
            return next;
        });
    };

    const resetForm = () => {
        setFormData({
            title: '',
            drive_link: '',
            description: '',
            class_level: '',
            faculty: '',
            subject: ''
        });
        setEditingBook(null);
    };

    const openModal = (book?: Book) => {
        if (book) {
            setEditingBook(book);
            setFormData({
                title: book.title,
                drive_link: book.drive_link,
                description: book.description || '',
                class_level: book.class_level,
                faculty: book.faculty,
                subject: book.subject
            });
        } else {
            resetForm();
            setFormData(prev => ({
                ...prev,
                class_level: selectedClass,
                faculty: selectedFaculty,
                subject: selectedSubject
            }));
        }
        setIsModalOpen(true);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!token) return;

        try {
            const payload = { ...formData, id: editingBook?.id };

            if (editingBook) {
                await axios.put(API_URL, payload, {
                    headers: { Authorization: `Bearer ${token}` }
                });
            } else {
                await axios.post(API_URL, payload, {
                    headers: { Authorization: `Bearer ${token}` }
                });
            }

            setIsModalOpen(false);
            fetchBooks();
            resetForm();
        } catch (error) {
            console.error('Failed to save book:', error);
            alert('Failed to save book');
        }
    };

    const handleDelete = async (id: number) => {
        if (!confirm('Are you sure you want to delete this book?')) return;
        if (!token) return;

        try {
            await axios.delete(API_URL, {
                params: { id },
                headers: { Authorization: `Bearer ${token}` }
            });
            fetchBooks();
        } catch (error) {
            console.error('Failed to delete book:', error);
            alert('Failed to delete book');
        }
    };

    const filteredBooks = books.filter(b =>
        b.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        b.subject.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <DashboardLayout>
            <div className="space-y-6">
                <div className="flex justify-between items-center">
                    <h1 className="text-2xl font-bold text-gray-800">Books Manager</h1>
                </div>

                {/* Controls */}
                <div className="bg-white p-4 rounded-lg shadow space-y-4">
                    <div className="flex flex-wrap gap-4">
                        <div className="w-full sm:w-64">
                            <label className="block text-sm font-medium text-gray-700 mb-1">Class</label>
                            <select
                                value={selectedClass}
                                onChange={(e) => {
                                    const val = e.target.value;
                                    setSelectedClass(val);
                                    if (['Class 8', 'Class 9', 'Class 10'].includes(val)) {
                                        setSelectedFaculty('None');
                                    }
                                }}
                                className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                            >
                                <option value="">All Classes</option>
                                {classes.map(c => (
                                    <option key={c} value={c}>{c}</option>
                                ))}
                            </select>
                        </div>

                        {!['Class 8', 'Class 9', 'Class 10'].includes(selectedClass) && (
                            <div className="w-full sm:w-64">
                                <label className="block text-sm font-medium text-gray-700 mb-1">Faculty</label>
                                <select
                                    value={selectedFaculty}
                                    onChange={(e) => handleInputFilterChange('faculty', e.target.value)}
                                    className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                                >
                                    <option value="">All Faculties</option>
                                    {faculties.map(f => (
                                        <option key={f} value={f}>{f}</option>
                                    ))}
                                </select>
                            </div>
                        )}

                        <div className="w-full sm:w-64 self-end flex-grow">
                            <div className="relative">
                                <input
                                    type="text"
                                    placeholder="Search by Title or Subject..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="w-full pl-10 pr-4 py-2 rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                                />
                                <Search className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
                            </div>
                        </div>

                        <button
                            onClick={() => openModal()}
                            className="w-full sm:w-auto self-end px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 flex items-center gap-2"
                        >
                            <Plus size={20} />
                            Add Book
                        </button>
                    </div>
                </div>

                {/* List */}
                {loading ? (
                    <div className="text-center py-12">Loading...</div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {filteredBooks.map((book) => (
                            <div key={book.id} className="bg-white rounded-lg shadow-md p-6 border border-gray-100 hover:shadow-lg transition-shadow">
                                <div className="flex justify-between items-start mb-4">
                                    <div className="p-2 bg-blue-50 rounded-lg">
                                        <Book className="h-6 w-6 text-blue-600" />
                                    </div>
                                    <div className="flex gap-2">
                                        <button onClick={() => openModal(book)} className="text-gray-400 hover:text-indigo-600">
                                            <Pencil size={18} />
                                        </button>
                                        <button onClick={() => handleDelete(book.id)} className="text-gray-400 hover:text-red-600">
                                            <Trash2 size={18} />
                                        </button>
                                    </div>
                                </div>

                                <h3 className="text-lg font-semibold text-gray-800 mb-1">{book.title}</h3>
                                <p className="text-sm text-gray-500 mb-2 truncate">{book.description || 'No description'}</p>

                                <div className="space-y-1 text-sm text-gray-600">
                                    <p><span className="font-medium">Subject:</span> {book.subject}</p>
                                    <p><span className="font-medium">Class:</span> {book.class_level}</p>
                                    <p><span className="font-medium">Faculty:</span> {book.faculty}</p>
                                </div>

                                <a
                                    href={book.drive_link}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="mt-4 block text-center py-2 px-4 border border-indigo-600 text-indigo-600 rounded-md hover:bg-indigo-50 transition-colors"
                                >
                                    View Book
                                </a>
                            </div>
                        ))}
                        {filteredBooks.length === 0 && (
                            <div className="col-span-full text-center py-12 text-gray-500 bg-white rounded-lg">
                                No books found. Try adjusting filters or search.
                            </div>
                        )}
                    </div>
                )}

                {/* Modal */}
                {isModalOpen && (
                    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
                        <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6">
                            <h2 className="text-xl font-bold mb-4">{editingBook ? 'Edit Book' : 'Add Book'}</h2>

                            <form onSubmit={handleSubmit} className="space-y-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700">Class</label>
                                        <select required name="class_level" value={formData.class_level} onChange={handleFormChange} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500">
                                            <option value="">Select Class</option>
                                            {classes.map(c => <option key={c} value={c}>{c}</option>)}
                                        </select>
                                    </div>

                                    {!['Class 8', 'Class 9', 'Class 10'].includes(formData.class_level) && (
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700">Faculty</label>
                                            <select required name="faculty" value={formData.faculty} onChange={handleFormChange} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500">
                                                <option value="">Select Faculty</option>
                                                {faculties.map(f => <option key={f} value={f}>{f}</option>)}
                                            </select>
                                        </div>
                                    )}
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Subject</label>
                                    <select required name="subject" value={formData.subject} onChange={handleFormChange} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500">
                                        <option value="">Select Subject</option>
                                        {availableSubjects.length > 0 ? (
                                            availableSubjects.map(s => <option key={s} value={s}>{s}</option>)
                                        ) : (
                                            <option value="" disabled>Select Class/Faculty first</option>
                                        )}
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Title</label>
                                    <input required type="text" name="title" value={formData.title} onChange={handleFormChange} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500" />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Drive Link</label>
                                    <input required type="url" name="drive_link" value={formData.drive_link} onChange={handleFormChange} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500" />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Description</label>
                                    <textarea name="description" value={formData.description} onChange={handleFormChange} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500" rows={3} />
                                </div>

                                <div className="flex justify-end gap-3 mt-6">
                                    <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50">Cancel</button>
                                    <button type="submit" className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700">Save</button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}
            </div>
        </DashboardLayout>
    );
}
