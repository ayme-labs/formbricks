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
  /** Why the sign-in failed: a toast, or a message under a field. */
  @ayme.child
  readonly errorMessage: Locator;
  private readonly errorToast: Locator;

  constructor(page: Page) {
    super(page);
    this.emailInput = page.getByLabel("Email", { exact: true });
    this.passwordInput = page.getByLabel("Password", { exact: true });
    // After a sign-in the button also shows "Last Used".
    this.logInWithEmailButton = page.getByRole("button", { name: /^Log in with Email(?: Last Used)?$/ });
    // Scoped to toasts, so a notice the page opens with, such as a verified email, is not an error.
    this.errorToast = page.locator("[data-rht-toaster]").getByRole("status");
    this.errorMessage = this.errorToast.or(page.locator("form").getByRole("alert"));
  }

  @ayme.action({
    description:
      "Lands where an organization without surveys creates its first one. It fails when sign-in leads anywhere else, which no page object covers yet.",
  })
  async logIn(email: string, password: string): Promise<SurveyNavigationPage | this> {
    // The button shows the form on its first click and submits it on the next.
    if (!(await this.emailInput.isVisible())) await this.logInWithEmailButton.click();
    await this.emailInput.fill(email);
    await this.passwordInput.fill(password);
    // An error left from an earlier attempt would read as this attempt's outcome.
    await this.errorToast.first().waitFor({ state: "hidden" });
    await this.logInWithEmailButton.click();
    // Sign-in goes to "/", which redirects to where the user starts.
    const signedIn = this.page.waitForURL((url) => url.pathname !== this.path && url.pathname !== "/");
    const failed = this.errorMessage.first().waitFor();
    await Promise.race([signedIn, failed]);
    void signedIn.catch(() => undefined);
    void failed.catch(() => undefined);
    if (await this.errorMessage.first().isVisible()) return this;
    const navigationPage = new SurveyNavigationPage(this.page);
    // URLPattern is not in every Node.js that runs these page objects, so the path is matched by hand.
    const { pathname } = new URL(this.page.url());
    if (!new RegExp(`^${navigationPage.path.replaceAll(/:\w+/g, "[^/]+")}$`).test(pathname)) {
      throw new Error(`Signed in, and the page went to ${pathname}, which no page object covers.`);
    }
    await navigationPage.startFromScratchButton.waitFor();
    return navigationPage;
  }
}
