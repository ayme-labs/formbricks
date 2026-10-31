import type { Page } from "@playwright/test";

// react-hot-toast renders each toast as a role="status" element that stays ~2 s. Back-to-back actions would
// see the previous action's toast, so a toast counts only if it was not on the page before the action.
const TOASTS = "[role='status']";
const SEEN = "data-ayme-seen";

/** Marks the toasts on the page now, so `waitForNewToast` ignores them. Call before the action. */
export async function markToasts(page: Page) {
  await page.locator(TOASTS).evaluateAll((els, seen) => els.forEach((el) => el.setAttribute(seen, "")), SEEN);
}

/** Waits for a toast with this text that appeared after `markToasts`. */
export async function waitForNewToast(page: Page, text: string, timeout: number) {
  await page.locator(`${TOASTS}:not([${SEEN}])`, { hasText: text }).first().waitFor({ timeout });
}

/** Waits for any toast that appeared after `markToasts`: a success or the app's refusal, whose text the result shows. */
export async function waitForAnyNewToast(page: Page, timeout: number) {
  await page.locator(`${TOASTS}:not([${SEEN}])`).filter({ hasText: /\S/ }).first().waitFor({ timeout });
}
