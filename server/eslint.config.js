import { fixupPluginRules } from "@eslint/compat";
import eslintPluginDrizzle from "eslint-plugin-drizzle";

import BaseEslintConfig from "../eslint.config.js";

export default [
  ...BaseEslintConfig,
  {
    plugins: {
      drizzle: fixupPluginRules(eslintPluginDrizzle),
    },
  },
];
