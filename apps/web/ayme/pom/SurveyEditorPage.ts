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

const LOGIC_WARNING_TITLE = "Changing will cause logic errors";

const canMoveUp = async (self: QuestionCardMenu) =>
  (await self.item("Move up").isEnabled()) || "This is the survey's first question";
const canMoveDown = async (self: QuestionCardMenu) =>
  (await self.item("Move down").isEnabled()) || "This is the survey's last question";
// The submenu is there only when the survey has more than one block.
const hasOtherBlocks = async (self: QuestionCardMenu) =>
  (await self.item("Move question to block").isVisible()) || "The survey has only one block";

/** The "…" menu of one question card. Unnamed, so found by its first item. */
export class QuestionCardMenu extends Menu {
  // The "Change question type" submenu is a menu of its own, named after its trigger.
  readonly typeMenu = this.page.getByRole("menu", { name: "Change question type" });

  constructor(
    page: Page,
    readonly owner: SurveyEditorPage
  ) {
    super(page, undefined, page.getByRole("menu").filter({ has: page.getByRole("menuitem", { name: "Change question type" }) }));
  }

  @ayme.action({
    description: `Changes the question to another type, keeping its headline. Types: ${QUESTION_TYPES.join(", ")}. A question with logic asks first.`,
  })
  async changeType(type: string) {
    await this.item("Change question type").click(T);
    const option = this.typeMenu.getByRole("menuitem", { name: type, exact: true });
    await option.waitFor(T);
    // Moving the pointer on to the submenu's item can close the submenu before the click lands.
    await option.dispatchEvent("click", undefined, T);
    await this.owner.logicWarning.root.or(this.root).first().waitFor({ state: "attached", ...T });
    if (await this.owner.logicWarning.root.isVisible()) return this.owner.logicWarning;
    await this.root.waitFor({ state: "hidden", ...T });
    return this.owner;
  }

  @ayme.action({
    description: `Adds a question of this type right below this one, in the same block. Types: ${QUESTION_TYPES.join(", ")}.`,
  })
  async addQuestionBelow(type: string) {
    const before = await this.owner.questionCards.count();
    await this.chooseInSubmenu("Add question below", type);
    await this.owner.questionCards.nth(before).waitFor(T);
    return this.owner;
  }

  @ayme.action({
    available: hasOtherBlocks,
    description: "Moves this question to the end of another block, given by its name as the menu shows it, such as \"Block 3\".",
  })
  async moveToBlock(block: string) {
    const layout = await this.owner.layout();
    await this.chooseInSubmenu("Move question to block", block);
    await this.owner.layoutChangedFrom(layout);
    return this.owner;
  }

  @ayme.action({
    available: canMoveUp,
    description: "Moves the question up within its block; from the top of its block it moves the whole block up a page.",
  })
  async moveUp() {
    return this.move("Move up");
  }

  @ayme.action({
    available: canMoveDown,
    description: "Moves the question down within its block; from the bottom of its block it moves the whole block down a page.",
  })
  async moveDown() {
    return this.move("Move down");
  }

  private async move(item: string) {
    const layout = await this.owner.layout();
    await this.choose(item);
    await this.owner.layoutChangedFrom(layout);
    return this.owner;
  }

  private async chooseInSubmenu(trigger: string, item: string) {
    await this.item(trigger).click(T);
    const option = this.page.getByRole("menu", { name: trigger }).getByRole("menuitem", { name: item, exact: true });
    await option.waitFor(T);
    // As in changeType: the submenu can close before a pointer click lands.
    await option.dispatchEvent("click", undefined, T);
    await this.root.waitFor({ state: "hidden", ...T });
  }
}

/** Asked before changing the type of a question that logic depends on. */
export class LogicWarningDialog extends Dialog {
  readonly changeAnywayButton = this.root.getByRole("button", { name: "Change anyway" });

  constructor(
    page: Page,
    readonly owner: SurveyEditorPage
  ) {
    super(page, LOGIC_WARNING_TITLE);
  }

  @ayme.action({ description: "Changes the type anyway; logic that depends on the question's answers may break." })
  async changeAnyway() {
    await this.changeAnywayButton.click(T);
    await this.root.waitFor({ state: "hidden", ...T });
    return this.owner;
  }

  @ayme.action
  async close() {
    await this.dismiss();
    return this.owner;
  }
}

// Counted, not isEnabled(): isEnabled waits for the button, and behind a menu or dialog (aria-hidden) that wait
// costs the action timeout on every observation and shows a raw TimeoutError as the reason (ayme-labs/ayme#962).
const canDelete = async (self: QuestionCard) =>
  (await self.toggle.locator("button:not(:disabled):has(svg.lucide-trash)").count()) > 0 || "This question cannot be deleted";

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

  readonly menuButton = this.toggle.locator("button[aria-haspopup='menu']");

  @ayme.action
  async openMenu() {
    await this.menuButton.click(T);
    await this.owner.questionMenu.root.waitFor(T);
    return this.owner.questionMenu;
  }

  @ayme.action
  async open() {
    if (!(await this.isOpen())) await this.toggle.click(T);
    await this.headlineEditor.waitFor(T);
    return this;
  }

  // In the open card.
  readonly requiredSwitch = this.container.getByRole("switch", { name: "Required", exact: true });

  @ayme.action({
    description: "Sets whether respondents must answer this question before going on. Unsaved until the survey is saved.",
  })
  async setRequired(required: boolean) {
    await this.open();
    if (!(await this.requiredSwitch.isVisible())) throw new Error("This question has no Required setting.");
    // A call-to-action question shows the switch disabled: it is never required.
    if (!(await this.requiredSwitch.isEnabled())) throw new Error("This question's Required setting cannot be changed.");
    if ((await this.requiredSwitch.isChecked()) !== required) await this.requiredSwitch.click(T);
    await this.container.page().waitForTimeout(300);
    if ((await this.requiredSwitch.isChecked()) !== required) throw new Error("The Required setting did not change.");
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

  @ayme.action({ description: "Sets the choices' labels in order, adding choices as needed. Unsaved until the survey is saved." })
  async setChoices(labels: string[]) {
    await this.open();
    if ((await this.choiceInputs.count()) === 0) throw new Error("This question has no choices.");
    for (const [i, label] of labels.entries()) {
      if ((await this.choiceInputs.count()) <= i) {
        await this.addChoiceBelowButtons.nth(i - 1).click(T);
        await this.choiceInputs.nth(i).waitFor(T);
      }
      await this.choiceInputs.nth(i).fill(label, T);
      // The editor applies each edit to a survey copy it read before; a second edit right after the first
      // can overwrite it (the first choice came out empty). Let each edit land first.
      await this.container.page().waitForTimeout(300);
    }
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

// The block header's icon buttons have no accessible name (tooltips only); their icons tell them apart.
// Read without waiting: predicates run on every observation, also behind menus (ayme-labs/ayme#962).
const blockButtonEnabled = (icon: string, reason: string) => async (self: BlockCard) =>
  (await self.header.locator(`button:not(:disabled):has(> svg.lucide-${icon})`).count()) > 0 || reason;
const blockCanMoveUp = blockButtonEnabled("arrow-up", "This is the survey's first block");
const blockCanMoveDown = blockButtonEnabled("arrow-down", "This is the survey's last block");
const blockCanDelete = blockButtonEnabled("trash", "This is the survey's only block");

/** Asked before deleting a block whose questions other questions' logic refers to. */
export class LogicDeletionDialog extends Dialog {
  readonly deleteAnywayButton = this.root.getByRole("button", { name: "Delete anyways" });

  constructor(
    page: Page,
    readonly owner: SurveyEditorPage
  ) {
    super(page, "Logic Inconsistency");
  }

  @ayme.action({ description: "Deletes the block anyway; logic rules that refer to its questions break." })
  async deleteAnyway() {
    const before = await this.owner.blockCards.count();
    await this.deleteAnywayButton.click(T);
    await this.owner.blockCards.nth(before - 1).waitFor({ state: "detached", ...T });
    return this.owner;
  }

  @ayme.action
  async close() {
    await this.dismiss();
    return this.owner;
  }
}

/** One block: a page of the survey holding one or more questions. */
export class BlockCard extends AppComponent {
  readonly nameInput = this.container.getByRole("textbox", { name: "Block name" });
  readonly addQuestionButton = this.container.getByRole("button", { name: "Add question to block" });
  readonly header = this.container.getByTestId("block-card-header");
  readonly addLogicButton = this.container.getByRole("button", { name: "Add logic", exact: true });
  // Only a block with rules has the section's toggle; aria-expanded tells whether its rules are rendered.
  readonly logicToggle = this.container.locator("button[aria-label='Conditional Logic']");
  // Each logic rule is a bordered card in the block's "Conditional Logic" section.
  readonly logicRules = this.container.locator("div.rounded-lg.border.bg-slate-50.p-3:has(> div [role='combobox'])");

  constructor(
    container: Locator,
    readonly owner: SurveyEditorPage
  ) {
    super(container);
  }

  headerButton(icon: string) {
    return this.header.locator(`button:has(> svg.lucide-${icon})`);
  }

  @ayme.action
  async openAddQuestionMenu() {
    await this.addQuestionButton.click(T);
    await this.owner.addQuestionMenu.root.waitFor(T);
    return this.owner.addQuestionMenu;
  }

  @ayme.action({ available: blockCanMoveUp, description: "Moves the block, a page for respondents, one place earlier. Unsaved until the survey is saved." })
  async moveUp() {
    return this.moveBy("arrow-up");
  }

  @ayme.action({ available: blockCanMoveDown, description: "Moves the block one place later. Unsaved until the survey is saved." })
  async moveDown() {
    return this.moveBy("arrow-down");
  }

  @ayme.action({ description: "Adds a copy of the block, its questions and settings, right after it. Unsaved until the survey is saved." })
  async duplicate() {
    const before = await this.owner.blockCards.count();
    await this.headerButton("copy").click(T);
    await this.owner.blockCards.nth(before).waitFor(T);
    return this.owner;
  }

  @ayme.action({
    available: blockCanDelete,
    description: "Removes the block and its questions. Asks first when other questions' logic refers to them. Unsaved until the survey is saved.",
  })
  async delete() {
    const before = await this.owner.blockCards.count();
    await this.headerButton("trash").click(T);
    const gone = this.owner.blockCards.nth(before - 1).waitFor({ state: "detached", ...T }).then(() => this.owner);
    const asked = this.owner.logicDeletion.root.waitFor(T).then(() => this.owner.logicDeletion);
    gone.catch(() => undefined);
    asked.catch(() => undefined);
    return Promise.race([gone, asked]);
  }

  @ayme.action({
    // One string literal: a description built with `+` was dropped from the tool without a word (run 7).
    description:
      "Adds a logic rule to the block: when `question`'s answer equals `answer` (a choice label, or the text typed for a free-text question), respondents jump to `target` (a block name or an ending card's headline) instead of the next block. Unsaved until the survey is saved.",
  })
  async addJumpRule(question: string, answer: string, target: string) {
    // A collapsed "Conditional Logic" section renders no rules, so count them with it open (run 7: the new
    // rule's choices went into the existing first rule).
    if ((await this.logicToggle.count()) > 0 && (await this.logicToggle.getAttribute("aria-expanded")) === "false")
      await this.logicToggle.click(T);
    const before = await this.logicRules.count();
    await this.addLogicButton.click(T);
    const rule = this.logicRules.nth(before);
    await rule.waitFor(T);
    // A rule's comboboxes have no accessible names but stable id suffixes: conditionValue (question),
    // conditionOperator, conditionMatchValue (the value), action-…-objective, action-…-target. Each opens a
    // "Suggestions" listbox portaled to the document. For a free-text question the value is a textbox
    // "Select or type value" and its combobox is hidden (run 8: picking by position clicked the hidden one).
    const combo = (suffix: string) => rule.locator(`[role='combobox'][id$='${suffix}']`).first();
    const pick = async (c: Locator, option: string) => {
      if ((await c.textContent())?.trim() === option) return;
      await c.click(T);
      await this.owner.page.getByRole("listbox", { name: "Suggestions" }).getByRole("option", { name: option, exact: true }).click(T);
      await c.filter({ hasText: option }).waitFor(T);
    };
    await pick(combo("-conditionValue"), question);
    await pick(combo("-conditionOperator"), "Equals");
    const typed = rule.getByRole("textbox", { name: "Select or type value" });
    if (await typed.isVisible()) await typed.fill(answer, T);
    else await pick(combo("-conditionMatchValue"), answer);
    await pick(combo("-objective"), "Jump to block");
    await pick(combo("-target"), target);
    return this;
  }

  private async moveBy(icon: string) {
    const layout = await this.owner.layout();
    await this.headerButton(icon).click(T);
    await this.owner.layoutChangedFrom(layout);
    return this.owner;
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

// While the editor loads neither button shows; a published survey shows "Save" and no Activate.
const canActivate = async (self: SurveyEditorPage) => {
  if (await self.activateButton.isVisible()) return true;
  if (await self.page.getByRole("button", { name: "Save", exact: true }).isVisible()) return "The survey is already published";
  return "The editor shows no Activate button";
};

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

  // "Add Block" below the last block; it unfolds a picker of question types. The test ids keep these
  // off the copy in the live preview.
  readonly addBlockTrigger = this.page.getByTestId("add-element-trigger");
  readonly addBlockPicker = this.page.getByTestId("add-element-picker");
  readonly activateButton = this.page.getByRole("button", { name: "Activate", exact: true });
  // Publishing an invalid survey shows why in a toast, such as "Choice 1 in question 1 of block 2 is missing".
  readonly validationMessage = this.page.getByRole("status").filter({ hasText: /missing|invalid|required/i });

  readonly addQuestionMenu = new AddQuestionMenu(this.page, this);
  readonly questionMenu = new QuestionCardMenu(this.page, this);
  readonly logicWarning = new LogicWarningDialog(this.page, this);
  readonly logicDeletion = new LogicDeletionDialog(this.page, this);

  async questions(): Promise<QuestionCard[]> {
    const cards = await this.questionCards.all();
    return cards.map((card) => new QuestionCard(card, this));
  }

  async blocks(): Promise<BlockCard[]> {
    const blocks = await this.blockCards.all();
    return blocks.map((block) => new BlockCard(block, this));
  }

  /** Which question ids each block holds, in order: changes when a question moves. */
  async layout() {
    const blocks = await this.blockCards.all();
    const ids = await Promise.all(
      blocks.map(async (block) => (await block.locator("div[id]:has(> div > [aria-label='Toggle question details'])").evaluateAll((els) => els.map((el) => el.id))).join(","))
    );
    return ids.join("|");
  }

  async layoutChangedFrom(before: string) {
    for (let waited = 0; waited < ROUTE_TIMEOUT; waited += 200) {
      if ((await this.layout()) !== before) return;
      await this.page.waitForTimeout(200);
    }
    throw new Error("The questions did not move.");
  }

  @ayme.action
  async renameSurvey(name: string) {
    await this.surveyNameInput.fill(name, T);
    return this;
  }

  @ayme.action({
    description: `Adds a new block, a page of its own for respondents, whose first question has this type. Types: ${QUESTION_TYPES.join(", ")}.`,
  })
  async addBlock(type: string) {
    const before = await this.blockCards.count();
    if ((await this.addBlockTrigger.getAttribute("aria-expanded")) !== "true") await this.addBlockTrigger.click(T);
    await this.addBlockPicker.getByRole("button", { name: type, exact: true }).click(T);
    await this.blockCards.nth(before).waitFor(T);
    return this;
  }

  // Returns nothing: the summary page imports this module, and modules that import each other break the build (#956).
  @ayme.action({
    available: canActivate,
    description: "Publishes the draft: respondents can answer it from its link, and the browser goes to its summary.",
  })
  async activate() {
    await this.activateButton.click(T);
    // Either the browser leaves for the summary, or a validation message (a status toast) keeps the editor.
    const left = this.page.waitForURL(/\/summary/, T).then(() => undefined);
    const refused = this.validationMessage.first().waitFor(T).then(() => this);
    left.catch(() => undefined);
    refused.catch(() => undefined);
    return Promise.race([left, refused]);
  }

  @ayme.action({ description: "Saves the survey; a published survey's respondents see the changes at once." })
  async save() {
    await this.saveButton.click(T);
    await this.savedToast.first().waitFor({ timeout: SERVER_TIMEOUT });
    return this;
  }
}
