import { Link } from "@tanstack/react-router";

export function SiteNav() {
  const active = { className: "pill pill-active" };
  return (
    <nav className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-5 py-4">
      <Link to="/" className="display text-xl text-primary">
        FPL Insight
      </Link>
      <div className="flex flex-wrap gap-2">
        <Link to="/" className="pill" activeOptions={{ exact: true }} activeProps={active}>
          Home
        </Link>
        <Link to="/players" className="pill" activeProps={active}>
          Player search
        </Link>
        <Link to="/picker" className="pill" activeProps={active}>
          Squad picker
        </Link>
      </div>
    </nav>
  );
}
