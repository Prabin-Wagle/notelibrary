import { useTheme } from '../contexts/ThemeContext';
import { Sun, Moon, Monitor } from 'lucide-react';

export default function ThemeSwitcher() {
    const { theme, setTheme } = useTheme();

    const themes = [
        { id: 'light', icon: Sun, label: 'Light' },
        { id: 'system', icon: Monitor, label: 'System' },
        { id: 'dark', icon: Moon, label: 'Dark' },
    ] as const;

    return (
        <div className="flex items-center gap-0.5 bg-ink-100 dark:bg-white/[0.06] border border-ink-200 dark:border-white/[0.06] p-1 rounded-lg">
            {themes.map(({ id, icon: Icon, label }) => (
                <button
                    key={id}
                    onClick={() => setTheme(id)}
                    className={`p-1.5 rounded-md transition-colors ${theme === id
                        ? 'bg-white dark:bg-white text-brand-600 dark:text-brand-400 shadow-sm'
                        : 'text-ink-400 dark:text-ink-500 hover:text-ink-700 dark:hover:text-ink-200'
                        }`}
                    title={label}
                    aria-label={`${label} theme`}
                >
                    <Icon size={13} />
                </button>
            ))}
        </div>
    );
}
