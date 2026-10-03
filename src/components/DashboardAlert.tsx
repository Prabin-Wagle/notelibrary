import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { AlertCircle, CheckCircle2, ChevronRight } from 'lucide-react';
import localData from '../data/localData';

export default function DashboardAlert() {
    const { user } = useAuth();
    const [hasAccess, setHasAccess] = useState<boolean | null>(null);

    useEffect(() => {
        const checkAccess = async () => {
            try {
                const response = await localData.get(`check-access`, {
                    params: { user_id: user?.id }
                });
                setHasAccess(response.data.data && response.data.data.length > 0);
            } catch (error) {
                console.error('Failed to check access:', error);
            }
        };

        if (user?.id) checkAccess();
    }, [user?.id]);

    if (hasAccess === null) return null;

    return (
        <div className="animate-in fade-in slide-in-from-left-4 duration-700">
            {!hasAccess ? (
                <div className="relative overflow-hidden bg-gradient-to-r from-orange-500 to-red-600 rounded-3xl p-6 text-white shadow-xl shadow-orange-500/20">
                    <div className="absolute top-0 right-0 -mr-8 -mt-8 w-32 h-32 bg-white/10 rounded-full blur-2xl" />
                    <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="flex items-start gap-4">
                            <div className="p-3 bg-white/20 rounded-2xl">
                                <AlertCircle size={24} />
                            </div>
                            <div>
                                <h3 className="text-lg font-black tracking-tight">Unlock Full Potential</h3>
                                <p className="text-orange-100 text-sm font-medium opacity-90 max-w-md">
                                    You haven't joined any Test Series yet. Unlock intensive practice materials and detailed analytics for your {user?.competition} preparation.
                                </p>
                            </div>
                        </div>
                        <button className="flex items-center justify-center gap-2 px-6 py-3 bg-white text-orange-600 rounded-2xl font-black uppercase tracking-widest text-[10px] hover:bg-orange-50 transition-colors shadow-lg">
                            View Test Series <ChevronRight size={14} />
                        </button>
                    </div>
                </div>
            ) : (
                <div className="relative overflow-hidden bg-gradient-to-r from-blue-600 to-indigo-600 rounded-3xl p-6 text-white shadow-xl shadow-blue-600/20">
                    <div className="absolute top-0 right-0 -mr-8 -mt-8 w-32 h-32 bg-white/10 rounded-full blur-2xl" />
                    <div className="relative z-10 flex items-center gap-4">
                        <div className="p-3 bg-white/20 rounded-2xl">
                            <CheckCircle2 size={24} />
                        </div>
                        <div>
                            <h3 className="text-lg font-black tracking-tight">VIP Access Active</h3>
                            <p className="text-blue-100 text-sm font-medium opacity-90">
                                You have full access to {user?.competition} Test Series. Stay consistent with your daily practice!
                            </p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
