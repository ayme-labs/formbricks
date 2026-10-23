import { ayme } from "@ayme-dev/ayme";
import type { Locator, Page } from "@playwright/test";
import { AppComponent } from "./AppComponent";
import { AppPage } from "./AppPage";
import { Dialog } from "./Dialog";
import { Menu } from "./Menu";
import { ROUTE_TIMEOUT, SERVER_TIMEOUT } from "./Timing";

// A 12-question survey keeps the editor's main thread busy past the 1 s default action timeout.
const T = { timeout: ROUTE_TIMEOUT };

/** The question types the add-question menu offers, by their menu label. */
const QUESTION_TYPES = [
  "Free text",
  "File Upload",
  "Date",
  "Single-Select",
  "Multi-Select",
  "Picture Selection",
  "Ranking",
  "Matrix",
  "Rating",
  "Net Promoter Score (NPS)",
  "Customer Satisfaction (CSAT)",
  "Customer Effort (CES)",
  "Schedule a meeting",
  "Address",
  "Contact Info",
  "Statement (Call to Action)",
  "Consent",
];

/** The question type menu of one block. */
export class AddQuestionMenu extends Menu {
  constructor(
    page: Page,
    readonly owner: SurveyEditorPage
  ) {
    super(page, "Add question to block");
  }

  @ayme.action({
    description: `Adds a question of this type at the end of the block and opens it. Types: ${QUESTION_TYPES.join(", ")}.`,
  })
  async addQuestion(type: string) {
    const before = await this.owner.questionCards.count();
    await this.choose(type);
    await this.owner.questionCards.nth(before).waitFor(T);
    return this.owner;
  }
}

const canDelete = async (self: QuestionCard) =>
  (await self.deleteButton.isEnabled()) || "This question cannot be deleted";

/** One question in the editor; a closed card shows only its headline. */
export class QuestionCard extends AppComponent {
  readonly toggle = this.container.locator(":scope > div > [aria-label='Toggle question details']");
  readonly headline = this.toggle.locator("h3");
  // The header's icon buttons have no accessible name; the trash icon tells delete apart.
  readonly deleteButton = this.toggle.getByRole("button").filter({ has: this.container.page().locator("svg.lucide-trash") });
  // Choices of a single-, multi-select or ranking question, while the card is open.
  readonly choiceInputs = this.container.getByRole("textbox", { name: /^Option \d+$/ });
  readonly addChoiceBelowButtons = this.container.getByRole("button", { name: "Add choice below" });

  constructor(
    container: Locator,
    readonly owner: SurveyEditorPage
  ) {
    super(container);
  }
  // The first rich-text field of an open card is the question's headline.
  readonly headlineEditor = this.container.locator("[contenteditable='true']").first();

  private async isOpen() {
    return (await this.container.locator(":scope > div").first().getAttribute("data-state")) === "open";
  }

  @ayme.action
  async open() {
    if (!(await this.isOpen())) await this.toggle.click(T);
    await this.headlineEditor.waitFor(T);
    return this;
  }

  @ayme.action({ description: "Replaces the question's headline. Unsaved until the survey is saved (or auto-saved)." })
  async setHeadline(text: string) {
    await this.open();
    await this.headlineEditor.fill(text, T);
    await this.headline.filter({ hasText: text }).waitFor(T);
    return this;
  }

  @ayme.action({ description: "Adds a choice with this label after the last one. Unsaved until the survey is saved." })
  async addChoice(label: string) {
    await this.open();
    const before = await this.choiceInputs.count();
    if (before === 0) throw new Error("This question has no choices.");
    await this.addChoiceBelowButtons.nth(before - 1).click(T);
    const added = this.choiceInputs.nth(before);
    await added.waitFor(T);
    await added.fill(label, T);
    return this;
  }

  @ayme.action({
    available: canDelete,
    description: "Removes the question and its logic from the survey. Unsaved until the survey is saved.",
  })
  async delete() {
    const before = await this.owner.questionCards.count();
    await this.deleteButton.click(T);
    await this.owner.questionCards.nth(before - 1).waitFor({ state: "detached", timeout: ROUTE_TIMEOUT });
    return this.owner;
  }
}

/** One block: a page of the survey holding one or more questions. */
export class BlockCard extends AppComponent {
  readonly nameInput = this.container.getByRole("textbox", { name: "Block name" });
  readonly addQuestionButton = this.container.getByRole("button", { name: "Add question to block" });

  constructor(
    container: Locator,
    readonly owner: SurveyEditorPage
  ) {
    super(container);
  }

  @ayme.action
  async openAddQuestionMenu() {
    await this.addQuestionButton.click(T);
    await this.owner.addQuestionMenu.root.waitFor(T);
    return this.owner.addQuestionMenu;
  }
}

/** Asked before editing a survey that already has responses. */
export class EditActiveSurveyDialog extends Dialog {
  readonly editButton = this.root.getByRole("button", { name: "Edit", exact: true });
  readonly duplicateAndEditButton = this.root.getByRole("button", { name: "Duplicate & edit" });

  constructor(page: Page) {
    super(page, "Edit an active survey?");
  }

  @ayme.action({ description: "Edits this survey; its existing responses stay, and may no longer match the questions." })
  async edit() {
    await this.editButton.click();
    return waitForEditor(this.page);
  }

  @ayme.action({ description: "Creates a copy of the survey, without responses, and opens the copy in the editor." })
  async duplicateAndEdit() {
    const url = this.page.url();
    await this.duplicateAndEditButton.click();
    await this.page.waitForURL((u) => u.href !== url && u.pathname.endsWith("/edit"), { timeout: ROUTE_TIMEOUT });
    return waitForEditor(this.page);
  }

  @ayme.action
  async close() {
    await this.dismiss();
  }
}

async function waitForEditor(page: Page) {
  const editor = new SurveyEditorPage(page);
  await editor.surveyNameInput.waitFor({ timeout: ROUTE_TIMEOUT });
  return editor;
}

/** Clicks an Edit control; a survey with responses asks first, otherwise the editor opens. */
export async function openEditorWith(editButton: Locator, dialog: EditActiveSurveyDialog) {
  const editor = new SurveyEditorPage(dialog.page);
  // A page holding the response table can keep the main thread busy past the 1 s default.
  await editButton.click({ timeout: ROUTE_TIMEOUT });
  await dialog.root.or(editor.surveyNameInput).waitFor({ timeout: ROUTE_TIMEOUT });
  if (await dialog.root.isVisible()) return dialog;
  return editor;
}

/** The survey editor: questions, blocks and endings of one survey. */
export class SurveyEditorPage extends AppPage {
  readonly path = "/workspaces/:workspaceId/surveys/:surveyId/edit";

  readonly backButton = this.page.getByRole("button", { name: "Back", exact: true });
  readonly surveyNameInput = this.page.getByRole("textbox", { name: "Survey name" });
  // "Save as draft" while the survey is a draft, "Save" once it is published.
  readonly saveButton = this.page.getByRole("button", { name: /^Save( as draft)?$/ });
  readonly savedToast = this.page.getByText("Changes saved.");
  // Blocks and their questions both carry the item id and scroll-mt-16; only a block has a header.
  readonly blockCards = this.page.locator("div[id].scroll-mt-16").filter({ has: this.page.getByTestId("block-card-header") });
  readonly questionCards = this.page.locator("div[id]:has(> div > [aria-label='Toggle question details'])");

  readonly addQuestionMenu = new AddQuestionMenu(this.page, this);

  async questions(): Promise<QuestionCard[]> {
    const cards = await this.questionCards.all();
    return cards.map((card) => new QuestionCard(card, this));
  }

  async blocks(): Promise<BlockCard[]> {
    const blocks = await this.blockCards.all();
    return blocks.map((block) => new BlockCard(block, this));
  }

  @ayme.action
  async renameSurvey(name: string) {
    await this.surveyNameInput.fill(name, T);
    return this;
  }

  @ayme.action({ description: "Saves the survey; a published survey's respondents see the changes at once." })
  async save() {
    await this.saveButton.click(T);
    await this.savedToast.first().waitFor({ timeout: SERVER_TIMEOUT });
    return this;
  }
}
