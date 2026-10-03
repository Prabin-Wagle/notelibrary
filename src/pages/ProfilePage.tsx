import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { User, Mail, Phone, MapPin, GraduationCap, Camera, Save, Edit2, X, Trash2, MousePointer2 } from 'lucide-react';
import { apiRequest } from '../lib/api';
import toast from 'react-hot-toast';
import { provinces, districts } from '../data/districts';
import ImageCropper from '../components/ImageCropper';

export default function ProfilePage() {
    const { user, updateUser, uploadAvatar, removeAvatar, deleteAccount, isAuthenticated } = useAuth();
    const navigate = useNavigate();

    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [cursorMode, setCursorMode] = useState<'system' | 'custom'>(() => localStorage.getItem('nl_cursor_mode') === 'system' ? 'system' : 'custom');
    const [cursorSize, setCursorSize] = useState<'small' | 'medium' | 'large'>(() => {
        const saved = localStorage.getItem('nl_cursor_size');
        return saved === 'medium' || saved === 'large' ? saved : 'small';
    });

    // Form options
    const [classes, setClasses] = useState<string[]>([]);
    const [faculties, setFaculties] = useState<string[]>([]);
    const [competitions, setCompetitions] = useState<Array<{ id: number; exam_name: string }>>([]);

    // Profile picture
    const [profilePicture, setProfilePicture] = useState<File | null>(null);
    const [profilePreview, setProfilePreview] = useState<string | null>(null);
    const [selectedImage, setSelectedImage] = useState<string | null>(null);
    const [showCropper, setShowCropper] = useState(false);
    const [removePhotoRequested, setRemovePhotoRequested] = useState(false);
    const [showDeleteAccount, setShowDeleteAccount] = useState(false);
    const [deletePassword, setDeletePassword] = useState('');
    const [deletingAccount, setDeletingAccount] = useState(false);

    // Form data
    const [formData, setFormData] = useState({
        name: '',
        username: '',
        email: '',
        phNo: '',
        province: '',
        district: '',
        city: '',
        class: '',
        faculty: '',
        competition: '',
    });

    const fetchOptions = async () => {
        try {
            setLoading(true);
            const options = await apiRequest<{ classes: string[]; faculties: string[]; competitions: Array<{ id: number; exam_name: string }> }>('/registration-options');
            setClasses(options.classes);
            setFaculties(options.faculties);
            setCompetitions(options.competitions);
        } catch (err) {
            console.error('Failed to fetch options:', err);
            toast.error('Failed to load form options');
        } finally {
            setLoading(false);
        }
    };

    // Load user data and form options
    useEffect(() => {
        if (!isAuthenticated) {
            navigate('/login');
            return;
        }
        fetchOptions();
    }, [isAuthenticated, navigate]);

    // Set form data after options are loaded
    useEffect(() => {
        if (user && classes.length > 0 && faculties.length > 0) {
            const findMatch = (value: string, options: string[]) => {
                if (!value) return '';
                if (options.includes(value)) return value;
                const normalized = value.toLowerCase().replace(/\s+/g, '');
                const found = options.find(opt => opt.toLowerCase().replace(/\s+/g, '') === normalized);
                return found || value;
            };

            setFormData({
                name: user.name || '',
                username: user.username || '',
                email: user.email || '',
                phNo: user.phNo || '',
                province: user.province || '',
                district: user.district || '',
                city: user.city || '',
                class: findMatch(user.class, classes),
                faculty: findMatch(user.faculty, faculties),
                competition: user.competition || '',
            });

            if (user.profile_picture) {
                setProfilePreview(user.profile_picture);
            } else {
                setProfilePreview(null);
            }

            if (!user.username) {
                setIsEditing(true);
            }
        }
    }, [user, classes, faculties]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        if (name === 'province') {
            setFormData(prev => ({ ...prev, province: value, district: '' }));
        } else {
            setFormData(prev => ({ ...prev, [name]: value }));
        }
    };

    const handleProfilePicture = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
        if (!validTypes.includes(file.type)) {
            toast.error('Please upload a valid image file (JPG, PNG, GIF, or WebP)');
            return;
        }

        if (file.size > 5 * 1024 * 1024) {
            toast.error('Original image must be less than 5MB');
            return;
        }

        const imageUrl = URL.createObjectURL(file);
        setSelectedImage(imageUrl);
        setShowCropper(true);
        setRemovePhotoRequested(false);
    };

    const handleCropComplete = async (croppedBlob: Blob) => {
        const croppedFile = new File([croppedBlob], 'profile.jpg', { type: 'image/jpeg' });
        setProfilePicture(croppedFile);
        setProfilePreview(URL.createObjectURL(croppedBlob));
        setShowCropper(false);
    };

    const handleRemovePhoto = () => {
        setProfilePicture(null);
        setProfilePreview(null);
        setRemovePhotoRequested(true);
    };

    const handleCancel = () => {
        if (user) {
            const findMatch = (value: string, options: string[]) => {
                if (!value) return '';
                if (options.includes(value)) return value;
                const normalized = value.toLowerCase().replace(/\s+/g, '');
                const found = options.find(opt => opt.toLowerCase().replace(/\s+/g, '') === normalized);
                return found || value;
            };

            setFormData({
                name: user.name || '',
                username: user.username || '',
                email: user.email || '',
                phNo: user.phNo || '',
                province: user.province || '',
                district: user.district || '',
                city: user.city || '',
                class: findMatch(user.class, classes),
                faculty: findMatch(user.faculty, faculties),
                competition: user.competition || '',
            });
            setProfilePreview(user.profile_picture || null);
        }
        setProfilePicture(null);
        setRemovePhotoRequested(false);
        setIsEditing(false);
    };

    const updateCursor = (mode: 'system' | 'custom', size: 'small' | 'medium' | 'large') => {
        setCursorMode(mode);
        setCursorSize(size);
        localStorage.setItem('nl_cursor_mode', mode);
        localStorage.setItem('nl_cursor_size', size);
        window.dispatchEvent(new CustomEvent('cursor-preferences-change', { detail: { mode, size } }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (formData.username.length < 4) {
            toast.error('Username must be at least 4 characters long.');
            return;
        }
        if (/^\d+$/.test(formData.username)) {
            toast.error('Username cannot contain only numbers.');
            return;
        }

        setSaving(true);
        try {
            await updateUser(formData);
            if (profilePicture) await uploadAvatar(profilePicture);
            else if (removePhotoRequested) await removeAvatar();
            toast.success('Profile updated successfully!');
            setProfilePicture(null);
            setRemovePhotoRequested(false);
            setIsEditing(false);
        } catch {
            toast.error('Failed to update profile');
        } finally {
            setSaving(false);
        }
    };

    const confirmDeleteAccount = async (e: React.FormEvent) => {
        e.preventDefault();
        setDeletingAccount(true);
        try {
            await deleteAccount(deletePassword);
            toast.success('Your account has been deactivated and personal details removed.');
            navigate('/login', { replace: true });
        } catch {
            toast.error('We could not delete the account. Check your password and try again.');
        } finally {
            setDeletingAccount(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 dark:border-blue-400"></div>
            </div>
        );
    }

    return (
        <div className="max-w-2xl mx-auto">
            {showCropper && selectedImage && (
                <ImageCropper
                    image={selectedImage}
                    onCropComplete={handleCropComplete}
                    onCancel={() => setShowCropper(false)}
                />
            )}

            {showDeleteAccount && (
                <div className="fixed inset-0 z-[80] grid place-items-center bg-gray-950/70 p-4" role="presentation">
                    <form onSubmit={confirmDeleteAccount} className="w-full max-w-md rounded-2xl border border-red-200 bg-white p-6 shadow-2xl dark:border-red-900/50 dark:bg-gray-900" role="dialog" aria-modal="true" aria-labelledby="delete-account-title">
                        <div className="flex items-start gap-3"><Trash2 className="mt-1 text-red-600" /><div><h2 id="delete-account-title" className="text-lg font-bold text-gray-950 dark:text-white">Delete your account?</h2><p className="mt-2 text-sm leading-6 text-gray-600 dark:text-gray-300">Your login and personal profile details will be removed. Test/payment records may be retained in anonymized form where required.</p></div></div>
                        <label className="mt-5 block text-sm font-medium text-gray-700 dark:text-gray-200" htmlFor="delete-account-password">Current password</label>
                        <input id="delete-account-password" autoComplete="current-password" type="password" required value={deletePassword} onChange={(event) => setDeletePassword(event.target.value)} className="mt-2 w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-gray-950 outline-none focus:ring-2 focus:ring-red-500 dark:border-gray-700 dark:bg-gray-950 dark:text-white" />
                        <div className="mt-6 flex justify-end gap-3"><button type="button" onClick={() => { setShowDeleteAccount(false); setDeletePassword(''); }} className="auth-secondary">Cancel</button><button disabled={deletingAccount} className="rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50">{deletingAccount ? 'Deleting…' : 'Delete account'}</button></div>
                    </form>
                </div>
            )}

            {!isEditing ? (
                <div className="animate-fade-in">
                    <div className="flex items-center justify-between mb-6">
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">My Profile</h1>
                            <p className="text-gray-500 dark:text-gray-400 text-sm">View your personal information</p>
                        </div>
                        <button
                            onClick={() => setIsEditing(true)}
                            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                        >
                            <Edit2 className="h-4 w-4" />
                            Edit Profile
                        </button>
                    </div>

                    {!user?.username && (
                        <div className="mb-4 p-4 bg-yellow-50 dark:bg-yellow-900/10 border border-yellow-200 dark:border-yellow-900/30 rounded-lg">
                            <p className="text-yellow-800 dark:text-yellow-400 text-sm font-medium">⚠️ Please set a username to complete your profile</p>
                        </div>
                    )}

                    <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800 overflow-hidden transition-colors duration-300">
                        <div className="bg-gradient-to-r from-blue-500 to-blue-600 dark:from-blue-600 dark:to-blue-700 px-6 py-8">
                            <div className="flex items-center gap-4">
                                <div className="w-20 h-20 rounded-full overflow-hidden bg-white dark:bg-gray-800 border-4 border-white dark:border-gray-800 shadow-lg flex items-center justify-center">
                                    {profilePreview ? (
                                        <img src={profilePreview} alt="Profile" className="w-full h-full object-cover" />
                                    ) : (
                                        <User className="h-10 w-10 text-gray-400" />
                                    )}
                                </div>
                                <div className="text-white">
                                    <h2 className="text-xl font-bold">{user?.name || 'User'}</h2>
                                    <p className="text-blue-100">@{user?.username || 'No username set'}</p>
                                </div>
                            </div>
                        </div>

                        <div className="p-6 space-y-6">
                            <div>
                                <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">Contact Information</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                                        <Mail className="h-5 w-5 text-gray-400" />
                                        <div>
                                            <p className="text-xs text-gray-500">Email</p>
                                            <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{user?.email || '-'}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                                        <Phone className="h-5 w-5 text-gray-400" />
                                        <div>
                                            <p className="text-xs text-gray-500">Phone</p>
                                            <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{user?.phNo || '-'}</p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div>
                                <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">Location</h3>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                                        <MapPin className="h-5 w-5 text-gray-400" />
                                        <div>
                                            <p className="text-xs text-gray-500">Province</p>
                                            <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{user?.province || '-'}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                                        <MapPin className="h-5 w-5 text-gray-400" />
                                        <div>
                                            <p className="text-xs text-gray-500">District</p>
                                            <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{user?.district || '-'}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                                        <MapPin className="h-5 w-5 text-gray-400" />
                                        <div>
                                            <p className="text-xs text-gray-500">City</p>
                                            <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{user?.city || '-'}</p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div>
                                <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">Academic Information</h3>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                                        <GraduationCap className="h-5 w-5 text-gray-400" />
                                        <div>
                                            <p className="text-xs text-gray-500">Class</p>
                                            <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{user?.class || '-'}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                                        <GraduationCap className="h-5 w-5 text-gray-400" />
                                        <div>
                                            <p className="text-xs text-gray-500">Faculty</p>
                                            <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{user?.faculty || '-'}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                                        <GraduationCap className="h-5 w-5 text-gray-400" />
                                        <div>
                                            <p className="text-xs text-gray-500">Competitive Exam</p>
                                            <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{user?.competition || '-'}</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <section className="mt-5 rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
                        <div className="flex items-start gap-3">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-gray-900 dark:bg-gray-800 dark:text-white"><MousePointer2 className="h-5 w-5" /></div>
                            <div>
                                <h2 className="font-semibold text-gray-900 dark:text-white">Cursor</h2>
                                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Choose the normal device cursor or one solid custom pointer—black in light mode and white in dark mode.</p>
                            </div>
                        </div>

                        <div className="mt-5 grid grid-cols-2 gap-2 rounded-lg bg-gray-100 p-1 dark:bg-gray-800">
                            {(['system', 'custom'] as const).map((mode) => (
                                <button key={mode} type="button" onClick={() => updateCursor(mode, cursorSize)} className={`rounded-md px-4 py-2.5 text-sm font-semibold transition ${cursorMode === mode ? 'bg-white text-gray-950 shadow-sm dark:bg-gray-700 dark:text-white' : 'text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-white'}`}>
                                    {mode === 'system' ? 'System default' : 'Custom adaptive'}
                                </button>
                            ))}
                        </div>

                        <div className={`mt-5 transition-opacity ${cursorMode === 'system' ? 'pointer-events-none opacity-40' : ''}`}>
                            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Custom cursor size</p>
                            <div className="grid grid-cols-3 gap-2">
                                {(['small', 'medium', 'large'] as const).map((size) => (
                                    <button key={size} type="button" disabled={cursorMode === 'system'} onClick={() => updateCursor('custom', size)} className={`flex min-h-14 items-center justify-center gap-2 rounded-lg border text-sm font-semibold capitalize transition ${cursorSize === size && cursorMode === 'custom' ? 'border-teal-500 bg-teal-50 text-teal-800 dark:border-teal-400 dark:bg-teal-950/30 dark:text-teal-200' : 'border-gray-200 text-gray-600 hover:border-gray-400 dark:border-gray-700 dark:text-gray-300'}`}>
                                        <img src="/cursors/cursor-default.png" alt="" aria-hidden="true" className={`cursor-preview ${size === 'small' ? 'h-4 w-4' : size === 'medium' ? 'h-5 w-5' : 'h-6 w-6'}`} />
                                        {size}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </section>
                    <section className="mt-5 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-red-200 bg-red-50/50 p-5 dark:border-red-900/50 dark:bg-red-950/10">
                        <div><h2 className="font-semibold text-red-800 dark:text-red-300">Delete account</h2><p className="mt-1 text-sm text-gray-600 dark:text-gray-400">Removes your personal details and disables sign-in.</p></div>
                        <button type="button" onClick={() => setShowDeleteAccount(true)} className="inline-flex items-center gap-2 rounded-lg border border-red-300 px-4 py-2.5 text-sm font-semibold text-red-700 transition hover:bg-red-100 dark:border-red-800 dark:text-red-300 dark:hover:bg-red-950/40"><Trash2 size={16} /> Delete account</button>
                    </section>
                </div>
            ) : (
                <div className="animate-fade-in">
                    <div className="flex items-center justify-between mb-6">
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Edit Profile</h1>
                            <p className="text-gray-500 dark:text-gray-400 text-sm">Update your personal information</p>
                        </div>
                        <button
                            onClick={handleCancel}
                            className="flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                        >
                            <X className="h-4 w-4" />
                            Cancel
                        </button>
                    </div>

                    {!user?.username && (
                        <div className="mb-4 p-4 bg-yellow-50 dark:bg-yellow-900/10 border border-yellow-200 dark:border-yellow-900/30 rounded-lg">
                            <p className="text-yellow-800 dark:text-yellow-400 text-sm font-medium">⚠️ Username is required. Please set a username below.</p>
                        </div>
                    )}

                    <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800 p-6 transition-colors duration-300">
                        <form onSubmit={handleSubmit} className="space-y-6">
                            <div className="flex flex-col items-center">
                                <div className="relative">
                                    <div className="w-28 h-28 rounded-full overflow-hidden bg-gray-100 dark:bg-gray-800 border-4 border-white dark:border-gray-800 shadow-lg flex items-center justify-center">
                                        {profilePreview ? (
                                            <img src={profilePreview} alt="Profile" className="w-full h-full object-cover" />
                                        ) : (
                                            <User className="h-14 w-14 text-gray-400 dark:text-gray-500" />
                                        )}
                                    </div>
                                    <label className="absolute bottom-1 right-1 w-9 h-9 bg-blue-600 rounded-full flex items-center justify-center cursor-pointer hover:bg-blue-700 transition-all shadow-lg hover:scale-110 active:scale-95">
                                        <Camera className="h-4 w-4 text-white" />
                                        <input
                                            type="file"
                                            accept="image/jpeg,image/png,image/gif,image/webp"
                                            onChange={handleProfilePicture}
                                            className="hidden"
                                        />
                                    </label>
                                    {(profilePreview || profilePicture) && (
                                        <button
                                            type="button"
                                            onClick={handleRemovePhoto}
                                            className="absolute top-1 right-1 w-8 h-8 bg-white dark:bg-gray-800 text-red-500 rounded-full flex items-center justify-center cursor-pointer hover:bg-red-50 dark:hover:bg-red-900/10 transition-all shadow-md border border-red-100 dark:border-red-900/30 hover:scale-110 active:scale-95"
                                            title="Remove Photo"
                                        >
                                            <Trash2 className="h-3.5 w-3.5" />
                                        </button>
                                    )}
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Email Address</label>
                                <div className="relative">
                                    <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                                    <input type="email" value={formData.email} disabled className="w-full pl-11 pr-4 py-3 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800/50 text-gray-500 dark:text-gray-400 cursor-not-allowed" />
                                </div>
                                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Email cannot be changed</p>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Full Name *</label>
                                    <div className="relative">
                                        <User className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                                        <input type="text" name="name" value={formData.name} onChange={handleChange} className="w-full pl-11 pr-4 py-3 border border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all" required />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Username * <span className="text-xs text-gray-400">(min 4 chars)</span></label>
                                    <div className="relative">
                                        <User className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                                        <input type="text" name="username" value={formData.username} onChange={handleChange} placeholder="Enter username" className={`w-full pl-11 pr-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all ${!formData.username ? 'border-yellow-400 bg-yellow-50 dark:bg-yellow-900/10 dark:border-yellow-900/40' : 'border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:text-white'}`} required />
                                    </div>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Phone Number</label>
                                <div className="relative">
                                    <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                                    <input type="tel" name="phNo" value={formData.phNo} onChange={handleChange} className="w-full pl-11 pr-4 py-3 border border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all" placeholder="9812345678" />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Province</label>
                                    <div className="relative text-gray-900 dark:text-white">
                                        <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                                        <select name="province" value={formData.province} onChange={handleChange} className="w-full pl-11 pr-4 py-3 border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all appearance-none bg-white dark:bg-gray-800">
                                            <option value="">Select Province</option>
                                            {provinces.map((prov) => (<option key={prov} value={prov}>{prov}</option>))}
                                        </select>
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">District</label>
                                    <div className="relative text-gray-900 dark:text-white">
                                        <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                                        <select name="district" value={formData.district} onChange={handleChange} disabled={!formData.province} className="w-full pl-11 pr-4 py-3 border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all appearance-none bg-white dark:bg-gray-800 disabled:bg-gray-100 dark:disabled:bg-gray-900 shadow-none">
                                            <option value="">Select District</option>
                                            {formData.province && districts[formData.province]?.map((dist) => (<option key={dist} value={dist}>{dist}</option>))}
                                        </select>
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">City</label>
                                    <div className="relative">
                                        <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                                        <input type="text" name="city" value={formData.city} onChange={handleChange} className="w-full pl-11 pr-4 py-3 border border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all" placeholder="Thamel" />
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Class</label>
                                    <div className="relative text-gray-900 dark:text-white">
                                        <GraduationCap className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                                        <select name="class" value={formData.class} onChange={handleChange} className="w-full pl-11 pr-4 py-3 border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all appearance-none bg-white dark:bg-gray-800 shadow-none">
                                            <option value="">Select Class</option>
                                            {classes.map((cls) => (<option key={cls} value={cls}>{cls.replace(/^class(\d+)$/, 'Grade $1')}</option>))}
                                        </select>
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Faculty</label>
                                    <div className="relative text-gray-900 dark:text-white">
                                        <GraduationCap className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                                        <select name="faculty" value={formData.faculty} onChange={handleChange} className="w-full pl-11 pr-4 py-3 border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all appearance-none bg-white dark:bg-gray-800 shadow-none">
                                            <option value="">Select Faculty</option>
                                            {faculties.map((fac) => (<option key={fac} value={fac}>{fac}</option>))}
                                        </select>
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Competitive Exam</label>
                                    <div className="relative text-gray-900 dark:text-white">
                                        <GraduationCap className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                                        <select name="competition" value={formData.competition} onChange={handleChange} className="w-full pl-11 pr-4 py-3 border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all appearance-none bg-white dark:bg-gray-800 shadow-none">
                                            <option value="">Select Exam</option>
                                            {competitions.map((exam) => (<option key={exam.id} value={exam.exam_name}>{exam.exam_name}</option>))}
                                        </select>
                                    </div>
                                </div>
                            </div>

                            <button type="submit" disabled={saving} className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors shadow-sm disabled:opacity-50">
                                <Save className="h-5 w-5" />
                                {saving ? 'Saving...' : 'Save Changes'}
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
