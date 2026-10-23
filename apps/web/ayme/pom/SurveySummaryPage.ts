import { ayme } from "@ayme-dev/ayme";
import { AppComponent } from "./AppComponent";
import { AppPage } from "./AppPage";
import { EditActiveSurveyDialog, openEditorWith } from "./SurveyEditorPage";
import { SurveyResponsesPage } from "./SurveyResponsesPage";
import { ROUTE_TIMEOUT, SERVER_TIMEOUT } from "./Timing";

type Status = "Active" | "Paused" | "Closed";

// The status select shows "Active", "Paused" (or "Scheduled") or "Closed"; a draft shows no select.
async function statusOf(self: SurveySummaryPage): Promise<string | undefined> {
  if (!(await self.statusSelect.isVisible())) return undefined;
  return (await self.statusSelect.textContent())?.trim();
}
const canPause = async (self: SurveySummaryPage) => {
  const status = await statusOf(self);
  return status === "Active" || (status ? `The survey is ${status.toLowerCase()}` : "A draft survey has no status");
};
const canComplete = async (self: SurveySummaryPage) => {
  const status = await statusOf(self);
  return (status !== undefined && status !== "Closed") || (status ? "The survey is closed" : "A draft survey has no status");
};
const canResume = async (self: SurveySummaryPage) => {
  const status = await statusOf(self);
  return (status !== undefined && status !== "Active") || (status ? "The survey is active" : "A draft survey has no status");
};

/** One question's results card on the summary. */
export class ElementSummary extends AppComponent {
  readonly heading = this.container.getByRole("heading", { level: 3 });
}

/** Aggregated results of one survey. */
export class SurveySummaryPage extends AppPage {
  readonly path = "/workspaces/:workspaceId/surveys/:surveyId/summary";

  readonly summaryTab = this.page.getByRole("link", { name: "Summary" });
  readonly responsesTab = this.page.getByRole("link", { name: "Responses" });
  readonly editButton = this.page.getByRole("button", { name: "Edit", exact: true });
  // CSS, not a role: behind a modal the select leaves the accessibility tree and would read as missing.
  readonly statusSelect = this.page.locator("button[role='combobox']");
  readonly impressionsToggle = this.page.getByTestId("impressions-toggle");
  readonly dropOffsToggle = this.page.getByTestId("dropOffs-toggle");
  // "Distribute" opens the share dialog on its "Anonymous links" tab, whose read-only input holds the public link.
  readonly distributeButton = this.page.getByRole("button", { name: "Distribute", exact: true });
  readonly distributeDialog = this.page.getByRole("dialog").filter({ has: this.page.getByTestId("survey-url-input") });
  readonly surveyUrlInput = this.page.getByTestId("survey-url-input");
  // One card per question; the card markup differs by question type, so match the list's children.
  readonly cards = this.page.locator("div.mt-10.space-y-8 > div:has(h3)");

  readonly editActiveSurvey = new EditActiveSurveyDialog(this.page);

  // Run 11: after publishing, the summary opens with the share dialog ("Your survey is active") over it, and the
  // controls behind it leave the accessibility tree: openEditor timed out finding "Edit".
  private async closeShareDialog() {
    if (!(await this.distributeDialog.isVisible())) return;
    await this.distributeDialog.getByRole("button", { name: "Close", exact: true }).click({ timeout: ROUTE_TIMEOUT });
    await this.distributeDialog.waitFor({ state: "hidden", timeout: ROUTE_TIMEOUT });
  }

  async elementSummaries(): Promise<ElementSummary[]> {
    const cards = await this.cards.all();
    return cards.map((card) => new ElementSummary(card));
  }

  @ayme.action
  async openResponses() {
    await this.closeShareDialog();
    await this.responsesTab.click();
    const responses = new SurveyResponsesPage(this.page);
    return responses.loaded();
  }

  @ayme.action({ description: "Opens the editor; a survey with responses asks first whether to edit it or a copy." })
  async openEditor() {
    await this.closeShareDialog();
    return openEditorWith(this.editButton, this.editActiveSurvey);
  }

  @ayme.action({
    description:
      "Answers the survey's public link (the anonymous multi-use link respondents open, as Distribute shows it), for example http://localhost:3000/s/<surveyId>. Opens the Distribute dialog to read it and closes it again.",
  })
  async publicLink(): Promise<string> {
    if (!(await this.surveyUrlInput.isVisible())) {
      await this.distributeButton.click({ timeout: ROUTE_TIMEOUT });
      await this.surveyUrlInput.waitFor({ timeout: ROUTE_TIMEOUT });
    }
    const link = await this.surveyUrlInput.inputValue();
    // Escape does not close this dialog; its Close button does.
    await this.closeShareDialog();
    return link;
  }

  private async setStatus(status: Status) {
    await this.closeShareDialog();
    await this.statusSelect.click({ timeout: ROUTE_TIMEOUT });
    await this.page.getByRole("option", { name: status, exact: true }).click({ timeout: ROUTE_TIMEOUT });
    await this.statusSelect.filter({ hasText: status }).waitFor({ timeout: SERVER_TIMEOUT });
    return this;
  }

  @ayme.action({
    available: canPause,
    description: "Stops collecting responses until resumed; respondents see that the survey is paused.",
  })
  async pause() {
    return this.setStatus("Paused");
  }

  @ayme.action({
    available: canComplete,
    description: "Closes the survey for good unless resumed; respondents can no longer answer it.",
  })
  async complete() {
    return this.setStatus("Closed");
  }

  @ayme.action({ available: canResume, description: "Makes the survey collect responses again." })
  async resume() {
    return this.setStatus("Active");
  }

  // The stat cards work like tabs: one click shows that card's details under the stats, another hides them,
  // and showing one hides the other's.
  @ayme.action({
    description:
      "Shows the Impressions card's details (the times the survey was viewed) under the stats, or hides them if they show; it hides the drop-off details.",
  })
  async toggleImpressions() {
    await this.closeShareDialog();
    await this.impressionsToggle.click({ timeout: ROUTE_TIMEOUT });
    return this;
  }

  @ayme.action({
    description:
      "Shows the Drop-Offs card's details (how many respondents left at each question) under the stats, or hides them if they show; it hides the impression details.",
  })
  async toggleDropOffs() {
    await this.closeShareDialog();
    await this.dropOffsToggle.click({ timeout: ROUTE_TIMEOUT });
    return this;
  }
}
