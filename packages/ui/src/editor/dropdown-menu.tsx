"use client";

import { cn } from "@penpot-ds/ui/lib/utils";
import * as React from "react";

/**
 * Menu a tendina scritto a mano, senza primitive headless.
 *
 * Story 1.1 / AD-11: `@base-ui/react` è uscito dal package e Radix entra solo
 * con i componenti generati in `domains/` (Story 2.4), mai da `editor/`
 * (Spine#AD-3). Questo file copre il minimo che serve al chrome dell'editor —
 * apertura/chiusura, focus trap leggero, Escape, click esterno, frecce — e
 * non ambisce a coprire la superficie di una primitiva completa (submenu,
 * checkbox item, radio group, tipeahead: non servono e non ci sono).
 */

type DropdownMenuContextValue = {
  open: boolean;
  setOpen: (open: boolean) => void;
  triggerRef: React.RefObject<HTMLButtonElement | null>;
  contentRef: React.RefObject<HTMLDivElement | null>;
};

const DropdownMenuContext = React.createContext<DropdownMenuContextValue | null>(null);

function useDropdownMenuContext(component: string) {
  const context = React.useContext(DropdownMenuContext);
  if (!context) {
    throw new Error(`<${component}> deve essere usato dentro <DropdownMenu>`);
  }
  return context;
}

/** Restituisce gli item abilitati del menu, in ordine di documento. */
function menuItems(content: HTMLElement | null) {
  if (!content) return [];
  return Array.from(
    content.querySelectorAll<HTMLElement>('[data-slot="dropdown-menu-item"]:not([data-disabled])'),
  );
}

function DropdownMenu({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = React.useState(false);
  const triggerRef = React.useRef<HTMLButtonElement | null>(null);
  const contentRef = React.useRef<HTMLDivElement | null>(null);

  // Chiusura su click esterno e su Escape. Escape riporta il focus al trigger:
  // senza questo il focus finisce sul <body> e la tastiera perde il filo.
  React.useEffect(() => {
    if (!open) return;

    function onPointerDown(event: PointerEvent) {
      const target = event.target as Node;
      if (contentRef.current?.contains(target) || triggerRef.current?.contains(target)) return;
      setOpen(false);
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      event.stopPropagation();
      setOpen(false);
      triggerRef.current?.focus();
    }

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const value = React.useMemo(
    () => ({ open, setOpen, triggerRef, contentRef }),
    [open],
  );

  return (
    <DropdownMenuContext.Provider value={value}>
      <div data-slot="dropdown-menu" className="relative inline-flex">
        {children}
      </div>
    </DropdownMenuContext.Provider>
  );
}

type DropdownMenuTriggerProps = React.ComponentProps<"button"> & {
  /**
   * Elemento da usare come trigger al posto del `<button>` di default — stessa
   * convenzione `render` che aveva Base UI, così i call site non cambiano.
   */
  render?: React.ReactElement<React.ComponentProps<"button">>;
};

function DropdownMenuTrigger({ render, children, onClick, ...props }: DropdownMenuTriggerProps) {
  const { open, setOpen, triggerRef, contentRef } = useDropdownMenuContext("DropdownMenuTrigger");

  const triggerProps: React.ComponentProps<"button"> & {
    ref: typeof triggerRef;
    "data-slot": string;
    "data-open"?: string;
  } = {
    ...props,
    ref: triggerRef,
    "data-slot": "dropdown-menu-trigger",
    "aria-haspopup": "menu",
    "aria-expanded": open,
    "data-open": open ? "" : undefined,
    onClick: (event: React.MouseEvent<HTMLButtonElement>) => {
      onClick?.(event);
      if (event.defaultPrevented) return;
      setOpen(!open);
    },
    onKeyDown: (event: React.KeyboardEvent<HTMLButtonElement>) => {
      if (event.key !== "ArrowDown") return;
      event.preventDefault();
      setOpen(true);
      // Il contenuto non è ancora montato: il focus va spostato dopo il paint.
      requestAnimationFrame(() => menuItems(contentRef.current)[0]?.focus());
    },
    children,
  };

  if (render) {
    return React.cloneElement(render, {
      ...triggerProps,
      className: cn(render.props.className, props.className),
    } as React.ComponentProps<"button">);
  }

  return <button type="button" {...triggerProps} />;
}

function DropdownMenuContent({
  align = "start",
  className,
  children,
  ...props
}: React.ComponentProps<"div"> & { align?: "start" | "end" }) {
  const { open, setOpen, contentRef, triggerRef } = useDropdownMenuContext("DropdownMenuContent");

  if (!open) return null;

  return (
    <div
      ref={contentRef}
      role="menu"
      data-slot="dropdown-menu-content"
      data-align={align}
      className={cn(
        "absolute top-full z-50 mt-1 max-h-96 min-w-32 origin-top overflow-x-hidden overflow-y-auto rounded-none bg-popover text-popover-foreground shadow-md ring-1 ring-foreground/10 outline-none",
        align === "end" ? "right-0" : "left-0",
        className,
      )}
      onKeyDown={(event) => {
        const items = menuItems(contentRef.current);
        if (items.length === 0) return;
        const current = items.indexOf(document.activeElement as HTMLElement);

        if (event.key === "ArrowDown" || event.key === "ArrowUp") {
          event.preventDefault();
          const delta = event.key === "ArrowDown" ? 1 : -1;
          const next = (current + delta + items.length) % items.length;
          items[next]?.focus();
          return;
        }
        if (event.key === "Home") {
          event.preventDefault();
          items[0]?.focus();
          return;
        }
        if (event.key === "End") {
          event.preventDefault();
          items[items.length - 1]?.focus();
          return;
        }
        if (event.key === "Tab") {
          setOpen(false);
          triggerRef.current?.focus();
        }
      }}
      {...props}
    >
      {children}
    </div>
  );
}

function DropdownMenuGroup({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div role="group" data-slot="dropdown-menu-group" className={className} {...props} />
  );
}

function DropdownMenuLabel({
  className,
  inset,
  ...props
}: React.ComponentProps<"div"> & { inset?: boolean }) {
  return (
    <div
      data-slot="dropdown-menu-label"
      data-inset={inset}
      className={cn("px-2 py-2 text-xs text-muted-foreground data-inset:pl-7", className)}
      {...props}
    />
  );
}

function DropdownMenuSeparator({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      role="separator"
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
  disabled,
  onClick,
  ...props
}: React.ComponentProps<"button"> & {
  inset?: boolean;
  variant?: "default" | "destructive";
}) {
  const { setOpen, triggerRef } = useDropdownMenuContext("DropdownMenuItem");

  return (
    <button
      type="button"
      role="menuitem"
      data-slot="dropdown-menu-item"
      data-inset={inset}
      data-variant={variant}
      data-disabled={disabled ? "" : undefined}
      disabled={disabled}
      className={cn(
        "group/dropdown-menu-item relative flex w-full cursor-default items-center gap-2 rounded-none px-2 py-2 text-left text-xs outline-hidden select-none hover:bg-accent hover:text-accent-foreground focus-visible:bg-accent focus-visible:text-accent-foreground data-inset:pl-7 data-[variant=destructive]:text-destructive data-[variant=destructive]:hover:bg-destructive/10 data-[variant=destructive]:focus-visible:bg-destructive/10 dark:data-[variant=destructive]:hover:bg-destructive/20 data-disabled:pointer-events-none data-disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 data-[variant=destructive]:*:[svg]:text-destructive",
        className,
      )}
      onClick={(event) => {
        onClick?.(event);
        if (event.defaultPrevented) return;
        setOpen(false);
        triggerRef.current?.focus();
      }}
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
