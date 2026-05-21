import { useEffect, useRef, useState } from 'react';

/**
 * 6-digit OTP entry screen. Calls `onSubmit(code)` when 6 digits are typed
 * or the form is submitted. `onResend` runs the resend API.
 */
export default function OtpStep({
    email,
    onSubmit,
    onResend,
    onBack,
    submitting,
    resending,
}) {
    const [code, setCode] = useState('');
    const [cooldown, setCooldown] = useState(30);
    const inputRef = useRef(null);

    useEffect(() => {
        inputRef.current?.focus();
    }, []);

    // Resend cooldown — discourages spamming the email.
    useEffect(() => {
        if (cooldown <= 0) return;
        const t = setInterval(() => setCooldown((c) => Math.max(0, c - 1)), 1000);
        return () => clearInterval(t);
    }, [cooldown]);

    const handleChange = (e) => {
        const digits = e.target.value.replace(/\D/g, '').slice(0, 6);
        setCode(digits);
        if (digits.length === 6) {
            onSubmit(digits);
        }
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        if (code.length !== 6) return;
        onSubmit(code);
    };

    const handleResend = async () => {
        try {
            await onResend();
            setCooldown(30);
            setCode('');
            inputRef.current?.focus();
        } catch {
            // The parent shows the toast. Keep the resend button available.
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-5">
            <div className="text-center">
                <h2 className="text-xl font-semibold text-slate-800 dark:text-slate-100">
                    Enter the 6-digit code
                </h2>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                    We sent it to <span className="font-medium text-slate-700 dark:text-slate-200">{email}</span>
                </p>
            </div>

            <input
                ref={inputRef}
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                value={code}
                onChange={handleChange}
                placeholder="••••••"
                maxLength={6}
                className="w-full text-center text-3xl tracking-[0.5em] font-mono rounded-lg border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 px-3 py-3 focus:outline-none focus:ring-2 focus:ring-brand-500"
            />

            <button
                type="submit"
                disabled={submitting || code.length !== 6}
                className="w-full bg-brand-600 hover:bg-brand-700 disabled:opacity-60 text-white font-medium py-2 rounded-lg transition"
            >
                {submitting ? 'Verifying...' : 'Verify'}
            </button>

            <div className="flex items-center justify-between text-xs">
                <button
                    type="button"
                    onClick={onBack}
                    className="text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
                >
                    ← Back
                </button>
                <button
                    type="button"
                    onClick={handleResend}
                    disabled={resending || cooldown > 0}
                    className="text-brand-600 dark:text-brand-400 disabled:opacity-50 font-medium"
                >
                    {resending
                        ? 'Sending...'
                        : cooldown > 0
                            ? `Resend in ${cooldown}s`
                            : 'Resend code'}
                </button>
            </div>
        </form>
    );
}
