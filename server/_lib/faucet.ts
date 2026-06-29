/**
 * Demo token faucet (server-side).
 *
 * The shared Demo token's `mint` is owner-gated (owner.require_auth()). To make
 * the demo dApp's transfer actually work, the faucet — signed by the token
 * owner, whose secret lives only in FAUCET_SECRET (never committed) — mints test
 * tokens to a connected wallet. Testnet only.
 */
import {
  Keypair,
  Contract,
  TransactionBuilder,
  Networks,
  BASE_FEE,
  Address,
  nativeToScVal,
  scValToNative,
  rpc,
} from '@stellar/stellar-sdk'

const RPC_URL = 'https://soroban-testnet.stellar.org'
const PASSPHRASE = Networks.TESTNET
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/** The shared Demo fungible token (must match DEMO_TOKEN_ID in src/lib/project.ts). */
export const DEMO_TOKEN_ID =
  'CD7XBRBY2IZASZIXZYXWR33ZUSUBUTXTY5MEGDLCAMOBVGQSLU6X675M'

/** The token uses 18 decimals (OZ default), so amounts are scaled by 10^18. */
const DECIMALS = 18n

/** Mint `amount` Demo tokens to `to`. Returns the tx hash. `secret` defaults to
 *  process.env (Vercel); the dev middleware passes it from loadEnv explicitly. */
export async function mintDemoTokens(
  to: string,
  amount = 1000,
  secret = process.env.FAUCET_SECRET,
): Promise<string> {
  if (!secret) throw new Error('FAUCET_SECRET not set')
  const server = new rpc.Server(RPC_URL)
  const owner = Keypair.fromSecret(secret)
  const contract = new Contract(DEMO_TOKEN_ID)

  // Faucet rule: one claim per wallet — only mint when the balance is back to 0.
  const balTx = new TransactionBuilder(await server.getAccount(owner.publicKey()), {
    fee: BASE_FEE,
    networkPassphrase: PASSPHRASE,
  })
    .addOperation(contract.call('balance', new Address(to).toScVal()))
    .setTimeout(30)
    .build()
  const sim = await server.simulateTransaction(balTx)
  if (!rpc.Api.isSimulationError(sim) && sim.result) {
    const current = scValToNative(sim.result.retval) as bigint
    if (current > 0n) {
      throw new Error(
        'Faucet limit: this wallet already holds DEMO. Send your balance to 0 to claim again.',
      )
    }
  }

  for (let i = 0; ; i++) {
    const source = await server.getAccount(owner.publicKey())
    const tx = new TransactionBuilder(source, {
      fee: BASE_FEE,
      networkPassphrase: PASSPHRASE,
    })
      .addOperation(
        contract.call(
          'mint',
          new Address(to).toScVal(),
          // Scale the human amount by the token's decimals.
          nativeToScVal(BigInt(amount) * 10n ** DECIMALS, { type: 'i128' }),
        ),
      )
      .setTimeout(60)
      .build()
    try {
      const prepared = await server.prepareTransaction(tx)
      prepared.sign(owner)
      const sent = await server.sendTransaction(prepared)
      if (sent.status === 'ERROR') throw new Error(JSON.stringify(sent.errorResult))
      let got = await server.getTransaction(sent.hash)
      for (let j = 0; got.status === 'NOT_FOUND' && j < 30; j++) {
        await sleep(1000)
        got = await server.getTransaction(sent.hash)
      }
      if (got.status !== 'SUCCESS') throw new Error(`mint ${got.status}`)
      return sent.hash
    } catch (err) {
      if (!/txBadSeq|txNoAccount/.test(String(err)) || i >= 10) throw err
      await sleep(1000)
    }
  }
}
