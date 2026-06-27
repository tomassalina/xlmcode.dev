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

/** The structured response the LLM must return on every turn. */
export const agentResponseSchema = z.object({
  message: z
    .string()
    .describe('Short chat-facing message describing what you did'),
  files: z.array(fileOpSchema).describe('File operations to apply'),
})

export type FileOp = z.infer<typeof fileOpSchema>
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
