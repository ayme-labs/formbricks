import { ayme } from "@ayme-dev/ayme";
import type { Locator } from "@playwright/test";

const rootOf = (self: AppComponent) => self.container;

/** A part of a Formbricks page, anchored at the container it is constructed with. */
@ayme({ root: rootOf })
export abstract class AppComponent {
  constructor(readonly container: Locator) {}
}
