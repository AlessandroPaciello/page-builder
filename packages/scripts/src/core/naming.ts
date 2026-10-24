/**
 * Nomi (Story 2.22): vivono nel nucleo perché generatore e verifica li usano;
 * `src/shared/naming.ts` li riesporta per chi sta fuori dal nucleo.
 */

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

/** Le parole di un nome libero (layer Penpot, valore di variante): minuscole, senza separatori. */
export function wordsOf(name: string): string[] {
  return toKebab(name.trim())
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

/** Un nome libero in kebab-case: "Icon Left" → "icon-left", "ShopCard" → "shop-card". */
export function kebabOf(name: string): string {
  return wordsOf(name).join("-");
}

/** `shop-card` → `shopCard`. */
export function camelCase(kebab: string): string {
  const pascal = pascalCase(kebabOf(kebab));
  return pascal.length > 0 ? pascal[0]!.toLowerCase() + pascal.slice(1) : pascal;
}

/** Chiave di parte valida: kebab-case che comincia con una lettera (`icon-left`). */
export const PART_KEY = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;

const IDENTIFIER = /^[A-Za-z_$][\w$]*$/;

/** Accesso a una proprietà in codice: `.root` se è un identificatore, altrimenti `["icon-left"]`. */
export function propAccess(key: string): string {
  return IDENTIFIER.test(key) ? `.${key}` : `[${JSON.stringify(key)}]`;
}

/** Chiave di un oggetto letterale in codice: `root` oppure `"icon-left"`. */
export function propKey(key: string): string {
  return IDENTIFIER.test(key) ? key : JSON.stringify(key);
}
