import { ayme } from "@ayme-dev/ayme";
import type { Locator, Page } from "@playwright/test";
import { AppComponent } from "./AppComponent";
import { AppPage } from "./AppPage";
import { SurveySummaryPage } from "./SurveySummaryPage";

// A client-side route change can take a cold compile in dev; the default action timeout is 1 s.
export const ROUTE_TIMEOUT = 30_000;

const isDraft = async (row: SurveyRow) => (await row.link.getAttribute("href"))?.endsWith("/edit") ?? false;
const notDraft = async (self: SurveyRow) =>
  !(await isDraft(self)) || "A draft survey has no summary; it opens in the editor";

/** One survey in the list. */
export class SurveyRow extends AppComponent {
  readonly link = this.container.getByRole("link");
  readonly optionsButton = this.container.getByTestId("survey-dropdown-trigger");

  constructor(
    container: Locator,
    readonly page: Page
  ) {
    super(container);
  }

  @ayme.action({ available: notDraft })
  async openSummary() {
    await this.link.click();
    const summary = new SurveySummaryPage(this.page);
    await summary.summaryTab.waitFor({ timeout: ROUTE_TIMEOUT });
    return summary;
  }
}

/** The surveys of the current workspace. */
export class SurveyListPage extends AppPage {
  readonly path = "/workspaces/:workspaceId/surveys";

  readonly heading = this.page.getByRole("heading", { name: "Surveys", level: 1 });
  readonly newSurveyButton = this.page.getByRole("button", { name: "New Survey" });
  readonly searchInput = this.page.getByRole("textbox", { name: "Search by survey name" });
  // Each survey row: the block that holds the row link and its options menu trigger.
  readonly rows = this.page.locator("div.relative.block:has([data-testid='survey-dropdown-trigger'])");

  async surveys(): Promise<SurveyRow[]> {
    const rows = await this.rows.all();
    return rows.map((row) => new SurveyRow(row, this.page));
  }

  @ayme.action
  async search(name: string) {
    await this.searchInput.fill(name);
    return this;
  }

  @ayme.action({ description: "Opens the summary of the survey whose name is exactly `name`." })
  async openSurveySummary(name: string) {
    const row = new SurveyRow(this.rows.filter({ has: this.page.getByText(name, { exact: true }) }), this.page);
    if (await isDraft(row)) throw new Error(`${name} is a draft survey; a draft has no summary.`);
    return row.openSummary();
  }
}
