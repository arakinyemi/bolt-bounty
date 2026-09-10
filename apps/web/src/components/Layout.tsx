import { NavLink, Outlet } from "react-router-dom";

const link = ({ isActive }: { isActive: boolean }) =>
  `rounded px-3 py-1.5 text-sm ${isActive ? "bg-gray-900 text-white" : "text-gray-700 hover:bg-gray-100"}`;

export function Layout() {
  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3">
          <NavLink to="/" className="text-lg font-semibold">
            ⚡ BoltBounty
          </NavLink>
          <nav className="flex gap-1">
            <NavLink to="/" end className={link}>Board</NavLink>
            <NavLink to="/new" className={link}>New bounty</NavLink>
            <NavLink to="/how" className={link}>How it works</NavLink>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-4xl px-4 py-6">
        <Outlet />
      </main>
      <footer className="mx-auto max-w-4xl px-4 py-6 text-xs text-gray-400">
        Regtest only. Escrow is a Lightning hold invoice on the platform node.
      </footer>
    </div>
  );
}
