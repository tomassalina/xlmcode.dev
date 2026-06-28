/**
 * Seed the demo templates (token / nft / swap) as system-owned, publicly-readable
 * projects. Run with: pnpm seed:templates
 *
 * - Ensures the system account info@xlmcode.dev exists (auth admin API).
 * - Re-seeds the 3 templates from the SAME code the demos use (EXAMPLE_APPS),
 *   so the stored file tree (incl. the dev kit) always matches the latest code.
 * - Idempotent: wipes the system account's existing templates first, then inserts.
 *
 * Secrets are read from .env.local at runtime (never printed).
 */
import { config } from 'dotenv'
config({ path: '.env.local' })

import { createClient } from '@supabase/supabase-js'
import { randomUUID } from 'node:crypto'
import { EXAMPLE_APPS } from '../src/lib/project'

const SUPABASE_URL = process.env.SUPABASE_URL ?? ''
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY ?? ''
const SYSTEM_EMAIL = 'info@xlmcode.dev'

// Template kind + display name aligned to EXAMPLE_APPS order: [token, nft, swap].
const KINDS = ['token', 'nft', 'swap'] as const
const NAMES = ['Fungible Token', 'NFT Collection', 'Token Swap'] as const

if (!SUPABASE_URL || !SUPABASE_SECRET_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SECRET_KEY in .env.local')
  process.exit(1)
}

const admin = createClient(SUPABASE_URL, SUPABASE_SECRET_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
})

/** Ensure info@xlmcode.dev exists; return its user id. */
async function ensureSystemUser(): Promise<string> {
  const { data: created, error } = await admin.auth.admin.createUser({
    email: SYSTEM_EMAIL,
    email_confirm: true,
    password: randomUUID(),
    user_metadata: { full_name: 'xlmcode' },
  })
  if (created?.user?.id) {
    console.log(`Created system user ${SYSTEM_EMAIL}`)
    return created.user.id
  }
  // Already exists → look it up via profiles (created by the handle_new_user trigger).
  console.log(`System user exists (${error?.message ?? 'lookup'}) — reusing`)
  const { data: prof, error: profErr } = await admin
    .from('profiles')
    .select('id')
    .eq('email', SYSTEM_EMAIL)
    .single()
  if (profErr || !prof) throw new Error(`Could not resolve system user: ${profErr?.message}`)
  return prof.id as string
}

async function main() {
  const systemId = await ensureSystemUser()

  // Wipe existing system templates (cascades to versions/messages/contracts).
  await admin.from('projects').delete().eq('owner_id', systemId).eq('is_template', true)

  for (let i = 0; i < EXAMPLE_APPS.length; i++) {
    const ex = EXAMPLE_APPS[i]
    const kind = KINDS[i] ?? 'token'
    const name = NAMES[i] ?? ex.label
    if (!ex.files) continue

    const { data: project, error: pErr } = await admin
      .from('projects')
      .insert({
        owner_id: systemId,
        slug: `tpl-${kind}`,
        name,
        current_files: ex.files,
        is_template: true,
        kind,
        published: true,
        sort_order: i,
      })
      .select('id')
      .single()
    if (pErr || !project) throw new Error(`insert project failed: ${pErr?.message}`)
    const projectId = project.id as string

    await admin.from('project_versions').insert({
      project_id: projectId,
      seq: 1,
      label: 'Template',
      summary: `The ${ex.label} template.`,
      files: ex.files,
    })

    await admin.from('messages').insert({
      project_id: projectId,
      seq: 1,
      role: 'assistant',
      content: `This is the "${ex.label}" template — a complete, working app. Clone it to start building your own.`,
      kind: 'system',
    })

    // Public share token → badges/templates link to /p/:token (read-only preview).
    await admin.from('project_shares').insert({ project_id: projectId, created_by: systemId })

    if (ex.contracts?.length) {
      await admin.from('deployed_contracts').insert(
        ex.contracts.map((c) => ({
          project_id: projectId,
          manifest_id: c.manifestId,
          name: c.name,
          category: c.category,
          contract_id: c.contractId,
          network: c.network,
          explorer_url: c.explorerUrl,
          deployer: c.deployer ?? null,
          config: c.config,
        })),
      )
    }

    console.log(`Seeded template: ${ex.label} (${kind}) → ${projectId}`)
  }

  console.log('Done.')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
