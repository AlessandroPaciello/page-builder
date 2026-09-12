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
