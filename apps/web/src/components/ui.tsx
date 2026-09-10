import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, TextareaHTMLAttributes } from "react";

// The handful of building blocks every page uses. Keeping them here keeps the
// pages short and the look consistent.

type Variant = "primary" | "secondary" | "success" | "danger" | "ghost";

const VARIANTS: Record<Variant, string> = {
  primary: "bg-stone-900 text-white hover:bg-stone-700 shadow-sm",
  secondary: "border border-stone-300 bg-white text-stone-800 hover:bg-stone-100",
  success: "bg-emerald-600 text-white hover:bg-emerald-500 shadow-sm",
  danger: "border border-rose-300 bg-white text-rose-700 hover:bg-rose-50",
  ghost: "text-stone-600 hover:bg-stone-100",
};

export function Button({ variant = "primary", className = "", ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      {...props}
      className={`inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 disabled:cursor-not-allowed disabled:opacity-50 ${VARIANTS[variant]} ${className}`}
    />
  );
}

export function Card({ children, className = "", tone = "default" }: { children: ReactNode; className?: string; tone?: "default" | "amber" | "green" | "rose" }) {
  const tones = {
    default: "border-stone-200 bg-white",
    amber: "border-amber-200 bg-amber-50",
    green: "border-emerald-200 bg-emerald-50",
    rose: "border-rose-200 bg-rose-50",
  };
  return <section className={`rounded-xl border p-5 ${tones[tone]} ${className}`}>{children}</section>;
}

export function CardTitle({ children, hint }: { children: ReactNode; hint?: ReactNode }) {
  return (
    <div className="mb-3">
      <h2 className="text-base font-semibold">{children}</h2>
      {hint && <p className="mt-0.5 text-sm text-stone-600">{hint}</p>}
    </div>
  );
}

const FIELD = "mt-1.5 w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm placeholder:text-stone-400 focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-200";

export function Field({ id, label, hint, children }: { id: string; label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="text-sm">
      <label htmlFor={id} className="font-medium text-stone-800">{label}</label>
      {children}
      {hint && <p className="mt-1 text-xs text-stone-500">{hint}</p>}
    </div>
  );
}

export const Input = ({ className = "", ...p }: InputHTMLAttributes<HTMLInputElement>) => <input {...p} className={`${FIELD} ${className}`} />;
export const Textarea = ({ className = "", ...p }: TextareaHTMLAttributes<HTMLTextAreaElement>) => <textarea {...p} className={`${FIELD} ${className}`} />;

export function EmptyState({ icon, title, text, action }: { icon: string; title: string; text: string; action?: ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-stone-300 bg-white px-6 py-12 text-center">
      <div className="text-3xl">{icon}</div>
      <h3 className="mt-3 font-semibold">{title}</h3>
      <p className="mx-auto mt-1 max-w-sm text-sm text-stone-600">{text}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Spinner() {
  return <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-stone-300 border-t-amber-500" aria-hidden />;
}

export function ErrorBox({ message }: { message: string | null }) {
  if (!message) return null;
  return <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">{message}</p>;
}
