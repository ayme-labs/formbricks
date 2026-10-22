import { ayme } from "@ayme-dev/ayme";
import type { Page } from "@playwright/test";

const onPage = (self: AppPage) => new URLPattern({ pathname: self.path }).test(self.page.url());

/** A Formbricks route; present while the browser's path matches `path`. */
@ayme({ present: onPage })
export abstract class AppPage {
  abstract readonly path: string;

  constructor(readonly page: Page) {}
}
