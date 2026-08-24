// Friendly loading / error / empty states used across the dashboard.

export function LoadingBlock({ label = "Loading FPL data…" }) {
  return (
    <div className="panel flex items-center gap-3 text-sm text-muted-foreground">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      {label}
    </div>
  );
}

export function ErrorBlock({ error, hint }) {
  const message =
    typeof error === "string" ? error : error?.message || "Something went wrong. Please try again.";
  return (
    <div className="panel border-destructive/60">
      <p className="text-sm font-semibold text-destructive">{message}</p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function EmptyBlock({ children }) {
  return <div className="panel text-sm text-muted-foreground">{children}</div>;
}
