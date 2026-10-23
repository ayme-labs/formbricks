import { ayme } from "@ayme-dev/ayme";
import type { Locator, Page } from "@playwright/test";
import { AppComponent } from "./AppComponent";
import { Menu } from "./Menu";
import { SignInPage } from "./SignInPage";
import { ROUTE_TIMEOUT, SurveyListPage } from "./SurveyListPage";
import { WorkspaceGeneralPage } from "./WorkspaceSettingsPage";

/** The signed-in user's menu at the bottom of the sidebar: account, organization and sign-out. */
export class AccountMenu extends Menu {
  constructor(page: Page) {
    // Named after its trigger's text (the user's name), so found by its id.
    super(page, undefined, page.locator("#userDropdownInnerContentWrapper"));
  }

  @ayme.action({ description: "Signs the user out of Formbricks in this browser and shows the sign-in page." })
  async signOut() {
    await this.item("Log out").click({ timeout: ROUTE_TIMEOUT });
    const signIn = new SignInPage(this.page);
    await signIn.heading.waitFor({ timeout: ROUTE_TIMEOUT });
    return signIn;
  }
}

/** The workspace sidebar, on every page inside a workspace. */
export class MainNavigation extends AppComponent {
  readonly surveysLink = this.container.getByRole("link", { name: "Surveys" });
  readonly settingsLink = this.container.getByRole("link", { name: "Settings" });
  // Set in the constructor: field initializers run before the `page` parameter property is assigned.
  readonly accountButton: Locator;
  readonly accountMenu: AccountMenu;

  constructor(readonly page: Page) {
    // The editor's preview pane is an <aside> too; only the sidebar links to the survey list.
    // CSS rather than a role: a modal's aria-hidden would make a role root vanish (ayme-labs/ayme#729).
    super(page.locator("aside:has(a[href$='/surveys'])"));
    this.accountButton = page.locator("#userDropdownTrigger");
    this.accountMenu = new AccountMenu(page);
  }

  @ayme.action
  async openSurveys() {
    await this.surveysLink.click();
    const list = new SurveyListPage(this.page);
    await list.heading.waitFor({ timeout: ROUTE_TIMEOUT });
    return list;
  }

  @ayme.action({ description: "Opens the workspace's settings at General; the settings sidebar replaces this one there." })
  async openSettings() {
    await this.settingsLink.click({ timeout: ROUTE_TIMEOUT });
    const general = new WorkspaceGeneralPage(this.page);
    await general.heading.waitFor({ timeout: ROUTE_TIMEOUT });
    return general;
  }

  @ayme.action
  async openAccountMenu() {
    // By keyboard: in dev, Next.js's "Issues" badge sits over this corner of the sidebar and takes the click.
    await this.accountButton.press("Enter", { timeout: ROUTE_TIMEOUT });
    await this.accountMenu.root.waitFor({ timeout: ROUTE_TIMEOUT });
    return this.accountMenu;
  }
}
