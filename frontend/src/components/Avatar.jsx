import { useState } from 'react';

/**
 * Round avatar with an optional online dot. Uses `imageUrl` when present,
 * falls back to a colored circle with the user's initial. Image errors fall
 * back to the initial automatically.
 *
 * Sizes are passed via Tailwind classes from the caller (default w-10 h-10)
 * so callers can size it per-context.
 */
export default function Avatar({
    name,
    imageUrl,
    online,
    sizeClass = 'w-10 h-10',
    textClass = 'font-semibold',
    ringClass = 'border-white dark:border-slate-800',
}) {
    const [broken, setBroken] = useState(false);
    const initial = (name || '?').charAt(0).toUpperCase();
    const showImage = !!imageUrl && !broken;

    return (
        <div className="relative shrink-0">
            <div
                className={`${sizeClass} rounded-full overflow-hidden bg-brand-500 text-white flex items-center justify-center ${textClass}`}
            >
                {showImage ? (
                    <img
                        src={imageUrl}
                        alt={name || 'avatar'}
                        className="w-full h-full object-cover"
                        onError={() => setBroken(true)}
                    />
                ) : (
                    <span>{initial}</span>
                )}
            </div>
            {online && (
                <span className={`absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 border-2 ${ringClass} rounded-full`} />
            )}
        </div>
    );
}
