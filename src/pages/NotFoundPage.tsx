import { ArrowLeft, Compass } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function NotFoundPage() {
  const { isAuthenticated } = useAuth();
  const destination = isAuthenticated ? '/dashboard' : '/login';
  return (
    <main className="auth-screen grid min-h-[100dvh] place-items-center px-5 py-12">
      <section className="w-full max-w-xl text-center">
        <span className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-brand-100 text-brand-800 dark:bg-brand-500/10 dark:text-brand-300"><Compass size={28} /></span>
        <p className="mt-8 font-metric text-sm font-bold tracking-[.2em] text-brand-700 dark:text-brand-300">404</p>
        <h1 className="mt-3 font-display text-4xl font-semibold tracking-[-.055em] text-ink-900 sm:text-5xl dark:text-white">This page left the syllabus.</h1>
        <p className="mx-auto mt-4 max-w-md text-sm leading-7 text-ink-500 dark:text-ink-400">The link may be out of date, or the page may have moved. Your study progress is still safe.</p>
        <Link to={destination} className="auth-primary mx-auto mt-8 !w-fit"><ArrowLeft size={16} /> {isAuthenticated ? 'Return to dashboard' : 'Return to sign in'}</Link>
      </section>
    </main>
  );
}
