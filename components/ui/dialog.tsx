"use client";

import * as RadixDialog from "@radix-ui/react-dialog";
import type { ReactNode } from "react";
import { IconClose } from "@/components/korosha/icon";

/**
 * Radix Dialog handles the parts that are easy to get subtly wrong: focus trap,
 * focus restore to the trigger, Escape, scroll lock, aria-modal wiring, and
 * inert-ing the rest of the page. Motion lives in globals.css (.ui-scrim /
 * .ui-dialog-panel) so it runs off the main thread.
 *
 * Pinned near the top rather than centred: a dialog whose content changes
 * height (the call modal moves through phases) grows downward instead of
 * jumping both ways. The panel itself scrolls when it is taller than the
 * viewport, because Radix's scroll lock only allows scrolling inside it.
 *
 * `dismissible={false}` hides the close button and ignores Escape and outside
 * clicks, for a state the user has to finish explicitly (a live call).
 */
export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  footer,
  children,
  className = "",
  dismissible = true,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  footer?: ReactNode;
  children?: ReactNode;
  className?: string;
  dismissible?: boolean;
}) {
  const block = (event: Event) => {
    if (!dismissible) event.preventDefault();
  };

  return (
    <RadixDialog.Root open={open} onOpenChange={onOpenChange}>
      <RadixDialog.Portal>
        <RadixDialog.Overlay className="ui-scrim fixed inset-0 z-40 bg-[var(--scrim)]" />
        {/* Placement lives on the wrapper so the enter/exit keyframe owns
            `transform` outright and never fights a translate utility. */}
        <div className="pointer-events-none fixed inset-0 z-50 flex justify-center px-[var(--space-4)] pt-[12vh]">
          <RadixDialog.Content
            onEscapeKeyDown={block}
            onPointerDownOutside={block}
            onInteractOutside={block}
            className={`ui-dialog-panel pointer-events-auto flex max-h-[calc(88vh-var(--space-4))] w-[min(92vw,32rem)] flex-col self-start overflow-y-auto rounded-2xl bg-[var(--surface)] text-[var(--foreground)] shadow-[var(--shadow-overlay)] ${className}`}
          >
            <div className="flex items-start justify-between gap-[var(--space-4)] px-[var(--space-5)] pt-[var(--space-5)]">
              <div className="min-w-0">
                <RadixDialog.Title className="text-lg font-semibold tracking-tight">{title}</RadixDialog.Title>
                {description ? (
                  <RadixDialog.Description className="mt-[var(--space-1)] text-sm leading-relaxed text-[var(--ink-muted)]">
                    {description}
                  </RadixDialog.Description>
                ) : (
                  <RadixDialog.Description className="sr-only">{title}</RadixDialog.Description>
                )}
              </div>
              {dismissible && <DialogClose />}
            </div>
            <div className={`px-[var(--space-5)] pt-[var(--space-4)] ${footer ? "pb-[var(--space-4)]" : "pb-[var(--space-5)]"}`}>
              {children}
            </div>
            {footer && (
              <div className="flex items-center justify-end gap-[var(--space-2)] px-[var(--space-5)] pb-[var(--space-5)] pt-[var(--space-2)]">
                {footer}
              </div>
            )}
          </RadixDialog.Content>
        </div>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
}

export function DialogClose({ label = "Close" }: { label?: string }) {
  return (
    <RadixDialog.Close
      aria-label={label}
      className="ui-button -mr-1 flex h-7 w-7 shrink-0 items-center justify-center text-md text-[var(--ink-muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)]"
    >
      <IconClose size="1em" />
    </RadixDialog.Close>
  );
}

export const DialogTrigger = RadixDialog.Trigger;
