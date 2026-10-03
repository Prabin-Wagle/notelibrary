import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, ArrowLeft, ArrowRight, CheckCircle2, LockKeyhole, ShieldCheck } from 'lucide-react';

export default function ChangePassword() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [formData, setFormData] = useState({ old_password: '', new_password: '', confirm_password: '' });

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, [event.target.name]: event.target.value });

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setSuccess('');
    if (formData.new_password !== formData.confirm_password) { setError('The new passwords do not match.'); return; }
    if (formData.new_password.length < 8) { setError('Use at least 8 characters for your new password.'); return; }
    setLoading(true);
    try {
      const stored = localStorage.getItem('nl_frontend_account');
      if (stored) {
        const account = JSON.parse(stored);
        if (account.password !== formData.old_password) { setError('The current password does not match the locally saved account.'); return; }
        localStorage.setItem('nl_frontend_account', JSON.stringify({ ...account, password: formData.new_password }));
      }
      setSuccess('Password updated in this browser.');
      setFormData({ old_password: '', new_password: '', confirm_password: '' });
      setTimeout(() => navigate('/dashboard'), 900);
    } catch {
      setError('We could not change your password. Please try again.');
    } finally { setLoading(false); }
  };

  return (
    <main className="auth-screen min-h-[100dvh] px-5 py-10 sm:py-16">
      <div className="mx-auto w-full max-w-lg">
        <button onClick={() => navigate('/dashboard')} className="auth-back"><ArrowLeft size={16} /> Back to dashboard</button>
        <section className="rounded-[2rem] border border-ink-200 bg-white/75 p-6 shadow-xl shadow-ink-900/[.06] backdrop-blur sm:p-9 dark:border-white/10 dark:bg-ink-900/80">
          <span className="grid h-12 w-12 place-items-center rounded-2xl bg-brand-100 text-brand-800 dark:bg-brand-500/10 dark:text-brand-300"><ShieldCheck size={22} /></span>
          <header className="auth-heading !mb-7 mt-6"><p className="auth-eyebrow">Account security</p><h1 className="!text-3xl sm:!text-4xl">Change your password.</h1><p>Use a unique password with at least eight characters.</p></header>
          <form onSubmit={handleSubmit} className="auth-form">
            {[
              { name: 'old_password', label: 'Current password', autoComplete: 'current-password' },
              { name: 'new_password', label: 'New password', autoComplete: 'new-password' },
              { name: 'confirm_password', label: 'Confirm new password', autoComplete: 'new-password' },
            ].map((field) => (
              <div key={field.name}><label htmlFor={field.name} className="auth-label">{field.label}</label><div className="auth-field"><LockKeyhole aria-hidden="true" /><input id={field.name} type="password" name={field.name} autoComplete={field.autoComplete} value={formData[field.name as keyof typeof formData]} onChange={handleChange} className="auth-input" placeholder="Enter password" required /></div></div>
            ))}
            {error && <div className="auth-message auth-message--error" role="alert"><AlertCircle size={16} className="mt-0.5 shrink-0" />{error}</div>}
            {success && <div className="auth-message auth-message--success" role="status"><CheckCircle2 size={16} className="mt-0.5 shrink-0" />{success}</div>}
            <button type="submit" disabled={loading} className="auth-primary">{loading ? 'Updating password…' : <>Update password <ArrowRight size={16} /></>}</button>
          </form>
        </section>
      </div>
    </main>
  );
}
