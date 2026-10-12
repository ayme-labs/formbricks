"use client";

import { decisionEndpoint } from "@ayme-dev/ayme";
import { AymeProvider } from "@ayme-dev/react";
import { initializeWebMCPPolyfill } from "@mcp-b/webmcp-polyfill";
import { type ReactNode, useState } from "react";
import { AymePageObjects } from "./AymePageObjects";
import { DECISION_ENDPOINT_PATH, arePageObjectsOff, isGoalLoopOn } from "./lab-switches";

// document.modelContext, before the provider publishes to it. Native WebMCP is kept where present.
if (typeof window !== "undefined") initializeWebMCPPolyfill();

const webMCP = { enabled: true };

/**
 * Ayme in the Formbricks lab app: the runtime owner, the page objects of the current screen unless
 * their cookie turns them off, the Goal Loop when its cookie is set, and, in lab mode, the Agent
 * Connection, which pairs the page with a coding agent's Ayme MCP server.
 */
export function AymeLab({ labMode, children }: Readonly<{ labMode: boolean; children: ReactNode }>) {
  // Read once per page load: the provider's options stay fixed while it is mounted.
  const [goalLoop] = useState(() =>
    typeof document !== "undefined" && isGoalLoopOn(document.cookie)
      ? decisionEndpoint(DECISION_ENDPOINT_PATH)
      : undefined
  );
  // Off, the page publishes only snapshot and the Browser Tools: Ayme in an app without page objects.
  const [pageObjects] = useState(
    () => !(typeof document !== "undefined" && arePageObjectsOff(document.cookie))
  );

  // Gated on lab mode the way an app gates it on its dev flag: a page then looks for the agent's server.
  return (
    <AymeProvider webMCP={webMCP} goalLoop={goalLoop} agentConnection={labMode}>
      {pageObjects && <AymePageObjects />}
      {children}
    </AymeProvider>
  );
}
