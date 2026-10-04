import { ayme } from "@ayme-dev/ayme";
import type { Locator, Page } from "@playwright/test";

/** A survey's summary at /workspaces/<id>/surveys/<id>/summary. */
@ayme
export class SurveySummaryPage {
  readonly surveyTitleHeading: Locator;
  readonly editButton: Locator;
  /** Closes the sharing dialog the summary opens after a survey is saved and closed. */
  readonly closeDialogButton: Locator;

  constructor(page: Page) {
    this.surveyTitleHeading = page.getByRole("heading", { level: 1 });
    this.editButton = page.getByRole("button", { name: "Edit", exact: true });
    this.closeDialogButton = page.getByRole("dialog").getByRole("button", { name: "Close", exact: true });
  }

  @ayme.action({ description: "Close the dialog open over the summary." })
  async closeDialog() {
    await this.closeDialogButton.click();
  }

  @ayme.action({ description: "Open this survey in the survey editor." })
  async edit() {
    await this.editButton.click();
  }
}
