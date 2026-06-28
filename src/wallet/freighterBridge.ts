import { useEffect } from 'react'
import freighterApi from '@stellar/freighter-api'

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
      if (!msg || msg.source !== 'stellarable-dapp' || !msg.id) return
      const reply = (data: Record<string, unknown>) =>
        (e.source as Window | null)?.postMessage(
          { source: 'stellarable-host', id: msg.id, ...data },
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
