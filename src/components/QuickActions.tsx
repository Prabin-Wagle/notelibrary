import { useNavigate } from 'react-router-dom';
import { Play, BookOpen, MessageSquare, User, ArrowUpRight } from 'lucide-react';

export default function QuickActions() {
    const navigate = useNavigate();

    const actions = [
        { label: 'Test Series', description: 'Take a live test', icon: Play, path: '/test-series', highlight: true },
        { label: 'Study Notes', description: 'Browse subjects', icon: BookOpen, path: '/subjects', highlight: false },
        { label: 'My Profile', description: 'Account & settings', icon: User, path: '/profile', highlight: false },
        { label: 'Help center', description: 'Get help', icon: MessageSquare, path: '/support', highlight: false },
    ];

    return (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            {actions.map((action) => (
                <button
                    key={action.path}
                    onClick={() => navigate(action.path)}
                    className="group surface-card flex flex-col items-start gap-6 p-4 sm:p-5 text-left transition-colors hover:border-brand-500/40 active:scale-[0.99]"
                >
                    <div className="flex items-center justify-between w-full">
                        <div className={`grid place-items-center h-9 w-9 rounded-lg transition-colors ${action.highlight
                            ? 'bg-brand-500/10 text-brand-600 dark:text-brand-400'
                            : 'bg-ink-100 dark:bg-white/[0.06] text-ink-500 dark:text-ink-400 group-hover:text-ink-900 dark:group-hover:text-white'
                            }`}>
                            <action.icon size={16} strokeWidth={2.2} />
                        </div>
                        <ArrowUpRight
                            size={15}
                            className="text-ink-300 dark:text-ink-600 group-hover:text-brand-500 transition-colors"
                        />
                    </div>
                    <div>
                        <span className="font-display text-[0.8125rem] font-semibold text-ink-900 dark:text-white block truncate">
                            {action.label}
                        </span>
                        <span className="mt-0.5 text-xs text-ink-400 dark:text-ink-500 block truncate">
                            {action.description}
                        </span>
                    </div>
                </button>
            ))}
        </div>
    );
}
