import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AlertCircle, ArrowRight, LockKeyhole, UserRound } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import AuthShell from '../../components/AuthShell';

export default function Login() {
  const navigate = useNavigate();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setLoading(true);
    try {
      const success = await login(identifier, password);
      if (success) navigate('/dashboard');
      else setError('That email, username, or password is incorrect.');
    } catch {
      setError('We could not reach the service. Please try again.');
    } finally { setLoading(false); }
  };

  return (
    <AuthShell eyebrow="Welcome back" title="Pick up where you left off." description="Sign in to reach your notes, test series, daily plan, and progress.">
      <form onSubmit={handleSubmit} className="auth-form" noValidate>
        <div>
          <label htmlFor="identifier" className="auth-label">Email or username</label>
          <div className="auth-field"><UserRound aria-hidden="true" /><input id="identifier" type="text" autoComplete="username" value={identifier} onChange={(event) => setIdentifier(event.target.value)} className="auth-input" placeholder="you@example.com" required /></div>
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between gap-4"><label htmlFor="password" className="auth-label !mb-0">Password</label><Link to="/forgot-password" className="auth-link text-xs">Forgot password?</Link></div>
          <div className="auth-field"><LockKeyhole aria-hidden="true" /><input id="password" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} className="auth-input" placeholder="Enter your password" required /></div>
        </div>

        {error && <div className="auth-message auth-message--error" role="alert"><AlertCircle size={16} className="mt-0.5 shrink-0" /><span>{error}</span></div>}

        <button type="submit" disabled={loading} className="auth-primary">{loading ? 'Opening workspace…' : <>Enter workspace <ArrowRight size={16} /></>}</button>
      </form>

      <p className="mt-7 text-center text-sm text-ink-500 dark:text-ink-400">New to Note Library? <Link to="/register" className="auth-link">Create an account</Link></p>
    </AuthShell>
  );
}
