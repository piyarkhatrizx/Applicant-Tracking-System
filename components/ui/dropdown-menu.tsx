"use client";

import * as RadixMenu from "@radix-ui/react-dropdown-menu";
import {
  createContext,
  useContext,
  useRef,
  useState,
  type ComponentPropsWithoutRef,
  type ReactNode,
  type RefObject,
} from "react";
import { IconCheck } from "@/components/korosha/icon";

/**
 * Radix DropdownMenu: roving focus, type-ahead, Escape, arrow keys, correct
 * aria roles. All the behaviour a hand-rolled menu gets wrong on day two.
 *
 * Interruptible motion. The content is force-mounted while it is open AND
 * while it is animating closed, and globals.css (.ui-menu) drives it with
 * data-state transitions instead of keyframes. Reopening mid-close therefore
 * continues from where the menu is on screen rather than restarting. Once the
 * close transition ends the content unmounts again, so a list with a menu per
 * row does not keep hundreds of positioned popovers alive.
 *
 * Because the content does not unmount on close, Radix's unmount-time focus
 * return would come late (after the transition) and could steal focus. Focus
 * returns to the trigger at the moment of closing instead, and only when focus
 * was still inside the menu (Escape, or choosing an item). An outside click
 * keeps whatever it focused.
 */
type Presence = {
  mounted: boolean;
  unmount: () => void;
  triggerRef: RefObject<HTMLButtonElement | null>;
  contentRef: RefObject<HTMLDivElement | null>;
};

const PresenceContext = createContext<Presence | null>(null);

export function DropdownMenu({
  open: openProp,
  defaultOpen = false,
  onOpenChange,
  ...props
}: ComponentPropsWithoutRef<typeof RadixMenu.Root>) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(defaultOpen);
  const open = openProp ?? uncontrolledOpen;
  const [mounted, setMounted] = useState(open);
  // Mount on open during render, so the first open frame already has content.
  if (open && !mounted) setMounted(true);

  const triggerRef = useRef<HTMLButtonElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  function handleOpenChange(next: boolean) {
    if (!next && contentRef.current?.contains(document.activeElement)) {
      triggerRef.current?.focus();
    }
    if (openProp === undefined) setUncontrolledOpen(next);
    onOpenChange?.(next);
  }

  return (
    <PresenceContext.Provider value={{ mounted, unmount: () => setMounted(false), triggerRef, contentRef }}>
      <RadixMenu.Root open={open} onOpenChange={handleOpenChange} {...props} />
    </PresenceContext.Provider>
  );
}

export function DropdownMenuTrigger(props: ComponentPropsWithoutRef<typeof RadixMenu.Trigger>) {
  const presence = useContext(PresenceContext);
  return <RadixMenu.Trigger ref={presence?.triggerRef} {...props} />;
}

export const DropdownMenuGroup = RadixMenu.Group;

const contentClass =
  "ui-menu z-50 min-w-44 border border-[var(--line)] bg-[var(--surface)] p-[var(--space-1)] text-sm shadow-[var(--shadow-overlay)]";

const itemClass =
  "flex cursor-default select-none items-center gap-[var(--space-2)] px-[var(--space-2)] py-[var(--space-1)] outline-none data-[highlighted]:bg-[var(--surface-hover)] data-[disabled]:pointer-events-none data-[disabled]:opacity-50";

export function DropdownMenuContent({
  children,
  className = "",
  sideOffset = 4,
  align = "start",
  onCloseAutoFocus,
  onTransitionEnd,
  ...props
}: ComponentPropsWithoutRef<typeof RadixMenu.Content>) {
  const presence = useContext(PresenceContext);
  const keepMounted = presence?.mounted ? true : undefined;

  return (
    <RadixMenu.Portal forceMount={keepMounted}>
      <RadixMenu.Content
        ref={presence?.contentRef}
        forceMount={keepMounted}
        sideOffset={sideOffset}
        align={align}
        className={`${contentClass} ${className}`}
        onCloseAutoFocus={(event) => {
          // Focus already returned in DropdownMenu's onOpenChange.
          if (presence) event.preventDefault();
          onCloseAutoFocus?.(event);
        }}
        onTransitionEnd={(event) => {
          onTransitionEnd?.(event);
          if (
            presence &&
            event.target === event.currentTarget &&
            event.propertyName === "opacity" &&
            event.currentTarget.dataset.state === "closed"
          ) {
            presence.unmount();
          }
        }}
        {...props}
      >
        {children}
      </RadixMenu.Content>
    </RadixMenu.Portal>
  );
}

export function DropdownMenuItem({
  children,
  destructive = false,
  className = "",
  ...props
}: ComponentPropsWithoutRef<typeof RadixMenu.Item> & { destructive?: boolean }) {
  return (
    <RadixMenu.Item
      className={`${itemClass} ${
        destructive
          ? "text-[var(--danger)] data-[highlighted]:bg-[var(--danger-tint)]"
          : "text-[var(--foreground)]"
      } ${className}`}
      {...props}
    >
      {children}
    </RadixMenu.Item>
  );
}

function ItemCheck() {
  return (
    <span aria-hidden="true" className="flex w-3 shrink-0 items-center text-[var(--foreground)]">
      <RadixMenu.ItemIndicator>
        <IconCheck size="1em" />
      </RadixMenu.ItemIndicator>
    </span>
  );
}

export function DropdownMenuCheckboxItem({
  children,
  className = "",
  ...props
}: ComponentPropsWithoutRef<typeof RadixMenu.CheckboxItem>) {
  return (
    <RadixMenu.CheckboxItem className={`${itemClass} ${className}`} {...props}>
      <ItemCheck />
      {children}
    </RadixMenu.CheckboxItem>
  );
}

export function DropdownMenuRadioGroup({
  children,
  ...props
}: ComponentPropsWithoutRef<typeof RadixMenu.RadioGroup>) {
  return <RadixMenu.RadioGroup {...props}>{children}</RadixMenu.RadioGroup>;
}

export function DropdownMenuRadioItem({
  children,
  className = "",
  ...props
}: ComponentPropsWithoutRef<typeof RadixMenu.RadioItem>) {
  return (
    <RadixMenu.RadioItem className={`${itemClass} ${className}`} {...props}>
      <ItemCheck />
      {children}
    </RadixMenu.RadioItem>
  );
}

export function DropdownMenuLabel({ children }: { children: ReactNode }) {
  return (
    <RadixMenu.Label className="px-[var(--space-2)] py-[var(--space-1)] text-xs font-semibold uppercase tracking-wide text-[var(--ink-muted)]">
      {children}
    </RadixMenu.Label>
  );
}

export function DropdownMenuSeparator() {
  return <RadixMenu.Separator className="my-[var(--space-1)] h-px bg-[var(--line)]" />;
}

/** Right-aligned keyboard hint, so shortcuts are discoverable from the menu. */
export function DropdownMenuShortcut({ children }: { children: ReactNode }) {
  return (
    <span className="ml-auto pl-[var(--space-4)] font-[family-name:var(--font-mono-ui)] text-xs text-[var(--ink-muted)]">
      {children}
    </span>
  );
}
