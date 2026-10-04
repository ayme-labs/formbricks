/* eslint-disable no-restricted-syntax -- The Ayme lab's own variables stay out of Formbricks's env schema, so the overlay leaves that schema unchanged. */

/** The Ayme lab's server-side settings, read from the environment the dev server was started with. */
export const labEnv = () => ({
  /** Lab mode, set by the Ayme lab's lab:dev: the page connects to a coding agent's Ayme MCP server. */
  labMode: process.env.AYME_LAB === "1",
  /** The key the Decision Endpoint calls the model with. */
  openRouterApiKey: process.env.AYME_OPENROUTER_API_KEY || undefined,
  /** Where the Decision Endpoint records each request's usage, when not the default. */
  decisionUsageFile: process.env.AYME_LAB_DECISION_USAGE_FILE || undefined,
});
