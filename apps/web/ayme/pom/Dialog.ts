import { ayme } from "@ayme-dev/ayme";
import type { Locator, Page } from "@playwright/test";
import { ROUTE_TIMEOUT } from "./Timing";

const rootOf = (self: Dialog) => self.root;

/** An open dialog, portaled to the end of the document, found by its title. */
@ayme({ root: rootOf })
export abstract class Dialog {
  readonly root: Locator;
  readonly closeButton: Locator;

  constructor(
    readonly page: Page,
    name: string
  ) {
    this.root = page.getByRole("dialog", { name });
    this.closeButton = this.root.getByRole("button", { name: "Close", exact: true });
  }

  protected async dismiss() {
    await this.closeButton.click({ timeout: ROUTE_TIMEOUT });
    await this.root.waitFor({ state: "hidden", timeout: ROUTE_TIMEOUT });
  }
}
