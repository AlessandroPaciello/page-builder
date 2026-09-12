// @generated — DO NOT EDIT BY HAND.
// Source: pipeline fixture → ricetta → emitter shadcn (contract accordion-item@1, penpotComponentId 062d2e96-d208-8096-8008-a0a47165506d, fixtureHash 4c74af97e6a4).
// Regenerate with: pnpm --filter @penpot-ds/scripts render:component -- AccordionItem

import * as AccordionPrimitive from "@radix-ui/react-accordion";
import { ChevronDownIcon } from "lucide-react";
import { cn } from "@penpot-ds/ui/lib/utils";
import * as React from "react";

export type AccordionItemProps = React.ComponentProps<typeof AccordionPrimitive.Item> & {
  label?: string;
  body?: string;
}

function AccordionItem({ className, label, body, ...props }: AccordionItemProps) {
  return (
    <AccordionPrimitive.Item data-slot="accordion-item" className={cn("border-b last:border-b-0 bg-card rounded-md", className)} {...props}>
      <AccordionPrimitive.Header className={cn("flex")}>
        <AccordionPrimitive.Trigger data-slot="accordion-item-trigger" className="flex flex-1 items-start justify-between text-left transition-all outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 [&[data-state=open]>svg]:rotate-180 gap-x-2 pb-3 pl-4 pr-4 pt-3">
          <span data-slot="accordion-item-label" className="font-medium text-foreground text-sm tracking-none">
            {label}
          </span>
          <ChevronDownIcon data-slot="accordion-item-chevron" className="pointer-events-none size-4 shrink-0 transition-transform duration-200 stroke-foreground" />
        </AccordionPrimitive.Trigger>
      </AccordionPrimitive.Header>
      <AccordionPrimitive.Content data-slot="accordion-item-content" className="overflow-hidden data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down pb-4 pl-4 pr-4">
        <div data-slot="accordion-item-body" className="font-regular text-muted-foreground text-sm tracking-none">
          {body}
        </div>
        <div data-slot="accordion-item-divider" className="border-t border-border" />
      </AccordionPrimitive.Content>
    </AccordionPrimitive.Item>
  );
}

export { AccordionItem };
