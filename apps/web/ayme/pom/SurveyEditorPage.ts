import { ayme } from "@ayme-dev/ayme";
import type { Locator, Page } from "@playwright/test";

/** The survey editor at /workspaces/<id>/surveys/<id>/edit, with its first question open. */
@ayme
export class SurveyEditorPage {
  readonly surveyNameInput: Locator;
  readonly questionTextEditor: Locator;
  readonly saveAndCloseButton: Locator;

  constructor(page: Page) {
    this.surveyNameInput = page.getByRole("textbox", { name: "Survey name", exact: true });
    // The question text is a rich-text editor without an accessible name. Formbricks's own
    // Playwright helper finds it the same way: from the "Question*" label to its form group.
    this.questionTextEditor = page
      .locator('label:text-is("Question*")')
      .locator("..")
      .locator("..")
      .locator(".editor-input");
    this.saveAndCloseButton = page.getByRole("button", { name: "Save & Close", exact: true });
  }

  @ayme.action({ description: "Replace the survey's name." })
  async setSurveyName(name: string) {
    await this.surveyNameInput.fill(name);
  }

  @ayme.action({ description: "Replace the text of the open question." })
  async setQuestionText(text: string) {
    // The rich-text editor takes a fill only once it is focused with its text selected, and loads
    // the question's stored text after it mounts, which can overwrite an early fill. So focus,
    // select, fill, and check that the text stayed, as Formbricks's own Playwright helper checks.
    for (let attempt = 1; attempt <= 3; attempt++) {
      await this.questionTextEditor.click();
      await this.questionTextEditor.press("ControlOrMeta+A");
      await this.questionTextEditor.fill(text);
      if ((await this.questionTextEditor.textContent())?.trim() === text) return;
    }
    throw new Error("The question editor did not keep the new text.");
  }

  @ayme.action({ description: "Save the survey and leave the editor for the survey summary." })
  async saveAndClose() {
    await this.saveAndCloseButton.click();
  }
}
