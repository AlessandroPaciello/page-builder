// @generated from Penpot design tokens — DO NOT EDIT BY HAND.
// Regenerate with: pnpm --filter @penpot-ds/scripts generate:theme
// Source catalog fixture hash: 4c74af97e6a4

export const spacing = {
  "1": 4,
  "2": 8,
  "3": 12,
  "4": 16,
  "5": 24,
  "6": 32,
  "7": 40,
  "8": 48,
  "9": 64,
} as const;

export const spacingOptions = [
  { label: "spacing.1", value: "1" },
  { label: "spacing.2", value: "2" },
  { label: "spacing.3", value: "3" },
  { label: "spacing.4", value: "4" },
  { label: "spacing.5", value: "5" },
  { label: "spacing.6", value: "6" },
  { label: "spacing.7", value: "7" },
  { label: "spacing.8", value: "8" },
  { label: "spacing.9", value: "9" },
] as const;

export const spacingMap = {
  "1": "var(--spacing-1)",
  "2": "var(--spacing-2)",
  "3": "var(--spacing-3)",
  "4": "var(--spacing-4)",
  "5": "var(--spacing-5)",
  "6": "var(--spacing-6)",
  "7": "var(--spacing-7)",
  "8": "var(--spacing-8)",
  "9": "var(--spacing-9)",
} as const;

export const radii = {
  "sm": 4,
  "md": 8,
  "lg": 12,
  "full": 9999,
} as const;

export const radiiOptions = [
  { label: "radius.sm", value: "sm" },
  { label: "radius.md", value: "md" },
  { label: "radius.lg", value: "lg" },
  { label: "radius.full", value: "full" },
] as const;

export const radiiMap = {
  "sm": "var(--radius-sm)",
  "md": "var(--radius-md)",
  "lg": "var(--radius-lg)",
  "full": "var(--radius-full)",
} as const;

// Nomi dei token per le scale di tailwind-merge (la `cn` dei componenti): senza,
// `font-regular` passa per una famiglia e `tracking-none` non è riconosciuto.
export const colorNames = [
  "gray-1",
  "gray-2",
  "gray-8",
  "gray-11",
  "gray-12",
  "white",
  "accent-1",
  "accent-2",
  "accent-9",
  "accent-11",
  "accent-12",
  "red-9",
  "green-9",
  "amber-9",
  "blue-9",
  "background",
  "foreground",
  "card",
  "card-foreground",
  "popover",
  "popover-foreground",
  "primary",
  "primary-foreground",
  "secondary",
  "secondary-foreground",
  "muted",
  "muted-foreground",
  "accent",
  "accent-foreground",
  "destructive",
  "destructive-foreground",
  "border",
  "input",
  "ring",
  "success",
  "success-foreground",
  "warning",
  "warning-foreground",
  "info",
  "info-foreground",
] as const;

export const fontSizeNames = [
  "xs",
  "sm",
  "base",
  "lg",
  "xl",
  "2xl",
  "3xl",
] as const;

export const fontWeightNames = [
  "regular",
  "medium",
  "semibold",
  "bold",
] as const;

export const trackingNames = [
  "none",
  "tight",
  "wide",
] as const;

export const fontFamilyNames = [
  "sans",
  "serif",
] as const;
