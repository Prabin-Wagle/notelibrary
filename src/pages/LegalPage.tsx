import { ArrowLeft, ArrowUpRight, BookOpen, Check, GraduationCap, ShieldCheck } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import './LegalPage.css';

const sections = {
  privacy: {
    title: 'Privacy policy',
    description: 'A clear guide to the information Note Library uses to keep your learning space working.',
    icon: ShieldCheck,
    items: [
      ['Information we collect', 'Account details such as your name, email address, username, learning level, and optional contact and location details. The service also stores study goals, bookmarks, quiz attempts, support conversations, and payment-review references you submit.'],
      ['How we use it', 'We use this information to operate your account, show learning materials, save your progress, review access requests, and respond to support tickets. We do not sell student personal information.'],
      ['Sharing and retention', 'Authorized service administrators may access information to provide support, review payments, or maintain the service. Financial and assessment records may be retained in anonymized form when needed for security, accounting, or legal obligations.'],
      ['Your choices', 'You can update profile details in Profile settings or request account deletion there. Deletion removes or anonymizes personal profile data and disables sign-in; some records may remain anonymized for operational or legal retention.'],
      ['Security and contact', 'We use access controls and protected sessions, but no internet service can guarantee absolute security. Contact the Help center to report a privacy concern or request assistance.'],
    ],
  },
  terms: {
    title: 'Terms and conditions',
    description: 'The shared expectations that help keep Note Library useful, fair, and focused on learning.',
    icon: BookOpen,
    items: [
      ['Your account', 'Keep your sign-in credentials private and provide accurate account information. You are responsible for activity performed through your account; contact support promptly if you suspect unauthorized access.'],
      ['Learning content', 'Notes, books, quizzes, and other materials are provided for personal study. Do not copy, redistribute, sell, or use content in a way that violates the rights of its author or applicable law.'],
      ['Test series and payments', 'Prices, discounts, and availability are shown in the collection. A submitted payment reference is a request for manual review, not confirmation of payment or instant access. Access begins only after the payment is verified and approved.'],
      ['Acceptable use', 'Do not attempt to bypass access controls, disrupt the service, upload harmful material, or misuse other students’ information. We may limit or suspend access for abuse or security concerns.'],
      ['Availability and changes', 'We may update learning content, features, or these terms as the service evolves. We will make reasonable efforts to keep the service available, but maintenance and outages can occur.'],
      ['Questions', 'These terms are a practical service notice, not legal advice. Contact the Help center if you have questions. Have local counsel review these terms before commercial launch.'],
    ],
  },
} as const;

export default function LegalPage() {
  const location = useLocation();
  const kind = location.pathname === '/terms' ? 'terms' : 'privacy';
  const page = sections[kind];
  const Icon = page.icon;

  return (
    <main id="top" className="legal-page min-h-[100dvh] px-5 pb-16 pt-6 text-ink-900 dark:text-ink-100 sm:px-8 sm:pt-8">
      <div className="legal-page__glow" aria-hidden="true" />
      <div className="legal-shell">
        <nav className="legal-topbar" aria-label="Page navigation">
          <Link to="/login" className="legal-brand" aria-label="Note Library home">
            <span className="legal-brand__mark"><GraduationCap size={21} strokeWidth={2.2} /></span>
            <span><strong>Note Library</strong><small>Student workspace</small></span>
          </Link>
          <Link to="/login" className="legal-back"><ArrowLeft size={16} /> <span>Back to sign in</span></Link>
        </nav>

        <header className="legal-hero animate-fade-in">
          <div className="legal-hero__copy">
            <p className="legal-eyebrow"><span /> Student guide <span className="legal-eyebrow__slash">/</span> Policies</p>
            <div className="legal-title-row">
              <span className="legal-title-icon"><Icon size={25} strokeWidth={1.8} /></span>
              <h1>{page.title}</h1>
            </div>
            <p className="legal-hero__description">{page.description}</p>
          </div>
          <div className="legal-meta" aria-label="Document details">
            <span className="legal-meta__label">Current edition</span>
            <strong>27 Sep 2026</strong>
            <span className="legal-meta__divider" />
            <span className="legal-meta__count">{String(page.items.length).padStart(2, '0')} sections</span>
          </div>
          <div className="legal-tabs" aria-label="Legal documents">
            <Link to="/privacy" aria-current={kind === 'privacy' ? 'page' : undefined} className={`legal-tab ${kind === 'privacy' ? 'is-active' : ''}`}>
              <ShieldCheck size={16} /> Privacy
            </Link>
            <Link to="/terms" aria-current={kind === 'terms' ? 'page' : undefined} className={`legal-tab ${kind === 'terms' ? 'is-active' : ''}`}>
              <BookOpen size={16} /> Terms
            </Link>
          </div>
        </header>

        <div className="legal-layout">
          <aside className="legal-aside animate-fade-in" aria-label="Document contents">
            <div className="legal-aside__sticky">
              <p className="legal-aside__title">In this document</p>
              <nav className="legal-toc">
                {page.items.map(([title], index) => (
                  <a key={title} href={`#section-${index + 1}`}>
                    <span>{String(index + 1).padStart(2, '0')}</span>{title}
                  </a>
                ))}
              </nav>
              <div className="legal-aside__note">
                <span className="legal-aside__note-icon"><Check size={14} /></span>
                <p>Written for students. Your choices and account controls stay in your hands.</p>
              </div>
            </div>
          </aside>

          <article className="legal-document" aria-label={page.title}>
            <div className="legal-document__intro">
              <span className="legal-document__overline">Note Library <span>·</span> {kind === 'privacy' ? 'Your information' : 'Using the service'}</span>
              <p>{kind === 'privacy'
                ? 'Your learning history is personal. Here’s what we keep, why it helps, and how you can manage it.'
                : 'These guidelines keep study materials available and the student workspace respectful for everyone.'}</p>
            </div>
            <div className="legal-sections">
              {page.items.map(([title, content], index) => (
                <section id={`section-${index + 1}`} key={title} className="legal-section">
                  <span className="legal-section__number">{String(index + 1).padStart(2, '0')}</span>
                  <div className="legal-section__body">
                    <h2>{title}</h2>
                    <p>{content}</p>
                  </div>
                  <a className="legal-section__top" href="#top" aria-label="Back to top"><ArrowUpRight size={16} /></a>
                </section>
              ))}
            </div>
            <footer className="legal-document__footer">
              <span className="legal-footer-mark"><ShieldCheck size={16} /></span>
              <p>This page describes current student-app behavior. Please have a qualified local legal professional review it before production launch.</p>
            </footer>
          </article>
        </div>

        <footer className="legal-bottom">
          <span>© 2026 Note Library</span>
          <span>Built for focused learning</span>
          <Link to="/register">Create an account <ArrowUpRight size={13} /></Link>
        </footer>
      </div>
    </main>
  );
}
