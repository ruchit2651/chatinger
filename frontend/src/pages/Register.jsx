import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext.jsx';
import { requestRegister, verifyRegister } from '../api/auth.js';
import OtpStep from '../components/OtpStep.jsx';
import Logo from '../components/Logo.jsx';

export default function Register() {
    const { applySession } = useAuth();
    const navigate = useNavigate();
    const [step, setStep] = useState('form'); // 'form' | 'otp'
    const [form, setForm] = useState({
        username: '',
        email: '',
        password: '',
        birth_date: '',
        mobile_number: '',
    });
    const [submitting, setSubmitting] = useState(false);
    const [resending, setResending] = useState(false);

    const onChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

    const requestCode = async (e) => {
        e?.preventDefault?.();
        setSubmitting(true);
        try {
            await requestRegister(form);
            toast.success('Verification code sent');
            setStep('otp');
        } catch (err) {
            toast.error(err.message);
        } finally {
            setSubmitting(false);
        }
    };

    const verifyCode = async (code) => {
        setSubmitting(true);
        try {
            const session = await verifyRegister({ email: form.email, code });
            applySession(session);
            toast.success(`Welcome to Chatinger, ${session.user.username}! 🎉`);
            navigate('/');
        } catch (err) {
            toast.error(err.message);
        } finally {
            setSubmitting(false);
        }
    };

    const resend = async () => {
        setResending(true);
        try {
            await requestRegister(form);
            toast.success('New code sent');
        } catch (err) {
            toast.error(err.message);
        } finally {
            setResending(false);
        }
    };

    return (
        <div className="min-h-full flex items-center justify-center bg-gradient-to-br from-brand-50 to-slate-100 dark:from-slate-800 dark:to-slate-900 p-4">
            <div className="w-full max-w-sm bg-white dark:bg-slate-800 rounded-2xl shadow-lg p-6 sm:p-8 space-y-5">
                <div className="flex flex-col items-center gap-2">
                    <Logo sizeClass="w-12 h-12" />
                    <span className="text-lg font-bold tracking-tight text-slate-800 dark:text-slate-100">
                        Chatinger
                    </span>
                </div>

                {step === 'form' ? (
                    <form onSubmit={requestCode} className="space-y-5">
                        <div className="text-center">
                            <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Create account</h1>
                            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                                We'll email a code to verify your address.
                            </p>
                        </div>

                        <div className="space-y-1">
                            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Username</label>
                            <input
                                name="username"
                                required
                                value={form.username}
                                onChange={onChange}
                                className="w-full rounded-lg border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500"
                            />
                        </div>

                        <div className="space-y-1">
                            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Email</label>
                            <input
                                name="email"
                                type="email"
                                required
                                value={form.email}
                                onChange={onChange}
                                className="w-full rounded-lg border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500"
                            />
                        </div>

                        <div className="space-y-1">
                            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Password</label>
                            <input
                                name="password"
                                type="password"
                                required
                                minLength={6}
                                value={form.password}
                                onChange={onChange}
                                className="w-full rounded-lg border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500"
                            />
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div className="space-y-1">
                                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                                    Birth date <span className="text-slate-400 font-normal">(optional)</span>
                                </label>
                                <input
                                    name="birth_date"
                                    type="date"
                                    value={form.birth_date}
                                    onChange={onChange}
                                    className="w-full rounded-lg border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500"
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                                    Mobile <span className="text-slate-400 font-normal">(optional)</span>
                                </label>
                                <input
                                    name="mobile_number"
                                    type="tel"
                                    inputMode="tel"
                                    placeholder="+1 555 123 4567"
                                    pattern="^\+?[\d\s\-()]{6,20}$"
                                    title="6–20 chars. Digits only; optional leading + for country code; spaces, dashes, and parentheses allowed."
                                    value={form.mobile_number}
                                    onChange={onChange}
                                    className="w-full rounded-lg border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500"
                                />
                                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-tight">
                                    6–20 digits. Country code with <span className="font-mono">+</span> allowed.
                                </p>
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={submitting}
                            className="w-full bg-brand-600 hover:bg-brand-700 disabled:opacity-60 text-white font-medium py-2 rounded-lg transition"
                        >
                            {submitting ? 'Sending code...' : 'Continue'}
                        </button>

                        <p className="text-center text-sm text-slate-600 dark:text-slate-400">
                            Already have an account?{' '}
                            <Link to="/login" className="text-brand-600 dark:text-brand-400 hover:underline font-medium">
                                Sign in
                            </Link>
                        </p>
                    </form>
                ) : (
                    <OtpStep
                        email={form.email}
                        onSubmit={verifyCode}
                        onResend={resend}
                        onBack={() => setStep('form')}
                        submitting={submitting}
                        resending={resending}
                    />
                )}
            </div>
        </div>
    );
}
