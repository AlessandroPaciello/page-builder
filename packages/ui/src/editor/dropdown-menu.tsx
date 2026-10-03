"use client";

import { Menu } from "@base-ui/react/menu";
import { cn } from "@penpot-ds/ui/lib/utils";
import * as React from "react";

/**
 * Menu a tendina su Base UI (Story 2.16, DROPDOWN-BASEUI).
 *
 * Sostituisce il menu scritto a mano della Story 1.1 (nessun portal/collision,
 * ARIA incompleta, Escape/focus globali condivisi — voce deferred-work
 * 1-1/2026-09-05, chiusa qui): apertura/chiusura, portal su root condiviso,
 * collision detection, Escape, frecce, Home/End, focus al trigger alla
 * chiusura e ARIA (`aria-haspopup`/`aria-expanded`, `role="menu"/"menuitem"`)
 * arrivano dal primitivo headless, coerente con AccordionItem (Base UI).
 * Le `data-slot` e le classi restano quelle del chrome dell'editor, così i
 * call site (`mode-toggle`, `user-menu`) non cambiano.
 */

function DropdownMenu({ children, ...props }: Omit<React.ComponentProps<typeof Menu.Root>, "children"> & { children: React.ReactNode }) {
  return (
    <Menu.Root {...props}>
      <div data-slot="dropdown-menu" className="relative inline-flex">
        {children}
      </div>
    </Menu.Root>
  );
}

type DropdownMenuTriggerProps = React.ComponentProps<typeof Menu.Trigger> & {
  /**
   * Elemento da usare come trigger al posto del `<button>` di default — stessa
   * convenzione `render` di Base UI, così i call site non cambiano
   * (`render={<Button variant="outline" />}`).
   */
  render?: React.ReactElement<Record<string, unknown>>;
};

function DropdownMenuTrigger({ render, children, className, ...props }: DropdownMenuTriggerProps) {
  return (
    <Menu.Trigger
      data-slot="dropdown-menu-trigger"
      className={className}
      {...(render === undefined ? {} : { render })}
      {...props}
    >
      {children}
    </Menu.Trigger>
  );
}

function DropdownMenuContent({
  align = "start",
  className,
  children,
  ...props
}: React.ComponentProps<typeof Menu.Popup> & { align?: "start" | "end" }) {
  return (
    <Menu.Portal>
      <Menu.Positioner side="bottom" align={align} sideOffset={4}>
        <Menu.Popup
          data-slot="dropdown-menu-content"
          data-align={align}
          className={cn(
            "z-50 max-h-96 min-w-32 origin-top overflow-x-hidden overflow-y-auto rounded-none bg-popover text-popover-foreground shadow-md ring-1 ring-foreground/10 outline-none",
            className,
          )}
          {...props}
        >
          {children}
        </Menu.Popup>
      </Menu.Positioner>
    </Menu.Portal>
  );
}

function DropdownMenuGroup({ className, ...props }: React.ComponentProps<typeof Menu.Group>) {
  return <Menu.Group data-slot="dropdown-menu-group" className={className} {...props} />;
}

function DropdownMenuLabel({
  className,
  inset,
  ...props
}: React.ComponentProps<typeof Menu.GroupLabel> & { inset?: boolean }) {
  return (
    <Menu.GroupLabel
      data-slot="dropdown-menu-label"
      data-inset={inset}
      className={cn("px-2 py-2 text-xs text-muted-foreground data-inset:pl-7", className)}
      {...props}
    />
  );
}

function DropdownMenuSeparator({ className, ...props }: React.ComponentProps<typeof Menu.Separator>) {
  return (
    <Menu.Separator
      data-slot="dropdown-menu-separator"
      className={cn("-mx-1 my-1 h-px bg-border", className)}
      {...props}
    />
  );
}

function DropdownMenuItem({
  className,
  inset,
  variant = "default",
  ...props
}: React.ComponentProps<typeof Menu.Item> & {
  inset?: boolean;
  variant?: "default" | "destructive";
}) {
  return (
    <Menu.Item
      data-slot="dropdown-menu-item"
      data-inset={inset}
      data-variant={variant}
      className={cn(
        "group/dropdown-menu-item relative flex w-full cursor-default items-center gap-2 rounded-none px-2 py-2 text-left text-xs outline-hidden select-none hover:bg-accent hover:text-accent-foreground focus-visible:bg-accent focus-visible:text-accent-foreground data-inset:pl-7 data-[variant=destructive]:text-destructive data-[variant=destructive]:hover:bg-destructive/10 data-[variant=destructive]:focus-visible:bg-destructive/10 dark:data-[variant=destructive]:hover:bg-destructive/20 data-disabled:pointer-events-none data-disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 data-[variant=destructive]:*:[svg]:text-destructive",
        className,
      )}
      {...props}
    />
  );
}

export {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
};
