export default function TypingIndicator({ username }) {
    return (
        <div className="flex items-center gap-2 px-1">
            <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl rounded-bl-sm px-3 py-2 flex items-center gap-1 shadow-sm">
                <Dot delay="0s" />
                <Dot delay="0.16s" />
                <Dot delay="0.32s" />
            </div>
            <span className="text-xs text-slate-500 dark:text-slate-400">{username} is typing...</span>
        </div>
    );
}

function Dot({ delay }) {
    return (
        <span
            className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounceDot"
            style={{ animationDelay: delay }}
        />
    );
}
