// Standalone validation of the pure-JS deploy path (no stellar CLI).
// This mirrors exactly what the serverless /api/deploy will do, so we prove the
// SDK flow on testnet before wiring it into the backend.
//
//   node contracts/scripts/deploy.mjs <wasmPath> '<configJson>' '<argsOrder>' '<typesJson>'
//
// Example (fungible token):
//   node contracts/scripts/deploy.mjs contracts/wasm/fungible-token.wasm \
//     '{"name":"Peña","symbol":"PENA","owner":"{{deployer}}","initial_supply":10000}' \
//     'name,symbol,owner,initial_supply' \
//     '{"name":"string","symbol":"string","owner":"address","initial_supply":"i128"}'

import { readFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import {
  Keypair,
  TransactionBuilder,
  Networks,
  BASE_FEE,
  Operation,
  Address,
  nativeToScVal,
  rpc,
} from '@stellar/stellar-sdk'

const RPC_URL = 'https://soroban-testnet.stellar.org'
const FRIENDBOT = 'https://friendbot.stellar.org'
const PASSPHRASE = Networks.TESTNET

/** Convert a config value to an ScVal using the contract's declared arg type. */
function toScVal(value, type, deployerPk) {
  if (type === 'address') {
    const addr = value === '{{deployer}}' || !value ? deployerPk : value
    return new Address(addr).toScVal()
  }
  if (type === 'i128') return nativeToScVal(BigInt(value), { type: 'i128' })
  if (type === 'u32') return nativeToScVal(Number(value), { type: 'u32' })
  if (type === 'u64') return nativeToScVal(BigInt(value), { type: 'u64' })
  return nativeToScVal(String(value), { type: 'string' })
}

/** Submit a prepared tx and poll until it lands. Returns the final response. */
async function submit(server, tx, signer) {
  const prepared = await server.prepareTransaction(tx)
  prepared.sign(signer)
  const sent = await server.sendTransaction(prepared)
  if (sent.status === 'ERROR') {
    throw new Error(`submit failed: ${JSON.stringify(sent.errorResult)}`)
  }
  let got = await server.getTransaction(sent.hash)
  for (let i = 0; got.status === 'NOT_FOUND' && i < 30; i++) {
    await new Promise((r) => setTimeout(r, 1000))
    got = await server.getTransaction(sent.hash)
  }
  if (got.status !== 'SUCCESS') {
    throw new Error(`tx ${sent.hash} ended ${got.status}`)
  }
  return { hash: sent.hash, response: got }
}

async function deploy({ wasm, configJson, order, types }) {
  const server = new rpc.Server(RPC_URL)
  const deployer = Keypair.random()
  const deployerPk = deployer.publicKey()

  // 1. Fund the ephemeral deployer via Friendbot.
  const fb = await fetch(`${FRIENDBOT}?addr=${deployerPk}`)
  if (!fb.ok) throw new Error(`friendbot failed: ${fb.status}`)

  // Friendbot lands on Horizon; the Soroban RPC sees the new account a few
  // seconds later. Poll until it's visible before building transactions.
  const getAccount = async () => {
    for (let i = 0; i < 30; i++) {
      try {
        return await server.getAccount(deployerPk)
      } catch {
        await new Promise((r) => setTimeout(r, 1000))
      }
    }
    throw new Error('deployer account never became visible on RPC')
  }

  // 2. Upload the WASM (publishes it by its sha256 hash).
  const wasmHash = createHash('sha256').update(wasm).digest()
  let account = await getAccount()
  const uploadTx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: PASSPHRASE,
  })
    .addOperation(Operation.uploadContractWasm({ wasm }))
    .setTimeout(60)
    .build()
  await submit(server, uploadTx, deployer)

  // 3. Create the contract, invoking __constructor with the user's config.
  // The just-uploaded WASM can take a few seconds to be visible to the create
  // simulation, so retry on the transient "Wasm does not exist" error.
  const constructorArgs = order.map((key) =>
    toScVal(configJson[key], types[key], deployerPk),
  )
  let hash, response
  for (let i = 0; ; i++) {
    account = await getAccount()
    const createTx = new TransactionBuilder(account, {
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
      ;({ hash, response } = await submit(server, createTx, deployer))
      break
    } catch (err) {
      const transient = String(err).includes('MissingValue') && i < 15
      if (!transient) throw err
      await new Promise((r) => setTimeout(r, 1000))
    }
  }

  // The created contract address is the return value of the host function.
  const contractAddress = Address.fromScAddress(
    response.returnValue.address(),
  ).toString()

  return {
    contractId: contractAddress,
    deployer: deployerPk,
    txHash: hash,
    explorerUrl: `https://stellar.expert/explorer/testnet/contract/${contractAddress}`,
  }
}

const [, , wasmPath, configArg, orderArg, typesArg] = process.argv
const wasm = await readFile(wasmPath)
const result = await deploy({
  wasm,
  configJson: JSON.parse(configArg),
  order: orderArg.split(','),
  types: JSON.parse(typesArg),
})
console.log(JSON.stringify(result, null, 2))
