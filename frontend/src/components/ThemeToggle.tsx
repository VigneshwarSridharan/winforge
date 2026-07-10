import type { ReactNode } from "react";
import { useTheme, type ThemeMode } from "../theme/ThemeProvider";

const OPTIONS: { mode: ThemeMode; label: string; icon: ReactNode }[] = [
  {
    mode: "light",
    label: "Light",
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="4" strokeLinecap="round" strokeLinejoin="round" />
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32l1.41 1.41M2 12h2m16 0h2M4.93 19.07l1.41-1.41m11.32-11.32l1.41-1.41"
        />
      </svg>
    ),
  },
  {
    mode: "dark",
    label: "Dark",
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
      </svg>
    ),
  },
  {
    mode: "system",
    label: "System",
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <rect x="3" y="4" width="18" height="12" rx="2" strokeLinecap="round" strokeLinejoin="round" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 20h8m-4-4v4" />
      </svg>
    ),
  },
];

export function ThemeToggle() {
  const { mode, setMode } = useTheme();

  return (
    <div className="flex items-center gap-1 rounded-lg border border-zinc-200 bg-zinc-100 p-1 dark:border-zinc-800 dark:bg-zinc-800/50">
      {OPTIONS.map((opt) => (
        <button
          key={opt.mode}
          type="button"
          onClick={() => setMode(opt.mode)}
          title={opt.label}
          aria-label={opt.label}
          aria-pressed={mode === opt.mode}
          className={`flex flex-1 items-center justify-center rounded-md p-1.5 transition-colors ${
            mode === opt.mode
              ? "bg-white text-orange-600 shadow-sm dark:bg-zinc-700 dark:text-orange-400"
              : "text-zinc-500 hover:text-zinc-700 dark:text-zinc-500 dark:hover:text-zinc-300"
          }`}
        >
          {opt.icon}
        </button>
      ))}
    </div>
  );
}
