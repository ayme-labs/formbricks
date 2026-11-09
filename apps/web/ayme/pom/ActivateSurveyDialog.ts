import { ayme } from "@ayme-dev/ayme";
import type { Locator } from "@playwright/test";
import { AppComponent } from "./AppComponent";
import { SurveyEditorPage } from "./SurveyEditorPage";
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
      "Publishes the survey. restricted: only its owner and the organization's owners and managers see it, and it feeds no integrations, webhooks or workflows. workspace: everyone in the workspace sees it and its responses. When publishing fails, the error shows in the dialog, or in the editor once the dialog has closed.",
  })
  async publish(
    visibility: "restricted" | "workspace"
  ): Promise<SurveySummaryPage | SurveyEditorPage | this> {
    await (visibility === "restricted" ? this.restrictedOption : this.workspaceOption).click();
    const editor = new SurveyEditorPage(this.root.page());
    // A toast lasts a few seconds, longer than an action waits by default.
    await editor.errorMessage.first().waitFor({ state: "hidden", timeout: 10_000 });
    await this.publishButton.click();
    const summary = new SurveySummaryPage(this.root.page());
    await summary.surveyTitleHeading.or(editor.errorMessage).first().waitFor();
    if (await summary.surveyTitleHeading.isVisible()) return summary;
    return (await this.root.isVisible()) ? this : editor;
  }
}
