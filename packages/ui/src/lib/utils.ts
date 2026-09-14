import { colorNames, fontFamilyNames, fontSizeNames, fontWeightNames, trackingNames } from "@penpot-ds/tokens/scales";
import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

/**
 * tailwind-merge con le scale dei token Penpot (Story 2.9), generate da
 * `generate:theme` in `@penpot-ds/tokens`: col merge di default
 * `font-regular` è preso per una famiglia (e `font-sans` lo scarta) e
 * `tracking-none` non è riconosciuto.
 */
const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      color: [...colorNames],
      text: [...fontSizeNames],
      "font-weight": [...fontWeightNames],
      tracking: [...trackingNames],
      font: [...fontFamilyNames],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
