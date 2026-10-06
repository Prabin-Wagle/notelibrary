import { useState, useEffect } from 'react';
import { Ticket, Plus, Trash2, RefreshCcw, Percent, AlertCircle, Eye, ShieldAlert, Award, Star, Flame } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { DashboardLayout } from '../components/DashboardLayout';
import toast from 'react-hot-toast';
import axios from 'axios';

interface PromoCode {
    id: number;
    code: string;
    discount_percent: number;
    max_uses: number | null;
    used_count: number;
    status: 'active' | 'inactive';
    created_at: string;
}

const API_URL = 'https://notelibraryapp.com/api/admin/payment/promocodes.php';

const PromoCodeManager = () => {
    const { token } = useAuth();
    const [promocodes, setPromocodes] = useState<PromoCode[]>([]);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    
    // New Promo Code Form State
    const [code, setCode] = useState('');
    const [discountPercent, setDiscountPercent] = useState('');
    const [maxUses, setMaxUses] = useState('');

    const fetchPromoCodes = async () => {
        setLoading(true);
        try {
            const response = await axios.get(API_URL, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            if (response.data.success) {
                setPromocodes(response.data.promocodes);
            } else {
                toast.error(response.data.message || 'Failed to fetch promo codes');
            }
        } catch (error) {
            console.error('Fetch error:', error);
            toast.error('An error occurred while fetching promo codes');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (token) {
            fetchPromoCodes();
        }
    }, [token]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        const trimmedCode = code.trim().toUpperCase();
        const discount = parseFloat(discountPercent);
        const limit = maxUses ? parseInt(maxUses) : '';

        if (!trimmedCode) {
            toast.error('Promo code name cannot be empty');
            return;
        }

        if (isNaN(discount) || discount <= 0 || discount > 100) {
            toast.error('Discount percentage must be between 0.01% and 100%');
            return;
        }

        setActionLoading(true);
        try {
            const formData = new FormData();
            formData.append('action', 'add');
            formData.append('code', trimmedCode);
            formData.append('discount_percent', discount.toString());
            formData.append('max_uses', limit.toString());

            const response = await axios.post(API_URL, formData, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (response.data.success) {
                toast.success(response.data.message || 'Promo code saved!');
                setCode('');
                setDiscountPercent('');
                setMaxUses('');
                fetchPromoCodes();
            } else {
                toast.error(response.data.message || 'Failed to save promo code');
            }
        } catch (error) {
            console.error('Save error:', error);
            toast.error('Error saving promo code');
        } finally {
            setActionLoading(false);
        }
    };

    const handleToggleStatus = async (id: number) => {
        try {
            const formData = new FormData();
            formData.append('action', 'toggle');
            formData.append('id', id.toString());

            const response = await axios.post(API_URL, formData, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (response.data.success) {
                toast.success(response.data.message);
                fetchPromoCodes();
            } else {
                toast.error(response.data.message || 'Failed to toggle status');
            }
        } catch (error) {
            console.error('Toggle error:', error);
            toast.error('Error updating status');
        }
    };

    const handleDelete = async (id: number, name: string) => {
        if (!window.confirm(`Are you sure you want to delete promo code "${name}" permanently?`)) {
            return;
        }

        try {
            const formData = new FormData();
            formData.append('action', 'delete');
            formData.append('id', id.toString());

            const response = await axios.post(API_URL, formData, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (response.data.success) {
                toast.success(response.data.message);
                fetchPromoCodes();
            } else {
                toast.error(response.data.message || 'Failed to delete promo code');
            }
        } catch (error) {
            console.error('Delete error:', error);
            toast.error('Error deleting promo code');
        }
    };

    const filteredCodes = promocodes.filter(p =>
        p.code.toLowerCase().includes(searchTerm.toLowerCase())
    );

    // Calculate dynamic stats
    const totalCodes = promocodes.length;
    const activeCodes = promocodes.filter(p => p.status === 'active').length;
    const totalUses = promocodes.reduce((sum, p) => sum + p.used_count, 0);

    return (
        <DashboardLayout>
            <div className="space-y-6">
                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                            <Ticket className="text-emerald-600" />
                            Promo Code Management
                        </h1>
                        <p className="text-slate-500 text-sm">Create, activate, and track student promo code coupons</p>
                    </div>
                    <button
                        onClick={fetchPromoCodes}
                        className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 transition-colors shadow-sm font-semibold"
                    >
                        <RefreshCcw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                        Refresh
                    </button>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between hover:shadow-md transition-all">
                        <div>
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Coupons</p>
                            <p className="text-3xl font-extrabold text-slate-900 mt-2">{totalCodes}</p>
                        </div>
                        <div className="p-3.5 bg-blue-50 text-blue-600 rounded-xl">
                            <Ticket size={24} />
                        </div>
                    </div>
                    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between hover:shadow-md transition-all">
                        <div>
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Active Coupons</p>
                            <p className="text-3xl font-extrabold text-emerald-600 mt-2">{activeCodes}</p>
                        </div>
                        <div className="p-3.5 bg-emerald-50 text-emerald-600 rounded-xl">
                            <Award size={24} />
                        </div>
                    </div>
                    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between hover:shadow-md transition-all">
                        <div>
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Coupon Uses</p>
                            <p className="text-3xl font-extrabold text-purple-600 mt-2">{totalUses}</p>
                        </div>
                        <div className="p-3.5 bg-purple-50 text-purple-600 rounded-xl">
                            <Flame size={24} />
                        </div>
                    </div>
                </div>

                {/* Workspace Split Layout */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Add Promo Code Panel */}
                    <div className="lg:col-span-1 bg-white p-6 rounded-xl border border-slate-200 shadow-sm self-start space-y-4">
                        <h2 className="text-lg font-bold text-slate-950 flex items-center gap-2">
                            <span className="text-emerald-500">✨</span> Create Promo Code
                        </h2>
                        
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div className="space-y-1.5">
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Promo Code Name</label>
                                <input
                                    type="text"
                                    placeholder="e.g. FESTIVE20"
                                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500 uppercase"
                                    value={code}
                                    onChange={(e) => setCode(e.target.value)}
                                    required
                                />
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Discount Percentage (%)</label>
                                <div className="relative">
                                    <input
                                        type="number"
                                        min="0.01"
                                        max="100"
                                        step="0.01"
                                        placeholder="e.g. 20.00"
                                        className="w-full pl-4 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                        value={discountPercent}
                                        onChange={(e) => setDiscountPercent(e.target.value)}
                                        required
                                    />
                                    <Percent className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Max Allowed Uses (Optional)</label>
                                <input
                                    type="number"
                                    min="1"
                                    placeholder="Unlimited"
                                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                    value={maxUses}
                                    onChange={(e) => setMaxUses(e.target.value)}
                                />
                            </div>

                            <button
                                type="submit"
                                disabled={actionLoading}
                                className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white rounded-lg text-sm font-black uppercase tracking-wider transition-all shadow-md shadow-emerald-600/10 flex items-center justify-center gap-2"
                            >
                                {actionLoading ? 'Saving...' : (
                                    <>
                                        <Plus size={16} /> Save Coupon Code
                                    </>
                                )}
                            </button>
                        </form>
                    </div>

                    {/* Active Promo Codes Table */}
                    <div className="lg:col-span-2 bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                            <h2 className="text-lg font-bold text-slate-950 flex items-center gap-2">
                                <span className="text-emerald-500">📋</span> Active Coupon Codes
                            </h2>
                            <input
                                type="text"
                                placeholder="Search coupon..."
                                className="px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500 w-full sm:w-48 font-semibold"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>

                        {loading ? (
                            <div className="flex flex-col items-center justify-center py-12 gap-3">
                                <div className="w-8 h-8 border-2 border-slate-200 border-t-emerald-600 rounded-full animate-spin"></div>
                                <p className="text-slate-500 font-medium text-sm">Loading promo codes...</p>
                            </div>
                        ) : filteredCodes.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-12 text-slate-500 text-center gap-2">
                                <Ticket className="w-12 h-12 text-slate-200 mb-2" />
                                <p className="font-bold text-slate-900 text-lg">No Coupons Found</p>
                                <p className="text-sm">Active coupons will list here once created</p>
                            </div>
                        ) : (
                            <div className="overflow-x-auto border border-slate-100 rounded-xl">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="bg-slate-50 border-b border-slate-200">
                                            <th className="px-5 py-3.5 text-xs font-bold text-slate-500 uppercase tracking-wider">Code</th>
                                            <th className="px-5 py-3.5 text-xs font-bold text-slate-500 uppercase tracking-wider">Discount</th>
                                            <th className="px-5 py-3.5 text-xs font-bold text-slate-500 uppercase tracking-wider">Usage Limit</th>
                                            <th className="px-5 py-3.5 text-xs font-bold text-slate-500 uppercase tracking-wider">Status</th>
                                            <th className="px-5 py-3.5 text-xs font-bold text-slate-500 text-center uppercase tracking-wider">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {filteredCodes.map((p) => (
                                            <tr key={p.id} className="hover:bg-slate-50/50 transition-colors">
                                                <td className="px-5 py-4">
                                                    <span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-lg text-xs font-extrabold tracking-wide">
                                                        {p.code}
                                                    </span>
                                                </td>
                                                <td className="px-5 py-4 font-extrabold text-slate-900">
                                                    {p.discount_percent}% OFF
                                                </td>
                                                <td className="px-5 py-4 text-xs font-semibold text-slate-500">
                                                    {p.used_count} / {p.max_uses !== null ? p.max_uses : '∞'}
                                                </td>
                                                <td className="px-5 py-4">
                                                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border ${
                                                        p.status === 'active' 
                                                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                                                        : 'bg-red-50 text-red-600 border-red-200'
                                                    }`}>
                                                        {p.status}
                                                    </span>
                                                </td>
                                                <td className="px-5 py-4 whitespace-nowrap">
                                                    <div className="flex items-center justify-center gap-1.5">
                                                        <button
                                                            onClick={() => handleToggleStatus(p.id)}
                                                            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition-all"
                                                        >
                                                            Toggle
                                                        </button>
                                                        <button
                                                            onClick={() => handleDelete(p.id, p.code)}
                                                            className="p-1.5 bg-red-50 hover:bg-red-500 text-red-600 hover:text-white rounded-lg transition-all"
                                                            title="Delete Coupon"
                                                        >
                                                            <Trash2 size={15} />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </DashboardLayout>
    );
};

export default PromoCodeManager;
