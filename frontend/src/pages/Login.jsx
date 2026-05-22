import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext.jsx';
import {
    requestLogin,
    verifyLogin,
    requestPasswordReset,
    verifyPasswordReset,
    resetPassword,
} from '../api/auth.js';
import OtpStep from '../components/OtpStep.jsx';
import Logo from '../components/Logo.jsx';

export default function Login() {
    const { applySession } = useAuth();
    const navigate = useNavigate();
    // 'creds' | 'otp' | 'forgot-email' | 'forgot-otp' | 'forgot-reset'
    const [step, setStep] = useState('creds');
    const [form, setForm] = useState({ email: '', password: '' });
    const [forgotEmail, setForgotEmail] = useState('');
    const [resetToken, setResetToken] = useState('');
    const [newPassword, setNewPassword] = useState({ password: '', confirm: '' });
    const [submitting, setSubmitting] = useState(false);
    const [resending, setResending] = useState(false);

    const onChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

    const requestCode = async (e) => {
        e?.preventDefault?.();
        setSubmitting(true);
        try {
            await requestLogin(form);
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
            const session = await verifyLogin({ email: form.email, code });
            applySession(session);
            toast.success(`Welcome back, ${session.user.username}!`);
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
            await requestLogin(form);
            toast.success('New code sent');
        } catch (err) {
            toast.error(err.message);
            throw err;
        } finally {
            setResending(false);
        }
    };

    const startForgot = () => {
        setForgotEmail(form.email);
        setStep('forgot-email');
    };

    const requestForgotCode = async (e) => {
        e?.preventDefault?.();
        setSubmitting(true);
        try {
            await requestPasswordReset({ email: forgotEmail });
            toast.success('Verification code sent');
            setStep('forgot-otp');
        } catch (err) {
            toast.error(err.message);
        } finally {
            setSubmitting(false);
        }
    };

    const verifyForgotCode = async (code) => {
        setSubmitting(true);
        try {
            const { resetToken: tok } = await verifyPasswordReset({ email: forgotEmail, code });
            setResetToken(tok);
            setStep('forgot-reset');
        } catch (err) {
            toast.error(err.message);
        } finally {
            setSubmitting(false);
        }
    };

    const resendForgot = async () => {
        setResending(true);
        try {
            await requestPasswordReset({ email: forgotEmail });
            toast.success('New code sent');
        } catch (err) {
            toast.error(err.message);
            throw err;
        } finally {
            setResending(false);
        }
    };

    const submitNewPassword = async (e) => {
        e?.preventDefault?.();
        if (newPassword.password.length < 6) {
            toast.error('Password must be at least 6 characters');
            return;
        }
        if (newPassword.password !== newPassword.confirm) {
            toast.error('Passwords do not match');
            return;
        }
        setSubmitting(true);
        try {
            const session = await resetPassword({ resetToken, password: newPassword.password });
            applySession(session);
            toast.success('Password updated. You are signed in.');
            navigate('/');
        } catch (err) {
            toast.error(err.message);
        } finally {
            setSubmitting(false);
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

                {step === 'creds' && (
                    <form onSubmit={requestCode} className="space-y-5">
                        <div className="text-center">
                            <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Sign in</h1>
                            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                                We'll email you a code to confirm it's you.
                            </p>
                        </div>

                        <div className="space-y-1">
                            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Email</label>
                            <input
                                name="email"
                                type="email"
                                autoComplete="email"
                                required
                                value={form.email}
                                onChange={onChange}
                                className="w-full rounded-lg border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500"
                            />
                        </div>

                        <div className="space-y-1">
                            <div className="flex items-center justify-between">
                                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Password</label>
                                <button
                                    type="button"
                                    onClick={startForgot}
                                    className="text-xs text-brand-600 dark:text-brand-400 hover:underline font-medium"
                                >
                                    Forgot password?
                                </button>
                            </div>
                            <input
                                name="password"
                                type="password"
                                autoComplete="current-password"
                                required
                                value={form.password}
                                onChange={onChange}
                                className="w-full rounded-lg border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500"
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={submitting}
                            className="w-full bg-brand-600 hover:bg-brand-700 disabled:opacity-60 text-white font-medium py-2 rounded-lg transition"
                        >
                            {submitting ? 'Sending code...' : 'Continue'}
                        </button>

                        <p className="text-center text-sm text-slate-600 dark:text-slate-400">
                            No account?{' '}
                            <Link to="/register" className="text-brand-600 dark:text-brand-400 hover:underline font-medium">
                                Create one
                            </Link>
                        </p>
                    </form>
                )}

                {step === 'otp' && (
                    <OtpStep
                        email={form.email}
                        onSubmit={verifyCode}
                        onResend={resend}
                        onBack={() => setStep('creds')}
                        submitting={submitting}
                        resending={resending}
                    />
                )}

                {step === 'forgot-email' && (
                    <form onSubmit={requestForgotCode} className="space-y-5">
                        <div className="text-center">
                            <h2 className="text-xl font-semibold text-slate-800 dark:text-slate-100">
                                Reset your password
                            </h2>
                            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                                Enter your email and we'll send a verification code.
                            </p>
                        </div>

                        <div className="space-y-1">
                            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Email</label>
                            <input
                                type="email"
                                autoComplete="email"
                                required
                                value={forgotEmail}
                                onChange={(e) => setForgotEmail(e.target.value)}
                                className="w-full rounded-lg border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500"
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={submitting}
                            className="w-full bg-brand-600 hover:bg-brand-700 disabled:opacity-60 text-white font-medium py-2 rounded-lg transition"
                        >
                            {submitting ? 'Sending code...' : 'Send code'}
                        </button>

                        <div className="text-center text-xs">
                            <button
                                type="button"
                                onClick={() => setStep('creds')}
                                className="text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
                            >
                                ← Back to sign in
                            </button>
                        </div>
                    </form>
                )}

                {step === 'forgot-otp' && (
                    <OtpStep
                        email={forgotEmail}
                        onSubmit={verifyForgotCode}
                        onResend={resendForgot}
                        onBack={() => setStep('forgot-email')}
                        submitting={submitting}
                        resending={resending}
                    />
                )}

                {step === 'forgot-reset' && (
                    <form onSubmit={submitNewPassword} className="space-y-5">
                        <div className="text-center">
                            <h2 className="text-xl font-semibold text-slate-800 dark:text-slate-100">
                                Set a new password
                            </h2>
                            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                                For <span className="font-medium text-slate-700 dark:text-slate-200">{forgotEmail}</span>
                            </p>
                        </div>

                        <div className="space-y-1">
                            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">New password</label>
                            <input
                                type="password"
                                autoComplete="new-password"
                                required
                                minLength={6}
                                value={newPassword.password}
                                onChange={(e) => setNewPassword({ ...newPassword, password: e.target.value })}
                                className="w-full rounded-lg border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500"
                            />
                        </div>

                        <div className="space-y-1">
                            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Confirm password</label>
                            <input
                                type="password"
                                autoComplete="new-password"
                                required
                                minLength={6}
                                value={newPassword.confirm}
                                onChange={(e) => setNewPassword({ ...newPassword, confirm: e.target.value })}
                                className="w-full rounded-lg border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500"
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={submitting}
                            className="w-full bg-brand-600 hover:bg-brand-700 disabled:opacity-60 text-white font-medium py-2 rounded-lg transition"
                        >
                            {submitting ? 'Updating...' : 'Update password'}
                        </button>
                    </form>
                )}
            </div>
        </div>
    );
}
