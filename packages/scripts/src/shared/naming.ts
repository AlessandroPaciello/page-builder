/** Nome file kebab-case: "AccordionItem" → "accordion-item". */
export function toKebab(name: string): string {
  return name
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/([A-Z])([A-Z][a-z])/g, "$1-$2")
    .toLowerCase();
}

/** `accordion-item` → `AccordionItem`: il nome del container in Penpot. */
export function pascalCase(kebab: string): string {
  return kebab
    .split("-")
    .map((word) => (word.length > 0 ? word[0]!.toUpperCase() + word.slice(1) : word))
    .join("");
}
