const baseConfig = require("./packages/config-prettier/prettier-preset");

module.exports = {
  ...baseConfig,
  plugins: [
    "@trivago/prettier-plugin-sort-imports",
    "prettier-plugin-tailwindcss",
    "prettier-plugin-sort-json",
  ],
  jsonRecursiveSort: true,
  // Ayme lab: the import sorter parses with Babel, which needs to be told about the legacy
  // decorators of Ayme's page objects (apps/web/ayme/pom).
  importOrderParserPlugins: ["typescript", "jsx", "decorators-legacy"],
};
