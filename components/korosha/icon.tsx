/**
 * A small, consistent icon set drawn in-house.
 *
 * Not Lucide or Feather: those are the default choice and read as such. Every
 * glyph here shares one stroke weight (1.5), one 16-unit box and `currentColor`,
 * so an icon inherits whatever ink its container uses and never introduces a
 * color of its own.
 */
type IconProps = {
  /** px as a number, or a CSS length. Use "1em" to match the adjacent text. */
  size?: number | string;
  className?: string;
  title?: string;
};

/** Close a dialog or panel. Replaces the multiplication-sign glyph. */
export function IconClose(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M4 4l8 8M12 4l-8 8" />
    </Svg>
  );
}

/** Checked item in a menu. Replaces the check-mark glyph. */
export function IconCheck(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M3.5 8.5l3 3 6-7" />
    </Svg>
  );
}

/** Forward: "show more", "next". */
export function IconArrowRight(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M3 8h10M9 4l4 4-4 4" />
    </Svg>
  );
}

/** Back: "previous". */
export function IconArrowLeft(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M13 8H3M7 4L3 8l4 4" />
    </Svg>
  );
}

function Svg({
  size = 16,
  className = "",
  title,
  children,
}: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={title ? undefined : true}
      role={title ? "img" : undefined}
      className={className}
    >
      {title && <title>{title}</title>}
      {children}
    </svg>
  );
}

/** Sort ascending. */
export function IconArrowUp(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M8 13V3M4 7l4-4 4 4" />
    </Svg>
  );
}

/** Sort descending. */
export function IconArrowDown(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M8 3v10M4 9l4 4 4-4" />
    </Svg>
  );
}

/** Reorder: move up. */
export function IconChevronUp(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M4 10l4-4 4 4" />
    </Svg>
  );
}

/** Reorder: move down. */
export function IconChevronDown(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M4 6l4 4 4-4" />
    </Svg>
  );
}

/** Drag affordance beside the reorder controls. */
export function IconGrip(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="6" cy="4" r="0.9" fill="currentColor" stroke="none" />
      <circle cx="10" cy="4" r="0.9" fill="currentColor" stroke="none" />
      <circle cx="6" cy="8" r="0.9" fill="currentColor" stroke="none" />
      <circle cx="10" cy="8" r="0.9" fill="currentColor" stroke="none" />
      <circle cx="6" cy="12" r="0.9" fill="currentColor" stroke="none" />
      <circle cx="10" cy="12" r="0.9" fill="currentColor" stroke="none" />
    </Svg>
  );
}

/** Empty state: an open tray. Replaces the em-dash placeholder. */
export function IconInbox(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M2 9.5h3l1 2h4l1-2h3" />
      <path d="M3.6 3.2h8.8l1.6 6.3v3H2V9.5z" />
    </Svg>
  );
}

export function IconPhone(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M5.6 2.6l1.6 2.6-1.3 1.3a7 7 0 003.6 3.6l1.3-1.3 2.6 1.6v2.1a1 1 0 01-1.1 1A11 11 0 012.5 3.7a1 1 0 011-1.1z" />
    </Svg>
  );
}

export function IconNote(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M3.5 2.5h9v11h-9z" />
      <path d="M5.8 5.6h4.4M5.8 8h4.4M5.8 10.4h2.6" />
    </Svg>
  );
}

export function IconMore(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="3.5" cy="8" r="1" fill="currentColor" stroke="none" />
      <circle cx="8" cy="8" r="1" fill="currentColor" stroke="none" />
      <circle cx="12.5" cy="8" r="1" fill="currentColor" stroke="none" />
    </Svg>
  );
}

export function IconTrash(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M2.8 4.2h10.4M6.2 4.2V2.8h3.6v1.4" />
      <path d="M4.2 4.2l.6 9h6.4l.6-9" />
    </Svg>
  );
}
