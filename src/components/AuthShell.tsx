import { ReactNode } from 'react';
import { ArrowLeft, BookOpen, CheckCircle2, GraduationCap, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';

interface AuthShellProps {
  children: ReactNode;
  eyebrow: string;
  title: string;
  description: string;
  backTo?: string;
  backLabel?: string;
  wide?: boolean;
}

const highlights = [
  'Curriculum-aligned notes and books',
  'Timed test series with clear analytics',
  'Daily focus tools built for students',
];

export default function AuthShell({
  children,
  eyebrow,
  title,
  description,
  backTo,
  backLabel = 'Back to sign in',
  wide = false,
}: AuthShellProps) {
  return (
    <main className="auth-screen">
      <a href="#auth-form" className="skip-link">Skip to form</a>
      <div className={`auth-shell ${wide ? 'auth-shell--wide' : ''}`}>
        <section className="auth-story" aria-label="About Note Library">
          <div>
            <Link to="/login" className="auth-brand" aria-label="Note Library home">
              <span className="auth-brand__mark"><GraduationCap size={21} strokeWidth={2.4} /></span>
              <span>
                <strong>Note Library</strong>
                <small>Student workspace</small>
              </span>
            </Link>

            <div className="auth-story__copy">
              <p className="auth-kicker"><Sparkles size={14} /> Study with direction</p>
              <h2>Everything for the next <em>good study day.</em></h2>
              <p>Keep your notes, practice, goals, and progress in one focused place—without the noise.</p>
            </div>
          </div>

          <div className="auth-story__footer">
            <ul>
              {highlights.map((item) => (
                <li key={item}><CheckCircle2 size={16} /> {item}</li>
              ))}
            </ul>
            <p><BookOpen size={15} /> Built for learners across Nepal</p>
          </div>
        </section>

        <section className="auth-panel" id="auth-form">
          <div className={`auth-card ${wide ? 'auth-card--wide' : ''}`}>
            {backTo && (
              <Link to={backTo} className="auth-back"><ArrowLeft size={16} /> {backLabel}</Link>
            )}
            <header className="auth-heading">
              <p className="auth-eyebrow">{eyebrow}</p>
              <h1>{title}</h1>
              <p>{description}</p>
            </header>
            {children}
          </div>
          <footer className="auth-legal" aria-label="Application information">
            <span>© {new Date().getFullYear()} Note Library</span>
            <Link to="/privacy">Privacy</Link>
            <Link to="/terms">Terms</Link>
          </footer>
        </section>
      </div>
    </main>
  );
}
