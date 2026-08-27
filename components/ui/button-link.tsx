import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { clsx } from "clsx";
import { normalizeExternalUrl } from "@/lib/url";

type Props = {
  href: string;
  children: React.ReactNode;
  external?: boolean;
  variant?: "primary" | "secondary" | "ghost";
};

export function ButtonLink({ href, children, external, variant = "primary" }: Props) {
  const className = clsx(
    "focus-ring inline-flex touch-manipulation items-center justify-center gap-2 rounded px-4 py-3 text-sm font-bold transition",
    variant === "primary" && "bg-forest text-white hover:bg-green-800",
    variant === "secondary" && "border border-slate-200 bg-white text-deep hover:bg-slate-100",
    variant === "ghost" && "border border-white/25 bg-white/10 text-white hover:bg-white/20"
  );
  const content = (
    <>
      {children}
      <ArrowRight size={16} aria-hidden />
    </>
  );

  if (external) {
    return <a href={normalizeExternalUrl(href)} target="_blank" rel="noopener noreferrer" className={className}>{content}</a>;
  }

  return <Link href={href} className={className}>{content}</Link>;
}
