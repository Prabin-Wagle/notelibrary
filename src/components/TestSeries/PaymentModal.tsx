import { useEffect, useState, type FormEvent } from 'react';
import { Download, Loader2, QrCode, Ticket, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { apiRequest, jsonBody } from '../../lib/api';

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  collectionId: number;
  collectionTitle: string;
  price: number;
  onSuccess?: () => void;
}

interface Quote { amount: number; price: number; discount_price: number | null; discount_percent: number; }

export default function PaymentModal({ isOpen, onClose, collectionId, collectionTitle, price, onSuccess }: PaymentModalProps) {
  const [promoCode, setPromoCode] = useState('');
  const [discount, setDiscount] = useState(0);
  const [provider, setProvider] = useState('esewa');
  const [reference, setReference] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setPromoCode('');
    setDiscount(0);
    setReference('');
  }, [collectionId, isOpen]);

  if (!isOpen) return null;
  const basePrice = Number(price);
  const finalPrice = Math.round(basePrice * (1 - discount / 100) * 100) / 100;

  const applyPromo = async () => {
    try {
      const { quote } = await apiRequest<{ quote: Quote }>(`/quiz-collections/${collectionId}/payment-quote`, {
        method: 'POST', body: jsonBody({ promo_code: promoCode }),
      });
      setDiscount(Number(quote.discount_percent));
      toast.success(quote.discount_percent ? 'Promotion applied.' : 'No promotion applied.');
    } catch (error) {
      setDiscount(0);
      toast.error(error instanceof Error ? error.message : 'Promotion code could not be checked.');
    }
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    try {
      await apiRequest(`/quiz-collections/${collectionId}/payment-requests`, {
        method: 'POST',
        body: jsonBody({ provider, reference, promo_code: promoCode || null }),
      });
      toast.success('Payment reference sent for review. Access will open after approval.');
      onSuccess?.();
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Payment request could not be submitted.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[80] grid place-items-center bg-ink-950/70 p-4 backdrop-blur-sm" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section role="dialog" aria-modal="true" aria-labelledby="checkout-title" className="anim-pop max-h-[92dvh] w-full max-w-2xl overflow-y-auto rounded-3xl border border-ink-200 bg-[#fbfaf7] shadow-2xl dark:border-white/10 dark:bg-ink-900">
        <header className="flex items-start justify-between gap-4 border-b border-ink-200 p-6 dark:border-white/10 sm:p-7">
          <div><p className="dashboard-eyebrow text-brand-700 dark:text-brand-300">Test series access</p><h2 id="checkout-title" className="mt-2 font-display text-2xl font-bold tracking-[-.04em]">Request enrollment</h2><p className="mt-1 text-sm text-ink-500 dark:text-ink-400">{collectionTitle}</p></div>
          <button type="button" onClick={onClose} aria-label="Close checkout" className="grid h-10 w-10 place-items-center rounded-xl text-ink-500 transition hover:bg-ink-100 dark:hover:bg-white/[.07]"><X size={19} /></button>
        </header>
        <div className="grid gap-6 p-6 sm:grid-cols-[.9fr_1.1fr] sm:p-7">
          <div className="space-y-4">
            <div className="rounded-2xl border border-ink-200 bg-white p-4 dark:border-white/10 dark:bg-white/[.035]">
              <div className="mb-3 flex items-center justify-between"><h3 className="text-sm font-semibold">Payment instructions</h3><QrCode size={17} className="text-brand-700 dark:text-brand-300" /></div>
              <div className="aspect-square overflow-hidden rounded-xl bg-ink-50 p-3 dark:bg-ink-950"><img src="/assets/payment.jpg" alt="Note Library payment QR code" className="h-full w-full object-contain" /></div>
              <a href="/assets/payment.jpg" download className="mt-3 inline-flex items-center gap-2 text-xs font-semibold text-brand-700 hover:underline dark:text-brand-300"><Download size={13} /> Download payment QR</a>
              <p className="mt-3 text-xs leading-5 text-ink-500 dark:text-ink-400">Complete payment using the displayed QR, then enter the transaction reference below. Requests are checked by the Note Library team; access is not granted until approval.</p>
            </div>
          </div>
          <div className="space-y-5">
            <div className="rounded-2xl border border-ink-200 bg-white p-5 dark:border-white/10 dark:bg-white/[.035]">
              <div className="flex justify-between text-sm"><span className="text-ink-500">Collection price</span><span className="font-semibold">Rs. {basePrice}</span></div>
              {discount > 0 && <div className="mt-3 flex justify-between text-sm text-emerald-700 dark:text-emerald-300"><span>Promotion ({discount}%)</span><span>− Rs. {Math.round(basePrice * discount / 100)}</span></div>}
              <div className="mt-4 flex items-end justify-between border-t border-ink-200 pt-4 dark:border-white/10"><span className="text-xs font-semibold uppercase tracking-wider text-ink-500">Amount due</span><strong className="font-metric text-3xl">Rs. {finalPrice}</strong></div>
              <div className="mt-4 flex gap-2"><div className="relative min-w-0 flex-1"><Ticket size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" /><input aria-label="Promotion code" value={promoCode} onChange={(event) => setPromoCode(event.target.value.toUpperCase())} placeholder="Promo code" className="w-full rounded-xl border border-ink-200 bg-[#fbfaf7] py-2.5 pl-9 pr-3 text-sm uppercase outline-none focus:border-brand-500 dark:border-white/10 dark:bg-ink-950" /></div><button type="button" onClick={applyPromo} disabled={!promoCode.trim()} className="auth-secondary">Apply</button></div>
            </div>
            <form onSubmit={submit} className="space-y-4">
              <label className="block text-xs font-semibold text-ink-600 dark:text-ink-300">Payment method<select value={provider} onChange={(event) => setProvider(event.target.value)} className="auth-select mt-2"><option value="esewa">eSewa</option><option value="khalti">Khalti</option><option value="bank">Bank transfer</option></select></label>
              <label className="block text-xs font-semibold text-ink-600 dark:text-ink-300">Transaction reference<input required maxLength={150} value={reference} onChange={(event) => setReference(event.target.value)} placeholder="Enter the payment transaction ID" className="auth-input mt-2" /></label>
              <button type="submit" disabled={submitting || finalPrice <= 0} className="auth-primary">{submitting ? <><Loader2 size={15} className="animate-spin" /> Sending request…</> : 'Submit for review'}</button>
              <p className="text-center text-xs leading-5 text-ink-400">Your request remains pending until a reviewer confirms the reference.</p>
            </form>
          </div>
        </div>
      </section>
    </div>
  );
}
