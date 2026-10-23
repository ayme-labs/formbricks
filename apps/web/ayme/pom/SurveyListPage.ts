import { ayme } from "@ayme-dev/ayme";
import type { Locator, Page } from "@playwright/test";
import { AppComponent } from "./AppComponent";
import { AppPage } from "./AppPage";
import { Dialog } from "./Dialog";
import { Menu } from "./Menu";
import { SurveyEditorPage } from "./SurveyEditorPage";
import { SurveySummaryPage } from "./SurveySummaryPage";
import { ROUTE_TIMEOUT, SERVER_TIMEOUT } from "./Timing";

export { ROUTE_TIMEOUT };

const isDraft = async (row: SurveyRow) => (await row.link.getAttribute("href"))?.endsWith("/edit") ?? false;
const notDraft = async (self: SurveyRow) =>
  !(await isDraft(self)) || "A draft survey has no summary; it opens in the editor";
const draft = async (self: SurveyRow) =>
  (await isDraft(self)) || "Only a draft opens in the editor from the list";

/** The options menu of one survey row. */
export class SurveyOptionsMenu extends Menu {
  constructor(
    page: Page,
    readonly owner: SurveyListPage
  ) {
    // Named after its trigger; the New Survey menu is a menu too.
    super(page, "Open options");
  }

  @ayme.action({ description: "Creates a copy of the survey in this workspace, named \"<name> (copy)\", without responses." })
  async duplicate() {
    const before = await this.owner.rows.count();
    await this.choose("Duplicate");
    await this.owner.rows.nth(before).waitFor({ timeout: SERVER_TIMEOUT });
    return this.owner;
  }

  @ayme.action
  async openCopyDialog() {
    await this.choose("Copy to…");
    await this.owner.copyDialog.root.waitFor();
    return this.owner.copyDialog;
  }

  @ayme.action
  async openDeleteDialog() {
    await this.choose("Delete");
    await this.owner.deleteDialog.root.waitFor();
    return this.owner.deleteDialog;
  }
}

/** Copies a survey into other workspaces of the organization. */
export class CopySurveyDialog extends Dialog {
  readonly workspaceCheckboxes = this.root.getByRole("checkbox");
  readonly copyButton = this.root.getByRole("button", { name: "Copy", exact: true });

  constructor(
    page: Page,
    readonly owner: SurveyListPage
  ) {
    super(page, "Copy survey");
  }

  @ayme.action
  async close() {
    await this.dismiss();
    return this.owner;
  }
}

/** Confirms deleting a survey. */
export class DeleteSurveyDialog extends Dialog {
  readonly deleteButton = this.root.getByRole("button", { name: "Delete", exact: true });
  readonly cancelButton = this.root.getByRole("button", { name: "Cancel", exact: true });

  constructor(
    page: Page,
    readonly owner: SurveyListPage
  ) {
    super(page, "Delete survey");
  }

  @ayme.action({ description: "Deletes the survey and all its responses for everyone; it cannot be undone." })
  async confirm() {
    const before = await this.owner.rows.count();
    await this.deleteButton.click();
    await this.root.waitFor({ state: "hidden", timeout: SERVER_TIMEOUT });
    await this.owner.rows.nth(before - 1).waitFor({ state: "detached", timeout: SERVER_TIMEOUT });
    return this.owner;
  }

  @ayme.action
  async cancel() {
    await this.cancelButton.click();
    await this.root.waitFor({ state: "hidden" });
    return this.owner;
  }
}

/** The New Survey menu. */
export class NewSurveyMenu extends Menu {
  constructor(page: Page) {
    super(page, "New Survey");
  }

  @ayme.action({ description: "Creates an empty draft survey in this workspace and opens it in the editor." })
  async startFromScratch() {
    await this.item("Start from scratch").click();
    const editor = new SurveyEditorPage(this.page);
    await editor.surveyNameInput.waitFor({ timeout: ROUTE_TIMEOUT });
    return editor;
  }
}

/** One survey in the list. */
export class SurveyRow extends AppComponent {
  readonly link = this.container.getByRole("link");
  readonly optionsButton = this.container.getByTestId("survey-dropdown-trigger");

  constructor(
    container: Locator,
    readonly page: Page,
    readonly owner: SurveyListPage
  ) {
    super(container);
  }

  @ayme.action
  async openOptions() {
    await this.optionsButton.click();
    await this.owner.optionsMenu.root.waitFor();
    return this.owner.optionsMenu;
  }

  @ayme.action({ available: draft })
  async openEditor() {
    await this.link.click();
    const editor = new SurveyEditorPage(this.page);
    await editor.surveyNameInput.waitFor({ timeout: ROUTE_TIMEOUT });
    return editor;
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

  readonly optionsMenu = new SurveyOptionsMenu(this.page, this);
  readonly copyDialog = new CopySurveyDialog(this.page, this);
  readonly deleteDialog = new DeleteSurveyDialog(this.page, this);
  readonly newSurveyMenu = new NewSurveyMenu(this.page);

  async surveys(): Promise<SurveyRow[]> {
    const rows = await this.rows.all();
    return rows.map((row) => new SurveyRow(row, this.page, this));
  }

  @ayme.action
  async openNewSurveyMenu() {
    await this.newSurveyButton.click();
    await this.newSurveyMenu.root.waitFor();
    return this.newSurveyMenu;
  }

  @ayme.action
  async search(name: string) {
    await this.searchInput.fill(name);
    return this;
  }

  @ayme.action({ description: "Opens the summary of the survey whose name is exactly `name`." })
  async openSurveySummary(name: string) {
    const row = new SurveyRow(this.rows.filter({ has: this.page.getByText(name, { exact: true }) }), this.page, this);
    if (await isDraft(row)) throw new Error(`${name} is a draft survey; a draft has no summary.`);
    return row.openSummary();
  }
}
