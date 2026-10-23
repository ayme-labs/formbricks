import { ayme } from "@ayme-dev/ayme";
import { AppComponent } from "./AppComponent";
import { AppPage } from "./AppPage";
import { ROUTE_TIMEOUT, SERVER_TIMEOUT } from "./Timing";

const T = { timeout: ROUTE_TIMEOUT }; // #957: the 1 s default action timeout

// The thank-you card's "Create your own Survey" button is styled as a submit button too.
const inProgress = async (self: LinkSurveyPage) =>
  (!(await self.thankYou.isVisible()) && (await self.submitButton.isVisible())) || "The survey shows no question";
const canGoBack = async (self: LinkSurveyPage) => {
  if (await self.backButton.isVisible()) return true;
  return (await self.questionItems.count()) > 0 ? "This is the first page of the survey" : "The survey shows no question";
};
const takesRating = async (self: RespondentQuestion) =>
  (await self.ratingOptions.first().isVisible()) || "This question is not a rating or NPS scale";
const takesText = async (self: RespondentQuestion) =>
  (await self.textAnswer.isVisible()) || "This question takes no text";
// Rating scales are radios too, but take a number (rate), not an option label.
const hasOptions = async (self: RespondentQuestion) => {
  if (await self.ratingOptions.first().isVisible()) return "This question is a rating scale";
  return (await self.options.first().isVisible()) || "This question has no answer options";
};
const hasFields = async (self: RespondentQuestion) =>
  (await self.textFields.count()) > 1 || "This question has no separate fields";
const takesDate = async (self: RespondentQuestion) =>
  (await self.monthSelect.isVisible()) || "This question takes no date";
const isMatrix = async (self: RespondentQuestion) =>
  (await self.matrix.isVisible()) || "This question is not a matrix";
const isRanking = async (self: RespondentQuestion) =>
  (await self.rankingOptions.isVisible()) || "This question is not a ranking";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const ordinal = (day: number) =>
  `${day}${day % 10 === 1 && day !== 11 ? "st" : day % 10 === 2 && day !== 12 ? "nd" : day % 10 === 3 && day !== 13 ? "rd" : "th"}`;
const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** One question on the respondent's current page of the survey; its own form, its id the question's id. */
export class RespondentQuestion extends AppComponent {
  readonly headline = this.container.getByRole("heading", { level: 2 });
  readonly textAnswer = this.container.getByRole("textbox").first();
  readonly options = this.container.locator("input[type='radio'], input[type='checkbox'], [role='radio'], [role='checkbox']");
  readonly ratingOptions = this.container.getByRole("radio", { name: /^Rate \d+ out of/ });
  // Address and contact info: one textbox per field, named by its label ("City*" when required).
  readonly textFields = this.container.getByRole("textbox");
  // The date question is an always-open calendar with month and year dropdowns.
  readonly monthSelect = this.container.getByRole("combobox", { name: "Choose the Month" });
  readonly yearSelect = this.container.getByRole("combobox", { name: "Choose the Year" });
  readonly matrix = this.container.getByRole("table");
  readonly rankingOptions = this.container.getByRole("group", { name: "Ranking options" });

  @ayme.action({ available: takesText, description: "Types the answer into a free-text question, replacing what it held." })
  async answerText(text: string) {
    await this.textAnswer.fill(text, T);
    return this;
  }

  @ayme.action({
    available: hasOptions,
    description: "Picks an answer option by its label; on a multi-select question it toggles that option.",
  })
  async choose(option: string) {
    // The inputs are sr-only and a scroll fade covers them; click the label row instead.
    await this.labelFor(option).click(T);
    return this;
  }

  @ayme.action({
    available: takesRating,
    description: "Picks a value on a rating or NPS scale, such as 4 of 5 stars or 9 of 10.",
  })
  async rate(value: number) {
    await this.container.locator("label").filter({ has: this.container.page().locator(`input[value='${value}']`) }).click(T);
    return this;
  }

  @ayme.action({
    available: hasFields,
    description: "Fills one field of an address or contact-info question, by its label without the required star, such as City or Email.",
  })
  async fillField(label: string, text: string) {
    await this.container.getByRole("textbox", { name: new RegExp(`^${escapeRegExp(label)}\\*?$`) }).fill(text, T);
    return this;
  }

  @ayme.action({ available: takesDate, description: "Picks a date on the calendar, given as YYYY-MM-DD." })
  async pickDate(date: string) {
    const [year, month, day] = date.split("-").map(Number);
    await this.yearSelect.selectOption(String(year), T);
    await this.monthSelect.selectOption({ index: month - 1 }, T);
    const name = `${MONTHS[month - 1]} ${ordinal(day)}, ${year}`;
    await this.container.getByRole("button", { name: new RegExp(`, ${name}$`) }).click(T);
    return this;
  }

  @ayme.action({ available: isMatrix, description: "Picks the column for one row of a matrix question, by their labels." })
  async chooseInRow(row: string, column: string) {
    // A `has` locator is relative to the label, so it starts from the page, not from this question.
    const radio = this.container.page().getByRole("radio", { name: `${row} ${column}`, exact: true });
    await this.container.locator("label").filter({ has: radio }).click(T);
    return this;
  }

  @ayme.action({
    available: isRanking,
    description: "Ranks the options in this order, first is best; options left out stay unranked.",
  })
  async rank(order: string[]) {
    // Unrank everything first, so the order given is the whole ranking.
    const remove = this.rankingOptions.getByRole("button", { name: /^Remove .* from ranking$/ });
    while ((await remove.count()) > 0) await remove.first().click(T);
    for (const option of order) {
      await this.rankingOptions.getByRole("button", { name: `Add ${option} to ranking`, exact: true }).click(T);
      await this.rankingOptions.getByRole("button", { name: `Remove ${option} from ranking`, exact: true }).waitFor(T);
    }
    return this;
  }

  private labelFor(option: string) {
    const labels = this.container.locator("label");
    return labels
      .filter({ has: this.container.page().getByLabel(option, { exact: true }) })
      .or(labels.filter({ hasText: new RegExp(`^\\s*${escapeRegExp(option)}\\s*$`) }))
      .first();
  }
}

/**
 * A survey's public link, as a respondent sees it: one block of questions at a time. What is submitted
 * becomes a response the survey's team sees in its results.
 */
export class LinkSurveyPage extends AppPage {
  readonly path = "/s/:surveyId";

  // The whole survey; each question inside it is a form of its own.
  readonly survey = this.page.getByRole("form").filter({ has: this.page.getByRole("heading", { level: 1 }) });
  readonly questionItems = this.survey.locator("form > div[id]");
  // "Next" or "Finish" by default and relabelled per survey; no type or test id, only the theme class,
  // which the round "Scroll to bottom" button shares (that one has no dir).
  readonly submitButton = this.survey.locator("button.border-submit-button-border[dir='auto']");
  readonly backButton = this.survey.getByRole("button", { name: "Back" });
  readonly thankYou = this.survey.getByRole("heading", { name: "Thank you!" });
  // A survey without an ending card (the seeded ones) shows only empty cards once submitted.
  // (An empty, transparent placeholder card sits behind the questions all along, so a single empty card says nothing.)
  readonly noQuestionCards = this.survey.getByTestId("stacked-cards-container").filter({ hasNot: this.page.locator("form") });
  // A plain span, no alert role; the only hook is its text.
  readonly requiredMessage = this.survey.getByText("Please fill out this field");

  // A CTA question's button can carry the question's id too, so match the question container only.
  private questionAt(id: string | null) {
    return this.survey.locator(`form > div[id='${id}']`);
  }

  async questions(): Promise<RespondentQuestion[]> {
    const items = await this.questionItems.all();
    return items.map((item) => new RespondentQuestion(item));
  }

  @ayme.action({
    available: inProgress,
    description:
      "Goes on to the next page of questions; on the last one it submits the response, which the survey's team then sees. A survey without an ending card then shows an empty card.",
  })
  async next() {
    const firstId = await this.questionItems.first().getAttribute("id");
    await this.submitButton.click(T);
    // This page's questions leave (next page or thank-you card), or a required-answer message keeps it.
    const options = { timeout: SERVER_TIMEOUT };
    const waits = [
      this.questionAt(firstId).waitFor({ state: "detached", ...options }),
      this.requiredMessage.first().waitFor(options),
    ];
    // The losing wait times out later; only the race's outcome counts.
    for (const wait of waits) wait.catch(() => undefined);
    await Promise.race(waits);
    // The page swaps its whole question area: once the old page left, wait for the new one to render.
    if (!(await this.requiredMessage.first().isVisible())) await this.pageShown();
    return this;
  }

  private async pageShown() {
    const shown = this.questionItems.first().or(this.thankYou);
    await shown.or(this.noQuestionCards).first().waitFor({ timeout: SERVER_TIMEOUT });
    // Between two pages the cards are empty for a moment too: give the next page 2 s to render.
    if (await this.noQuestionCards.isVisible()) await shown.first().waitFor({ timeout: 2000 }).catch(() => undefined);
  }

  @ayme.action({ available: canGoBack, description: "Goes back to the previous page of questions; answers given so far are kept." })
  async back() {
    const firstId = await this.questionItems.first().getAttribute("id");
    await this.backButton.click(T);
    await this.questionAt(firstId).waitFor({ state: "detached", timeout: SERVER_TIMEOUT });
    await this.pageShown();
    return this;
  }
}
