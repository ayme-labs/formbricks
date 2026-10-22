/** The Ayme lab's switches. They are read when the page loads, so changing one takes a page load. */

/** The cookie that turns the Goal Loop on: `ayme-lab-goal-loop=on`. Absent or any other value: off. */
export const GOAL_LOOP_COOKIE = "ayme-lab-goal-loop";

/** The route the browser sends Goal Loop decisions to. */
export const DECISION_ENDPOINT_PATH = "/api/ayme/decisions";

const hasCookie = (cookieHeader: string, cookie: string): boolean =>
  cookieHeader.split(";").some((part) => part.trim() === cookie);

export const isGoalLoopOn = (cookieHeader: string): boolean =>
  hasCookie(cookieHeader, `${GOAL_LOOP_COOKIE}=on`);
