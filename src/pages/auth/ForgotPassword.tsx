import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, ArrowRight, CheckCircle2, KeyRound, LockKeyhole, Mail } from 'lucide-react';
import AuthShell from '../../components/AuthShell';
import { ApiError, apiRequest, jsonBody } from '../../lib/api';

export default function ForgotPassword() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [email, setEmail] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSendOtp = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setSuccessMsg('');
    setLoading(true);
    try {
      const result = await apiRequest<{ message: string; debug_token?: string }>('/auth/forgot-password', {
        method: 'POST',
        body: jsonBody({ email }),
      });
      if (result.debug_token) {
        sessionStorage.setItem('nl_reset_debug_token', result.debug_token);
        setResetToken(result.debug_token);
      }
      setSuccessMsg('Recovery instructions are ready.');
      setTimeout(() => { setStep(2); setSuccessMsg(''); }, 700);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'We could not create recovery instructions. Try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setLoading(true);
    try {
      await apiRequest<{ message: string }>('/auth/reset-password', {
        method: 'POST',
        body: jsonBody({ email, token: resetToken, new_password: newPassword }),
      });
      sessionStorage.removeItem('nl_reset_debug_token');
      setSuccessMsg('Password updated. Returning you to sign in…');
      setTimeout(() => navigate('/login'), 900);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'We could not update your password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      eyebrow={`Account recovery · Step ${step} of 2`}
      title={step === 1 ? 'Let’s get you back in.' : 'Choose a new password.'}
      description={step === 1 ? 'Enter the email linked to your account. We’ll create a secure, time-limited reset link.' : `Enter the reset token sent to ${email} and choose a new password.`}
      backTo={step === 1 ? '/login' : undefined}
    >
      <div className="mb-7 grid grid-cols-2 gap-2" aria-label="Recovery progress">
        {[1, 2].map((item) => <span key={item} className={`h-1 rounded-full ${item <= step ? 'bg-brand-600' : 'bg-ink-200 dark:bg-white/10'}`} />)}
      </div>

      <form onSubmit={step === 1 ? handleSendOtp : handleResetPassword} className="auth-form">
        {step === 1 ? (
          <div>
            <label htmlFor="recovery-email" className="auth-label">Account email</label>
            <div className="auth-field">
              <Mail aria-hidden="true" />
              <input id="recovery-email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} className="auth-input" placeholder="you@example.com" required />
            </div>
          </div>
        ) : (
          <>
            <div>
              <label htmlFor="recovery-code" className="auth-label">Reset token</label>
              <div className="auth-field">
                <KeyRound aria-hidden="true" />
                <input id="recovery-code" type="text" autoComplete="off" value={resetToken} onChange={(event) => setResetToken(event.target.value.trim())} className="auth-input font-metric text-xs" placeholder="Paste your reset token" required />
              </div>
              {sessionStorage.getItem('nl_reset_debug_token') && <p className="mt-2 text-xs text-ink-400">Local development filled the token automatically.</p>}
            </div>
            <div>
              <label htmlFor="new-password" className="auth-label">New password</label>
              <div className="auth-field">
                <LockKeyhole aria-hidden="true" />
                <input id="new-password" type="password" autoComplete="new-password" minLength={8} value={newPassword} onChange={(event) => setNewPassword(event.target.value)} className="auth-input" placeholder="At least 8 characters" required />
              </div>
            </div>
          </>
        )}

        {error && <div className="auth-message auth-message--error" role="alert"><AlertCircle size={16} className="mt-0.5 shrink-0" />{error}</div>}
        {successMsg && <div className="auth-message auth-message--success" role="status"><CheckCircle2 size={16} className="mt-0.5 shrink-0" />{successMsg}</div>}

        <button type="submit" disabled={loading} className="auth-primary">
          {loading ? (step === 1 ? 'Sending code…' : 'Updating password…') : <>{step === 1 ? 'Send recovery code' : 'Update password'} <ArrowRight size={16} /></>}
        </button>
      </form>

      {step === 2 && <button type="button" onClick={() => { setStep(1); setResetToken(''); setError(''); }} className="mt-5 w-full text-center text-xs font-semibold text-ink-500 hover:text-brand-700 dark:text-ink-400">Use a different email</button>}
    </AuthShell>
  );
}
