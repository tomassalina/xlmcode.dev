/**
 * Shared contracts between the platform frontend (`src/`) and the serverless
 * backend (`api/`).
 *
 * Conceptual reminder (see PLAN.md §1):
 *   - The platform is the editor. The user's generated app is the document.
 *   - The `FileTree` is the single source of truth for that document.
 *   - The LLM proposes operations; the platform applies them.
 *
 * The agent response contract (AgentResponse / FileOp / ContractOp) lives in
 * `schema.ts` because it is derived from a Zod schema. Re-exported here so
 * callers have one import surface.
 */
export type { FileOp, ContractOp, AgentResponse } from './schema'

/** The user's generated app, in memory: path -> file contents. */
export type FileTree = Record<string, string>

/** Supported LLM providers. The MVP ships with OpenAI; the rest are stubs. */
export type LlmProvider = 'openai' | 'anthropic' | 'gemini'

/** A field the user fills in to configure a deployable contract. */
export interface ManifestConfigField {
  key: string
  label: string
  type: 'string' | 'number' | 'address'
  default?: unknown
}

/** A method a contract exposes, so the LLM knows how to call it. */
export interface ManifestMethod {
  name: string
  args: string[]
  returns: string
  mutates: boolean
}

/**
 * A contract manifest. Adding a new protocol to Stellable = adding one of these
 * JSON files, without touching the engine (see PLAN.md §6).
 */
export interface Manifest {
  id: string
  name: string
  description: string
  type: 'deployable' | 'deployed'
  category: 'token' | 'access' | 'nft' | 'oracle' | 'dex' | (string & {})
  wasmPath?: string
  init?: { method: string; argsFromConfig: string[] }
  contractId?: string | null
  network?: 'testnet' | 'mainnet'
  config: ManifestConfigField[]
  methods: ManifestMethod[]
}

/** Result of deploying a Type-1 contract to testnet. */
export interface DeployResult {
  contractId: string
  txHash: string
  explorerUrl: string
}

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

/** Request payload for the chat endpoint. */
export interface ChatRequest {
  sessionId: string
  provider: LlmProvider
  projectId: string
  fileTree: FileTree
  history: ChatMessage[]
  userMessage: string
}
