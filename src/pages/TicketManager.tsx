import { useState, useEffect } from 'react';
import { Ticket, Search, Filter, MessageSquare, Clock, XCircle, Send, User, Mail, AlertCircle, RefreshCcw, ExternalLink } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { DashboardLayout } from '../components/DashboardLayout';

interface SupportTicket {
    id: number;
    user_id: number;
    subject: string;
    message: string;
    admin_reply: string | null;
    status: 'pending' | 'answered' | 'closed';
    created_at: string;
    updated_at: string;
    user_name: string;
    user_email: string;
    user_profile_picture: string | null;
    question_id?: number | null;
}

const TicketManager = () => {
    const { token } = useAuth();
    const navigate = useNavigate();
    const [tickets, setTickets] = useState<SupportTicket[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
    const [replies, setReplies] = useState<any[]>([]);
    const [adminReply, setAdminReply] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isFetchingDetails, setIsFetchingDetails] = useState(false);

    const parseMessage = (text: string) => {
        const parts = text.split(/(\*\*.*?\*\*)/g);
        return parts.map((part, i) => {
            if (part.startsWith('**') && part.endsWith('**')) {
                return <strong key={i} className="text-blue-600 bg-blue-50 px-1 rounded">{part.slice(2, -2)}</strong>;
            }
            return part;
        });
    };

    const fetchTicketDetails = async (ticketId: number) => {
        setIsFetchingDetails(true);
        try {
            const response = await fetch(`https://notelibraryapp.com/api/admin/support/get_ticket_details.php?ticket_id=${ticketId}`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            const data = await response.json();
            if (data.success) {
                setReplies(data.replies);
            } else {
                toast.error(data.message || 'Failed to fetch conversation');
            }
        } catch (error) {
            console.error('Thread fetch error:', error);
            toast.error('Error fetching conversation thread');
        } finally {
            setIsFetchingDetails(false);
        }
    };

    const handleSelectTicket = (ticket: SupportTicket) => {
        setSelectedTicket(ticket);
        fetchTicketDetails(ticket.id);
    };

    const fetchTickets = async () => {
        setLoading(true);
        try {
            const response = await fetch('https://notelibraryapp.com/api/admin/support/get_all_tickets.php', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            const data = await response.json();
            if (data.success) {
                setTickets(data.tickets);
            } else {
                toast.error(data.message || 'Failed to fetch tickets');
            }
        } catch (error) {
            console.error('Fetch error:', error);
            toast.error('An error occurred while fetching tickets');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchTickets();
    }, [token]);

    const handleReply = async (ticketId: number, status: string = 'answered') => {
        if (!adminReply.trim() && status !== 'closed') {
            toast.error('Please enter a reply');
            return;
        }

        setIsSubmitting(true);
        try {
            const formData = new FormData();
            formData.append('ticket_id', ticketId.toString());
            formData.append('admin_reply', adminReply);
            formData.append('status', status);

            const response = await fetch('https://notelibraryapp.com/api/admin/support/admin_reply.php', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`
                },
                body: formData
            });

            const data = await response.json();
            if (data.success) {
                toast.success(status === 'closed' ? 'Ticket closed' : 'Reply submitted successfully');
                setAdminReply('');
                if (status === 'closed') {
                    setSelectedTicket(null);
                    fetchTickets();
                } else {
                    fetchTicketDetails(ticketId);
                    fetchTickets();
                }
            } else {
                toast.error(data.message || 'Failed to submit reply');
            }
        } catch (error) {
            console.error('Reply error:', error);
            toast.error('An error occurred while submitting reply');
        } finally {
            setIsSubmitting(false);
        }
    };

    const filteredTickets = tickets.filter(ticket => {
        const matchesSearch =
            ticket.subject.toLowerCase().includes(searchTerm.toLowerCase()) ||
            ticket.user_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            ticket.user_email.toLowerCase().includes(searchTerm.toLowerCase());

        const matchesStatus = statusFilter === 'all' || ticket.status === statusFilter;

        return matchesSearch && matchesStatus;
    });

    const getStatusStyle = (status: string) => {
        switch (status) {
            case 'pending': return 'bg-amber-100 text-amber-700 border-amber-200';
            case 'answered': return 'bg-green-100 text-green-700 border-green-200';
            case 'closed': return 'bg-slate-100 text-slate-700 border-slate-200';
            default: return 'bg-blue-100 text-blue-700 border-blue-200';
        }
    };

    return (
        <DashboardLayout>
            <div className="space-y-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900">Support Tickets</h1>
                        <p className="text-slate-500 text-sm">Manage and respond to student inquiries</p>
                    </div>
                    <button
                        onClick={fetchTickets}
                        className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 transition-colors shadow-sm"
                    >
                        <RefreshCcw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                        Refresh
                    </button>
                </div>

                {/* Filters */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                    <div className="md:col-span-2 relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                        <input
                            type="text"
                            placeholder="Search by subject, name, or email..."
                            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <div className="relative">
                        <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                        <select
                            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm appearance-none"
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                        >
                            <option value="all">All Statuses</option>
                            <option value="pending">Pending</option>
                            <option value="answered">Answered</option>
                            <option value="closed">Closed</option>
                        </select>
                    </div>
                    <div className="flex items-center justify-end text-xs text-slate-500 font-medium">
                        Showing {filteredTickets.length} of {tickets.length} tickets
                    </div>
                </div>

                {/* Tickets Table */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-slate-50 border-b border-slate-200">
                                    <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">User</th>
                                    <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Ticket Info</th>
                                    <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Status</th>
                                    <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Created</th>
                                    <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {loading ? (
                                    <tr>
                                        <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                                            <div className="flex flex-col items-center gap-3">
                                                <div className="w-8 h-8 border-2 border-blue-600/20 border-t-blue-600 rounded-full animate-spin"></div>
                                                <p className="font-medium">Loading tickets...</p>
                                            </div>
                                        </td>
                                    </tr>
                                ) : filteredTickets.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                                            <div className="flex flex-col items-center gap-2">
                                                <Ticket className="w-12 h-12 text-slate-200 mb-2" />
                                                <p className="font-bold text-slate-900 text-lg">No Tickets Found</p>
                                                <p className="text-sm">Try adjusting your search or filters</p>
                                            </div>
                                        </td>
                                    </tr>
                                ) : (
                                    filteredTickets.map((ticket) => (
                                        <tr key={ticket.id} className="hover:bg-slate-50/80 transition-colors group">
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center overflow-hidden border-2 border-slate-50">
                                                        {ticket.user_profile_picture ? (
                                                            <img
                                                                src={ticket.user_profile_picture.startsWith('http') ? ticket.user_profile_picture : `https://notelibraryapp.com${ticket.user_profile_picture}`}
                                                                className="w-full h-full object-cover"
                                                                alt=""
                                                            />
                                                        ) : (
                                                            <User className="text-slate-400 w-5 h-5" />
                                                        )}
                                                    </div>
                                                    <div className="flex flex-col truncate max-w-[150px]">
                                                        <span className="font-semibold text-slate-900 truncate">{ticket.user_name}</span>
                                                        <span className="text-[10px] text-slate-500 truncate">{ticket.user_email}</span>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex flex-col">
                                                    <span className="font-bold text-slate-900 group-hover:text-blue-600 transition-colors">{ticket.subject}</span>
                                                    <span className="text-slate-500 text-sm line-clamp-1 italic max-w-xs">"{ticket.message}"</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${getStatusStyle(ticket.status)}`}>
                                                    {ticket.status}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-sm text-slate-500">
                                                <div className="flex items-center gap-1.5">
                                                    <Clock className="w-3.5 h-3.5" />
                                                    {new Date(ticket.created_at).toLocaleDateString()}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <button
                                                    onClick={() => handleSelectTicket(ticket)}
                                                    className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                                                    title="View / Reply"
                                                >
                                                    <MessageSquare className="w-5 h-5" />
                                                </button>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Reply Modal */}
                {selectedTicket && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-300">
                        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
                            {/* Modal Header */}
                            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-white sticky top-0 z-10">
                                <div className="flex items-center gap-4">
                                    <div className="p-3 bg-blue-100 rounded-xl text-blue-600">
                                        <Ticket className="w-6 h-6" />
                                    </div>
                                    <div>
                                        <h3 className="text-xl font-bold text-slate-900">Ticket Conversation</h3>
                                        <p className="text-sm text-slate-500">ID: #{selectedTicket.id} | {selectedTicket.subject}</p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setSelectedTicket(null)}
                                    className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                                >
                                    <XCircle className="w-6 h-6" />
                                </button>
                            </div>

                            {/* Modal Body - Conversation Thread */}
                            <div className="p-6 overflow-y-auto space-y-6 flex-1 bg-slate-50 custom-scrollbar">
                                {isFetchingDetails ? (
                                    <div className="flex flex-col items-center justify-center py-20 gap-3">
                                        <div className="w-8 h-8 border-2 border-blue-600/20 border-t-blue-600 rounded-full animate-spin"></div>
                                        <p className="text-slate-500 font-medium">Loading history...</p>
                                    </div>
                                ) : (
                                    <>
                                        {/* User Info Header in Modal */}
                                        <div className="flex items-center gap-4 p-4 bg-white rounded-xl border border-slate-100 shadow-sm mb-4">
                                            <div className="h-12 w-12 rounded-full bg-slate-100 flex items-center justify-center overflow-hidden">
                                                {selectedTicket.user_profile_picture ? (
                                                    <img
                                                        src={selectedTicket.user_profile_picture.startsWith('http') ? selectedTicket.user_profile_picture : `https://notelibraryapp.com${selectedTicket.user_profile_picture}`}
                                                        className="w-full h-full object-cover"
                                                        alt=""
                                                    />
                                                ) : (
                                                    <User className="text-slate-400 w-6 h-6" />
                                                )}
                                            </div>
                                            <div>
                                                <p className="font-bold text-slate-900">{selectedTicket.user_name}</p>
                                                <p className="text-xs text-slate-500 font-medium flex items-center gap-1">
                                                    <Mail className="w-3 h-3" /> {selectedTicket.user_email}
                                                </p>
                                            </div>
                                            <div className="ml-auto">
                                                <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${getStatusStyle(selectedTicket.status)}`}>
                                                    {selectedTicket.status}
                                                </span>
                                            </div>
                                        </div>

                                        {/* Initial Student Message */}
                                        <div className="flex flex-col items-start max-w-[85%] space-y-1">
                                            <div className="flex items-center justify-between w-full pr-4">
                                                <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">
                                                    Student Inquiry • {new Date(selectedTicket.created_at).toLocaleString()}
                                                </div>
                                                {selectedTicket.question_id && (
                                                    <button 
                                                        onClick={() => navigate(`/question-bank?q_id=${selectedTicket.question_id}`)}
                                                        className="flex items-center gap-1 text-[10px] font-bold text-blue-600 hover:text-blue-800 transition-colors uppercase tracking-widest"
                                                    >
                                                        Go to Question <ExternalLink className="w-3 h-3" />
                                                    </button>
                                                )}
                                            </div>
                                            <div className="bg-white p-4 rounded-2xl rounded-tl-none border border-slate-100 shadow-sm text-slate-700 text-sm whitespace-pre-wrap">
                                                <p className="font-bold text-slate-900 mb-1">{selectedTicket.subject}</p>
                                                {parseMessage(selectedTicket.message)}
                                            </div>
                                        </div>

                                        {/* Replies */}
                                        {replies.map((reply, idx) => (
                                            <div key={reply.id || idx} className={`flex flex-col max-w-[85%] space-y-1 ${reply.is_admin ? 'ml-auto items-end' : 'items-start'}`}>
                                                <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">
                                                    {reply.is_admin ? 'Support Team' : 'Student'} • {new Date(reply.created_at).toLocaleString()}
                                                    {reply.is_legacy && <span className="text-[8px] bg-slate-200 px-1 rounded ml-1">Legacy</span>}
                                                </div>
                                                <div className={`p-4 rounded-2xl text-sm whitespace-pre-wrap shadow-sm ${reply.is_admin
                                                    ? 'bg-blue-600 text-white rounded-tr-none'
                                                    : 'bg-white text-slate-700 rounded-tl-none border border-slate-100'
                                                    }`}>
                                                    {parseMessage(reply.message)}
                                                </div>
                                            </div>
                                        ))}
                                    </>
                                )}
                            </div>

                            {/* Modal Footer - Reply Form */}
                            <div className="p-6 border-t border-slate-100 bg-white sticky bottom-0 z-10 space-y-4">
                                {selectedTicket.status === 'closed' ? (
                                    <div className="flex items-center justify-center gap-2 text-slate-400 py-2 border border-dashed border-slate-200 rounded-xl bg-slate-50">
                                        <AlertCircle size={14} />
                                        <span className="text-sm font-medium">This ticket is closed. Re-open to reply.</span>
                                    </div>
                                ) : (
                                    <div className="space-y-4">
                                        <textarea
                                            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none text-slate-800 text-sm transition-all resize-none"
                                            rows={2}
                                            placeholder="Type your response here..."
                                            value={adminReply}
                                            onChange={(e) => setAdminReply(e.target.value)}
                                        ></textarea>
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2 text-slate-400 text-[10px] font-bold uppercase tracking-widest italic">
                                                <AlertCircle size={14} />
                                                Student will be notified
                                            </div>
                                            <div className="flex gap-3">
                                                <button
                                                    onClick={() => handleReply(selectedTicket.id, 'closed')}
                                                    disabled={isSubmitting}
                                                    className="px-4 py-2 bg-slate-100 text-slate-600 rounded-lg font-bold text-xs hover:bg-slate-200 transition-colors disabled:opacity-50"
                                                >
                                                    Close Ticket
                                                </button>
                                                <button
                                                    onClick={() => handleReply(selectedTicket.id)}
                                                    disabled={isSubmitting || !adminReply.trim()}
                                                    className="px-6 py-2 bg-blue-600 text-white rounded-lg font-bold text-xs hover:bg-blue-700 shadow-md shadow-blue-600/10 transition-all flex items-center gap-2 disabled:bg-slate-300 disabled:shadow-none"
                                                >
                                                    {isSubmitting ? (
                                                        <RefreshCcw className="w-3 h-3 animate-spin" />
                                                    ) : (
                                                        <>
                                                            <Send className="w-3 h-3" />
                                                            Send Reply
                                                        </>
                                                    )}
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </DashboardLayout>
    );
};

export default TicketManager;
