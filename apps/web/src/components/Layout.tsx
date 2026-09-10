import { useEffect } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { signInUrl } from "../api";
import { useAuth } from "../auth";
import { Avatar, Tag } from "./ui";

const link = ({ isActive }: { isActive: boolean }) =>
  `label px-3 py-2 font-semibold transition ${isActive ? "bg-ink text-white" : "hover:bg-ink/10"}`;

export function Layout() {
  const { me, role, loading, signOut } = useAuth();
  const { pathname } = useLocation();
  const navigate = useNavigate();

  // A signed-in account without a role goes to the role picker first.
  useEffect(() => {
    if (!loading && me && !me.role && pathname !== "/role") navigate("/role", { replace: true });
  }, [loading, me, pathname, navigate]);

  return (
    <div className="flex min-h-screen flex-col">
      <div className="label bg-ink py-1.5 text-center text-white/80">
        <span className="text-green">●</span> Regtest &nbsp;·&nbsp; Lightning hold-invoice escrow &nbsp;·&nbsp; Sats are locked, never held
      </div>
      <header className="sticky top-0 z-10 border-b-2 border-ink bg-paper/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-3">
          <Link to="/" className="font-display text-xl font-bold tracking-tight">⚡ BoltBounty</Link>
          <nav className="flex items-center gap-1">
            <NavLink to="/" end className={link}>Board</NavLink>
            {role === "worker" && <NavLink to="/work" className={link}>My work</NavLink>}
            <NavLink to="/how" className={(s) => `hidden sm:block ${link(s)}`}>How it works</NavLink>
            {!loading && (me ? (
              <div className="ml-2 flex items-center gap-2 border-2 border-ink bg-white py-1 pl-1 pr-2">
                <Avatar src={me.avatarUrl} alt={me.login} size={22} />
                <span className="label hidden font-semibold sm:inline">{me.login}</span>
                {role && (
                  <Link to="/role" title="Your role">
                    <Tag tone={role === "poster" ? "yellow" : "blue"}>{role}</Tag>
                  </Link>
                )}
                <button onClick={signOut} className="label text-muted hover:text-brand">Sign out</button>
              </div>
            ) : (
              <a href={signInUrl(pathname)} className="label ml-2 border-2 border-ink bg-white px-3 py-2 font-semibold shadow-hard-sm hover:bg-paper">
                Sign in with GitHub
              </a>
            ))}
            {role === "poster" && (
              <NavLink to="/new" className="label ml-2 border-2 border-ink bg-brand px-3 py-2 font-semibold text-white shadow-hard-sm transition hover:bg-ink">
                Post a bounty
              </NavLink>
            )}
          </nav>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-10">
        <Outlet />
      </main>
      <footer className="mt-12 border-t-2 border-ink bg-ink text-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-6 py-6">
          <span className="font-display font-bold">⚡ BoltBounty</span>
          <span className="label text-white/60">Escrow without a custodian · Built on LND hold invoices</span>
        </div>
      </footer>
    </div>
  );
}
