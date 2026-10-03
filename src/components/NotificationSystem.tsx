import { useState, useEffect, useRef } from 'react';
import { Bell, CheckCircle2, AlertCircle, Info, X } from 'lucide-react';
import localData from '../data/localData';
import { useAuth } from '../contexts/AuthContext';

interface Notification {
    id: string | number;
    title: string;
    message: string;
    type: 'info' | 'success' | 'warning' | 'error';
    is_read: number;
    created_at: string;
}

export default function NotificationSystem() {
    const { user } = useAuth();
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    const fetchNotifications = async () => {
        try {
            const response = await localData.get(`notifications`, {
                params: { user_id: user?.id }
            });
            if (response.data.status === 'success') {
                setNotifications(response.data.notifications);
            }
        } catch (error) {
            console.error('Failed to fetch notifications:', error);
        }
    };

    useEffect(() => {
        if (user?.id) {
            fetchNotifications();
            // Poll for new notifications every 60 seconds
            const interval = setInterval(fetchNotifications, 60000);
            return () => clearInterval(interval);
        }
    }, [user?.id]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const markAsRead = async (id: string | number) => {
        try {
            await localData.get(`notifications`, {
                params: { user_id: user?.id, mark_read: id }
            });
            setNotifications(prev => prev.map(n => String(n.id) === String(id) ? { ...n, is_read: 1 } : n));
        } catch (error) {
            console.error('Failed to mark notification as read:', error);
        }
    };

    const markAllAsRead = async () => {
        try {
            await localData.get(`notifications`, {
                params: { user_id: user?.id, mark_all: 1 }
            });
            setNotifications(prev => prev.map(n => ({ ...n, is_read: 1 })));
        } catch (error) {
            console.error('Failed to mark all notifications as read:', error);
        }
    };

    const unreadCount = notifications.filter(n => !n.is_read).length;

    const getIcon = (type: string) => {
        switch (type) {
            case 'success': return <CheckCircle2 className="text-green-500" size={16} />;
            case 'warning': return <AlertCircle className="text-orange-500" size={16} />;
            case 'error': return <X className="text-red-500" size={16} />;
            default: return <Info className="text-blue-500" size={16} />;
        }
    };

    return (
        <div className="relative" ref={dropdownRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="p-2 text-gray-400 hover:text-gray-900 dark:hover:text-white bg-gray-50 dark:bg-gray-800 rounded-xl transition-all relative group"
            >
                <Bell size={20} className="group-hover:rotate-12 transition-transform" />
                {unreadCount > 0 && (
                    <span className="absolute top-1.5 right-1.5 w-4 h-4 bg-red-500 text-white text-[10px] font-black rounded-full flex items-center justify-center border-2 border-white dark:border-gray-800 animate-bounce">
                        {unreadCount}
                    </span>
                )}
            </button>

            {isOpen && (
                <div className="absolute right-0 mt-3 w-80 bg-white dark:bg-gray-900 rounded-[2rem] shadow-2xl border border-gray-100 dark:border-gray-800 z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-300">
                    <div className="p-5 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between bg-gray-50/50 dark:bg-gray-800/50">
                        <h3 className="font-black text-gray-900 dark:text-white uppercase tracking-widest text-[10px]">Notifications</h3>
                        {unreadCount > 0 && (
                            <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400">{unreadCount} New</span>
                        )}
                    </div>

                    <div className="max-h-[350px] overflow-y-auto">
                        {notifications.length > 0 ? (
                            notifications.map((n) => (
                                <div
                                    key={n.id}
                                    onClick={() => !n.is_read && markAsRead(n.id)}
                                    className={`p-4 border-b border-gray-50 dark:border-gray-800/50 transition-colors cursor-pointer ${!n.is_read ? 'bg-blue-50/30 dark:bg-blue-900/10' : 'hover:bg-gray-50 dark:hover:bg-gray-800/50'
                                        }`}
                                >
                                    <div className="flex gap-3">
                                        <div className="mt-1">{getIcon(n.type)}</div>
                                        <div className="flex-1">
                                            <h4 className="text-xs font-bold text-gray-900 dark:text-white mb-1 uppercase tracking-tight">{n.title}</h4>
                                            <p className="text-[11px] text-gray-500 dark:text-gray-400 leading-relaxed">{n.message}</p>
                                            <span className="text-[9px] text-gray-400 font-bold uppercase tracking-widest mt-2 block">
                                                {new Date(n.created_at).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="p-8 text-center text-gray-400 font-medium text-sm">
                                No notifications yet.
                            </div>
                        )}
                    </div>

                    <div className="p-4 bg-gray-50 dark:bg-gray-800/50 text-center">
                        <button
                            onClick={markAllAsRead}
                            className="text-[10px] font-black text-gray-500 uppercase tracking-widest hover:text-blue-600 transition-colors"
                        >
                            Mark all as read
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
