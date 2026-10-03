import { useState } from 'react';
import { Send, MessageSquare, LifeBuoy, CheckCircle2 } from 'lucide-react';
import toast from 'react-hot-toast';

export default function ContactPage() {
    const [subject, setSubject] = useState('');
    const [message, setMessage] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!subject.trim() || !message.trim()) {
            toast.error('Please fill in all fields');
            return;
        }

        setIsSubmitting(true);
        try {
            const current = JSON.parse(localStorage.getItem('nl_tickets') || '[]');
            current.unshift({ id: Date.now(), subject, message, admin_reply: null, status: 'pending', created_at: new Date().toISOString(), updated_at: new Date().toISOString() });
            localStorage.setItem('nl_tickets', JSON.stringify(current));
            toast.success('Request saved in this browser.');
            setSubject('');
            setMessage('');
        } catch (error) {
            console.error('Submission error:', error);
            toast.error('The request could not be saved locally.');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            {/* Header Section */}
            <div className="text-center space-y-4">
                <div className="inline-flex p-3 bg-blue-100 dark:bg-blue-900/30 rounded-2xl text-blue-600 dark:text-blue-400 mb-2">
                    <LifeBuoy size={32} />
                </div>
                <h1 className="text-4xl font-black tracking-tight text-gray-900 dark:text-white">How can we help?</h1>
                <p className="text-gray-500 dark:text-gray-400 max-w-lg mx-auto leading-relaxed">
                    Have a question or need assistance? Our support team is here to help you move forward.
                </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-start">
                {/* Info Cards */}
                <div className="md:col-span-1 space-y-4">
                    <div className="bg-white dark:bg-gray-900 p-6 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm transition-all hover:shadow-md">
                        <div className="w-10 h-10 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl flex items-center justify-center text-indigo-600 dark:text-indigo-400 mb-4">
                            <MessageSquare size={20} />
                        </div>
                        <h3 className="font-bold text-gray-900 dark:text-white mb-1">Direct Support</h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400">Requests stay in this browser for the frontend demo.</p>
                    </div>

                    <div className="bg-white dark:bg-gray-900 p-6 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm transition-all hover:shadow-md">
                        <div className="w-10 h-10 bg-green-50 dark:bg-green-900/20 rounded-xl flex items-center justify-center text-green-600 dark:text-green-400 mb-4">
                            <CheckCircle2 size={20} />
                        </div>
                        <h3 className="font-bold text-gray-900 dark:text-white mb-1">Ticket System</h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400">Track notes and replies without a server or account.</p>
                    </div>

                    <div className="bg-blue-600 p-6 rounded-2xl text-white shadow-xl shadow-blue-600/20">
                        <h3 className="font-bold mb-2">Helpful Tip</h3>
                        <p className="text-sm text-blue-100 opacity-90 leading-relaxed">
                            This standalone build does not send messages to a support team.
                        </p>
                    </div>
                </div>

                {/* Contact Form */}
                <div className="md:col-span-2">
                    <div className="bg-white dark:bg-gray-900 p-8 rounded-3xl border border-gray-100 dark:border-gray-800 shadow-sm">
                        <form onSubmit={handleSubmit} className="space-y-6">
                            <div className="space-y-2">
                                <label htmlFor="subject" className="text-sm font-bold text-gray-700 dark:text-gray-300 ml-1">
                                    Subject
                                </label>
                                <input
                                    id="subject"
                                    type="text"
                                    placeholder="What can we help you with?"
                                    value={subject}
                                    onChange={(e) => setSubject(e.target.value)}
                                    className="w-full px-5 py-4 bg-gray-50 dark:bg-gray-800/50 border-none rounded-2xl focus:ring-2 focus:ring-blue-600 transition-all text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500"
                                />
                            </div>

                            <div className="space-y-2">
                                <label htmlFor="message" className="text-sm font-bold text-gray-700 dark:text-gray-300 ml-1">
                                    Message
                                </label>
                                <textarea
                                    id="message"
                                    rows={6}
                                    placeholder="Describe your issue or question in detail..."
                                    value={message}
                                    onChange={(e) => setMessage(e.target.value)}
                                    className="w-full px-5 py-4 bg-gray-50 dark:bg-gray-800/50 border-none rounded-2xl focus:ring-2 focus:ring-blue-600 transition-all text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 resize-none"
                                ></textarea>
                            </div>

                            <button
                                type="submit"
                                disabled={isSubmitting}
                                className={`
                  w-full py-4 rounded-2xl font-bold flex items-center justify-center gap-2 transition-all duration-300
                  ${isSubmitting
                                        ? 'bg-gray-200 dark:bg-gray-800 text-gray-400 cursor-not-allowed'
                                        : 'bg-blue-600 text-white hover:bg-blue-700 shadow-lg shadow-blue-600/20 active:scale-[0.98]'
                                    }
                `}
                            >
                                {isSubmitting ? (
                                    <div className="h-5 w-5 border-2 border-gray-400 border-t-white rounded-full animate-spin"></div>
                                ) : (
                                    <>
                                        <Send size={18} />
                                        Submit Request
                                    </>
                                )}
                            </button>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    );
}
