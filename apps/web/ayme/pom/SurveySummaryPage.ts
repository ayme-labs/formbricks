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
  // One card per question; the card markup differs by question type, so match the list's children.
  readonly cards = this.page.locator("div.mt-10.space-y-8 > div:has(h3)");

  readonly editActiveSurvey = new EditActiveSurveyDialog(this.page);

  async elementSummaries(): Promise<ElementSummary[]> {
    const cards = await this.cards.all();
    return cards.map((card) => new ElementSummary(card));
  }

  @ayme.action
  async openResponses() {
    await this.responsesTab.click();
    const responses = new SurveyResponsesPage(this.page);
    return responses.loaded();
  }

  @ayme.action({ description: "Opens the editor; a survey with responses asks first whether to edit it or a copy." })
  async openEditor() {
    return openEditorWith(this.editButton, this.editActiveSurvey);
  }

  private async setStatus(status: Status) {
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

  @ayme.action
  async toggleImpressions() {
    await this.impressionsToggle.click();
    return this;
  }

  @ayme.action
  async toggleDropOffs() {
    await this.dropOffsToggle.click();
    return this;
  }
}
