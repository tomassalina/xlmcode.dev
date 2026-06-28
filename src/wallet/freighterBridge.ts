import { useEffect } from 'react'
import freighterApi from '@stellar/freighter-api'

/** Prompt Freighter (top-level, where it's injected) and return the address.
 *  Used at deploy time so the deployed contract is owned by the user's wallet —
 *  the same wallet the generated app connects — so its writes/admin succeed. */
export async function getFreighterAddress(): Promise<string> {
  const c = await freighterApi.isConnected()
  if (!c.isConnected) throw new Error('Freighter is not installed')
  const a = await freighterApi.requestAccess()
  if (a.error) throw new Error(String(a.error))
  return a.address
}

/**
 * Freighter wallet bridge (host side).
 *
 * Browser extensions inject their provider only into the TOP frame, never into
 * the cross-origin Sandpack preview iframe — so a generated dApp running in the
 * preview can't reach Freighter directly. This host listener runs at the top
 * level (where Freighter IS injected) and answers wallet requests the preview
 * forwards over `postMessage`:
 *   - getAddress → requestAccess()
 *   - signXDR    → signTransaction(xdr)
 * The preview builds and submits the transaction itself (the SDK works in the
 * sandbox); only the signature is delegated here.
 *
 * Testnet MVP: requests are gated by a source tag, not a strict origin (the
 * sandbox origin is opaque/variable).
 */
export function useFreighterBridge() {
  useEffect(() => {
    const onMessage = async (e: MessageEvent) => {
      const msg = e.data
      if (!msg || msg.source !== 'xlmcode-dapp' || !msg.id) return
      const reply = (data: Record<string, unknown>) =>
        (e.source as Window | null)?.postMessage(
          { source: 'xlmcode-host', id: msg.id, ...data },
          '*',
        )
      try {
        if (msg.method === 'getAddress') {
          const access = await freighterApi.requestAccess()
          if (access.error) throw new Error(String(access.error))
          reply({ result: access.address })
        } else if (msg.method === 'signXDR') {
          const signed = await freighterApi.signTransaction(msg.xdr, {
            networkPassphrase: msg.networkPassphrase,
            address: msg.address,
          })
          if (signed.error) throw new Error(String(signed.error))
          reply({ result: signed.signedTxXdr })
        } else if (msg.method === 'faucet') {
          // Same-origin call to our backend (the preview can't reach /api itself).
          const r = await fetch('/api/faucet', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ address: msg.address }),
          })
          const data = await r.json()
          if (!r.ok) throw new Error(data.error ?? 'Faucet failed')
          reply({ result: data.hash })
        } else if (msg.method === 'mintNft') {
          const r = await fetch('/api/mint-nft', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ address: msg.address }),
          })
          const data = await r.json()
          if (!r.ok) throw new Error(data.error ?? 'Mint failed')
          reply({ result: JSON.stringify(data) })
        } else {
          reply({ error: `Unknown wallet method: ${msg.method}` })
        }
      } catch (err) {
        reply({ error: err instanceof Error ? err.message : String(err) })
      }
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [])
}
