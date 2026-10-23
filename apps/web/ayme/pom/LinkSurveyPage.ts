import { ayme } from "@ayme-dev/ayme";
import { AppComponent } from "./AppComponent";
import { AppPage } from "./AppPage";
import { ROUTE_TIMEOUT, SERVER_TIMEOUT } from "./Timing";

const T = { timeout: ROUTE_TIMEOUT };

// The thank-you card's "Create your own Survey" button is styled as a submit button too.
const inProgress = async (self: LinkSurveyPage) =>
  (!(await self.thankYou.isVisible()) && (await self.submitButton.isVisible())) || "The survey shows no question";
const takesText = async (self: SurveyQuestion) =>
  (await self.textAnswer.isVisible()) || "This question takes no text";
const hasOptions = async (self: SurveyQuestion) =>
  (await self.options.first().isVisible()) || "This question has no answer options";

/** One question on the respondent's current page of the survey; its own form, its id the question's id. */
export class SurveyQuestion extends AppComponent {
  readonly headline = this.container.getByRole("heading", { level: 2 });
  readonly textAnswer = this.container.getByRole("textbox").first();
  readonly options = this.container.locator("input[type='radio'], input[type='checkbox'], [role='radio'], [role='checkbox']");

  @ayme.action({ available: takesText })
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
    available: hasOptions,
    description: "Picks a value on a rating or NPS scale, such as 4 of 5 stars or 9 of 10.",
  })
  async rate(value: number) {
    await this.container.locator("label").filter({ has: this.container.page().locator(`input[value='${value}']`) }).click(T);
    return this;
  }

  private labelFor(option: string) {
    const labels = this.container.locator("label");
    return labels
      .filter({ has: this.container.page().getByLabel(option, { exact: true }) })
      .or(labels.filter({ hasText: new RegExp(`^\\s*${option.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*$`) }))
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
  // A plain span, no alert role; the only hook is its text.
  readonly requiredMessage = this.survey.getByText("Please fill out this field");

  async questions(): Promise<SurveyQuestion[]> {
    const items = await this.questionItems.all();
    return items.map((item) => new SurveyQuestion(item));
  }

  @ayme.action({
    available: inProgress,
    description:
      "Goes on to the next page of questions; on the last one it submits the response, which the survey's team then sees.",
  })
  async next() {
    const firstId = await this.questionItems.first().getAttribute("id");
    await this.submitButton.click(T);
    // This page's questions leave (next page or thank-you card), or a required-answer message keeps it.
    const options = { timeout: SERVER_TIMEOUT };
    const waits = [
      this.survey.locator(`[id='${firstId}']`).waitFor({ state: "detached", ...options }),
      this.requiredMessage.first().waitFor(options),
    ];
    // The losing wait times out later; only the race's outcome counts.
    for (const wait of waits) wait.catch(() => undefined);
    await Promise.race(waits);
    return this;
  }
}
