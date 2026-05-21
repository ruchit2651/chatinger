/**
 * Chatinger brand mark — speech-bubble + three dots.
 * Pure SVG, scales via `sizeClass`.
 */
export default function Logo({ sizeClass = 'w-10 h-10', className = '' }) {
    return (
        <svg
            viewBox="0 0 64 64"
            xmlns="http://www.w3.org/2000/svg"
            className={`${sizeClass} ${className}`}
            aria-label="Chatinger"
        >
            <defs>
                <linearGradient id="chatinger-grad" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="#3b82f6" />
                    <stop offset="100%" stopColor="#1d4ed8" />
                </linearGradient>
            </defs>
            <path
                d="M14 6h36a10 10 0 0 1 10 10v24a10 10 0 0 1-10 10H30L18 60v-10h-4A10 10 0 0 1 4 40V16A10 10 0 0 1 14 6z"
                fill="url(#chatinger-grad)"
            />
            <circle cx="22" cy="28" r="3.5" fill="#ffffff" />
            <circle cx="32" cy="28" r="3.5" fill="#ffffff" />
            <circle cx="42" cy="28" r="3.5" fill="#ffffff" />
        </svg>
    );
}

export function Wordmark({ className = '' }) {
    return (
        <div className={`flex items-center gap-2 ${className}`}>
            <Logo sizeClass="w-8 h-8" />
            <span className="text-xl font-bold tracking-tight text-slate-800 dark:text-slate-100">
                Chatinger
            </span>
        </div>
    );
}
