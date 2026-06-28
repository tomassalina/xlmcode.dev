/**
 * Contract deploy core (provider-agnostic, runs on the server only).
 *
 * Mirrors the validated `contracts/scripts/deploy.mjs` flow:
 *   1. Generate + Friendbot-fund an ephemeral testnet deployer.
 *   2. Upload the pre-compiled WASM (published by its sha256 hash).
 *   3. Create the contract, invoking `__constructor` with the user's config.
 *
 * The server never compiles Rust — it deploys committed WASM and passes config
 * to the constructor. See contracts/build.sh for how the WASM is produced.
 */
import { readFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { resolve } from 'node:path'
import {
  Keypair,
  TransactionBuilder,
  Networks,
  BASE_FEE,
  Operation,
  Address,
  nativeToScVal,
  rpc,
  xdr,
} from '@stellar/stellar-sdk'
import type { Manifest, ManifestConfigField, DeployResult } from '../../shared/types'

const RPC_URL = 'https://soroban-testnet.stellar.org'
const FRIENDBOT = 'https://friendbot.stellar.org'
const PASSPHRASE = Networks.TESTNET
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/** The Soroban scval type a config field maps to (derived from its UI type). */
function scTypeOf(field: ManifestConfigField): string {
  if (field.scType) return field.scType
  if (field.type === 'address') return 'address'
  if (field.type === 'number') return 'i128'
  return 'string'
}

function toScVal(
  value: unknown,
  scType: string,
  deployerPk: string,
): xdr.ScVal {
  if (scType === 'address') {
    const addr =
      value === '{{deployer}}' || !value ? deployerPk : String(value)
    return new Address(addr).toScVal()
  }
  if (scType === 'i128') return nativeToScVal(BigInt(Number(value)), { type: 'i128' })
  if (scType === 'u32') return nativeToScVal(Number(value), { type: 'u32' })
  if (scType === 'u64') return nativeToScVal(BigInt(Number(value)), { type: 'u64' })
  if (scType === 'bool') return nativeToScVal(Boolean(value))
  return nativeToScVal(String(value), { type: 'string' })
}

async function submit(
  server: rpc.Server,
  tx: Parameters<rpc.Server['prepareTransaction']>[0],
  signer: Keypair,
) {
  const prepared = await server.prepareTransaction(tx)
  prepared.sign(signer)
  const sent = await server.sendTransaction(prepared)
  if (sent.status === 'ERROR') {
    throw new Error(`submit failed: ${JSON.stringify(sent.errorResult)}`)
  }
  let got = await server.getTransaction(sent.hash)
  for (let i = 0; got.status === 'NOT_FOUND' && i < 30; i++) {
    await sleep(1000)
    got = await server.getTransaction(sent.hash)
  }
  if (got.status !== 'SUCCESS') throw new Error(`tx ${sent.hash} ended ${got.status}`)
  return { hash: sent.hash, response: got }
}

export interface DeployInput {
  manifest: Manifest
  config: Record<string, unknown>
  /** The user's wallet secret — signs the deploy and becomes the owner. When
   *  omitted, a throwaway funded account is used (so deploys work pre-wallet). */
  deployerSecret?: string
}

export async function deployContract({
  manifest,
  config,
  deployerSecret,
}: DeployInput): Promise<DeployResult & { deployer: string; wasmHash: string }> {
  if (manifest.type !== 'deployable' || !manifest.wasmPath || !manifest.init) {
    throw new Error(`Manifest "${manifest.id}" is not a deployable contract`)
  }

  const wasm = await readFile(resolve(process.cwd(), manifest.wasmPath))
  const server = new rpc.Server(RPC_URL)
  const deployer = deployerSecret
    ? Keypair.fromSecret(deployerSecret)
    : Keypair.random()
  const deployerPk = deployer.publicKey()

  // 1. Ensure the deployer is funded; poll until the RPC sees the account.
  // A provided wallet is funded at login, but fund defensively if it's missing.
  let funded = false
  if (deployerSecret) {
    try {
      await server.getAccount(deployerPk)
      funded = true
    } catch {
      funded = false
    }
  }
  if (!funded) {
    const fb = await fetch(`${FRIENDBOT}?addr=${deployerPk}`)
    if (!fb.ok && fb.status !== 400) throw new Error(`friendbot failed: ${fb.status}`)
  }
  const getAccount = async () => {
    for (let i = 0; i < 30; i++) {
      try {
        return await server.getAccount(deployerPk)
      } catch {
        await sleep(1000)
      }
    }
    throw new Error('deployer account never became visible on RPC')
  }

  // 2. Upload the WASM (published by its sha256 hash).
  const wasmHash = createHash('sha256').update(wasm).digest()
  const uploadTx = new TransactionBuilder(await getAccount(), {
    fee: BASE_FEE,
    networkPassphrase: PASSPHRASE,
  })
    .addOperation(Operation.uploadContractWasm({ wasm }))
    .setTimeout(60)
    .build()
  await submit(server, uploadTx, deployer)

  // 3. Create the contract, invoking __constructor with the config (ordered).
  const fields = new Map(manifest.config.map((f) => [f.key, f]))
  const constructorArgs = manifest.init.argsFromConfig.map((key) => {
    const field = fields.get(key)
    if (!field) throw new Error(`Constructor arg "${key}" has no config field`)
    return toScVal(config[key] ?? field.default, scTypeOf(field), deployerPk)
  })

  let result: Awaited<ReturnType<typeof submit>> | null = null
  for (let i = 0; result === null; i++) {
    const createTx = new TransactionBuilder(await getAccount(), {
      fee: BASE_FEE,
      networkPassphrase: PASSPHRASE,
    })
      .addOperation(
        Operation.createCustomContract({
          address: new Address(deployerPk),
          wasmHash,
          constructorArgs,
        }),
      )
      .setTimeout(60)
      .build()
    try {
      result = await submit(server, createTx, deployer)
    } catch (err) {
      // The just-uploaded WASM can lag the create simulation a few seconds.
      if (!String(err).includes('MissingValue') || i >= 15) throw err
      await sleep(1000)
    }
  }

  const contractId = Address.fromScAddress(
    result.response.returnValue!.address(),
  ).toString()

  return {
    contractId,
    deployer: deployerPk,
    txHash: result.hash,
    wasmHash: wasmHash.toString('hex'),
    explorerUrl: `https://stellar.expert/explorer/testnet/contract/${contractId}`,
  }
}
