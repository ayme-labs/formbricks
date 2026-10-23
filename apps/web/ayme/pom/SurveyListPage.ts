import { ayme } from "@ayme-dev/ayme";
import type { Locator, Page } from "@playwright/test";
import { AppComponent } from "./AppComponent";
import { AppPage } from "./AppPage";
import { Dialog } from "./Dialog";
import { Menu } from "./Menu";
import { SurveyEditorPage } from "./SurveyEditorPage";
import { SurveySummaryPage } from "./SurveySummaryPage";
import { TemplateGalleryPage } from "./TemplateGalleryPage";
import { ROUTE_TIMEOUT, SERVER_TIMEOUT } from "./Timing";
import { markToasts, waitForNewToast } from "./Toast";

export { ROUTE_TIMEOUT };

const T = { timeout: ROUTE_TIMEOUT }; // #957: the 1 s default action timeout

// A draft's row links to its editor. Read without waiting: behind an open menu the row is aria-hidden, and a
// role locator that waits there costs the action timeout per row on every observation (ayme-labs/ayme#962).
const isDraft = async (row: SurveyRow) => (await row.container.locator("a[href$='/edit']").count()) > 0;
const notDraft = async (self: SurveyRow) =>
  !(await isDraft(self)) || "A draft survey has no summary; it opens in the editor";
const draft = async (self: SurveyRow) =>
  (await isDraft(self)) || "Only a draft opens in the editor from the list";

type SurveyStatus = "Active" | "Paused" | "Closed";
const STATUS_VALUE: Record<SurveyStatus, string> = { Active: "inProgress", Paused: "paused", Closed: "completed" };

const hasStatus = async (self: SurveyOptionsMenu) =>
  (await self.statusSubmenu.isVisible()) || "A draft or archived survey has no status to change";
const canArchive = async (self: SurveyOptionsMenu) =>
  (await self.item("Archive").isVisible()) || "The survey is archived";
// An archived survey's menu offers only Restore and Delete.
const notArchived = async (self: SurveyOptionsMenu) =>
  !(await self.item("Restore").isVisible()) || "The survey is archived";
const canRestore = async (self: SurveyOptionsMenu) =>
  (await self.item("Restore").isVisible()) || "The survey is not archived";

/** The options menu of one survey row. */
export class SurveyOptionsMenu extends Menu {
  // "Change status" opens a submenu of its own; its items carry test ids by status value.
  readonly statusSubmenu = this.root.getByTestId("survey-status-submenu");

  constructor(
    page: Page,
    readonly owner: SurveyListPage
  ) {
    // Named after its trigger; the New Survey menu is a menu too.
    super(page, "Open options");
  }

  @ayme.action({
    available: notArchived,
    description: "Creates a copy of the survey in this workspace, named \"<name> (copy)\", without responses.",
  })
  async duplicate() {
    await markToasts(this.page);
    await this.choose("Duplicate");
    // Not a row count: with 12+ surveys the list refetches back to 12 rendered rows (a 13th shows for ~0.3 s).
    // A new toast only: back to back, the previous duplicate's toast is still showing (run 7).
    await waitForNewToast(this.page, "Survey duplicated successfully", SERVER_TIMEOUT);
    return this.owner;
  }

  @ayme.action({
    available: hasStatus,
    description: "Sets whether the survey collects responses: Active collects, Paused stops until resumed, Closed ends it.",
  })
  async changeStatus(status: SurveyStatus) {
    const option = this.page.getByTestId(`survey-status-option-${STATUS_VALUE[status]}`);
    // A click opens the submenu as a hover does. Moving the pointer on to the submenu's item closes it again
    // before the click lands (Radix closes a submenu the pointer leaves), so the item gets the click event alone (#959).
    if (!(await option.isVisible())) await this.statusSubmenu.click(T);
    await markToasts(this.page);
    await option.dispatchEvent("click", undefined, T);
    await waitForNewToast(this.page, "Survey status updated successfully", SERVER_TIMEOUT);
    return this.owner;
  }

  @ayme.action({ available: canArchive })
  async openArchiveDialog() {
    await this.choose("Archive");
    await this.owner.archiveDialog.root.waitFor(T);
    return this.owner.archiveDialog;
  }

  @ayme.action({ available: canRestore, description: "Restores an archived survey to the list, as it was before." })
  async restore() {
    await markToasts(this.page);
    await this.choose("Restore");
    await waitForNewToast(this.page, "Survey restored", SERVER_TIMEOUT);
    return this.owner;
  }

  @ayme.action({ available: notArchived })
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

/** Confirms archiving a survey. */
export class ArchiveSurveyDialog extends Dialog {
  // "Stop and archive" for a survey still collecting responses, "Archive" otherwise.
  readonly confirmButton = this.root.getByRole("button", { name: /^(Archive|Stop and archive)$/ });
  readonly cancelButton = this.root.getByRole("button", { name: "Cancel", exact: true });

  constructor(
    page: Page,
    readonly owner: SurveyListPage
  ) {
    super(page, "Archive this survey?");
  }

  @ayme.action({
    description:
      "Archives the survey: it stops collecting responses and leaves the list; it and its responses are deleted for good after 30 days unless restored.",
  })
  async confirm() {
    await this.confirmButton.click(T);
    await this.root.waitFor({ state: "hidden", timeout: SERVER_TIMEOUT });
    return this.owner;
  }

  @ayme.action
  async cancel() {
    await this.cancelButton.click(T);
    await this.root.waitFor({ state: "hidden", timeout: ROUTE_TIMEOUT });
    return this.owner;
  }
}

type StatusFilter = "Draft" | "Active" | "Paused" | "Closed" | "Archived";

/** The list's Status filter: checkable statuses; the list shows surveys with any checked one. */
export class StatusFilterMenu extends Menu {
  constructor(
    page: Page,
    readonly owner: SurveyListPage
  ) {
    super(page, "Status");
  }

  @ayme.action({ description: "Checks or unchecks one status in the filter. Archived surveys show only while Archived is checked." })
  async toggle(status: StatusFilter) {
    await this.root.getByRole("menuitem").filter({ hasText: new RegExp(`^${status}$`) }).click(T);
    return this;
  }

  @ayme.action
  async close() {
    await this.page.keyboard.press("Escape");
    await this.root.waitFor({ state: "hidden", timeout: ROUTE_TIMEOUT });
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

  @ayme.action
  async openTemplates() {
    await this.item("Choose a template").click(T);
    const gallery = new TemplateGalleryPage(this.page);
    await gallery.searchInput.waitFor(T);
    return gallery;
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
  // The list shows 12 surveys at a time; the next ones come with "Load more".
  readonly loadMoreButton = this.page.getByRole("button", { name: "Load more", exact: true });

  readonly optionsMenu = new SurveyOptionsMenu(this.page, this);
  readonly copyDialog = new CopySurveyDialog(this.page, this);
  readonly deleteDialog = new DeleteSurveyDialog(this.page, this);
  readonly archiveDialog = new ArchiveSurveyDialog(this.page, this);
  readonly statusFilterButton = this.page.getByRole("button", { name: /^Status/ });
  readonly statusFilterMenu = new StatusFilterMenu(this.page, this);
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
  async openStatusFilter() {
    await this.statusFilterButton.click(T);
    await this.statusFilterMenu.root.waitFor(T);
    return this.statusFilterMenu;
  }

  @ayme.action({ description: "Shows only the surveys whose name contains `text`; an empty text shows them all again." })
  async search(text: string) {
    await this.searchInput.fill(text, T);
    return this;
  }

  @ayme.action({
    available: async (self: SurveyListPage) =>
      (await self.loadMoreButton.isVisible()) || "The list already shows every survey its search and filters match",
  })
  async loadMore() {
    const before = await this.rows.count();
    await this.loadMoreButton.click(T);
    await this.rows.nth(before).waitFor({ timeout: SERVER_TIMEOUT });
    return this;
  }

  @ayme.action({
    description: "Opens the summary of the survey whose name is exactly `name`, loading more of the list until it shows.",
  })
  async openSurveySummary(name: string) {
    const matching = this.rows.filter({ has: this.page.getByText(name, { exact: true }) });
    while ((await matching.count()) === 0 && (await this.loadMoreButton.isVisible())) await this.loadMore();
    const count = await matching.count();
    // The list leaves out archived surveys and those its search and filters hide.
    if (count === 0) throw new Error(`No survey named ${name} is in the list as filtered now.`);
    if (count > 1) throw new Error(`${count} surveys in the list are named ${name}.`);
    const row = new SurveyRow(matching, this.page, this);
    if (await isDraft(row)) throw new Error(`${name} is a draft survey; a draft has no summary.`);
    return row.openSummary();
  }
}
