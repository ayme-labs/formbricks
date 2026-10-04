import { handleDecisionRequest } from "@/ayme/decision-endpoint";

// The Ayme lab's Decision Endpoint for the Goal Loop.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = handleDecisionRequest;
