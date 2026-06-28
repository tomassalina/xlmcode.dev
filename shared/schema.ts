import { z } from 'zod'

/**
 * The single source of truth for what the LLM is allowed to return.
 *
 * The Zod schema IS the contract: `generateObject` (AI SDK) converts it to a
 * JSON Schema, constrains the model to it, and validates the response before we
 * ever touch it (PLAN.md §5.3).
 *
 * IMPORTANT — OpenAI Structured Outputs (strict mode) constraints:
 *   - Use `z.union` (emits `anyOf`), NOT `z.discriminatedUnion` (emits `oneOf`,
 *     which OpenAI rejects).
 *   - No open-ended `z.record`/`z.unknown` maps (additionalProperties is
 *     forbidden in strict mode). Contract ops land in Milestone 2 with a
 *     strict-safe shape; for now the agent only returns message + file ops.
 */

/** A single mutation to the file tree. `edit` replaces the whole file (no diffs). */
export const fileOpSchema = z.union([
  z.object({
    op: z.literal('create'),
    path: z.string().describe('File path, e.g. /App.tsx'),
    content: z.string(),
  }),
  z.object({
    op: z.literal('edit'),
    path: z.string(),
    content: z.string().describe('The FULL updated file content (not a diff)'),
  }),
  z.object({
    op: z.literal('delete'),
    path: z.string(),
  }),
])

/**
 * An action the agent PROPOSES (it cannot execute directly). The user confirms
 * each one; the platform runs it and feeds the result back so the agent can
 * continue. `configJson` is a JSON object string (kept as a string so the schema
 * stays strict-mode-safe — no open-ended record).
 */
export const agentActionSchema = z.union([
  z.object({
    type: z.literal('deploy_contract'),
    manifestId: z
      .string()
      .describe('Catalog contract id, e.g. "oz-fungible-token"'),
    configJson: z
      .string()
      .describe(
        'JSON object string of config values keyed by the manifest config keys, e.g. {"name":"Demo","symbol":"DEMO","initial_supply":1000000}. Omit "owner" to use the user wallet.',
      ),
    reason: z
      .string()
      .describe('One short sentence shown to the user explaining the deploy'),
  }),
  z.object({
    type: z.literal('create_wallet'),
    label: z.string().describe('Short label, e.g. "Player 2"'),
    reason: z.string().describe('One short sentence explaining why'),
  }),
])

/** The structured response the LLM must return on every turn. */
export const agentResponseSchema = z.object({
  message: z
    .string()
    .describe('Short chat-facing message describing what you did'),
  versionName: z
    .string()
    .describe(
      'A very short 2-5 word title for this change, e.g. "Add pricing section". No matter how long the user prompt is, summarize it here.',
    ),
  files: z.array(fileOpSchema).describe('File operations to apply'),
  actions: z
    .array(agentActionSchema)
    .describe(
      'Contract deploys / wallet creations to PROPOSE this turn. The user confirms each; you then receive the result and continue. Empty array if none.',
    ),
})

export type FileOp = z.infer<typeof fileOpSchema>
export type AgentAction = z.infer<typeof agentActionSchema>
export type AgentResponse = z.infer<typeof agentResponseSchema>

/**
 * Contract operations — defined for Milestone 2. Not yet part of
 * agentResponseSchema (needs a structured-outputs-safe config shape).
 */
export type ContractOp =
  | {
      op: 'deploy'
      manifestId: string
      config: Record<string, unknown>
      bindTo?: string
    }
  | { op: 'invoke'; contractId: string; method: string; args: unknown[] }
