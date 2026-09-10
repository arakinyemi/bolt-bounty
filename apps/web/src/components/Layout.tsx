import { Link, NavLink, Outlet } from "react-router-dom";

const link = ({ isActive }: { isActive: boolean }) =>
  `rounded-lg px-3 py-1.5 text-sm font-medium transition ${isActive ? "bg-stone-900 text-white" : "text-stone-600 hover:bg-stone-100 hover:text-stone-900"}`;

export function Layout() {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-10 border-b border-stone-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
          <Link to="/" className="flex items-center gap-1.5 text-lg font-semibold">
            <span aria-hidden>⚡</span> BoltBounty
          </Link>
          <nav className="flex items-center gap-1">
            <NavLink to="/" end className={link}>Board</NavLink>
            <NavLink to="/how" className={(s) => `hidden sm:block ${link(s)}`}>How it works</NavLink>
            <NavLink to="/new" className="ml-2 rounded-lg bg-amber-400 px-3 py-1.5 text-sm font-semibold text-stone-900 shadow-sm transition hover:bg-amber-300">
              Post a bounty
            </NavLink>
          </nav>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-8">
        <Outlet />
      </main>
      <footer className="mx-auto w-full max-w-6xl px-6 py-6 text-xs text-stone-400">
        Regtest demo. Escrow is a Lightning hold invoice on the platform node; nothing here is real money.
      </footer>
    </div>
  );
}
