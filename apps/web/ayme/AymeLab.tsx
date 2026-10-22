"use client";

import { decisionEndpoint } from "@ayme-dev/ayme";
import { AymeProvider } from "@ayme-dev/react";
import { initializeWebMCPPolyfill } from "@mcp-b/webmcp-polyfill";
import { type ReactNode, useState } from "react";
import { DECISION_ENDPOINT_PATH, isGoalLoopOn } from "./lab-switches";
import { MainNavigation } from "./pom/MainNavigation";
import { SignInPage } from "./pom/SignInPage";
import { SurveyListPage } from "./pom/SurveyListPage";
import { SurveySummaryPage } from "./pom/SurveySummaryPage";

// document.modelContext, before the provider publishes to it. Native WebMCP is kept where present.
if (typeof window !== "undefined") initializeWebMCPPolyfill();

const webMCP = { enabled: true };

// Registered once: each page is present on its own route, MainNavigation while the sidebar is.
const pageObjects = [SignInPage, SurveyListPage, SurveySummaryPage, MainNavigation];

/**
 * Ayme in the Formbricks lab app: the runtime owner, the Goal Loop when its cookie is set, and, in
 * lab mode, the Agent Connection, which pairs the page with a coding agent's Ayme MCP server.
 */
export function AymeLab({ labMode, children }: Readonly<{ labMode: boolean; children: ReactNode }>) {
  // Read once per page load: the provider's options stay fixed while it is mounted.
  const [goalLoop] = useState(() =>
    typeof document !== "undefined" && isGoalLoopOn(document.cookie)
      ? decisionEndpoint(DECISION_ENDPOINT_PATH)
      : undefined
  );

  // Gated on lab mode the way an app gates it on its dev flag: a page then looks for the agent's server.
  return (
    <AymeProvider pageObjects={pageObjects} webMCP={webMCP} goalLoop={goalLoop} agentConnection={labMode}>
      {children}
    </AymeProvider>
  );
}
