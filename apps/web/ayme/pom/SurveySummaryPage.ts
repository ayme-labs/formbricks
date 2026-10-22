import { ayme } from "@ayme-dev/ayme";
import { AppComponent } from "./AppComponent";
import { AppPage } from "./AppPage";

/** One question's results card on the summary. */
export class ElementSummary extends AppComponent {
  readonly heading = this.container.getByRole("heading", { level: 3 });
}

/** Aggregated results of one survey. */
export class SurveySummaryPage extends AppPage {
  readonly path = "/workspaces/:workspaceId/surveys/:surveyId/summary";

  readonly summaryTab = this.page.getByRole("link", { name: "Summary" });
  readonly responsesTab = this.page.getByRole("link", { name: "Responses" });
  readonly editButton = this.page.getByRole("button", { name: "Edit" });
  readonly statusSelect = this.page.getByRole("combobox");
  readonly impressionsToggle = this.page.getByTestId("impressions-toggle");
  readonly dropOffsToggle = this.page.getByTestId("dropOffs-toggle");
  // One card per question; the card markup differs by question type, so match the list's children.
  readonly cards = this.page.locator("div.mt-10.space-y-8 > div:has(h3)");

  async elementSummaries(): Promise<ElementSummary[]> {
    const cards = await this.cards.all();
    return cards.map((card) => new ElementSummary(card));
  }

  @ayme.action
  async openResponses() {
    await this.responsesTab.click();
  }

  @ayme.action
  async openEditor() {
    await this.editButton.click();
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
