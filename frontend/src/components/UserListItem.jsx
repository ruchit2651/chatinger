export default function UserListItem({ user, online, onClick }) {
    const initial = user.username.charAt(0).toUpperCase();
    return (
        <li>
            <button
                onClick={onClick}
                className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-slate-50 dark:hover:bg-slate-700/60 transition"
            >
                <div className="relative shrink-0">
                    <div className="w-10 h-10 rounded-full bg-slate-400 dark:bg-slate-600 text-white flex items-center justify-center font-semibold">
                        {initial}
                    </div>
                    {online && (
                        <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 border-2 border-white dark:border-slate-800 rounded-full" />
                    )}
                </div>
                <div className="flex-1 min-w-0">
                    <p className="font-medium text-slate-800 dark:text-slate-100 truncate">{user.username}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                        {online ? 'Online' : user.email}
                    </p>
                </div>
            </button>
        </li>
    );
}
