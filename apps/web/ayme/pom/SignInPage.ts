import { ayme } from "@ayme-dev/ayme";
import type { Locator, Page } from "@playwright/test";
import { AppPage } from "./AppPage";
import { SurveyNavigationPage } from "./SurveyNavigationPage";

export class SignInPage extends AppPage {
  readonly path = "/auth/login";

  @ayme.child
  readonly emailInput: Locator;
  @ayme.child
  readonly passwordInput: Locator;
  /** Shows the email form, then submits it. */
  @ayme.child
  readonly logInWithEmailButton: Locator;
  /** Formbricks reports a failed sign-in in a toast. */
  @ayme.child
  readonly errorMessage: Locator;

  constructor(page: Page) {
    super(page);
    this.emailInput = page.getByLabel("Email", { exact: true });
    this.passwordInput = page.getByLabel("Password", { exact: true });
    // After a sign-in the button also shows "Last Used".
    this.logInWithEmailButton = page.getByRole("button", { name: /^Log in with Email(?: Last Used)?$/ });
    this.errorMessage = page.getByRole("status");
  }

  @ayme.action({
    description:
      "Signs in with email and password. A user whose organization has no survey yet lands where its first survey starts.",
  })
  async logIn(email: string, password: string): Promise<SurveyNavigationPage | this> {
    // The button shows the form on its first click and submits it on the next.
    if (!(await this.emailInput.isVisible())) await this.logInWithEmailButton.click();
    await this.emailInput.fill(email);
    await this.passwordInput.fill(password);
    await this.logInWithEmailButton.click();
    const navigationPage = new SurveyNavigationPage(this.page);
    await navigationPage.startFromScratchButton.or(this.errorMessage).first().waitFor();
    return (await this.errorMessage.isVisible()) ? this : navigationPage;
  }
}
