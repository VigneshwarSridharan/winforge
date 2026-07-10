import { Link, Outlet, useLocation } from "react-router-dom";
import { ThemeToggle } from "./ThemeToggle";

const NAV_ITEMS = [
  {
    to: "/",
    label: "Dashboard",
    isActive: (pathname: string) => pathname === "/",
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <rect x="3" y="3" width="7" height="9" rx="1" strokeLinecap="round" strokeLinejoin="round" />
        <rect x="14" y="3" width="7" height="5" rx="1" strokeLinecap="round" strokeLinejoin="round" />
        <rect x="14" y="12" width="7" height="9" rx="1" strokeLinecap="round" strokeLinejoin="round" />
        <rect x="3" y="16" width="7" height="5" rx="1" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    to: "/leads",
    label: "Leads",
    isActive: (pathname: string) => pathname.startsWith("/leads"),
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2H5a2 2 0 00-2-2z"
        />
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V5a2 2 0 012-2h4a2 2 0 012 2v2" />
      </svg>
    ),
  },
];

export function Layout() {
  const location = useLocation();

  return (
    <div className="flex h-screen bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100 font-sans antialiased">
      <aside className="w-64 shrink-0 border-r border-zinc-200 bg-white/50 backdrop-blur-xl flex flex-col dark:border-zinc-800/80 dark:bg-zinc-900/50">
        <div className="p-6">
          <Link to="/" className="text-xl font-bold tracking-tight flex items-center gap-2">
            <span className="bg-gradient-to-br from-red-600 via-orange-500 to-amber-400 w-4 h-4 rounded-sm rotate-45" />
            <span>
              Win
              <span className="bg-gradient-to-r from-red-600 via-orange-500 to-amber-400 bg-clip-text text-transparent">
                forge
              </span>
            </span>
          </Link>
        </div>
        <nav className="flex-1 px-4 space-y-1">
          {NAV_ITEMS.map((item) => {
            const active = item.isActive(location.pathname);
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  active
                    ? "bg-zinc-100 text-zinc-900 dark:bg-zinc-800/60 dark:text-white"
                    : "text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800/40 dark:hover:text-zinc-100"
                }`}
              >
                {item.icon}
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="p-4 border-t border-zinc-200 dark:border-zinc-800/80 space-y-3">
          <ThemeToggle />
          <p className="text-xs text-zinc-500">
            Win
            <span className="bg-gradient-to-r from-red-600 via-orange-500 to-amber-400 bg-clip-text text-transparent">
              forge
            </span>
          </p>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
}
