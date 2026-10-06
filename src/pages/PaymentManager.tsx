import { useState, useEffect } from 'react';
import { CreditCard, Search, Filter, CheckCircle, XCircle, Eye, User, Clock, RefreshCcw, AlertCircle, ExternalLink, AlertTriangle, Download } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import { DashboardLayout } from '../components/DashboardLayout';

interface PaymentRequest {
    id: number;
    user_id: number;
    user_name: string;
    user_email: string;
    collection_id: number;
    collection_title: string;
    screenshot_path: string;
    status: 'pending' | 'approved' | 'rejected';
    transaction_code: string | null;
    promo_code: string | null;
    created_at: string;
    user_profile_picture: string | null;
}

const PaymentManager = () => {
    const { token } = useAuth();
    const [requests, setRequests] = useState<PaymentRequest[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [selectedRequest, setSelectedRequest] = useState<PaymentRequest | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [manualTransactionCode, setManualTransactionCode] = useState('');
    const [manualNote, setManualNote] = useState('');

    const fetchRequests = async () => {
        setLoading(true);
        try {
            const response = await fetch(`https://notelibraryapp.com/api/admin/payment/get_requests.php?status=${statusFilter}`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            const data = await response.json();
            if (data.success) {
                setRequests(data.data);
            } else {
                toast.error(data.message || 'Failed to fetch requests');
            }
        } catch (error) {
            console.error('Fetch error:', error);
            toast.error('An error occurred while fetching payment requests');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchRequests();
    }, [token, statusFilter]);

    const handleAction = async (requestId: number, action: 'approve' | 'reject' | 'revoke') => {
        setIsProcessing(true);
        try {
            const response = await fetch('https://notelibraryapp.com/api/admin/payment/handle_request.php', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`
                },
                body: (() => {
                    const fd = new FormData();
                    fd.append('request_id', requestId.toString());
                    fd.append('action', action);
                    fd.append('note', manualNote);
                    if (manualTransactionCode) fd.append('transaction_code', manualTransactionCode);
                    return fd;
                })()
            });

            const data = await response.json();
            if (data.success) {
                toast.success(data.message);
                setSelectedRequest(null);
                fetchRequests();
            } else {
                toast.error(data.message || `Failed to ${action} request`);
            }
        } catch (error) {
            console.error('Processing error:', error);
            toast.error(`An error occurred while ${action}ing request`);
        } finally {
            setIsProcessing(false);
        }
    };

    const filteredRequests = requests.filter(req =>
        req.user_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        req.user_email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        req.collection_title.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const downloadCSV = () => {
        if (filteredRequests.length === 0) {
            toast.error('No data to export');
            return;
        }

        const headers = [
            'ID',
            'Student Name',
            'Student Email',
            'Collection',
            'Collection ID',
            'Promo Code',
            'Transaction Code',
            'Status',
            'Submitted Date',
        ];

        const escapeCSV = (value: string | number | null | undefined): string => {
            if (value === null || value === undefined) return '';
            const str = String(value);
            if (str.includes(',') || str.includes('"') || str.includes('\n')) {
                return `"${str.replace(/"/g, '""')}"`;
            }
            return str;
        };

        const rows = filteredRequests.map(req => [
            escapeCSV(req.id),
            escapeCSV(req.user_name),
            escapeCSV(req.user_email),
            escapeCSV(req.collection_title),
            escapeCSV(req.collection_id),
            escapeCSV(req.promo_code),
            escapeCSV(req.transaction_code),
            escapeCSV(req.status),
            escapeCSV(new Date(req.created_at).toLocaleString()),
        ]);

        const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        const filterLabel = statusFilter === 'all' ? 'all' : statusFilter;
        link.href = url;
        link.download = `payment_requests_${filterLabel}_${new Date().toISOString().slice(0, 10)}.csv`;
        link.click();
        URL.revokeObjectURL(url);
        toast.success(`Exported ${filteredRequests.length} records to CSV`);
    };

    const getStatusStyle = (status: string) => {
        switch (status) {
            case 'pending': return 'bg-amber-100 text-amber-700 border-amber-200';
            case 'approved': return 'bg-green-100 text-green-700 border-green-200';
            case 'rejected': return 'bg-red-100 text-red-700 border-red-200';
            default: return 'bg-blue-100 text-blue-700 border-blue-200';
        }
    };

    return (
        <DashboardLayout>
            <div className="space-y-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                            <CreditCard className="text-blue-600" />
                            Payment Verifications
                        </h1>
                        <p className="text-slate-500 text-sm">Verify student payments and grant course access</p>
                    </div>
                    <button
                        onClick={fetchRequests}
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
                            placeholder="Search by name, email or collection..."
                            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <div className="relative">
                        <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                        <select
                            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm appearance-none font-medium"
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                        >
                            <option value="all">All Requests ({requests.length})</option>
                            <option value="pending">Pending Only ({requests.filter(r => r.status === 'pending').length})</option>
                            <option value="approved">Approved</option>
                            <option value="rejected">Rejected</option>
                        </select>
                    </div>
                    <div className="flex items-center justify-end gap-3">
                        <span className="text-xs text-slate-500 font-medium">
                            Showing {filteredRequests.length} results
                        </span>
                        <button
                            onClick={downloadCSV}
                            disabled={filteredRequests.length === 0}
                            className="flex items-center gap-2 px-3 py-2 bg-emerald-600 text-white rounded-lg text-xs font-bold hover:bg-emerald-700 transition-colors shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
                            title="Download filtered results as CSV"
                        >
                            <Download className="w-3.5 h-3.5" />
                            Export CSV
                        </button>
                    </div>
                </div>

                {/* Table */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-slate-50 border-b border-slate-200">
                                    <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Student</th>
                                    <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Purchase</th>
                                    <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Promo Code</th>
                                    <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Transaction Code</th>
                                    <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Date</th>
                                    <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Status</th>
                                    <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {loading ? (
                                    <tr>
                                        <td colSpan={7} className="px-6 py-12 text-center">
                                            <div className="flex flex-col items-center gap-3">
                                                <div className="w-8 h-8 border-2 border-blue-600/20 border-t-blue-600 rounded-full animate-spin"></div>
                                                <p className="text-slate-500 font-medium">Loading requests...</p>
                                            </div>
                                        </td>
                                    </tr>
                                ) : filteredRequests.length === 0 ? (
                                    <tr>
                                        <td colSpan={7} className="px-6 py-12 text-center text-slate-500">
                                            <div className="flex flex-col items-center gap-2">
                                                <CreditCard className="w-12 h-12 text-slate-200 mb-2" />
                                                <p className="font-bold text-slate-900 text-lg">No Requests Found</p>
                                                <p className="text-sm">Requests will appear here as students buy courses</p>
                                            </div>
                                        </td>
                                    </tr>
                                ) : (
                                    filteredRequests.map((req) => (
                                        <tr key={req.id} className="hover:bg-slate-50/80 transition-colors group">
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center overflow-hidden border-2 border-slate-50">
                                                        {req.user_profile_picture ? (
                                                            <img
                                                                src={req.user_profile_picture.startsWith('http') ? req.user_profile_picture : `https://notelibraryapp.com${req.user_profile_picture}`}
                                                                className="w-full h-full object-cover"
                                                                alt=""
                                                            />
                                                        ) : (
                                                            <User className="text-slate-400 w-5 h-5" />
                                                        )}
                                                    </div>
                                                    <div className="flex flex-col truncate max-w-[180px]">
                                                        <span className="font-semibold text-slate-900 truncate">{req.user_name}</span>
                                                        <span className="text-[10px] text-slate-500 truncate">{req.user_email}</span>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex flex-col">
                                                    <span className="font-bold text-slate-900 group-hover:text-blue-600 transition-colors">{req.collection_title}</span>
                                                    <span className="text-slate-500 text-xs italic">ID: #{req.collection_id}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                {req.promo_code ? (
                                                    <span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-lg text-[10px] font-black uppercase tracking-wider">
                                                        🎟️ {req.promo_code}
                                                    </span>
                                                ) : (
                                                    <span className="text-slate-400 text-xs font-semibold">-</span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 font-mono text-xs text-slate-600">
                                                {req.transaction_code || '---'}
                                            </td>
                                            <td className="px-6 py-4 text-sm text-slate-500">
                                                <div className="flex items-center gap-1.5">
                                                    <Clock className="w-3.5 h-3.5" />
                                                    {new Date(req.created_at).toLocaleDateString()}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-sm">
                                                <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${getStatusStyle(req.status)}`}>
                                                    {req.status}
                                                </span>
                                            </td>

                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-1">
                                                    <button
                                                        onClick={() => setSelectedRequest(req)}
                                                        className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                                                        title="View Proof"
                                                    >
                                                        <Eye className="w-5 h-5" />
                                                    </button>
                                                    {req.status === 'approved' ? (
                                                        <button
                                                            onClick={() => {
                                                                if (window.confirm(`Revoke access for ${req.user_name}?`)) {
                                                                    handleAction(req.id, 'revoke');
                                                                }
                                                            }}
                                                            className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                                                            title="Revoke Access"
                                                        >
                                                            <XCircle className="w-5 h-5" />
                                                        </button>
                                                    ) : (
                                                        <button
                                                            onClick={() => handleAction(req.id, 'approve')}
                                                            className="p-2 text-slate-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-all"
                                                            title="Approve & Grant"
                                                        >
                                                            <CheckCircle className="w-5 h-5" />
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Verification Modal */}
                {selectedRequest && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-300">
                        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[95vh]">
                            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-white sticky top-0 z-10">
                                <div className="flex items-center gap-4">
                                    <div className="p-3 bg-blue-100 rounded-xl text-blue-600">
                                        <CreditCard className="w-6 h-6" />
                                    </div>
                                    <div>
                                        <h3 className="text-xl font-bold text-slate-900">Verify Payment</h3>
                                        <p className="text-sm text-slate-500">Request ID: #{selectedRequest.id}</p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => {
                                        setSelectedRequest(null);
                                        setManualTransactionCode('');
                                        setManualNote('');
                                    }}
                                    className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                                >
                                    <XCircle className="w-6 h-6" />
                                </button>
                            </div>

                            <div className="flex-1 overflow-y-auto p-6 bg-slate-50 grid grid-cols-1 lg:grid-cols-2 gap-6">
                                {/* Details Column */}
                                <div className="space-y-6">
                                    <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm space-y-4">
                                        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest px-1">Student Information</h4>
                                        <div className="flex items-center gap-4 p-3 bg-slate-50 rounded-xl">
                                            <div className="h-12 w-12 rounded-full bg-white flex items-center justify-center overflow-hidden border border-slate-200">
                                                {selectedRequest.user_profile_picture ? (
                                                    <img
                                                        src={selectedRequest.user_profile_picture.startsWith('http') ? selectedRequest.user_profile_picture : `https://notelibraryapp.com${selectedRequest.user_profile_picture}`}
                                                        className="w-full h-full object-cover"
                                                        alt=""
                                                    />
                                                ) : (
                                                    <User className="text-slate-400 w-6 h-6" />
                                                )}
                                            </div>
                                            <div>
                                                <p className="font-bold text-slate-900">{selectedRequest.user_name}</p>
                                                <p className="text-xs text-slate-500">{selectedRequest.user_email}</p>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm space-y-4">
                                        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest px-1">Purchase Details</h4>
                                        <div className="space-y-2">
                                            <p className="text-sm text-slate-600 font-medium">Requesting access to:</p>
                                            <div className="p-4 bg-blue-50 border border-blue-100 rounded-xl">
                                                <p className="font-bold text-blue-900">{selectedRequest.collection_title}</p>
                                                <p className="text-xs text-blue-700 mt-1">Collection ID: #{selectedRequest.collection_id}</p>
                                            </div>
                                            {selectedRequest.promo_code && (
                                                <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-xl flex items-center justify-between">
                                                    <span className="text-xs font-bold text-emerald-800">Applied Promo Code:</span>
                                                    <span className="px-2.5 py-1 bg-emerald-600 text-white rounded-lg text-[10px] font-black tracking-widest">
                                                        🎟️ {selectedRequest.promo_code}
                                                    </span>
                                                </div>
                                            )}
                                            <div className="flex items-center gap-2 mt-4 text-xs text-slate-500">
                                                <Clock size={14} /> Submitted on {new Date(selectedRequest.created_at).toLocaleString()}
                                            </div>
                                        </div>
                                    </div>

                                    {selectedRequest.transaction_code && (
                                        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm space-y-4">
                                            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest px-1">Transaction Details</h4>
                                            <div className="p-4 rounded-xl border bg-slate-50 border-slate-100 text-slate-600">
                                                <p className="text-sm">
                                                    Transaction Code: <span className="font-mono font-bold bg-white/50 px-2 py-0.5 rounded">{selectedRequest.transaction_code}</span>
                                                </p>
                                            </div>
                                        </div>
                                    )}

                                    {selectedRequest.status === 'pending' && (
                                        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm space-y-4">
                                            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest px-1">Manual Resolution</h4>
                                            <div className="space-y-3">
                                                <div>
                                                    <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Override Transaction Code (Optional)</label>
                                                    <input
                                                        type="text"
                                                        placeholder="Enter Txn ID manually..."
                                                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                                        value={manualTransactionCode}
                                                        onChange={(e) => setManualTransactionCode(e.target.value)}
                                                    />
                                                </div>
                                                <div>
                                                    <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Admin Note</label>
                                                    <textarea
                                                        placeholder="Reason for manual action..."
                                                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none h-20 resize-none"
                                                        value={manualNote}
                                                        onChange={(e) => setManualNote(e.target.value)}
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {selectedRequest.status === 'pending' && (
                                        <div className="p-4 bg-amber-50 border border-amber-100 rounded-xl flex gap-3 text-amber-800">
                                            <AlertCircle className="w-5 h-5 shrink-0" />
                                            <p className="text-xs leading-relaxed font-medium">
                                                Please carefully check the transaction ID and amount in the screenshot before approving.
                                                Approving will instantly grant the student access to this collection.
                                            </p>
                                        </div>
                                    )}
                                </div>

                                {/* Proof Column */}
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between px-1">
                                        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Payment Proof</h4>
                                        <a
                                            href={`https://notelibraryapp.com/${selectedRequest.screenshot_path}`}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="text-xs font-bold text-blue-600 flex items-center gap-1 hover:underline"
                                        >
                                            <ExternalLink size={12} /> Open original
                                        </a>
                                    </div>
                                    <div className="bg-white p-2 rounded-2xl border border-slate-100 shadow-sm aspect-[3/4] overflow-hidden group">
                                        <img
                                            src={`https://notelibraryapp.com/${selectedRequest.screenshot_path}`}
                                            alt="Payment proof"
                                            className="w-full h-full object-contain bg-slate-100 rounded-xl"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="p-6 border-t border-slate-100 flex items-center justify-end gap-3 bg-white sticky bottom-0 z-10">
                                <button
                                    onClick={() => setSelectedRequest(null)}
                                    className="px-6 py-2.5 bg-slate-100 text-slate-600 rounded-xl font-bold text-sm hover:bg-slate-200 transition-colors"
                                >
                                    Cancel
                                </button>
                                <div className="flex gap-3">
                                    {selectedRequest.status === 'approved' ? (
                                        <button
                                            onClick={() => {
                                                if (window.confirm('Are you sure you want to revoke access? The student will no longer be able to access this collection.')) {
                                                    handleAction(selectedRequest.id, 'revoke');
                                                }
                                            }}
                                            disabled={isProcessing}
                                            className="px-6 py-2.5 bg-red-100 text-red-700 border border-red-200 rounded-xl font-bold text-sm hover:bg-red-200 transition-colors flex items-center gap-2 disabled:opacity-50"
                                        >
                                            <AlertTriangle size={18} /> Revoke Access
                                        </button>
                                    ) : (
                                        <>
                                            <button
                                                onClick={() => handleAction(selectedRequest.id, 'reject')}
                                                disabled={isProcessing}
                                                className="px-6 py-2.5 bg-red-50 text-red-600 border border-red-100 rounded-xl font-bold text-sm hover:bg-red-100 transition-colors flex items-center gap-2 disabled:opacity-50"
                                            >
                                                <XCircle size={18} /> Reject
                                            </button>
                                            <button
                                                onClick={() => handleAction(selectedRequest.id, 'approve')}
                                                disabled={isProcessing}
                                                className="px-8 py-2.5 bg-blue-600 text-white rounded-xl font-bold text-sm hover:bg-blue-700 shadow-lg shadow-blue-600/20 transition-all flex items-center gap-2 disabled:opacity-50 active:scale-95"
                                            >
                                                {isProcessing ? (
                                                    <RefreshCcw className="w-4 h-4 animate-spin" />
                                                ) : (
                                                    <>
                                                        <CheckCircle size={18} /> Approve & Grant Access
                                                    </>
                                                )}
                                            </button>
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </DashboardLayout>
    );
};

export default PaymentManager;
