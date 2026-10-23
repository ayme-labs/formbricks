import { ayme } from "@ayme-dev/ayme";
import type { Page } from "@playwright/test";

// Formbricks renders its error card at the requested route when the user may not see the resource (no team
// access) or it does not exist; the URL alone would keep every tool of the page listed there (run 7).
const ERROR_CARD = "Error loading resources";

const onPage = async (self: AppPage) =>
  new URLPattern({ pathname: self.path }).test(self.page.url()) &&
  (await self.page.getByText(ERROR_CARD, { exact: true }).count()) === 0;

/** A Formbricks route; present while the browser's path matches `path` and the route shows no error card. */
@ayme({ present: onPage })
export abstract class AppPage {
  abstract readonly path: string;

  constructor(readonly page: Page) {}
}
