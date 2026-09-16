import Image from "next/image";
import type { ReactNode } from "react";

export type AvatarSize = "sm" | "md" | "lg";

const sizeClass: Record<AvatarSize, string> = {
  sm: "h-5 w-5 text-[9px]",
  md: "h-7 w-7 text-[11px]",
  lg: "h-10 w-10 text-sm",
};

const sizePx: Record<AvatarSize, number> = { sm: 20, md: 28, lg: 40 };

export function initialsFor(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

export function Avatar({
  name,
  src,
  size = "md",
  className = "",
}: {
  name: string;
  src?: string;
  size?: AvatarSize;
  className?: string;
}) {
  const base = `${sizeClass[size]} shrink-0 rounded-full ${className}`;

  if (src) {
    return (
      <Image
        src={src}
        alt={name}
        width={sizePx[size]}
        height={sizePx[size]}
        unoptimized
        className={`${base} object-cover`}
      />
    );
  }

  return (
    <span
      role="img"
      aria-label={name || "Unknown person"}
      className={`${base} inline-flex items-center justify-center bg-[var(--avatar-tint)] font-semibold text-[var(--avatar-ink)]`}
    >
      <span aria-hidden="true">{initialsFor(name) || "?"}</span>
    </span>
  );
}

/**
 * Stacked group. The ring is the page surface, so overlapping avatars read as
 * separate discs. `max` collapses the tail into a +N chip.
 */
export function AvatarGroup({
  people,
  size = "md",
  max = 4,
}: {
  people: { name: string; src?: string }[];
  size?: AvatarSize;
  max?: number;
}) {
  const shown = people.slice(0, max);
  const overflow = people.length - shown.length;

  return (
    <span className="inline-flex items-center" aria-label={people.map((p) => p.name).join(", ")}>
      {shown.map((person, index) => (
        <span
          key={`${person.name}-${index}`}
          className="-ml-1.5 rounded-full ring-2 ring-[var(--surface)] first:ml-0"
        >
          <Avatar name={person.name} src={person.src} size={size} />
        </span>
      ))}
      {overflow > 0 && (
        <span
          className={`-ml-1.5 inline-flex items-center justify-center rounded-full bg-[var(--surface-sunken)] font-semibold text-[var(--ink-muted)] ring-2 ring-[var(--surface)] ${sizeClass[size]}`}
        >
          +{overflow}
        </span>
      )}
    </span>
  );
}

export function AvatarWithLabel({
  name,
  src,
  size = "md",
  children,
}: {
  name: string;
  src?: string;
  size?: AvatarSize;
  children?: ReactNode;
}) {
  return (
    <span className="inline-flex min-w-0 items-center gap-[var(--space-2)]">
      <Avatar name={name} src={src} size={size} />
      <span className="min-w-0 truncate">{children ?? name}</span>
    </span>
  );
}
