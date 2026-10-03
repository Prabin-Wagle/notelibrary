import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, BookOpenCheck, ImageOff, RefreshCw } from 'lucide-react';
import { apiRequest } from '../../lib/api';

interface Collection {
  id: number;
  title: string;
  description: string | null;
  price: number;
  discount_price: number | null;
  image_url: string | null;
  competitive_exam: string | null;
  test_count: number;
  has_access: boolean | number;
}

export default function TestSeriesCollectionList() {
  const [collections, setCollections] = useState<Collection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [failedImages, setFailedImages] = useState<Set<number>>(() => new Set());
  const navigate = useNavigate();

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await apiRequest<{ collections: Collection[] }>('/quiz-collections');
      setCollections(response.collections || []);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'We could not load the test series.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  if (loading) return <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3" aria-label="Loading test series">{[0, 1, 2].map((item) => <div key={item} className="h-72 animate-pulse rounded-2xl bg-ink-100 dark:bg-white/[.05]" />)}</div>;
  if (error) return <section className="surface-card grid min-h-64 place-items-center p-8 text-center"><div><span className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-rose-50 text-rose-700 dark:bg-rose-400/10 dark:text-rose-300"><RefreshCw size={20} /></span><h2 className="mt-4 font-display text-lg font-semibold">Test series unavailable</h2><p className="mt-2 max-w-sm text-sm leading-6 text-ink-500 dark:text-ink-400">{error}</p><button onClick={() => void load()} className="auth-secondary mt-5">Try again</button></div></section>;
  if (!collections.length) return <section className="surface-card grid min-h-72 place-items-center p-8 text-center"><div><span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-300"><BookOpenCheck size={24} /></span><h2 className="mt-5 font-display text-xl font-semibold">No test collections yet</h2><p className="mt-2 max-w-md text-sm leading-6 text-ink-500 dark:text-ink-400">Published collections will appear here when they are ready.</p></div></section>;

  return <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
    {collections.map((collection, index) => {
      const hasAccess = Boolean(Number(collection.has_access));
      const price = Number(collection.discount_price ?? collection.price);
      const failed = failedImages.has(collection.id);
      return <article key={collection.id} className={`surface-card group overflow-hidden ${index === 0 && collections.length > 2 ? 'md:col-span-2 md:grid md:grid-cols-[1fr_1fr]' : ''}`}>
        <div className={`relative overflow-hidden bg-ink-100 dark:bg-ink-800 ${index === 0 && collections.length > 2 ? 'min-h-64' : 'h-48'}`}>
          {collection.image_url && !failed ? <img src={collection.image_url} alt={`${collection.title} cover`} onError={() => setFailedImages((current) => new Set(current).add(collection.id))} className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.025]" /> : <div className="grid h-full place-items-center text-ink-400"><ImageOff size={26} /></div>}
          <div className="absolute inset-0 bg-gradient-to-t from-ink-950/55 via-transparent to-transparent" />
          <span className="absolute left-4 top-4 rounded-lg border border-white/20 bg-ink-950/55 px-2.5 py-1 font-display text-[.58rem] font-bold uppercase tracking-[.13em] text-white backdrop-blur-md">{hasAccess ? 'Available' : price === 0 ? 'Free' : 'Preview'}</span>
        </div>
        <div className="flex flex-col p-6">
          <div className="mb-4 flex items-center justify-between gap-3"><span className="text-[.68rem] font-semibold text-ink-400">{collection.competitive_exam || `${collection.test_count} ${collection.test_count === 1 ? 'test' : 'tests'}`}</span><span className="font-metric text-sm font-bold text-brand-800 dark:text-brand-300">{price === 0 ? 'Free' : `Rs. ${price}`}</span></div>
          <h2 className="font-display text-xl font-semibold leading-tight tracking-[-.035em] text-ink-900 dark:text-white">{collection.title}</h2>
          <p className="mt-3 line-clamp-3 flex-1 text-sm leading-6 text-ink-500 dark:text-ink-400">{collection.description || 'Practice sets curated to help you prepare with confidence.'}</p>
          <button onClick={() => navigate(`/test-series/${collection.id}`)} className="auth-primary mt-6">{hasAccess ? 'Open collection' : 'Preview collection'} <ArrowRight size={16} /></button>
        </div>
      </article>;
    })}
  </div>;
}
