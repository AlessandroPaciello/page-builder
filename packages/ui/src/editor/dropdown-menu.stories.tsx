import type { Meta, StoryObj } from "@storybook/react";
import { Button } from "./button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./dropdown-menu";

/**
 * Story scritta a mano del menu a tendina dell'editor (Story 2.18), su Base
 * UI: tiene vivo Storybook e il suo smoke gate dopo la rimozione dei
 * componenti di prova della v2. CSF3 con `args`: lo stesso uso dei call site
 * (`mode-toggle`, `user-menu`), trigger polimorfico via `render`.
 */

interface DropdownMenuStoryArgs {
  readonly trigger: string;
  readonly label: string;
  readonly items: readonly string[];
  /** Voce distruttiva in fondo, dopo il separatore; vuota = nessuna. */
  readonly destructiveItem: string;
  readonly align: "start" | "end";
  readonly defaultOpen: boolean;
}

const meta = {
  title: "Editor/DropdownMenu",
  args: {
    trigger: "Tema",
    label: "Aspetto",
    items: ["Chiaro", "Scuro", "Sistema"],
    destructiveItem: "",
    align: "start",
    defaultOpen: false,
  },
  argTypes: {
    align: { control: "inline-radio", options: ["start", "end"] },
  },
  render: ({ trigger, label, items, destructiveItem, align, defaultOpen }) => (
    <main>
      <DropdownMenu defaultOpen={defaultOpen}>
        <DropdownMenuTrigger render={<Button variant="outline">{trigger}</Button>} />
        <DropdownMenuContent align={align}>
          <DropdownMenuGroup>
            <DropdownMenuLabel>{label}</DropdownMenuLabel>
            {items.map((item, index) => (
              <DropdownMenuItem key={`${index}-${item}`}>{item}</DropdownMenuItem>
            ))}
          </DropdownMenuGroup>
          {destructiveItem === "" ? null : (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive">{destructiveItem}</DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </main>
  ),
} satisfies Meta<DropdownMenuStoryArgs>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Chiuso: Story = { args: { defaultOpen: false } };
export const Aperto: Story = { args: { defaultOpen: true } };
export const ConVoceDistruttiva: Story = {
  args: { trigger: "Account", label: "Account", items: ["Profilo", "Impostazioni"], destructiveItem: "Esci", align: "end", defaultOpen: true },
};
