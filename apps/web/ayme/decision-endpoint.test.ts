import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { createLabDecisionEndpoint } from "./decision-endpoint";

// OpenRouter's documented System One response, with its generation id, usage and cost.
const upstreamAnswer = {
  id: "gen-dec-1791149103-Hkue1YMeXsjVtPKZEXeZ",
  model: "typesafe/jev-1.13-20260917",
  provider: "TypeSafe",
  answers: { goal_met: { type: "noul", noul: 0.12 } },
  usage: { cost: 0.000019992, input_tokens: 476, output_tokens: 70 },
};

const decisionRequest = (body: unknown) =>
  new Request("http://localhost:3000/api/ayme/decisions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

const validBody = { model: "typesafe/jev-1.13", state: { page: [] }, questions: { goal_met: "?" } };

describe("the Ayme lab Decision Endpoint", () => {
  let dir: string;
  let usageFile: string;
  const fetchMock = vi.fn();

  beforeEach(async () => {
    dir = await mkdtemp(path.join(tmpdir(), "ayme-lab-decisions-"));
    usageFile = path.join(dir, "nested", "usage.jsonl");
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(async () => {
    vi.unstubAllGlobals();
    await rm(dir, { recursive: true, force: true });
  });

  const readUsage = async () =>
    (await readFile(usageFile, "utf8"))
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line));

  test("forwards a decision with the key and records its usage and cost", async () => {
    fetchMock.mockResolvedValue(Response.json(upstreamAnswer));
    let clock = 1_000;
    const handle = createLabDecisionEndpoint({ apiKey: "test-key", usageFile, now: () => (clock += 250) });

    const response = await handle(decisionRequest(validBody));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(upstreamAnswer);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://openrouter.ai/api/v1/systemone");
    expect(new Headers(init.headers).get("Authorization")).toBe("Bearer test-key");
    expect(JSON.parse(init.body)).toEqual(validBody);
    expect(await readUsage()).toEqual([
      {
        time: new Date(1_250).toISOString(),
        durationMs: 250,
        status: 200,
        requestedModel: "typesafe/jev-1.13",
        model: "typesafe/jev-1.13-20260917",
        generationId: "gen-dec-1791149103-Hkue1YMeXsjVtPKZEXeZ",
        usage: { cost: 0.000019992, input_tokens: 476, output_tokens: 70 },
      },
    ]);
  });

  test("records an upstream failure without usage and returns it unchanged", async () => {
    fetchMock.mockResolvedValue(Response.json({ error: { code: 401, message: "No key" } }, { status: 401 }));
    const handle = createLabDecisionEndpoint({ apiKey: "test-key", usageFile });

    const response = await handle(decisionRequest(validBody));

    expect(response.status).toBe(401);
    expect(await readUsage()).toEqual([
      expect.objectContaining({
        status: 401,
        requestedModel: "typesafe/jev-1.13",
        model: null,
        generationId: null,
        usage: null,
      }),
    ]);
  });

  test("answers 503 and calls nothing when the key is not set", async () => {
    const handle = createLabDecisionEndpoint({ apiKey: undefined, usageFile });

    const response = await handle(decisionRequest(validBody));

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: "AYME_OPENROUTER_API_KEY is not set." });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
