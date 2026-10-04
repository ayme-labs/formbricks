import { createDecisionEndpoint } from "@ayme-dev/ayme/server";
import { appendFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { labEnv } from "./lab-env";

/**
 * How the Goal Loop's decisions reach the model: the provider and model choices of Ayme's Decision
 * Endpoint. The one place to change when its options change. The key comes from
 * AYME_OPENROUTER_API_KEY, through OpenRouter.
 */
const decisionEndpointOptions = (apiKey: string) => ({
  provider: "openrouter" as const,
  apiKey,
  authorize() {},
});

/** The JSON Lines file each decision request is recorded in, unless AYME_LAB_DECISION_USAGE_FILE names another. */
export const defaultUsageFile = () => path.join(process.cwd(), ".ayme-lab", "decision-usage.jsonl");

/** One line of the usage file. */
export type DecisionUsageRecord = {
  time: string;
  durationMs: number;
  status: number;
  requestedModel: string | null;
  model: string | null;
  /** OpenRouter's id for the generation, the key to its own usage record of the call. */
  generationId: string | null;
  usage: { input_tokens?: number; output_tokens?: number; cost?: number } | null;
};

type LabDecisionEndpointOptions = {
  apiKey: string | undefined;
  usageFile: string;
  now?: () => number;
};

const jsonError = (status: number, error: string) =>
  Response.json({ error }, { status, headers: { "Cache-Control": "no-store" } });

const parseJson = (text: string): Record<string, unknown> | null => {
  try {
    const value: unknown = JSON.parse(text);
    return value !== null && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
};

const stringOrNull = (value: unknown) => (typeof value === "string" ? value : null);

/**
 * Ayme's Decision Endpoint with the key from the environment. Records every request it forwards,
 * with the model's token usage and cost from the response, as one line of the usage file.
 */
export function createLabDecisionEndpoint({
  apiKey,
  usageFile,
  now = Date.now,
}: LabDecisionEndpointOptions): (request: Request) => Promise<Response> {
  const forward = apiKey ? createDecisionEndpoint(decisionEndpointOptions(apiKey)) : undefined;

  return async (request) => {
    if (!forward) return jsonError(503, "AYME_OPENROUTER_API_KEY is not set.");

    const startedAt = now();
    const body = request.method === "GET" || request.method === "HEAD" ? undefined : await request.text();
    const response = await forward(
      new Request(request.url, { method: request.method, headers: request.headers, body })
    );

    const answer = parseJson(await response.clone().text());
    const usage = answer?.usage;
    const record: DecisionUsageRecord = {
      time: new Date(startedAt).toISOString(),
      durationMs: now() - startedAt,
      status: response.status,
      requestedModel: stringOrNull(body === undefined ? undefined : parseJson(body)?.model),
      model: stringOrNull(answer?.model),
      generationId: stringOrNull(answer?.id),
      usage: usage !== null && typeof usage === "object" ? (usage as DecisionUsageRecord["usage"]) : null,
    };
    try {
      await mkdir(path.dirname(usageFile), { recursive: true });
      await appendFile(usageFile, `${JSON.stringify(record)}\n`);
    } catch (error) {
      console.error("The Ayme lab could not record a decision's usage.", error);
    }
    return response;
  };
}

/** The route handler: reads the key and the usage file location at request time. */
export const handleDecisionRequest = (request: Request) => {
  const { openRouterApiKey, decisionUsageFile } = labEnv();
  return createLabDecisionEndpoint({
    apiKey: openRouterApiKey,
    usageFile: decisionUsageFile ?? defaultUsageFile(),
  })(request);
};
