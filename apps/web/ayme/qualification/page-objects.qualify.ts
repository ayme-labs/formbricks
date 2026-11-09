import { startAgent } from "@ayme-dev/mcp/testing";
import { type Locator, type Page, expect, test } from "@playwright/test";
import assert from "node:assert";
import { GOAL_LOOP_COOKIE, PAGE_OBJECTS_COOKIE } from "../lab-switches";
import { SignInPage } from "../pom/SignInPage";
import { SurveyEditorPage } from "../pom/SurveyEditorPage";
import { SurveyNavigationPage } from "../pom/SurveyNavigationPage";
import { SurveySummaryPage } from "../pom/SurveySummaryPage";
import { disconnect, seedUser, waitForAuthorization } from "./seed";

// The qualification drives the page objects with Playwright; the lab app publishes the same classes
// compiled by Ayme. It needs the lab app running in lab mode (pnpm lab:dev), and no other Ayme MCP
// server listening on ports 9350 to 9365: a page pairs by itself only with exactly one.

const BROWSER_TOOLS = [
  "check",
  "click",
  "fill",
  "fill_form",
  "hover",
  "press_key",
  "select_option",
  "type",
  "uncheck",
];

test.afterAll(disconnect);

async function publishedToolNames(page: Page): Promise<string[]> {
  return page.evaluate(async () => {
    const modelContext = (
      document as unknown as { modelContext?: { getTools(): Promise<{ name: string }[]> } }
    ).modelContext;
    return modelContext ? (await modelContext.getTools()).map((tool) => tool.name).sort() : [];
  });
}

async function expectExactlyOnce(locator: Locator): Promise<void> {
  await expect(locator).toHaveCount(1);
  await expect(locator).toBeVisible();
}

async function expectTools(page: Page, names: string[]): Promise<void> {
  // Polls the names still missing, so a failure names them rather than a truncated list.
  await expect
    .poll(async () => {
      const published = await publishedToolNames(page);
      return names.filter((name) => !published.includes(name));
    })
    .toEqual([]);
}

test("the page pairs with an ayme mcp server by itself, which lists its tools, and the goal tool only with the Goal Loop switch on", async ({
  browser,
  baseURL,
}) => {
  const signInTools = [...BROWSER_TOOLS, "snapshot", "SignInPage.logIn"];
  // One server at a time: the page's scan pairs only when it finds exactly one.
  for (const goalLoop of [false, true]) {
    const agent = await startAgent();
    const context = await browser.newContext();
    // The page client connects to the server on a loopback WebSocket; the content security policy
    // must allow it.
    const cspViolations: string[] = [];
    context.on("console", (message) => {
      if (message.text().includes("Content Security Policy")) cspViolations.push(message.text());
    });
    try {
      if (goalLoop) await context.addCookies([{ name: GOAL_LOOP_COOKIE, value: "on", url: baseURL! }]);
      const page = await context.newPage();
      await page.goto("/auth/login");
      await expectTools(page, signInTools);
      // Lab mode: the page looked for the server as it loaded and paired with it, with no link.
      await expect
        .poll(() => agent.pageToolNames(), { message: agent.log, timeout: 30_000 })
        .toEqual(expect.arrayContaining(signInTools));
      const listed = await agent.pageToolNames();
      // WebMCP publishes every listed tool but screenshot, whose image result it cannot carry.
      expect(listed.filter((name) => name !== "screenshot").sort()).toEqual(await publishedToolNames(page));
      expect(listed.includes("goal")).toBe(goalLoop);
      expect(cspViolations).toEqual([]);
    } finally {
      await context.close();
      await agent.close();
    }
  }
});

test("with the page objects switch off, the page publishes snapshot and the Browser Tools and no Page Object Tool", async ({
  browser,
  baseURL,
}) => {
  const context = await browser.newContext();
  try {
    await context.addCookies([
      { name: PAGE_OBJECTS_COOKIE, value: "off", url: baseURL! },
      { name: GOAL_LOOP_COOKIE, value: "on", url: baseURL! },
    ]);
    const page = await context.newPage();
    await page.goto("/auth/login");
    await expectTools(page, [...BROWSER_TOOLS, "snapshot", "goal"]);
    // Page Object Tools are named <page object>.<action>; Ayme's own tools carry no dot.
    expect((await publishedToolNames(page)).filter((name) => name.includes("."))).toEqual([]);
  } finally {
    await context.close();
  }
});

test("each page object locator resolves exactly once in its intended state, and each action called through an ayme mcp server takes effect", async ({
  page,
}) => {
  const user = await seedUser();
  // The agent calls the page objects through its server, in the page, so the actions are checked
  // the same way; the locators are checked with Playwright.
  const agent = await startAgent();
  try {
    await walkThroughScreens(page, user, agent);
  } finally {
    await agent.close();
  }
});

async function walkThroughScreens(
  page: Page,
  user: Awaited<ReturnType<typeof seedUser>>,
  agent: Awaited<ReturnType<typeof startAgent>>
): Promise<void> {
  const signInPage = new SignInPage(page);
  await page.goto("/auth/login");
  // Ayme publishes the screen's tools once React has mounted it. Typing into the server-rendered form
  // before that can land in the wrong field, as it did on a dev server's first page load.
  await expectTools(page, ["SignInPage.logIn"]);
  await expectExactlyOnce(signInPage.logInWithEmailButton);
  await expect(signInPage.emailInput).toHaveCount(0);

  // A new organization without surveys is sent to create its first survey.
  const surveyNavigationPage = await signInPage.logIn(user.email, user.password);
  assert(surveyNavigationPage instanceof SurveyNavigationPage);
  await page.waitForURL(new RegExp(`/organizations/${user.organizationId}/workspaces/new/survey`));
  await expectExactlyOnce(surveyNavigationPage.startFromScratchButton);
  await expectTools(page, ["SurveyNavigationPage.startFromScratch"]);

  const created = page.waitForResponse((response) => {
    const { pathname } = new URL(response.url());
    return (
      (pathname === "/api/v3/surveys" || pathname === "/api/v3/surveys/templates") &&
      response.request().method() === "POST"
    );
  });
  const surveyEditorPage = await surveyNavigationPage.startFromScratch();
  const response = await created;
  expect(response.status()).toBe(201);
  const surveyId = String(((await response.json()) as { data?: { id?: unknown } }).data?.id);
  await waitForAuthorization([surveyId]);
  await page.waitForURL(new RegExp(`/workspaces/${user.workspaceId}/surveys/${surveyId}/edit`));

  await expectExactlyOnce(surveyEditorPage.surveyNameInput);
  await expectExactlyOnce(surveyEditorPage.questionTextEditor);
  await expectExactlyOnce(surveyEditorPage.saveAndCloseButton);
  await expectTools(page, ["SurveyEditorPage.fillSurveyForm", "SurveyEditorPage.saveAndClose"]);

  await expect
    .poll(() => agent.pageToolNames(), { message: agent.log, timeout: 30_000 })
    .toEqual(expect.arrayContaining(["SurveyEditorPage.fillSurveyForm"]));
  const call = async (name: string, input: Record<string, unknown> = {}) => {
    const result = await agent.call(name, input);
    expect(result.isError, `${name}: ${result.text}`).toBe(false);
  };

  const surveyName = `Ayme lab qualification ${surveyId}`;
  const questionText = `What should the lab check next? ${surveyId}`;
  await call("SurveyEditorPage.fillSurveyForm", { name: surveyName, questionText });
  await expect(surveyEditorPage.surveyNameInput).toHaveValue(surveyName);
  await expect(surveyEditorPage.questionTextEditor).toHaveText(questionText);
  await call("SurveyEditorPage.saveAndClose");

  await page.waitForURL(new RegExp(`/workspaces/${user.workspaceId}/surveys/${surveyId}/summary`));
  const surveySummaryPage = new SurveySummaryPage(page);
  // Saving a new survey opens its sharing dialog over the summary.
  await expectExactlyOnce(surveySummaryPage.shareSurveyDialog.root);
  await expectExactlyOnce(surveySummaryPage.shareSurveyDialog.closeButton);
  await expectTools(page, ["ShareSurveyDialog.close", "SurveySummaryPage.edit"]);
  const summaryAfterShare = await surveySummaryPage.shareSurveyDialog.close();
  await expect(summaryAfterShare.shareSurveyDialog.root).toHaveCount(0);
  await expectExactlyOnce(surveySummaryPage.surveyTitleHeading);
  await expect(surveySummaryPage.surveyTitleHeading).toHaveText(surveyName);
  await expectExactlyOnce(surveySummaryPage.editButton);

  const reopened = await surveySummaryPage.edit();
  assert(reopened instanceof SurveyEditorPage);
  await page.waitForURL(new RegExp(`/workspaces/${user.workspaceId}/surveys/${surveyId}/edit`));
  await expect(reopened.surveyNameInput).toHaveValue(surveyName);
}
