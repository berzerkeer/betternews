/** @type {import('prettier').Config} */
const config = {
  importOrder: [
    "^(react/(.*)$)|^(react$)",
    "^(hono/(.*)$)|^(hono$)",
    "^(drizzle-orm/(.*)$)|^(drizzle-orm$)",
    "^(@tanstack/react-router/(.*)$)|^(@tanstack/react-router$)",
    "^(@tanstack/(.*)$)|^(@tanstack$)",
    "",
    "<THIRD_PARTY_MODULES>",
    "",
    "^types$",
    "^~/shared/(.*)$",
    "^~/lib/(.*)$",
    "^~/hooks/(.*)$",
    "^~/components/ui/(.*)$",
    "^~/components/(.*)$",
    "",
    "^[./]",
  ],
  importOrderParserPlugins: ["typescript", "jsx", "decorators-legacy"],
  plugins: ["@ianvs/prettier-plugin-sort-imports"],
};

export default config;
