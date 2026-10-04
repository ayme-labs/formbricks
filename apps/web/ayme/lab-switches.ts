/** The Ayme lab's Goal Loop switch. It is read when the page loads, so changing it takes a page load. */

/** The cookie that turns the Goal Loop on: `ayme-lab-goal-loop=on`. Absent or any other value: off. */
export const GOAL_LOOP_COOKIE = "ayme-lab-goal-loop";

/** The route the browser sends Goal Loop decisions to. */
export const DECISION_ENDPOINT_PATH = "/api/ayme/decisions";

export const isGoalLoopOn = (cookieHeader: string): boolean =>
  cookieHeader.split(";").some((cookie) => cookie.trim() === `${GOAL_LOOP_COOKIE}=on`);
