export function ErrorBanner({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300">
      <span>{message}</span>
      {onRetry && (
        <button
          onClick={onRetry}
          className="shrink-0 rounded-lg border border-red-300 px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-100 transition-colors dark:border-red-500/30 dark:text-red-300 dark:hover:bg-red-500/10"
        >
          Retry
        </button>
      )}
    </div>
  );
}
