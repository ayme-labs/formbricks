import { ayme } from "@ayme-dev/ayme";
import type { Locator, Page } from "@playwright/test";

/** The screen where a new organization creates its first survey, from a template or from scratch. */
@ayme
export class SurveyNavigationPage {
  readonly startFromScratchButton: Locator;

  constructor(page: Page) {
    this.startFromScratchButton = page.getByRole("button", {
      name: "Start from scratch Create your own survey questions",
      exact: true,
    });
  }

  @ayme.action({ description: "Create a new survey from scratch and open it in the survey editor." })
  async startFromScratch() {
    await this.startFromScratchButton.click();
  }
}
