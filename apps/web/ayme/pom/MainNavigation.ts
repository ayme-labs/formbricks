import { ayme } from "@ayme-dev/ayme";
import type { Page } from "@playwright/test";
import { AppComponent } from "./AppComponent";
import { ROUTE_TIMEOUT, SurveyListPage } from "./SurveyListPage";

/** The workspace sidebar, on every page inside a workspace. */
export class MainNavigation extends AppComponent {
  readonly surveysLink = this.container.getByRole("link", { name: "Surveys" });
  readonly contactsLink = this.container.getByRole("link", { name: "Contacts" });

  constructor(readonly page: Page) {
    // The editor's preview pane is an <aside> too; only the sidebar links to the survey list.
    // CSS rather than a role: a modal's aria-hidden would make a role root vanish.
    super(page.locator("aside:has(a[href$='/surveys'])"));
  }

  @ayme.action
  async openSurveys() {
    await this.surveysLink.click();
    const list = new SurveyListPage(this.page);
    await list.heading.waitFor({ timeout: ROUTE_TIMEOUT });
    return list;
  }

  @ayme.action
  async openContacts() {
    await this.contactsLink.click();
  }
}
