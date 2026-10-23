"use client";

import { decisionEndpoint } from "@ayme-dev/ayme";
import { AymeProvider, usePageObject } from "@ayme-dev/react";
import { initializeWebMCPPolyfill } from "@mcp-b/webmcp-polyfill";
import { type ReactNode, useState } from "react";
import { DECISION_ENDPOINT_PATH, isGoalLoopOn } from "./lab-switches";
import { LinkSurveyPage } from "./pom/LinkSurveyPage";
import { MainNavigation } from "./pom/MainNavigation";
import { SignInPage } from "./pom/SignInPage";
import { SurveyEditorPage } from "./pom/SurveyEditorPage";
import { SurveyListPage } from "./pom/SurveyListPage";
import { SurveyResponsesPage } from "./pom/SurveyResponsesPage";
import { SurveySummaryPage } from "./pom/SurveySummaryPage";
import { TemplateGalleryPage } from "./pom/TemplateGalleryPage";
import { SettingsNavigation, WorkspaceAppearancePage, WorkspaceGeneralPage } from "./pom/WorkspaceSettingsPage";

// document.modelContext, before the provider publishes to it. Native WebMCP is kept where present.
if (typeof window !== "undefined") initializeWebMCPPolyfill();

const webMCP = { enabled: true };

// Registered once: each page is present on its own route.
const pageObjects = [
  SignInPage,
  SurveyListPage,
  SurveySummaryPage,
  SurveyResponsesPage,
  SurveyEditorPage,
  LinkSurveyPage,
  TemplateGalleryPage,
  WorkspaceGeneralPage,
  WorkspaceAppearancePage,
];

// The sidebars are on many routes and no URL states them, so they are registered while this component is
// mounted; each is present while its own root is on the page (settings swap the workspace sidebar for theirs).
function SidebarPageObject() {
  usePageObject(MainNavigation);
  usePageObject(SettingsNavigation);
  return null;
}

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
      <SidebarPageObject />
      {children}
    </AymeProvider>
  );
}
