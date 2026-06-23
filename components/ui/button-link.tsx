import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { clsx } from "clsx";

type Props = {
  href: string;
  children: React.ReactNode;
  external?: boolean;
  variant?: "primary" | "secondary" | "ghost";
};

export function ButtonLink({ href, children, external, variant = "primary" }: Props) {
  return (
    <Link
      href={href}
      target={external ? "_blank" : undefined}
      rel={external ? "noreferrer" : undefined}
      className={clsx(
        "focus-ring inline-flex items-center justify-center gap-2 rounded px-4 py-3 text-sm font-bold transition",
        variant === "primary" && "bg-forest text-white hover:bg-green-800",
        variant === "secondary" && "border border-slate-200 bg-white text-deep hover:bg-slate-100",
        variant === "ghost" && "border border-white/25 bg-white/10 text-white hover:bg-white/20"
      )}
    >
      {children}
      <ArrowRight size={16} aria-hidden />
    </Link>
  );
}
