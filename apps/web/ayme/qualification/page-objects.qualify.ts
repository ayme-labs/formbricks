import { startAgent } from "@ayme-dev/mcp/testing";
import { type Locator, type Page, expect, test } from "@playwright/test";
import { GOAL_LOOP_COOKIE } from "../lab-switches";
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
  await expect.poll(() => publishedToolNames(page)).toEqual(expect.arrayContaining(names));
}

test("the page pairs with an ayme mcp server by itself, which lists its tools, and the goal tool only with the Goal Loop switch on", async ({
  browser,
  baseURL,
}) => {
  const signInTools = [
    ...BROWSER_TOOLS,
    "snapshot",
    "SignInPage.fillEmail",
    "SignInPage.fillPassword",
    "SignInPage.logInWithEmail",
  ];
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
      expect([...listed].sort()).toEqual(await publishedToolNames(page));
      expect(listed.includes("goal")).toBe(goalLoop);
      expect(cspViolations).toEqual([]);
    } finally {
      await context.close();
      await agent.close();
    }
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
  await expectTools(page, ["SignInPage.fillEmail", "SignInPage.fillPassword", "SignInPage.logInWithEmail"]);
  await expectExactlyOnce(signInPage.logInWithEmailButton);
  await signInPage.logInWithEmail();
  await expectExactlyOnce(signInPage.emailInput);
  await expectExactlyOnce(signInPage.passwordInput);
  await expectExactlyOnce(signInPage.logInWithEmailButton);
  await signInPage.fillEmail(user.email);
  await signInPage.fillPassword(user.password);
  await expect(signInPage.emailInput).toHaveValue(user.email);
  await expect(signInPage.passwordInput).toHaveValue(user.password);
  await signInPage.logInWithEmail();

  // A new organization without surveys is sent to create its first survey.
  await page.waitForURL(new RegExp(`/organizations/${user.organizationId}/workspaces/new/survey`));
  const surveyNavigationPage = new SurveyNavigationPage(page);
  await expectExactlyOnce(surveyNavigationPage.startFromScratchButton);
  await expectTools(page, ["SurveyNavigationPage.startFromScratch"]);

  const created = page.waitForResponse((response) => {
    const { pathname } = new URL(response.url());
    return (
      (pathname === "/api/v3/surveys" || pathname === "/api/v3/surveys/templates") &&
      response.request().method() === "POST"
    );
  });
  await surveyNavigationPage.startFromScratch();
  const response = await created;
  expect(response.status()).toBe(201);
  const surveyId = String(((await response.json()) as { data?: { id?: unknown } }).data?.id);
  await waitForAuthorization([surveyId]);
  await page.waitForURL(new RegExp(`/workspaces/${user.workspaceId}/surveys/${surveyId}/edit`));

  const surveyEditorPage = new SurveyEditorPage(page);
  await expectExactlyOnce(surveyEditorPage.surveyNameInput);
  await expectExactlyOnce(surveyEditorPage.questionTextEditor);
  await expectExactlyOnce(surveyEditorPage.saveAndCloseButton);
  await expectTools(page, [
    "SurveyEditorPage.saveAndClose",
    "SurveyEditorPage.setQuestionText",
    "SurveyEditorPage.setSurveyName",
  ]);

  await expect
    .poll(() => agent.pageToolNames(), { message: agent.log, timeout: 30_000 })
    .toEqual(expect.arrayContaining(["SurveyEditorPage.setQuestionText"]));
  const call = async (name: string, input: Record<string, unknown> = {}) => {
    const result = await agent.call(name, input);
    expect(result.isError, `${name}: ${result.text}`).toBe(false);
  };

  const surveyName = `Ayme lab qualification ${surveyId}`;
  const questionText = `What should the lab check next? ${surveyId}`;
  await call("SurveyEditorPage.setSurveyName", { name: surveyName });
  await expect(surveyEditorPage.surveyNameInput).toHaveValue(surveyName);
  await call("SurveyEditorPage.setQuestionText", { text: questionText });
  await expect(surveyEditorPage.questionTextEditor).toHaveText(questionText);
  await call("SurveyEditorPage.saveAndClose");

  await page.waitForURL(new RegExp(`/workspaces/${user.workspaceId}/surveys/${surveyId}/summary`));
  const surveySummaryPage = new SurveySummaryPage(page);
  // Saving a new survey opens its sharing dialog over the summary.
  await expectExactlyOnce(surveySummaryPage.closeDialogButton);
  await surveySummaryPage.closeDialog();
  await expect(surveySummaryPage.closeDialogButton).toHaveCount(0);
  await expectExactlyOnce(surveySummaryPage.surveyTitleHeading);
  await expect(surveySummaryPage.surveyTitleHeading).toHaveText(surveyName);
  await expectExactlyOnce(surveySummaryPage.editButton);
  await expectTools(page, ["SurveySummaryPage.closeDialog", "SurveySummaryPage.edit"]);
}
