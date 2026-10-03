import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { AlertCircle, ArrowRight, Camera, CheckCircle2, LockKeyhole, Mail, Phone, UserRound } from 'lucide-react';
import { apiRequest } from '../../lib/api';
import type { RegisterFormData } from '../../types/auth';
import { provinces, districts } from '../../data/districts';
import ImageCropper from '../../components/ImageCropper';
import AuthShell from '../../components/AuthShell';
import { useAuth } from '../../contexts/AuthContext';
import { ApiError } from '../../lib/api';

export default function Register() {
  const navigate = useNavigate();
  const location = useLocation();
  const { register } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Form options
  const [classes, setClasses] = useState<string[]>([]);
  const [faculties, setFaculties] = useState<string[]>([]);
  const [competitions, setCompetitions] = useState<Array<{ id: number; exam_name: string }>>([]);
  const [loadingOptions, setLoadingOptions] = useState(true);

  // Profile picture
  const [profilePicture, setProfilePicture] = useState<File | null>(null);
  const [profilePreview, setProfilePreview] = useState<string | null>(null);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [showCropper, setShowCropper] = useState(false);

  // Form data
  const [formData, setFormData] = useState<RegisterFormData>({
    name: '',
    username: '',
    email: '',
    phNo: '',
    province: '',
    district: '',
    city: '',
    password: '',
    class: '',
    faculty: '',
    competition: '',
  });

  useEffect(() => {
    const fetchOptions = async () => {
      try {
        setLoadingOptions(true);
        const options = await apiRequest<{ classes: string[]; faculties: string[]; competitions: Array<{ id: number; exam_name: string }> }>('/registration-options');
        setClasses(options.classes);
        setFaculties(options.faculties);
        setCompetitions(options.competitions);
      } catch (err) {
        console.error('Failed to fetch options:', err);
        setError('Failed to load form options. Please refresh the page.');
      } finally {
        setLoadingOptions(false);
      }
    };
    fetchOptions();
  }, []);

  useEffect(() => {
    if (location.state?.isGoogle) {
      const { email, name } = location.state;
      setFormData(prev => ({
        ...prev,
        email: email || '',
        name: name || ''
      }));
    }
  }, [location.state]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    if (name === 'province') {
      setFormData({ ...formData, province: value, district: '' });
    } else if (name === 'faculty') {
      setFormData({ ...formData, faculty: value, competition: '' });
    } else {
      setFormData({ ...formData, [name]: value });
    }
  };

  const getFilteredCompetitions = () => {
    const selectedFaculty = (formData.faculty || '').toLowerCase();
    return competitions.filter(e => {
      const isCmat = (e.exam_name || '').toUpperCase() === 'CMAT' || (e.exam_name || '').toLowerCase().includes('cmat');
      if (selectedFaculty === 'management') {
        return isCmat;
      }
      if (selectedFaculty === 'science') {
        return !isCmat;
      }
      return true;
    });
  };

  const handleProfilePicture = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      setError('Please upload a valid image file (JPG, PNG, GIF, or WebP)');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError('Original image must be less than 5MB');
      return;
    }

    const imageUrl = URL.createObjectURL(file);
    setSelectedImage(imageUrl);
    setShowCropper(true);
    setError('');
  };

  const handleCropComplete = (croppedBlob: Blob) => {
    setProfilePicture(new File([croppedBlob], 'profile.jpg', { type: 'image/jpeg' }));
    setProfilePreview(URL.createObjectURL(croppedBlob));
    setShowCropper(false);
  };

  const validateForm = () => {
    if (!formData.name.trim()) {
      setError('Full Name is required.');
      return false;
    }
    if (!formData.email.trim()) {
      setError('Email is required.');
      return false;
    }
    if (!formData.password) {
      setError('Password is required.');
      return false;
    }
    if (formData.username.length < 4) {
      setError('Username must be at least 4 characters long.');
      return false;
    }
    if (/^\d+$/.test(formData.username)) {
      setError('Username cannot contain only numbers.');
      return false;
    }
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const { photoSaved } = await register(formData, profilePicture);

      setSuccess(profilePicture && !photoSaved
        ? 'Your account is ready, but we could not save the photo. You can add it later from Profile. Verify your email to continue.'
        : 'Your account is ready. Verify your email to continue.');
      if (location.state?.isGoogle) {
        setTimeout(() => navigate('/login'), 2000);
      } else {
        setTimeout(() => navigate('/verify-otp', { state: { email: formData.email } }), 2000);
      }
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (loadingOptions) {
    return (
      <div className="auth-screen grid min-h-[100dvh] place-items-center px-6">
        <div className="text-center" role="status">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-2 border-brand-200 border-t-brand-700 dark:border-white/10 dark:border-t-brand-300" />
          <p className="mt-4 font-display text-xs font-semibold text-ink-500 dark:text-ink-400">Preparing registration…</p>
        </div>
      </div>
    );
  }

  return (
    <>
      {showCropper && selectedImage && (
        <ImageCropper
          image={selectedImage}
          onCropComplete={handleCropComplete}
          onCancel={() => setShowCropper(false)}
        />
      )}
      <AuthShell wide eyebrow="Start your workspace" title="Build your learner profile." description="Tell us what you study so we can put the right notes, books, and test series within easy reach." backTo="/login">
            <form onSubmit={handleSubmit} className="auth-form">
              <div className="flex items-center gap-4 rounded-2xl border border-ink-200 bg-white/55 p-4 dark:border-white/10 dark:bg-white/[.035]">
                <div className="relative">
                  <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-2xl border border-ink-200 bg-ink-100 dark:border-white/10 dark:bg-white/[.06]">
                    {profilePreview ? (
                      <img src={profilePreview} alt="Profile preview" className="h-full w-full object-cover" />
                    ) : (
                      <UserRound className="h-7 w-7 text-ink-400" />
                    )}
                  </div>
                  <label className="absolute -bottom-1 -right-1 flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg bg-brand-700 text-white shadow-md transition hover:bg-brand-600">
                    <Camera className="h-4 w-4 text-white" />
                    <span className="sr-only">Choose profile photo</span>
                    <input type="file" accept="image/*" onChange={handleProfilePicture} className="sr-only" />
                  </label>
                </div>
                <div>
                  <p className="font-display text-sm font-semibold text-ink-900 dark:text-white">Profile photo <span className="font-normal text-ink-400">(optional)</span></p>
                  <p className="mt-1 text-xs leading-5 text-ink-500 dark:text-ink-400">JPG, PNG, GIF or WebP. Up to 5 MB.</p>
                </div>
              </div>

              {error && <div className="auth-message auth-message--error" role="alert"><AlertCircle size={16} className="mt-0.5 shrink-0" />{error}</div>}
              {success && <div className="auth-message auth-message--success" role="status"><CheckCircle2 size={16} className="mt-0.5 shrink-0" />{success}</div>}

              <fieldset>
                <legend className="auth-label mb-3">Account details</legend>
              <div className="auth-grid">
                <div>
                  <label htmlFor="name" className="auth-label">Full name</label>
                  <div className="auth-field">
                    <UserRound aria-hidden="true" />
                    <input id="name" type="text" name="name" autoComplete="name" value={formData.name} onChange={handleChange} className="auth-input" placeholder="Your full name" required />
                  </div>
                </div>
                <div>
                  <label htmlFor="username" className="auth-label">Username</label>
                  <div className="auth-field">
                    <UserRound aria-hidden="true" />
                    <input id="username" type="text" name="username" autoComplete="username" value={formData.username} onChange={handleChange} className="auth-input" placeholder="Choose a username" required />
                  </div>
                </div>
              </div>

              <div className="auth-grid mt-4">
                <div>
                  <label htmlFor="email" className="auth-label">Email</label>
                  <div className="auth-field">
                    <Mail aria-hidden="true" />
                    <input id="email" type="email" name="email" autoComplete="email" value={formData.email} onChange={handleChange} className="auth-input" placeholder="you@example.com" disabled={location.state?.isGoogle} required />
                  </div>
                </div>
                <div>
                  <label htmlFor="phNo" className="auth-label">Phone number</label>
                  <div className="auth-field">
                    <Phone aria-hidden="true" />
                    <input id="phNo" type="tel" name="phNo" autoComplete="tel" value={formData.phNo} onChange={handleChange} className="auth-input" placeholder="98XXXXXXXX" />
                  </div>
                </div>
              </div>

              <div className="mt-4">
                <label htmlFor="register-password" className="auth-label">Password</label>
                <div className="auth-field">
                  <LockKeyhole aria-hidden="true" />
                  <input id="register-password" type="password" name="password" autoComplete="new-password" minLength={8} value={formData.password} onChange={handleChange} className="auth-input" placeholder="At least 8 characters" required />
                </div>
              </div>
              </fieldset>

              <fieldset className="border-t border-ink-200 pt-5 dark:border-white/10">
                <legend className="auth-label mb-3 pr-3">Location</legend>
              <div className="auth-grid--three">
                <div>
                  <label htmlFor="province" className="auth-label">Province</label>
                  <select id="province" name="province" value={formData.province} onChange={handleChange} className="auth-select" required>
                    <option value="">Select</option>
                    {provinces.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
                <div>
                  <label htmlFor="district" className="auth-label">District</label>
                  <select id="district" name="district" value={formData.district} onChange={handleChange} className="auth-select" disabled={!formData.province} required>
                    <option value="">Select</option>
                    {formData.province && districts[formData.province]?.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
                <div>
                  <label htmlFor="city" className="auth-label">City</label>
                  <input id="city" type="text" name="city" autoComplete="address-level2" value={formData.city} onChange={handleChange} className="auth-input" placeholder="City" />
                </div>
              </div>
              </fieldset>

              <fieldset className="border-t border-ink-200 pt-5 dark:border-white/10">
                <legend className="auth-label mb-3 pr-3">Study profile</legend>
              <div className={`grid grid-cols-1 ${['class8', 'class9', 'class10'].includes(formData.class) ? 'md:grid-cols-1' : 'md:grid-cols-3'} gap-4`}>
                <div>
                  <label htmlFor="class" className="auth-label">Class</label>
                  <select id="class" name="class" value={formData.class} onChange={handleChange} className="auth-select">
                    <option value="">Select</option>
                    {classes.map(c => <option key={c} value={c}>{c.replace(/^class(\d+)$/, 'Grade $1')}</option>)}
                  </select>
                </div>
                
                {!['class8', 'class9', 'class10'].includes(formData.class) && (
                  <>
                    <div>
                      <label htmlFor="faculty" className="auth-label">Faculty</label>
                      <select id="faculty" name="faculty" value={formData.faculty} onChange={handleChange} className="auth-select">
                        <option value="">Select</option>
                        {faculties.map(f => <option key={f} value={f}>{f}</option>)}
                      </select>
                    </div>
                    <div>
                      <label htmlFor="competition" className="auth-label">Goal</label>
                      <select id="competition" name="competition" value={formData.competition} onChange={handleChange} className="auth-select">
                        <option value="">Select</option>
                        {getFilteredCompetitions().map(e => <option key={e.id} value={e.exam_name}>{e.exam_name}</option>)}
                      </select>
                    </div>
                  </>
                )}
              </div>
              </fieldset>

              <button type="submit" disabled={loading} className="auth-primary">
                {loading ? 'Creating account…' : <>Create account <ArrowRight size={16} /></>}
              </button>

              <p className="text-center text-sm text-ink-500 dark:text-ink-400">Already have an account? <Link to="/login" className="auth-link">Sign in</Link></p>
              <p className="text-center text-xs text-ink-400 dark:text-ink-500">By creating an account, you agree to our <Link to="/terms" className="auth-link">Terms</Link> and <Link to="/privacy" className="auth-link">Privacy Policy</Link>.</p>
            </form>
      </AuthShell>
    </>
  );
}
