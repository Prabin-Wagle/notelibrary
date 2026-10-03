import { Quote } from 'lucide-react';

const fallbacks = [
    { text: "To be yourself in a world that is constantly trying to make you something else is the greatest accomplishment.", author: "Ralph Waldo Emerson" },
    { text: "To live is the rarest thing in the world. Most people exist, that is all.", author: "Oscar Wilde" },
    { text: "Live as if you were to die tomorrow. Learn as if you were to live forever.", author: "Mahatma Gandhi" },
    { text: "Darkness cannot drive out darkness: only light can do that. Hate cannot drive out hate: only love can do that.", author: "Martin Luther King Jr." },
    { text: "Without music, life would be a mistake.", author: "Friedrich Nietzsche" },
    { text: "We accept the love we think we deserve.", author: "Stephen Chbosky" },
    { text: "Be yourself; everyone else is already taken.", author: "Oscar Wilde" },
    { text: "Two things are infinite: the universe and human stupidity; and I'm not sure about the universe.", author: "Albert Einstein" },
    { text: "So many books, so little time.", author: "Frank Zappa" },
    { text: "A room without books is like a body without a soul.", author: "Marcus Tullius Cicero" },
    { text: "If you tell the truth, you don't have to remember anything.", author: "Mark Twain" },
];

export default function QuoteOfTheDay() {
    const quote = fallbacks[new Date().getDate() % fallbacks.length];

    return (
        <div className="surface-card flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6 px-5 sm:px-6 py-5 border-l-2 !border-l-brand-500">
            <div className="flex items-center gap-2 shrink-0">
                <Quote size={14} className="text-brand-500 dark:text-brand-400" />
                <span className="dashboard-eyebrow text-brand-600 dark:text-brand-400 !text-[0.5625rem]">Daily fuel</span>
            </div>

            <p className="flex-1 font-editorial italic text-[0.9375rem] leading-relaxed text-ink-700 dark:text-ink-200 line-clamp-2 min-w-0">
                “{quote.text}”
            </p>

            <p className="font-display text-xs font-semibold text-ink-400 dark:text-ink-500 shrink-0">
                — {quote.author}
            </p>
        </div>
    );
}
