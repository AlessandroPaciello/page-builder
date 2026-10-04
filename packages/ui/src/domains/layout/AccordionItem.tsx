// @generated — DO NOT EDIT BY HAND.
// Source: pipeline due contratti → istantanea → render (contract accordion-item@1, penpotComponentId seed-accordionitem-2-16, snapshotHash 763d0076e7e6).
// Regenerate with: pnpm --filter @penpot-ds/scripts render -- AccordionItem

import { cn } from "@penpot-ds/ui/lib/utils";
import { Accordion } from "@base-ui/react/accordion";
import { ChevronDownIcon } from "lucide-react";
import * as React from "react";

export type AccordionItemProps = React.ComponentProps<typeof Accordion.Item> & {
  label?: string;
  body?: string;
};

function AccordionItem({ className, label = "", body = "", ...props }: AccordionItemProps) {
  return (
    <Accordion.Item data-slot="accordion-item" className={cn("bg-card flex flex-col items-start rounded-md", className)} {...props}>
      <Accordion.Header className="flex">
        <Accordion.Trigger data-slot="accordion-item-trigger" className="flex flex-row gap-x-2 items-center pb-3 pl-4 pr-4 pt-3 focus-visible:outline-2 focus-visible:outline-offset-2">
          <span data-slot="accordion-item-label" className="font-medium text-foreground text-sm tracking-none">
            {label}
          </span>
          <ChevronDownIcon data-slot="accordion-item-chevron" className="stroke-foreground" />
        </Accordion.Trigger>
      </Accordion.Header>
      <Accordion.Panel data-slot="accordion-item-content" className="flex flex-col items-start pb-4 pl-4 pr-4">
        <div data-slot="accordion-item-body" className="font-regular text-muted-foreground text-sm tracking-none">
          {body}
        </div>
        <div data-slot="accordion-item-divider" className="border-border" />
      </Accordion.Panel>
    </Accordion.Item>
  );
}

export { AccordionItem };
