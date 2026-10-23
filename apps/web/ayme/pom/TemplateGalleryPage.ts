import { ayme } from "@ayme-dev/ayme";
import type { Locator, Page } from "@playwright/test";
import { AppComponent } from "./AppComponent";
import { AppPage } from "./AppPage";
import { SurveyEditorPage } from "./SurveyEditorPage";
import { ROUTE_TIMEOUT } from "./Timing";

const T = { timeout: ROUTE_TIMEOUT }; // #957: the 1 s default action timeout

/** The gallery's filter buttons, one row each for channel, industry and role. */
type TemplateFilter =
  | "All channels"
  | "Website Survey"
  | "App Survey"
  | "Link Survey"
  | "All industries"
  | "E-Commerce"
  | "SaaS"
  | "Other"
  | "All roles"
  | "Product Manager"
  | "Marketing"
  | "Customer Experience"
  | "Employee Experience"
  | "Sales";

const notSelected = async (self: TemplateCard) =>
  !(await self.useButton.isVisible()) || "The template is already selected";

async function createFrom(useButton: Locator, page: Page) {
  await useButton.click(T);
  // The new survey opens in the editor once it is created on the server. Waiting for the editor's name field,
  // not page.waitForURL: on the 52-card gallery that timed out at 30 s although the editor had opened (run 6).
  const editor = new SurveyEditorPage(page);
  await editor.surveyNameInput.waitFor({ timeout: 2 * ROUTE_TIMEOUT });
  return editor;
}

/** One template in the gallery; selecting it shows it in the preview and offers "Use this template". */
export class TemplateCard extends AppComponent {
  readonly name = this.container.getByRole("heading", { level: 3 });
  readonly useButton = this.container.getByRole("button", { name: "Use this template" });

  constructor(
    container: Locator,
    readonly page: Page
  ) {
    super(container);
  }

  @ayme.action({ available: notSelected, description: "Shows the template in the preview." })
  async select() {
    await this.container.click(T);
    await this.useButton.waitFor(T);
    return this;
  }

  @ayme.action({
    description: "Creates a new draft survey in this workspace from the template and opens it in the editor.",
  })
  async useTemplate() {
    if (!(await this.useButton.isVisible())) await this.select();
    return createFrom(this.useButton, this.page);
  }
}

/** The template gallery for a new survey in the current workspace. */
export class TemplateGalleryPage extends AppPage {
  readonly path = "/workspaces/:workspaceId/surveys/templates";

  readonly searchInput = this.page.getByRole("textbox", { name: "Search" });
  // Each card shows its name as a level-3 heading; the selected one is a div, the others buttons.
  readonly cards = this.page
    .getByRole("main")
    .locator(".group.cursor-pointer")
    .filter({ has: this.page.locator(":scope > h3") })
    .filter({ hasNot: this.page.getByRole("heading", { name: "Start from scratch", exact: true }) });

  async templates(): Promise<TemplateCard[]> {
    const cards = await this.cards.all();
    return cards.map((card) => new TemplateCard(card, this.page));
  }

  @ayme.action({ description: "Shows only the templates matching `text`; an empty text shows them all again." })
  async search(text: string) {
    await this.searchInput.fill(text, T);
    return this;
  }

  @ayme.action({ description: "Shows only the templates for this channel, industry or role; an \"All …\" button clears that row." })
  async filter(option: TemplateFilter) {
    await this.page.getByRole("main").getByRole("button", { name: option, exact: true }).click(T);
    return this;
  }

  @ayme.action({
    description:
      "Creates a new draft survey in this workspace from the template named exactly `name` and opens it in the editor.",
  })
  async useTemplate(name: string) {
    const card = this.cards.filter({ has: this.page.getByRole("heading", { name, exact: true, level: 3 }) });
    if ((await card.count()) === 0) throw new Error(`No template named ${name} is in the gallery as filtered now.`);
    return new TemplateCard(card, this.page).useTemplate();
  }
}
