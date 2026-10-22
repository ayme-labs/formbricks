import { ayme } from "@ayme-dev/ayme";
import { AppPage } from "./AppPage";

export class SignInPage extends AppPage {
  readonly path = "/auth/login";

  readonly heading = this.page.getByRole("heading", { name: "Log in to your account" });
  // The same button first reveals the email form, then submits it.
  readonly emailLoginButton = this.page.getByRole("button", { name: "Log in with Email" });
  readonly emailInput = this.page.getByRole("textbox", { name: "Email" });
  readonly passwordInput = this.page.getByRole("textbox", { name: "Password" });

  @ayme.action({
    description:
      "Signs in with email and password. On success the browser loads the user's workspace in a new document.",
  })
  async signIn(email: string, password: string) {
    if (!(await this.emailInput.isVisible())) await this.emailLoginButton.click();
    await this.emailInput.fill(email);
    await this.passwordInput.fill(password);
    await this.emailLoginButton.click();
  }
}
