"use client";

import { usePageObject } from "@ayme-dev/react";
import { usePathname } from "next/navigation";
import { SignInPage } from "./pom/SignInPage";
import { SurveyEditorPage } from "./pom/SurveyEditorPage";
import { SurveyNavigationPage } from "./pom/SurveyNavigationPage";
import { SurveySummaryPage } from "./pom/SurveySummaryPage";

const SignIn = () => {
  usePageObject(SignInPage);
  return null;
};
const SurveyNavigation = () => {
  usePageObject(SurveyNavigationPage);
  return null;
};
const SurveyEditor = () => {
  usePageObject(SurveyEditorPage);
  return null;
};
const SurveySummary = () => {
  usePageObject(SurveySummaryPage);
  return null;
};

/** Registers the page objects of the screen at the current path, so only its tools are published. */
export function AymePageObjects() {
  const pathname = usePathname();
  if (pathname === "/auth/login") return <SignIn />;
  if (/^\/organizations\/[^/]+\/workspaces\/new\/survey$/.test(pathname)) return <SurveyNavigation />;
  if (/^\/workspaces\/[^/]+\/surveys\/[^/]+\/edit$/.test(pathname)) return <SurveyEditor />;
  if (/^\/workspaces\/[^/]+\/surveys\/[^/]+\/summary$/.test(pathname)) return <SurveySummary />;
  return null;
}
