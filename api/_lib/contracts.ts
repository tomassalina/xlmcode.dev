/**
 * Contract catalog registry.
 *
 * Adding a protocol to Stellarable = dropping a Manifest JSON in
 * contracts/manifests/ (+ its WASM via contracts/build.sh for deployables).
 * No engine changes — see PLAN.md §6.
 */
import { readdir, readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import type { Manifest } from '../../shared/types'

const MANIFEST_DIR = resolve(process.cwd(), 'contracts/manifests')

let cache: Manifest[] | null = null

export async function listManifests(): Promise<Manifest[]> {
  if (cache) return cache
  const files = (await readdir(MANIFEST_DIR)).filter((f) => f.endsWith('.json'))
  const manifests = await Promise.all(
    files.map(async (f) => {
      const raw = await readFile(resolve(MANIFEST_DIR, f), 'utf8')
      return JSON.parse(raw) as Manifest
    }),
  )
  cache = manifests.sort((a, b) => a.name.localeCompare(b.name))
  return cache
}

export async function getManifest(id: string): Promise<Manifest | undefined> {
  return (await listManifests()).find((m) => m.id === id)
}
