import { ayme } from "@ayme-dev/ayme";
import type { Locator, Page } from "@playwright/test";
import { AppPage } from "./AppPage";
import { ShareSurveyDialog } from "./ShareSurveyDialog";
import { SurveyEditorPage } from "./SurveyEditorPage";

export class SurveySummaryPage extends AppPage {
  readonly path = "/workspaces/:workspaceId/surveys/:surveyId/summary";

  @ayme.child
  readonly surveyTitleHeading: Locator;
  @ayme.child
  readonly editButton: Locator;
  @ayme.child
  readonly shareDialog: ShareSurveyDialog;

  constructor(page: Page) {
    super(page);
    this.surveyTitleHeading = page.getByRole("heading", { level: 1 });
    this.editButton = page.getByRole("button", { name: "Edit", exact: true });
    this.shareDialog = new ShareSurveyDialog(page.getByRole("dialog"));
  }

  @ayme.action
  async edit(): Promise<SurveyEditorPage> {
    await this.editButton.click();
    const editor = new SurveyEditorPage(this.page);
    await editor.surveyNameInput.waitFor();
    return editor;
  }
}
