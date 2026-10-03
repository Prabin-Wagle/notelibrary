import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Ticket, Clock, CheckCircle2, XCircle, RefreshCcw, MessageCircle, ChevronRight } from 'lucide-react';
import toast from 'react-hot-toast';
import localData from '../data/localData';

interface SupportTicket {
    id: number;
    subject: string;
    message: string;
    admin_reply: string | null;
    status: 'pending' | 'answered' | 'closed';
    created_at: string;
    updated_at: string;
}

export default function SupportTicketsPage() {
    const [tickets, setTickets] = useState<SupportTicket[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const navigate = useNavigate();

    const fetchTickets = async () => {
        setIsLoading(true);
        try {
            const response = await localData.get('tickets');
            const data = response.data;

            if (data.status === 'success') {
                setTickets(data.tickets);
            } else {
                toast.error(data.message || 'Failed to load tickets');
            }
        } catch (error) {
            console.error('Fetch error:', error);
            toast.error('Local tickets could not be loaded.');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchTickets();
    }, []);

    const getStatusStyle = (status: string) => {
        switch (status) {
            case 'pending':
                return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400';
            case 'answered':
                return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400';
            case 'closed':
                return 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400';
            default:
                return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400';
        }
    };

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'pending':
                return <Clock size={14} />;
            case 'answered':
                return <CheckCircle2 size={14} />;
            case 'closed':
                return <XCircle size={14} />;
            default:
                return <Ticket size={14} />;
        }
    };

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-gray-900 p-8 rounded-3xl border border-gray-100 dark:border-gray-800 shadow-sm">
                <div className="flex items-center gap-5">
                    <div className="p-4 bg-indigo-100 dark:bg-indigo-900/30 rounded-2xl text-indigo-600 dark:text-indigo-400">
                        <Ticket size={28} />
                    </div>
                    <div>
                        <h1 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight">Support Tickets</h1>
                        <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">Manage and track all your support inquiries</p>
                    </div>
                </div>
                <button
                    onClick={fetchTickets}
                    className="flex items-center justify-center gap-2 px-6 py-3 bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-xl font-bold text-sm hover:bg-gray-100 dark:hover:bg-gray-700 transition-all active:scale-95"
                >
                    <RefreshCcw size={16} className={isLoading ? 'animate-spin' : ''} />
                    Refresh
                </button>
            </div>

            {/* Tickets List */}
            {isLoading ? (
                <div className="flex flex-col items-center justify-center py-20 gap-4">
                    <div className="h-10 w-10 border-4 border-blue-600/20 border-t-blue-600 rounded-full animate-spin"></div>
                    <p className="text-gray-500 dark:text-gray-400 font-medium">Loading your tickets...</p>
                </div>
            ) : tickets.length === 0 ? (
                <div className="bg-white dark:bg-gray-900 p-12 rounded-3xl border border-gray-100 dark:border-gray-800 text-center space-y-4">
                    <div className="inline-flex p-4 bg-gray-100 dark:bg-gray-800 rounded-full text-gray-400">
                        <MessageCircle size={48} />
                    </div>
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white">No Tickets Found</h2>
                    <p className="text-gray-500 dark:text-gray-400 max-w-xs mx-auto">
                        You haven't submitted any support tickets yet. Need help? Head over to the Contact page.
                    </p>
                </div>
            ) : (
                <div className="grid grid-cols-1 gap-4">
                    {tickets.map((ticket) => (
                        <div
                            key={ticket.id}
                            className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 hover:border-blue-200 dark:hover:border-blue-900 shadow-sm transition-all duration-300 overflow-hidden group"
                        >
                            <button
                                onClick={() => navigate(`/support-tickets/${ticket.id}`)}
                                className="w-full text-left p-6 flex flex-col md:flex-row md:items-center justify-between gap-4"
                            >
                                <div className="flex items-center gap-4 flex-1">
                                    <div className="p-3 rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-500 group-hover:bg-blue-600 group-hover:text-white transition-colors duration-300">
                                        <Ticket size={18} />
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-gray-900 dark:text-white mb-1 group-hover:text-blue-600 transition-colors">{ticket.subject}</h3>
                                        <div className="flex flex-wrap items-center gap-3 text-xs font-medium text-gray-400">
                                            <span className="flex items-center gap-1"><Clock size={12} /> {new Date(ticket.created_at).toLocaleDateString()}</span>
                                            <span className="bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded text-[10px] uppercase tracking-wider">#{ticket.id}</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center gap-4">
                                    <span className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wide ${getStatusStyle(ticket.status)}`}>
                                        {getStatusIcon(ticket.status)}
                                        {ticket.status}
                                    </span>
                                    <div className="text-gray-400 group-hover:translate-x-1 transition-transform">
                                        <ChevronRight size={20} />
                                    </div>
                                </div>
                            </button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
