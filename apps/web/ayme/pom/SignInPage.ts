import { ayme } from "@ayme-dev/ayme";
import type { Locator, Page } from "@playwright/test";

/** The sign-in screen at /auth/login. */
@ayme
export class SignInPage {
  readonly emailInput: Locator;
  readonly passwordInput: Locator;
  readonly logInWithEmailButton: Locator;

  constructor(page: Page) {
    this.emailInput = page.getByPlaceholder("work@email.com", { exact: true });
    this.passwordInput = page.getByLabel("Password", { exact: true });
    // After a sign-in the button also shows "Last Used".
    this.logInWithEmailButton = page.getByRole("button", { name: /^Log in with Email(?: Last Used)?$/ });
  }

  @ayme.action({
    description: "Click 'Log in with Email': the first click shows the email form, the next one submits it.",
  })
  async logInWithEmail() {
    await this.logInWithEmailButton.click();
  }

  @ayme.action({ description: "Type the email address into the sign-in form." })
  async fillEmail(email: string) {
    await this.emailInput.fill(email);
  }

  @ayme.action({ description: "Type the password into the sign-in form." })
  async fillPassword(password: string) {
    await this.passwordInput.fill(password);
  }
}
