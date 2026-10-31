import { ayme } from "@ayme-dev/ayme";
import type { Locator, Page } from "@playwright/test";
import { ROUTE_TIMEOUT } from "./Timing";

const rootOf = (self: Menu) => self.root;

/** An open dropdown menu, portaled to the end of the document. */
@ayme({ root: rootOf })
export abstract class Menu {
  readonly root: Locator;

  constructor(
    readonly page: Page,
    name?: string,
    root?: Locator
  ) {
    this.root = root ?? (name ? page.getByRole("menu", { name }) : page.getByRole("menu"));
  }

  item(name: string) {
    return this.root.getByRole("menuitem", { name, exact: true });
  }

  protected async choose(name: string) {
    await this.item(name).click({ timeout: ROUTE_TIMEOUT });
    await this.root.waitFor({ state: "hidden", timeout: ROUTE_TIMEOUT });
  }
}
