import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AlertCircle, ArrowRight, CheckCircle2, ShieldCheck } from 'lucide-react';
import AuthShell from '../../components/AuthShell';
import { ApiError, apiRequest, jsonBody } from '../../lib/api';

export default function VerifyOTP() {
  const navigate = useNavigate();
  const location = useLocation();
  const email = location.state?.email || '';
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [resending, setResending] = useState(false);
  const debugCode = sessionStorage.getItem('nl_verification_debug_code');

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setSuccess('');
    if (!email) { setError('Your email is missing. Please start registration again.'); return; }
    setLoading(true);
    try {
      await apiRequest<{ message: string }>('/auth/email-verification/confirm', {
        method: 'POST',
        body: jsonBody({ email, code: otp }),
      });
      sessionStorage.removeItem('nl_verification_debug_code');
      setSuccess('Email verified. You can now sign in.');
      setTimeout(() => navigate('/login'), 900);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'The code could not be verified. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const resend = async () => {
    if (!email) return;
    setResending(true);
    setError('');
    try {
      const result = await apiRequest<{ message: string; debug_code?: string }>('/auth/email-verification/request', {
        method: 'POST',
        body: jsonBody({ email }),
      });
      if (result.debug_code) sessionStorage.setItem('nl_verification_debug_code', result.debug_code);
      setSuccess('A new verification code has been created.');
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'A new code could not be requested.');
    } finally {
      setResending(false);
    }
  };

  return (
    <AuthShell eyebrow="One last step" title="Verify your email." description={email ? `We sent a six-digit code to ${email}. It may take a minute to arrive.` : 'Return to registration so we know where to send your code.'} backTo="/register" backLabel="Back to registration">
      <form onSubmit={handleSubmit} className="auth-form">
        <div>
          <label htmlFor="verification-code" className="auth-label">Verification code</label>
          <div className="auth-field">
            <ShieldCheck aria-hidden="true" />
            <input id="verification-code" type="text" inputMode="numeric" autoComplete="one-time-code" value={otp} onChange={(event) => setOtp(event.target.value.replace(/\D/g, '').slice(0, 6))} className="auth-input font-metric text-center text-xl tracking-[.36em]" placeholder="000000" maxLength={6} required />
          </div>
          <p className="mt-2 text-xs leading-5 text-ink-400">Check spam or promotions if the email is not in your inbox.</p>
          {debugCode && <p className="mt-2 rounded-lg bg-brand-500/10 px-3 py-2 font-metric text-xs text-brand-800 dark:text-brand-200">Local development code: {debugCode}</p>}
        </div>

        {error && <div className="auth-message auth-message--error" role="alert"><AlertCircle size={16} className="mt-0.5 shrink-0" />{error}</div>}
        {success && <div className="auth-message auth-message--success" role="status"><CheckCircle2 size={16} className="mt-0.5 shrink-0" />{success}</div>}

        <button type="submit" disabled={loading || !email || otp.length !== 6} className="auth-primary">
          {loading ? 'Verifying…' : <>Verify email <ArrowRight size={16} /></>}
        </button>
      </form>
      <p className="mt-6 text-center text-sm text-ink-500 dark:text-ink-400">Need a new code? <button type="button" disabled={resending || !email} onClick={resend} className="auth-link disabled:opacity-50">{resending ? 'Sending…' : 'Resend code'}</button></p>
    </AuthShell>
  );
}
