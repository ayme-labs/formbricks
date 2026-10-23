import { ayme } from "@ayme-dev/ayme";
import type { Locator, Page } from "@playwright/test";
import { AppComponent } from "./AppComponent";
import { AppPage } from "./AppPage";
import { SurveyListPage } from "./SurveyListPage";
import { ROUTE_TIMEOUT, SERVER_TIMEOUT } from "./Timing";
import { markToasts, waitForAnyNewToast } from "./Toast";

// #957: the 1 s default action timeout is too short for a settings route's first compile in dev.
const T = { timeout: ROUTE_TIMEOUT };

/**
 * Workspace settings › General: the workspace's name and its cooldown between surveys. Changes need the
 * owner, a manager or a member with manage access; for others the fields are read-only.
 */
export class WorkspaceGeneralPage extends AppPage {
  readonly path = "/workspaces/:workspaceId/settings/workspace/general";

  readonly heading = this.page.getByRole("heading", { name: "Workspace Settings", level: 1 });
  readonly nameInput = this.page.getByRole("textbox", { name: "What is your workspace called?" });
  readonly cooldownInput = this.page.getByRole("spinbutton", { name: "Wait X days before showing next survey:" });
  // Each card has its own "Update" button; the card is the form around its field.
  private formOf(field: Locator) {
    return this.page.locator("form").filter({ has: field });
  }

  // Ends on the app's answer: a toast (saved, or refused by the server), or the field's own validation
  // message, which is no toast (an empty name shows "Workspace name cannot be empty" under the field).
  private async update(field: Locator, value: string) {
    await field.fill(value, T);
    await markToasts(this.page);
    await this.formOf(field).getByRole("button", { name: "Update" }).click(T);
    const message = this.formOf(field).locator("[id$='-form-item-message']").filter({ hasText: /\S/ });
    const toast = waitForAnyNewToast(this.page, SERVER_TIMEOUT);
    const invalid = message.first().waitFor({ timeout: SERVER_TIMEOUT });
    // The losing wait times out later; only the race's outcome counts.
    toast.catch(() => undefined);
    invalid.catch(() => undefined);
    await Promise.race([toast, invalid]);
  }

  @ayme.action({
    description:
      "Renames the workspace for everyone in it; the new name shows in the sidebar and breadcrumbs. Ends on the app's answer: a toast, or the field's validation message such as an empty name.",
  })
  async renameWorkspace(name: string) {
    await this.update(this.nameInput, name);
    return this;
  }

  @ayme.action({
    description:
      "Sets how many days a person waits before this workspace's website and app surveys show them another survey (link surveys ignore it). Ends on the app's toast or the field's validation message.",
  })
  async setCooldownDays(days: number) {
    await this.update(this.cooldownInput, String(days));
    return this;
  }
}

/** Workspace settings › Appearance: the survey theme, logo, placement and branding. */
export class WorkspaceAppearancePage extends AppPage {
  readonly path = "/workspaces/:workspaceId/settings/workspace/look";

  readonly heading = this.page.getByRole("heading", { name: "Appearance", level: 1 });
  readonly customStylingSwitch = this.page.getByRole("switch", { name: "Enable custom styling" });
  readonly themeSaveButton = this.page.locator("form").filter({ has: this.customStylingSwitch }).getByRole("button", { name: "Save" });

  @ayme.action({
    description:
      "Turns on or off whether each survey may override the workspace theme with its own styling, and saves the theme. Ends on the app's toast.",
  })
  async setCustomStyling(on: boolean) {
    if ((await this.customStylingSwitch.getAttribute("aria-checked", T)) !== String(on)) await this.customStylingSwitch.click(T);
    await markToasts(this.page);
    await this.themeSaveButton.click(T);
    await waitForAnyNewToast(this.page, SERVER_TIMEOUT);
    return this;
  }
}

/** The settings sidebar, which replaces the workspace sidebar on every settings page. */
export class SettingsNavigation extends AppComponent {
  readonly backButton: Locator;

  constructor(readonly page: Page) {
    // Only this sidebar links to the Tags settings; the workspace sidebar links to settings' General only.
    // CSS rather than a role, as for MainNavigation (#729: a modal's aria-hidden would hide a role root).
    super(page.locator("aside:has(a[href$='/settings/workspace/tags'])"));
    this.backButton = this.container.getByRole("button", { name: "Back" });
  }

  private link(name: string) {
    // The workspace links come first; the organization section has a "General" of its own.
    return this.container.getByRole("link", { name, exact: true }).first();
  }

  @ayme.action({ description: "Leaves settings for the workspace's survey list." })
  async back() {
    await this.backButton.click(T);
    const list = new SurveyListPage(this.page);
    await list.heading.waitFor(T);
    return list;
  }

  @ayme.action
  async openGeneral() {
    await this.link("General").click(T);
    const general = new WorkspaceGeneralPage(this.page);
    await general.heading.waitFor(T);
    return general;
  }

  @ayme.action
  async openAppearance() {
    await this.link("Appearance").click(T);
    const appearance = new WorkspaceAppearancePage(this.page);
    await appearance.heading.waitFor(T);
    return appearance;
  }
}
