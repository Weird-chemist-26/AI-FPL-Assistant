export function StatCard({ label, value, sub, accent = false }) {
  return (
    <div className="panel p-4">
      <p className="ctl-label mb-1">{label}</p>
      <p
        className={
          accent
            ? "display text-3xl text-primary"
            : "display text-3xl text-foreground"
        }
      >
        {value}
      </p>
      {sub && <p className="mt-1 text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}
