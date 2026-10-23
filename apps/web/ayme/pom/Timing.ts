// A client-side route change can take a cold compile in dev; the default action timeout is 1 s.
export const ROUTE_TIMEOUT = 30_000;
// A server action (save, duplicate, delete) answers within a few seconds.
export const SERVER_TIMEOUT = 10_000;
