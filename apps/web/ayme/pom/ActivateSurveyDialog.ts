import { ayme } from "@ayme-dev/ayme";
import type { Locator } from "@playwright/test";
import { AppComponent } from "./AppComponent";
import { SurveySummaryPage } from "./SurveySummaryPage";

/** Asks who can view a restricted survey before it is published. */
export class ActivateSurveyDialog extends AppComponent {
  @ayme.child
  readonly restrictedOption: Locator;
  @ayme.child
  readonly workspaceOption: Locator;
  @ayme.child
  readonly publishButton: Locator;

  constructor(root: Locator) {
    super(root);
    // The options' labels name the workspace and the survey's owner, so they are found by value.
    this.restrictedOption = root.locator('[role="radio"][value="restricted"]');
    this.workspaceOption = root.locator('[role="radio"][value="workspace"]');
    this.publishButton = root.getByRole("button", { name: "Publish", exact: true });
  }

  @ayme.action({
    description:
      "Publishes the survey. restricted: only its owner and the organization's owners and managers see it, and it feeds no integrations, webhooks or workflows. workspace: everyone in the workspace sees it and its responses.",
  })
  async publish(visibility: "restricted" | "workspace"): Promise<SurveySummaryPage> {
    await (visibility === "restricted" ? this.restrictedOption : this.workspaceOption).click();
    await this.publishButton.click();
    const summary = new SurveySummaryPage(this.root.page());
    await summary.surveyTitleHeading.waitFor();
    return summary;
  }
}
