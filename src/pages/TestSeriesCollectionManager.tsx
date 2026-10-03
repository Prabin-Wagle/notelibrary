import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Plus, Edit2, Trash2, X } from 'lucide-react';
import axios from 'axios';
import { DashboardLayout } from '../components/DashboardLayout';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

const API_URL = 'https://notelibraryapp.com/api/admin/testSeriesCollection.php';

interface TestSeriesCollection {
    id: number;
    title: string;
    competitive_exam: 'IOE' | 'CEE' | 'OTHER';
    description: string;
    price: number | string | null;
    discount_price: number | string | null;
    image_url: string | null;
    created_at: string;
    updated_at: string;
}

const COMPETITIVE_EXAMS = ['IOE', 'CEE', 'OTHER'] as const;

const parsePrice = (value: number | string | null | undefined): number | null => {
    if (value === null || value === undefined || value === '') return null;
    const parsed = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(parsed) ? parsed : null;
};

export default function TestSeriesCollectionManager() {
    const { token } = useAuth();
    const [collections, setCollections] = useState<TestSeriesCollection[]>([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingCollection, setEditingCollection] = useState<TestSeriesCollection | null>(null);
    const [loading, setLoading] = useState(false);

    const [formData, setFormData] = useState({
        title: '',
        description: '',
        competitive_exam: '' as '' | 'IOE' | 'CEE' | 'OTHER',
        image_url: '',
        price: '',
        discount_price: ''
    });

    const fetchCollections = useCallback(async () => {
        try {
            const response = await axios.get(API_URL, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (response.data.success) {
                setCollections(response.data.data);
            }
        } catch (error) {
            console.error('Error fetching collections:', error);
        }
    }, [token]);

    useEffect(() => {
        void fetchCollections();
    }, [fetchCollections]);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        const payload = {
            title: formData.title,
            description: formData.description,
            competitive_exam: formData.competitive_exam,
            image_url: formData.image_url || null,
            price: formData.price ? parseFloat(formData.price) : 0,
            discount_price: formData.discount_price ? parseFloat(formData.discount_price) : null
        };

        try {
            if (editingCollection) {
                await axios.put(API_URL, { ...payload, id: editingCollection.id }, {
                    headers: { Authorization: `Bearer ${token}` }
                });
            } else {
                await axios.post(API_URL, payload, {
                    headers: { Authorization: `Bearer ${token}` }
                });
            }

            await fetchCollections();
            resetForm();
            setIsModalOpen(false);
            toast.success(editingCollection ? 'Collection updated' : 'Collection created');
        } catch (error) {
            console.error('Error saving collection:', error);
            toast.error('Could not save this collection. Check the fields and try again.');
        } finally {
            setLoading(false);
        }
    };

    const handleEdit = (collection: TestSeriesCollection) => {
        setEditingCollection(collection);
        setFormData({
            title: collection.title,
            description: collection.description,
            competitive_exam: collection.competitive_exam,
            image_url: collection.image_url || '',
            price: collection.price?.toString() || '',
            discount_price: collection.discount_price?.toString() || ''
        });
        setIsModalOpen(true);
    };

    const handleDelete = async (id: number) => {
        if (!confirm('Are you sure you want to delete this collection? All test series in it will also be deleted.')) {
            return;
        }

        try {
            await axios.delete(`${API_URL}?id=${id}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            await fetchCollections();
        } catch (error) {
            console.error('Error deleting collection:', error);
            toast.error('Could not delete this collection. Please try again.');
        }
    };

    const resetForm = () => {
        setFormData({
            title: '',
            description: '',
            competitive_exam: '',
            image_url: '',
            price: '',
            discount_price: ''
        });
        setEditingCollection(null);
    };

    return (
        <DashboardLayout>
            <div className="p-6">
                <div className="flex justify-between items-center mb-6">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900">Test Series Collections</h1>
                        <p className="text-gray-600 mt-1">Organize premium test series by competitive exam</p>
                    </div>
                    <button
                        onClick={() => {
                            resetForm();
                            setIsModalOpen(true);
                        }}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                        <Plus size={20} />
                        Create Collection
                    </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {collections.map(collection => {
                        const price = parsePrice(collection.price);
                        const discountPrice = parsePrice(collection.discount_price);

                        return (
                        <div key={collection.id} className="bg-white rounded-lg shadow-md overflow-hidden">
                            {collection.image_url && (
                                <img
                                    src={collection.image_url}
                                    alt={collection.title}
                                    className="w-full h-40 object-cover"
                                />
                            )}
                            <div className="p-4">
                                <div className="flex items-center gap-2 mb-2">
                                    <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full font-medium">
                                        {collection.competitive_exam}
                                    </span>
                                </div>
                                <h3 className="text-lg font-semibold text-gray-900 mb-1">{collection.title}</h3>
                                <p className="text-gray-600 text-sm mb-3 line-clamp-2">{collection.description}</p>

                                <div className="flex items-center gap-2 mb-4">
                                    {discountPrice !== null && discountPrice >= 0 ? (
                                        <>
                                            <span className="text-lg font-bold text-green-600">
                                                {discountPrice === 0 ? 'FREE' : `NPR ${discountPrice.toFixed(2)}`}
                                            </span>
                                            {price !== null && discountPrice < price && (
                                                <span className="text-sm text-gray-400 line-through">
                                                    NPR {price.toFixed(2)}
                                                </span>
                                            )}
                                        </>
                                    ) : (
                                        <span className="text-lg font-bold text-green-600">
                                            {price === 0 ? 'FREE' : price === null ? 'Price unavailable' : `NPR ${price.toFixed(2)}`}
                                        </span>
                                    )}
                                </div>

                                <div className="flex gap-2">
                                    <button
                                        onClick={() => handleEdit(collection)}
                                        className="flex-1 flex items-center justify-center gap-1 px-3 py-2 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors text-sm"
                                    >
                                        <Edit2 size={14} />
                                        Edit
                                    </button>
                                    <button
                                        onClick={() => handleDelete(collection.id)}
                                        className="flex-1 flex items-center justify-center gap-1 px-3 py-2 bg-red-100 text-red-700 rounded hover:bg-red-200 transition-colors text-sm"
                                    >
                                        <Trash2 size={14} />
                                        Delete
                                    </button>
                                </div>
                            </div>
                        </div>
                    );
                    })}

                    {collections.length === 0 && (
                        <div className="col-span-full text-center py-12 bg-white rounded-lg shadow-md">
                            <p className="text-gray-500 text-lg">No collections found. Create your first collection!</p>
                        </div>
                    )}
                </div>

                {isModalOpen && createPortal(
                    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm" onMouseDown={(event) => { if (event.target === event.currentTarget && !loading) { setIsModalOpen(false); resetForm(); } }}>
                        <section role="dialog" aria-modal="true" aria-labelledby="collection-dialog-title" className="flex max-h-[min(90dvh,780px)] w-full max-w-2xl flex-col overflow-hidden rounded-3xl border border-white/70 bg-white shadow-[0_32px_100px_-32px_rgba(15,23,42,0.55)]">
                            <header className="flex items-start justify-between border-b border-gray-100 px-6 py-5 sm:px-7">
                                <div>
                                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-teal-700">Assessment workspace</p>
                                    <h2 id="collection-dialog-title" className="mt-1 text-xl font-bold text-gray-900 sm:text-2xl">
                                        {editingCollection ? 'Edit test collection' : 'Create test collection'}
                                    </h2>
                                    <p className="mt-1 text-sm text-gray-500">Set its exam, display details, and student pricing.</p>
                                </div>
                                <button
                                    type="button"
                                    disabled={loading}
                                    aria-label="Close collection editor"
                                    onClick={() => { setIsModalOpen(false); resetForm(); }}
                                    className="rounded-xl p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700 disabled:opacity-40"
                                >
                                    <X size={20} />
                                </button>
                            </header>

                            <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
                                <div className="space-y-5 overflow-y-auto px-6 py-5 sm:px-7">
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-1.5" htmlFor="collection-title">Title</label>
                                    <input
                                        type="text"
                                        name="title"
                                        id="collection-title"
                                        value={formData.title}
                                        onChange={handleInputChange}
                                        placeholder="e.g. IOE Engineering Entrance 2083"
                                        required
                                        className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3.5 py-3 text-sm text-gray-900 placeholder:text-gray-400 transition focus:border-teal-600 focus:bg-white focus:outline-none focus:ring-4 focus:ring-teal-600/10"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-1.5" htmlFor="collection-description">Description</label>
                                    <textarea
                                        name="description"
                                        id="collection-description"
                                        value={formData.description}
                                        onChange={handleInputChange}
                                        rows={3}
                                        placeholder="A short note about the practice sets in this collection"
                                        className="w-full resize-y rounded-xl border border-gray-200 bg-gray-50 px-3.5 py-3 text-sm leading-6 text-gray-900 placeholder:text-gray-400 transition focus:border-teal-600 focus:bg-white focus:outline-none focus:ring-4 focus:ring-teal-600/10"
                                    />
                                </div>

                                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                    <div>
                                        <label className="block text-sm font-semibold text-gray-700 mb-1.5" htmlFor="collection-exam">Competitive exam</label>
                                        <select
                                            name="competitive_exam"
                                            id="collection-exam"
                                            value={formData.competitive_exam}
                                            onChange={handleInputChange}
                                            required
                                            className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3.5 py-3 text-sm text-gray-900 transition focus:border-teal-600 focus:bg-white focus:outline-none focus:ring-4 focus:ring-teal-600/10"
                                        >
                                            <option value="">Select competitive exam</option>
                                            {COMPETITIVE_EXAMS.map(exam => (
                                                <option key={exam} value={exam}>{exam}</option>
                                            ))}
                                        </select>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-semibold text-gray-700 mb-1.5" htmlFor="collection-image">Image URL <span className="font-normal text-gray-400">(optional)</span></label>
                                        <input
                                            type="url"
                                            name="image_url"
                                            id="collection-image"
                                            value={formData.image_url}
                                            onChange={handleInputChange}
                                            placeholder="https://example.com/banner.png"
                                            className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3.5 py-3 text-sm text-gray-900 placeholder:text-gray-400 transition focus:border-teal-600 focus:bg-white focus:outline-none focus:ring-4 focus:ring-teal-600/10"
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                    <div>
                                        <label className="block text-sm font-semibold text-gray-700 mb-1.5" htmlFor="collection-price">List price (NPR)</label>
                                        <input
                                            type="number"
                                            name="price"
                                            id="collection-price"
                                            value={formData.price}
                                            onChange={handleInputChange}
                                            required
                                            min="0"
                                            step="0.01"
                                            className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3.5 py-3 text-sm text-gray-900 transition focus:border-teal-600 focus:bg-white focus:outline-none focus:ring-4 focus:ring-teal-600/10"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-semibold text-gray-700 mb-1.5" htmlFor="collection-discount">Offer price (NPR) <span className="font-normal text-gray-400">(optional)</span></label>
                                        <input
                                            type="number"
                                            name="discount_price"
                                            id="collection-discount"
                                            value={formData.discount_price}
                                            onChange={handleInputChange}
                                            min="0"
                                            step="0.01"
                                            className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3.5 py-3 text-sm text-gray-900 transition focus:border-teal-600 focus:bg-white focus:outline-none focus:ring-4 focus:ring-teal-600/10"
                                        />
                                    </div>
                                </div>

                                </div>
                                <footer className="flex flex-col-reverse gap-2 border-t border-gray-100 bg-gray-50/70 px-6 py-4 sm:flex-row sm:justify-end sm:px-7">
                                    <button type="button" disabled={loading} onClick={() => { setIsModalOpen(false); resetForm(); }} className="rounded-xl border border-gray-200 bg-white px-5 py-2.5 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50">Cancel</button>
                                    <button type="submit" disabled={loading} className="rounded-xl bg-teal-700 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-teal-800 disabled:cursor-wait disabled:opacity-60">
                                        {loading ? 'Saving…' : editingCollection ? 'Save changes' : 'Create collection'}
                                    </button>
                                </footer>
                            </form>
                        </section>
                    </div>,
                    document.body,
                )}
            </div>
        </DashboardLayout>
    );
}
