import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, TextareaHTMLAttributes } from "react";

// Building blocks in the DevFest grammar: ink borders, hard shadows, mono labels.

export type Tone = "white" | "yellow" | "blue" | "green" | "pink" | "ink";

export const TONE_BG: Record<Tone, string> = {
  white: "bg-white text-ink",
  yellow: "bg-yellow-soft text-ink",
  blue: "bg-blue-soft text-ink",
  green: "bg-green-soft text-ink",
  pink: "bg-pink-soft text-ink",
  ink: "bg-ink text-white",
};

export function Tag({ tone = "white", children, className = "" }: { tone?: Tone; children: ReactNode; className?: string }) {
  return <span className={`label inline-flex items-center gap-1 whitespace-nowrap border border-ink px-2 py-1 font-semibold ${TONE_BG[tone]} ${className}`}>{children}</span>;
}

type Variant = "primary" | "secondary" | "success" | "danger" | "ghost";

const VARIANTS: Record<Variant, string> = {
  primary: "border-ink bg-ink text-white shadow-hard hover:bg-brand hover:border-brand",
  secondary: "border-ink bg-white text-ink shadow-hard-sm hover:bg-paper",
  success: "border-ink bg-green-soft text-ink shadow-hard hover:bg-green hover:text-white",
  danger: "border-ink bg-pink-soft text-ink shadow-hard-sm hover:bg-brand hover:text-white",
  ghost: "border-transparent bg-transparent text-ink hover:border-ink",
};

export function Button({ variant = "primary", className = "", ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      {...props}
      className={`label inline-flex items-center justify-center gap-2 border-2 px-4 py-3 font-semibold transition-all active:translate-x-[2px] active:translate-y-[2px] active:shadow-none disabled:cursor-not-allowed disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue ${VARIANTS[variant]} ${className}`}
    />
  );
}

export function Card({ children, className = "", tone = "white" }: { children: ReactNode; className?: string; tone?: Tone }) {
  return <section className={`card p-5 sm:p-6 ${TONE_BG[tone]} ${className}`}>{children}</section>;
}

export function CardTitle({ children, hint, tag }: { children: ReactNode; hint?: ReactNode; tag?: ReactNode }) {
  return (
    <div className="mb-4">
      {tag && <div className="mb-2">{tag}</div>}
      <h2 className="font-display text-xl font-bold leading-tight">{children}</h2>
      {hint && <p className="mt-1 text-sm text-muted">{hint}</p>}
    </div>
  );
}

const FIELD = "mt-1.5 w-full border-2 border-ink bg-white px-3 py-2.5 text-sm placeholder:text-stone-400 focus:outline-none focus:shadow-hard-sm";

export function Field({ id, label, hint, children }: { id: string; label: string; hint?: string; children: ReactNode }) {
  return (
    <div>
      <label htmlFor={id} className="label font-semibold">{label}</label>
      {children}
      {hint && <p className="mt-1.5 text-xs text-muted">{hint}</p>}
    </div>
  );
}

export const Input = ({ className = "", ...p }: InputHTMLAttributes<HTMLInputElement>) => <input {...p} className={`${FIELD} ${className}`} />;
export const Textarea = ({ className = "", ...p }: TextareaHTMLAttributes<HTMLTextAreaElement>) => <textarea {...p} className={`${FIELD} ${className}`} />;

export function EmptyState({ icon, title, text, action }: { icon: string; title: string; text: string; action?: ReactNode }) {
  return (
    <div className="border-2 border-dashed border-ink bg-white/70 px-6 py-14 text-center">
      <div className="text-3xl">{icon}</div>
      <h3 className="mt-3 font-display text-xl font-bold">{title}</h3>
      <p className="mx-auto mt-1 max-w-sm text-sm text-muted">{text}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function Spinner() {
  return <span className="inline-block h-3.5 w-3.5 animate-spin border-2 border-current border-t-transparent" aria-hidden />;
}

export function ErrorBox({ message }: { message: string | null }) {
  if (!message) return null;
  return <p className="border-2 border-ink bg-pink-soft px-3 py-2 text-sm">{message}</p>;
}

export function Avatar({ src, alt, size = 24 }: { src: string; alt: string; size?: number }) {
  return <img src={src} alt={alt} width={size} height={size} className="inline-block border border-ink bg-white" style={{ width: size, height: size }} />;
}
