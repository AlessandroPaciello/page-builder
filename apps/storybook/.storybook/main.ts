import type { StorybookConfig } from "@storybook/react-vite";

const config: StorybookConfig = {
  // Glob speculare a packages/ui/src/stories.smoke.test.tsx (runtime diversi, nessuna costante condivisa).
  stories: ["../../../packages/ui/src/domains/**/*.stories.@(js|jsx|mjs|ts|tsx)"],
  addons: ["@storybook/addon-a11y"],
  framework: {
    name: "@storybook/react-vite",
    options: {},
  },
};

export default config;
