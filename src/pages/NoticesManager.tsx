import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { Plus, Trash2, Edit, RefreshCw, Eye, Search, Filter, X } from 'lucide-react';
import TextEditor from '../components/TextEditor';
import BlogContentRenderer from '../components/BlogContentRenderer';

import { useAuth } from '../context/AuthContext';
import { DashboardLayout } from '../components/DashboardLayout';

// Matching fields from blogs (1).sql
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
    status: 'draft' | 'published';
    created_at: string;
    updated_at: string;
}

export default function NoticesManager() {
    const { token } = useAuth();
    const [classes, setClasses] = useState<string[]>([]);
    const [faculties, setFaculties] = useState<string[]>([]);
    const [exams, setExams] = useState<any[]>([]);
    const [blogs, setBlogs] = useState<Blog[]>([]);
    const [loading, setLoading] = useState(false);
    const [viewMode, setViewMode] = useState<'list' | 'create' | 'edit'>('list');

    // Form States
    const [currentId, setCurrentId] = useState<number | null>(null);
    const [title, setTitle] = useState('');
    const [slug, setSlug] = useState('');
    const [excerpt, setExcerpt] = useState('');
    const [thumbnail, setThumbnail] = useState('');
    const [content, setContent] = useState('');
    const [status, setStatus] = useState<'draft' | 'published'>('draft');
    const [selectedClass, setSelectedClass] = useState('');
    const [selectedFaculty, setSelectedFaculty] = useState('');
    const [selectedExam, setSelectedExam] = useState('');

    const editorRef = useRef<any>(null);

    // Filter
    const [filterText, setFilterText] = useState('');

    // Review & Resource Upload States
    const [resourceFile, setResourceFile] = useState<File | null>(null);
    const [uploadingResource, setUploadingResource] = useState(false);
    const [uploadedResourceUrl, setUploadedResourceUrl] = useState(''); // Keep for backward compat/quick view

    // Asset Library State
    const [showAssetModal, setShowAssetModal] = useState(false);
    const [serverAssets, setServerAssets] = useState<any[]>([]);
    const [loadingAssets, setLoadingAssets] = useState(false);

    const fetchServerAssets = async () => {
        setLoadingAssets(true);
        try {
            const response = await axios.get('https://notelibraryapp.com/api/admin/get_notice_resources.php', {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (response.data.success) {
                setServerAssets(response.data.files);
            }
        } catch (error) {
            console.error('Error fetching assets:', error);
        } finally {
            setLoadingAssets(false);
        }
    };

    const handleInsertAsset = (url: string, type: string) => {
        if (!editorRef.current) {
            alert('Editor not ready');
            return;
        }

        let embedHtml = '';
        const ext = type.toLowerCase();

        if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) {
            embedHtml = `<img src="${url}" alt="Image" style="max-width: 100%; height: auto; display: block; margin: 10px 0;" />`;
        } else if (['mp4', 'webm'].includes(ext)) {
            embedHtml = `
                <div style="max-width: 100%; margin: 10px 0;">
                    <video controls width="100%" style="display: block;">
                        <source src="${url}" type="video/${ext}">
                        Your browser does not support the video tag.
                    </video>
                </div>
            `;
        } else if (ext === 'pdf' || url.toLowerCase().endsWith('.pdf')) {
            const parts = url.split('/');
            const filename = parts[parts.length - 1];
            embedHtml = `
                <div class="pdf-viewer-placeholder" data-pdf-url="${url}" style="width: 100%; padding: 18px 20px; margin: 20px 0; border: 1px solid #cbd5e1; border-radius: 12px; background: #f8fafc; color: #0f172a;">
                    <strong style="display: block; margin-bottom: 10px;">PDF document inserted:</strong>
                    <a href="${url}" target="_blank" rel="noopener noreferrer" style="color: #2563eb; text-decoration: underline;">${filename}</a>
                    <p style="margin: 8px 0 0; color: #475569; font-size: 13px;">This PDF will render using the React PDF viewer in the public preview.</p>
                </div>
                <p>&nbsp;</p>
            `;
        } else {
            // Generic link
            const parts = url.split('/');
            const filename = parts[parts.length - 1];
            embedHtml = `<a href="${url}" target="_blank" class="text-indigo-600 hover:underline">${filename}</a>`;
        }

        editorRef.current.insertContent(embedHtml);
        setShowAssetModal(false); // Close modal if open
        alert('Asset inserted!');
    };


    const handleUploadResource = async () => {
        if (!resourceFile || !token) return;

        // 25MB Limit Check
        if (resourceFile.size > 25 * 1024 * 1024) {
            alert('File is too large. Max size is 25MB.');
            return;
        }

        setUploadingResource(true);
        const formData = new FormData();
        formData.append('resource', resourceFile);

        try {
            const response = await axios.post('https://notelibraryapp.com/api/admin/upload_notice_resource.php', formData, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'multipart/form-data'
                }
            });

            if (response.data.success) {
                setUploadedResourceUrl(response.data.url);
                setResourceFile(null); // Clear file input
                // Add to server assets list immediately
                setServerAssets(prev => [{
                    name: response.data.name,
                    original_name: resourceFile.name,
                    url: response.data.url,
                    type: response.data.name.split('.').pop(),
                    date: Date.now() / 1000,
                    size: resourceFile.size
                }, ...prev]);
            } else {
                alert('Upload failed: ' + response.data.message);
            }
        } catch (error) {
            console.error('Upload error:', error);
            alert('Failed to upload file');
        } finally {
            setUploadingResource(false);
        }
    };

    // handleEmbedPdf removed as it is replaced by generic handleInsertAsset

    const handleDeleteAsset = async (filename: string) => {
        if (!confirm('Are you sure you want to delete this asset?')) return;

        try {
            const response = await axios.post('https://notelibraryapp.com/api/admin/delete_notice_resource.php',
                { filename },
                { headers: { Authorization: `Bearer ${token}` } }
            );

            if (response.data.success) {
                setServerAssets(prev => prev.filter(asset => asset.name !== filename));
                // If the deleted asset was the last uploaded one, clear the preview
                if (uploadedResourceUrl.includes(filename)) {
                    setUploadedResourceUrl('');
                }
            } else {
                alert('Failed to delete: ' + response.data.message);
            }
        } catch (error) {
            console.error('Delete error:', error);
            alert('Failed to delete asset');
        }
    };

    // Preview
    const [previewBlog, setPreviewBlog] = useState<Blog | null>(null);

    useEffect(() => {
        if (token) {
            fetchBlogs();
            fetchAdminMetadata();
        }
    }, [token]);

    const fetchAdminMetadata = async () => {
        try {
            // Fetch Classes and Faculties
            const initRes = await axios.get('https://notelibraryapp.com/api/admin/subjects.php', {
                params: { action: 'init' },
                headers: { Authorization: `Bearer ${token}` }
            });
            if (initRes.data.success) {
                setClasses(initRes.data.classes.filter((c: string) => c.toLowerCase() !== 'none'));
                setFaculties(initRes.data.faculties.filter((f: string) => f.toLowerCase() !== 'none'));
            }

            // Fetch Exams
            const examRes = await axios.get('https://notelibraryapp.com/api/admin/subjects.php', {
                params: { action: 'exams' },
                headers: { Authorization: `Bearer ${token}` }
            });
            if (examRes.data.success) {
                setExams(examRes.data.exams);
            }
        } catch (error) {
            console.error('Failed to fetch admin metadata:', error);
        }
    };

    const fetchBlogs = async () => {
        setLoading(true);
        try {
            const response = await axios.get('https://notelibraryapp.com/api/admin/getBlogs.php', {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (response.data.success) {
                setBlogs(response.data.blogs);
            }
        } catch (error) {
            console.error('Error fetching blogs:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async () => {
        if (!title || !slug || !content) {
            alert('Title, Slug and Content are required');
            return;
        }

        const payload = {
            title,
            slug,
            excerpt,
            thumbnail,
            class: selectedClass,
            faculty: selectedFaculty,
            exam_type: selectedExam,
            content,
            status
        };

        try {
            if (viewMode === 'edit' && currentId) {
                await axios.post('https://notelibraryapp.com/api/admin/updateBlog.php',
                    { ...payload, id: currentId },
                    { headers: { Authorization: `Bearer ${token}` } }
                );
            } else {
                await axios.post('https://notelibraryapp.com/api/admin/createBlog.php',
                    payload,
                    { headers: { Authorization: `Bearer ${token}` } }
                );
            }
            fetchBlogs();
            resetForm();
            setViewMode('list');
        } catch (error) {
            alert('Failed to save notice');
            console.error(error);
        }
    };

    const handleDelete = async (id: number) => {
        if (!confirm('Are you sure you want to delete this notice?')) return;
        try {
            await axios.post('https://notelibraryapp.com/api/admin/deleteBlog.php',
                { id },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            fetchBlogs();
        } catch (error) {
            alert('Failed to delete notice');
        }
    };

    const handleEdit = (blog: Blog) => {
        setCurrentId(blog.id);
        setTitle(blog.title);
        setSlug(blog.slug);
        setExcerpt(blog.excerpt);
        setThumbnail(blog.thumbnail);
        setContent(blog.content);
        setStatus(blog.status);
        setSelectedClass(blog.class);
        setSelectedFaculty(blog.faculty);
        setSelectedExam(blog.exam_type);

        // Try to extract uploaded resource URL from content (iframe src) to repopulate Asset Manager
        const iframeMatch = blog.content.match(/<iframe[^>]+src="([^"]+)"/);
        if (iframeMatch && iframeMatch[1]) {
            setUploadedResourceUrl(iframeMatch[1]);
        } else {
            setUploadedResourceUrl('');
        }

        setViewMode('edit');
    };

    const resetForm = () => {
        setCurrentId(null);
        setTitle('');
        setSlug('');
        setExcerpt('');
        setThumbnail('');
        setContent('');
        setStatus('draft');
        setSelectedClass('');
        setSelectedFaculty('');
        setSelectedExam('');
        setResourceFile(null);
        setUploadedResourceUrl('');
    };

    const togglePreview = (blog: Blog) => {
        setPreviewBlog(blog);
    };

    const filteredBlogs = blogs.filter(b => b.title.toLowerCase().includes(filterText.toLowerCase()));

    // Inject TinyMCE CSS for preview
    useEffect(() => {
        if (previewBlog) {
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = '/tinymce/skins/content/default/content.min.css';
            document.head.appendChild(link);
            return () => {
                document.head.removeChild(link);
            };
        }
    }, [previewBlog]);

    if (previewBlog) {
        return (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                <div className="bg-slate-900 rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col border border-slate-700">
                    <div className="p-6 border-b border-slate-700 flex justify-between items-start bg-slate-800">
                        <div>
                            <h2 className="text-2xl font-bold text-white">{previewBlog.title}</h2>
                            <div className="flex gap-2 text-sm text-gray-400 mt-1">
                                <span className={`px-2 py-0.5 rounded-full text-xs ${previewBlog.status === 'published' ? 'bg-green-900 text-green-400' : 'bg-yellow-900 text-yellow-400'}`}>
                                    {previewBlog.status.toUpperCase()}
                                </span>
                                <span>{new Date(previewBlog.created_at).toLocaleDateString()}</span>
                            </div>
                        </div>
                        <button
                            onClick={() => setPreviewBlog(null)}
                            className="text-gray-400 hover:text-white p-2 rounded-full hover:bg-slate-700 transition-colors"
                        >
                            <X size={24} />
                        </button>
                    </div>
                    {previewBlog.thumbnail && (
                        <div className="h-56 w-full bg-cover bg-center shrink-0 border-b border-slate-700" style={{ backgroundImage: `url(${previewBlog.thumbnail})` }}></div>
                    )}
                    <div className="p-8 overflow-y-auto bg-white mce-content-body">
                        <BlogContentRenderer content={previewBlog.content} />
                    </div>
                </div>
            </div>
        );
    }

    return (
        <DashboardLayout>
            <div className="p-6">
                <div className="flex justify-between items-center mb-6">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">Notices (Blog System)</h1>
                        <p className="text-gray-600">Create, view, and manage notices via Blog API</p>
                    </div>
                    {viewMode === 'list' && (
                        <button
                            onClick={() => setViewMode('create')}
                            className="bg-indigo-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-indigo-700"
                        >
                            <Plus size={20} /> New Notice
                        </button>
                    )}
                    {viewMode !== 'list' && (
                        <button
                            onClick={() => { setViewMode('list'); resetForm(); }}
                            className="bg-gray-100 text-gray-600 px-4 py-2 rounded-lg hover:bg-gray-200"
                        >
                            Cancel
                        </button>
                    )}
                </div>

                {viewMode === 'list' ? (
                    <div className="space-y-4">
                        <div className="flex gap-4">
                            <div className="relative flex-1">
                                <Search className="absolute left-3 top-2.5 text-gray-400" size={20} />
                                <input
                                    type="text"
                                    placeholder="Search notices..."
                                    value={filterText}
                                    onChange={(e) => setFilterText(e.target.value)}
                                    className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-indigo-500 outline-none"
                                />
                            </div>
                        </div>

                        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                            <table className="w-full text-left">
                                <thead className="bg-gray-50 text-gray-600 text-sm font-medium">
                                    <tr>
                                        <th className="px-6 py-4">Title</th>
                                        <th className="px-6 py-4">Status</th>
                                        <th className="px-6 py-4">Date</th>
                                        <th className="px-6 py-4 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {filteredBlogs.length === 0 ? (
                                        <tr>
                                            <td colSpan={4} className="px-6 py-8 text-center text-gray-500">
                                                No notices found.
                                            </td>
                                        </tr>
                                    ) : (
                                        filteredBlogs.map((blog) => (
                                            <tr key={blog.id} className="hover:bg-gray-50">
                                                <td className="px-6 py-4 font-medium text-gray-900">
                                                    <div>{blog.title}</div>
                                                    <div className="text-xs text-gray-500">{blog.slug}</div>
                                                </td>
                                                <td className="px-6 py-4 text-gray-600">
                                                    <span className={`px-2 py-1 rounded-full text-xs font-semibold ${blog.status === 'published' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                                                        {blog.status.toUpperCase()}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 text-gray-600">
                                                    {new Date(blog.created_at).toLocaleDateString()}
                                                </td>
                                                <td className="px-6 py-4 text-right flex justify-end gap-2">
                                                    <button
                                                        onClick={() => togglePreview(blog)}
                                                        className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg"
                                                        title="Preview"
                                                    >
                                                        <Eye size={18} />
                                                    </button>
                                                    <button
                                                        onClick={() => handleEdit(blog)}
                                                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"
                                                        title="Edit"
                                                    >
                                                        <Edit size={18} />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDelete(blog.id)}
                                                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                                                        title="Delete"
                                                    >
                                                        <Trash2 size={18} />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                ) : (
                    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 max-w-4xl mx-auto">
                        <div className="space-y-6">
                            <div className="grid grid-cols-2 gap-6">
                                <div className="col-span-2">
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
                                    <input
                                        type="text"
                                        value={title}
                                        onChange={(e) => setTitle(e.target.value)}
                                        placeholder="Enter notice title"
                                        className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-indigo-500 outline-none"
                                    />
                                </div>
                                <div className="col-span-2 md:col-span-1">
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Slug</label>
                                    <input
                                        type="text"
                                        value={slug}
                                        onChange={(e) => setSlug(e.target.value)}
                                        placeholder="url-slug"
                                        className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-indigo-500 outline-none"
                                    />
                                </div>
                                <div className="col-span-2 md:col-span-1">
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                                    <select
                                        value={status}
                                        onChange={(e) => setStatus(e.target.value as 'draft' | 'published')}
                                        className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-indigo-500 outline-none"
                                    >
                                        <option value="draft">Draft</option>
                                        <option value="published">Published</option>
                                    </select>
                                </div>

                                <div className="col-span-2">
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Thumbnail URL</label>
                                    <input
                                        type="text"
                                        value={thumbnail}
                                        onChange={(e) => setThumbnail(e.target.value)}
                                        placeholder="https://example.com/image.jpg"
                                        className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-indigo-500 outline-none"
                                    />
                                </div>

                                <div className="col-span-2">
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Excerpt</label>
                                    <textarea
                                        value={excerpt}
                                        onChange={(e) => setExcerpt(e.target.value)}
                                        rows={2}
                                        placeholder="Short description..."
                                        className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-indigo-500 outline-none"
                                    />
                                </div>

                                <div className="col-span-2 md:col-span-1">
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Class (Optional)</label>
                                    <select
                                        value={selectedClass}
                                        onChange={(e) => {
                                            const val = e.target.value;
                                            setSelectedClass(val);
                                            if (['Class 8', 'Class 9', 'Class 10'].includes(val)) {
                                                setSelectedFaculty('None');
                                            }
                                        }}
                                        className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-indigo-500 outline-none"
                                    >
                                        <option value="">None</option>
                                        {classes.map(c => (
                                            <option key={c} value={c}>{c}</option>
                                        ))}
                                    </select>
                                </div>
                                {!['Class 8', 'Class 9', 'Class 10'].includes(selectedClass) && (
                                    <div className="col-span-2 md:col-span-1">
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Faculty (Optional)</label>
                                        <select
                                            value={selectedFaculty}
                                            onChange={(e) => setSelectedFaculty(e.target.value)}
                                            className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-indigo-500 outline-none"
                                        >
                                            <option value="">None</option>
                                            {faculties.map(f => (
                                                <option key={f} value={f}>{f}</option>
                                            ))}
                                        </select>
                                    </div>
                                )}
                                <div className="col-span-2 md:col-span-1">
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Exam Type (Optional)</label>
                                    <select
                                        value={selectedExam}
                                        onChange={(e) => setSelectedExam(e.target.value)}
                                        className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-indigo-500 outline-none"
                                    >
                                        <option value="">None</option>
                                        {exams.map(e => (
                                            <option key={e.id} value={e.exam_name}>{e.exam_name}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Content</label>
                                    <TextEditor
                                        ref={editorRef}
                                        value={content}
                                        onChange={setContent}
                                        height={500}
                                    />
                                </div>
                            </div>

                            <div className="flex justify-end gap-3 pt-4">
                                <button
                                    onClick={() => { setViewMode('list'); resetForm(); }}
                                    className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleSubmit}
                                    className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                                >
                                    {viewMode === 'create' ? 'Create Notice' : 'Update Notice'}
                                </button>
                            </div>
                        </div>

                        {/* Asset Manager Sidebar / Section */}
                        <div className="mt-8 pt-8 border-t border-gray-200">
                            <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                                <Filter size={20} /> Asset Manager
                            </h3>

                            <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                                <p className="text-sm text-gray-600 mb-4">
                                    Upload images, videos, or documents to get a link. You can then paste this link into the editor above.
                                </p>

                                <div className="flex flex-col md:flex-row gap-4 items-start">
                                    <div className="flex-1 w-full">
                                        <input
                                            type="file"
                                            onChange={(e) => {
                                                if (e.target.files && e.target.files[0]) {
                                                    setResourceFile(e.target.files[0]);
                                                }
                                            }}
                                            className="block w-full text-sm text-gray-500
                                                file:mr-4 file:py-2 file:px-4
                                                file:rounded-full file:border-0
                                                file:text-sm file:font-semibold
                                                file:bg-indigo-50 file:text-indigo-700
                                                hover:file:bg-indigo-100"
                                        />
                                        <p className="text-xs text-gray-500 mt-1">Max size: 25MB. Allowed: Images, Videos, PDFs, Docs.</p>
                                    </div>

                                    <button
                                        onClick={handleUploadResource}
                                        disabled={!resourceFile || uploadingResource}
                                        className={`px-4 py-2 rounded-lg text-white flex items-center gap-2 font-medium
                                            ${!resourceFile || uploadingResource
                                                ? 'bg-gray-400 cursor-not-allowed'
                                                : 'bg-green-600 hover:bg-green-700'}`}
                                    >
                                        {uploadingResource ? <RefreshCw className="animate-spin" size={18} /> : <Plus size={18} />}
                                        {uploadingResource ? 'Uploading...' : 'Upload Asset'}
                                    </button>
                                </div>

                                {uploadedResourceUrl && (
                                    <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg flex flex-col sm:flex-row gap-3 items-center justify-between">
                                        <div className="overflow-hidden w-full">
                                            <p className="text-xs text-green-800 font-semibold mb-1">Last Upload Successful!</p>
                                            <code className="block bg-white px-2 py-1 rounded border border-green-100 text-xs text-gray-600 truncate">
                                                {uploadedResourceUrl}
                                            </code>
                                        </div>
                                        <div className="flex gap-2 shrink-0">
                                            <button
                                                onClick={() => {
                                                    const type = uploadedResourceUrl.split('.').pop() || 'file';
                                                    handleInsertAsset(uploadedResourceUrl, type);
                                                }}
                                                className="px-3 py-1.5 bg-indigo-600 text-white text-sm rounded hover:bg-indigo-700 transition-colors flex items-center gap-1"
                                            >
                                                <Plus size={14} /> Insert
                                            </button>
                                        </div>
                                    </div>
                                )}

                                <button
                                    onClick={() => {
                                        fetchServerAssets();
                                        setShowAssetModal(true);
                                    }}
                                    className="mt-4 w-full py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 flex items-center justify-center gap-2"
                                >
                                    <Search size={16} /> Browse Server Assets ({serverAssets.length > 0 ? serverAssets.length : '...'})
                                </button>
                            </div>
                        </div>

                        {/* Asset Library Modal */}
                        {showAssetModal && (
                            <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                                <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[80vh] flex flex-col">
                                    <div className="p-4 border-b border-gray-200 flex justify-between items-center bg-gray-50 rounded-t-xl">
                                        <h3 className="font-bold text-lg text-gray-800">Asset Library</h3>
                                        <button onClick={() => setShowAssetModal(false)} className="text-gray-500 hover:text-gray-700">
                                            <X size={20} />
                                        </button>
                                    </div>
                                    <div className="flex-1 overflow-y-auto p-4 bg-gray-50">
                                        {loadingAssets ? (
                                            <div className="flex justify-center py-8 text-gray-500">
                                                <RefreshCw className="animate-spin mr-2" /> Loading assets...
                                            </div>
                                        ) : (
                                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                                {serverAssets.length === 0 ? (
                                                    <p className="col-span-full text-center text-gray-500 py-8">No assets found on server.</p>
                                                ) : (
                                                    serverAssets.map((file, idx) => (
                                                        <div key={idx} className="bg-white p-3 rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-shadow group">
                                                            <div className="aspect-square bg-gray-100 rounded mb-2 overflow-hidden flex items-center justify-center relative">
                                                                {['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(file.type) ? (
                                                                    <img src={file.url} alt={file.name} className="w-full h-full object-cover" />
                                                                ) : (
                                                                    <div className="text-gray-400 font-bold text-3xl uppercase">{file.type}</div>
                                                                )}

                                                                {/* Hover Actions */}
                                                                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center p-4">
                                                                    <button
                                                                        onClick={() => handleInsertAsset(file.url, file.type)}
                                                                        className="w-full py-1.5 bg-indigo-600 text-white rounded text-sm font-semibold hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2 mb-2"
                                                                    >
                                                                        <Plus size={16} /> Insert
                                                                    </button>
                                                                    <div className="flex gap-2">
                                                                        <a
                                                                            href={file.url}
                                                                            target="_blank"
                                                                            rel="noreferrer"
                                                                            title="View"
                                                                            className="flex-1 py-1.5 bg-white text-gray-700 rounded text-xs font-medium hover:bg-gray-100 transition-colors flex items-center justify-center"
                                                                        >
                                                                            <Eye size={16} />
                                                                        </a>
                                                                        <button
                                                                            onClick={() => {
                                                                                navigator.clipboard.writeText(file.url);
                                                                                alert('Copied!');
                                                                            }}
                                                                            title="Copy Link"
                                                                            className="flex-1 py-1.5 bg-white text-gray-700 rounded text-xs font-medium hover:bg-gray-100 transition-colors flex items-center justify-center"
                                                                        >
                                                                            <RefreshCw size={14} className="rotate-90" />
                                                                        </button>
                                                                        <button
                                                                            onClick={() => handleDeleteAsset(file.name)}
                                                                            title="Delete"
                                                                            className="flex-1 py-1.5 bg-white text-red-600 rounded text-xs font-medium hover:bg-red-50 transition-colors flex items-center justify-center"
                                                                        >
                                                                            <Trash2 size={16} />
                                                                        </button>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                            <p className="text-xs text-gray-700 truncate font-medium" title={file.name}>{file.name}</p>
                                                            <div className="flex justify-between mt-1 text-[10px] text-gray-500">
                                                                <span>{(file.size / 1024 / 1024).toFixed(2)} MB</span>
                                                                <span>{new Date(file.date * 1000).toLocaleDateString()}</span>
                                                            </div>
                                                        </div>
                                                    ))
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </DashboardLayout>
    );
}
