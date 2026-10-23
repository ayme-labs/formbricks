import { ayme } from "@ayme-dev/ayme";
import type { Locator, Page } from "@playwright/test";
import { AppComponent } from "./AppComponent";
import { AppPage } from "./AppPage";
import { Dialog } from "./Dialog";
import { EditActiveSurveyDialog, openEditorWith } from "./SurveyEditorPage";
import { ROUTE_TIMEOUT } from "./Timing";

// A survey with many questions renders a wide table that keeps the main thread busy past the 1 s
// default action timeout, so every wait on this page uses a longer one.
const T = { timeout: ROUTE_TIMEOUT };

const canGoBack = async (self: ResponseCardModal) =>
  (await self.previousButton.isEnabled()) || "This is the first response in the list";
const canGoForward = async (self: ResponseCardModal) =>
  (await self.nextButton.isEnabled()) || "This is the last loaded response in the list";

/** One response opened from the table, with the previous and next responses one step away. */
export class ResponseCardModal extends Dialog {
  readonly position = this.root.getByText(/^Response \d+ of \d+$/);
  readonly previousButton = this.root.getByRole("button").filter({ has: this.page.locator("svg.lucide-chevron-left") });
  readonly nextButton = this.root.getByRole("button").filter({ has: this.page.locator("svg.lucide-chevron-right") });

  constructor(
    page: Page,
    readonly owner: SurveyResponsesPage
  ) {
    super(page, "Survey Response Details");
  }

  @ayme.action({ available: canGoBack })
  async previous() {
    const before = await this.position.textContent();
    await this.previousButton.click(T);
    await this.position.filter({ hasNotText: before ?? "" }).waitFor(T);
    return this;
  }

  @ayme.action({ available: canGoForward })
  async next() {
    const before = await this.position.textContent();
    await this.nextButton.click(T);
    await this.position.filter({ hasNotText: before ?? "" }).waitFor(T);
    return this;
  }

  @ayme.action
  async close() {
    await this.dismiss();
    return this.owner;
  }
}

const COMPLETENESS = ["Complete and partial responses", "Complete responses", "Partial responses"];

/** The response filter popover: which responses the table and the summary count. */
@ayme({ root: (self: ResponseFilterPopover) => self.root })
export class ResponseFilterPopover {
  readonly root: Locator;
  readonly completenessSelect: Locator;
  readonly applyButton: Locator;
  readonly clearAllButton: Locator;

  constructor(
    readonly page: Page,
    readonly owner: SurveyResponsesPage
  ) {
    this.root = page.getByRole("dialog").filter({ hasText: "Show all responses that match" });
    this.completenessSelect = this.root.getByRole("combobox").first();
    // While a select is open, Radix hides the rest of the page from the accessibility tree.
    this.applyButton = this.root.locator("button", { hasText: "Apply filters" });
    this.clearAllButton = this.root.locator("button", { hasText: "Clear all" });
  }

  @ayme.action({
    description: `Chooses which responses match by completeness: one of ${COMPLETENESS.map((c) => `"${c}"`).join(", ")}. Takes effect on apply.`,
  })
  async showOnly(completeness: string) {
    if (!COMPLETENESS.includes(completeness)) throw new Error(`No completeness option "${completeness}".`);
    await this.completenessSelect.click(T);
    await this.page.getByRole("option", { name: completeness, exact: true }).click(T);
    await this.completenessSelect.filter({ hasText: completeness }).waitFor(T);
    return this;
  }

  @ayme.action({ description: "Applies the filter; it also applies to this survey's summary." })
  async apply() {
    await this.applyButton.click(T);
    await this.root.waitFor({ state: "hidden", timeout: ROUTE_TIMEOUT });
    return this.owner;
  }

  @ayme.action({ description: "Removes every filter and applies that at once." })
  async clearAll() {
    await this.clearAllButton.click(T);
    await this.root.waitFor({ state: "hidden", timeout: ROUTE_TIMEOUT });
    return this.owner;
  }
}

/** One response in the table. */
export class ResponseRow extends AppComponent {
  // The checkbox cell selects the row; any other cell opens the response.
  readonly dateCell = this.container.getByRole("cell").nth(1);

  constructor(
    container: Locator,
    readonly owner: SurveyResponsesPage
  ) {
    super(container);
  }

  @ayme.action
  async open() {
    await this.dateCell.click(T);
    await this.owner.responseCard.root.waitFor(T);
    return this.owner.responseCard;
  }
}

const hasMore = async (self: SurveyResponsesPage) =>
  (await self.loadMoreButton.isVisible()) || "Every response is loaded";

/** The responses of one survey, as a table; filters here also apply to the summary. */
export class SurveyResponsesPage extends AppPage {
  readonly path = "/workspaces/:workspaceId/surveys/:surveyId/responses";

  readonly heading = this.page.getByRole("heading", { level: 1 });
  readonly summaryTab = this.page.getByRole("link", { name: "Summary" });
  readonly responsesTab = this.page.getByRole("link", { name: "Responses" });
  readonly editButton = this.page.getByRole("button", { name: "Edit", exact: true });
  readonly filterButton = this.page.getByRole("button", { name: /^Filter/ });
  readonly dateRangeButton = this.page.locator("button", { hasText: /All time|Last|Custom|\d/ }).first();
  readonly loadMoreButton = this.page.locator("button", { hasText: "Load more" });
  // Body rows only; an empty table renders one row without a "Select row" checkbox.
  readonly noResults = this.page.locator("table tbody").getByText("No results");
  readonly rows = this.page.locator("table tbody tr").filter({ has: this.page.locator("button[role=checkbox], input[type=checkbox]") });

  readonly responseCard = new ResponseCardModal(this.page, this);
  readonly filter = new ResponseFilterPopover(this.page, this);
  readonly editActiveSurvey = new EditActiveSurveyDialog(this.page);

  /** Resolves once the table shows its first page of responses, or that none match. */
  async loaded() {
    await this.rows.first().or(this.noResults).waitFor({ timeout: ROUTE_TIMEOUT });
    return this;
  }

  async responses(): Promise<ResponseRow[]> {
    const rows = await this.rows.all();
    return rows.map((row) => new ResponseRow(row, this));
  }

  @ayme.action
  async openFilter() {
    if (!(await this.filter.root.isVisible())) await this.filterButton.click(T);
    await this.filter.root.waitFor(T);
    return this.filter;
  }

  @ayme.action({ available: hasMore })
  async loadMore() {
    const before = await this.rows.count();
    await this.loadMoreButton.click(T);
    await this.rows.nth(before).waitFor({ timeout: ROUTE_TIMEOUT }).catch(() => undefined);
    return this;
  }

  @ayme.action({ description: "Opens the editor; a survey with responses asks first whether to edit it or a copy." })
  async openEditor() {
    return openEditorWith(this.editButton, this.editActiveSurvey);
  }
}
