import { ayme } from "@ayme-dev/ayme";
import type { Page } from "@playwright/test";
import { AppComponent } from "./AppComponent";
import { ROUTE_TIMEOUT, SurveyListPage } from "./SurveyListPage";

/** The workspace sidebar, on every page inside a workspace. */
export class MainNavigation extends AppComponent {
  readonly surveysLink = this.container.getByRole("link", { name: "Surveys" });

  constructor(readonly page: Page) {
    super(page.getByRole("complementary"));
  }

  @ayme.action
  async openSurveys() {
    await this.surveysLink.click();
    const list = new SurveyListPage(this.page);
    await list.heading.waitFor({ timeout: ROUTE_TIMEOUT });
    return list;
  }
}
