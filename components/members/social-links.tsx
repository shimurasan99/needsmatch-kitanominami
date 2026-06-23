import { ExternalLink, Globe, Instagram } from "lucide-react";
import type { Member } from "@/types/domain";

export function SocialLinks({ member, compact = false }: { member: Pick<Member, "facebookUrl" | "instagramUrl" | "websiteUrl" | "name">; compact?: boolean }) {
  const links = [
    { href: member.facebookUrl, label: `${member.name}のFacebook`, icon: <span className="text-sm font-black">f</span> },
    { href: member.instagramUrl, label: `${member.name}のInstagram`, icon: <Instagram size={compact ? 15 : 17} aria-hidden /> },
    { href: member.websiteUrl, label: `${member.name}のホームページ`, icon: <Globe size={compact ? 15 : 17} aria-hidden /> }
  ].filter((item) => item.href);

  return (
    <div className="flex flex-wrap gap-2">
      {links.map((link) => (
        <a
          key={link.label}
          href={link.href}
          target="_blank"
          rel="noreferrer"
          aria-label={link.label}
          title={link.label}
          className="focus-ring inline-grid h-9 w-9 place-items-center rounded border border-slate-200 bg-white text-forest shadow-sm hover:border-forest hover:bg-snow"
        >
          {link.icon}
          <span className="sr-only">{link.label}</span>
          {!compact && <ExternalLink className="sr-only" size={1} aria-hidden />}
        </a>
      ))}
    </div>
  );
}
