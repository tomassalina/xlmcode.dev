import { Router } from 'express'
import { requireUser } from '../middleware/auth.js'
import { adminClient } from '../lib/supabase.js'

const router = Router()

const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN ?? 'http://localhost:5173'

// ─────────────────────────────────────────────────────────────────────────────
// Projects
// ─────────────────────────────────────────────────────────────────────────────

/** GET /api/projects — list all projects owned by the current user */
router.get('/projects', requireUser, async (req, res) => {
  const { data, error } = await req.supabase
    .from('projects')
    .select('id,slug,name,created_at,updated_at')
    .order('updated_at', { ascending: false })

  if (error) { res.status(500).json({ error: error.message }); return }
  res.json(data)
})

/** POST /api/projects — create a new project */
router.post('/projects', requireUser, async (req, res) => {
  const { name, slug, current_files } = req.body as {
    name?: string
    slug?: string
    current_files?: Record<string, unknown>
  }
  if (!name || !slug) { res.status(400).json({ error: 'name and slug required' }); return }

  const { data, error } = await req.supabase
    .from('projects')
    .insert({ owner_id: req.user.id, name, slug, current_files: current_files ?? {} })
    .select()
    .single()

  if (error) { res.status(500).json({ error: error.message }); return }
  res.status(201).json(data)
})

/** GET /api/projects/:id — fetch project + versions + messages + contracts */
router.get('/projects/:id', requireUser, async (req, res) => {
  const { id } = req.params

  const [projectRes, versionsRes, messagesRes, contractsRes] = await Promise.all([
    req.supabase.from('projects').select('*').eq('id', id).single(),
    req.supabase
      .from('project_versions')
      .select('*')
      .eq('project_id', id)
      .order('seq', { ascending: true }),
    req.supabase
      .from('messages')
      .select('*')
      .eq('project_id', id)
      .order('seq', { ascending: true }),
    req.supabase
      .from('deployed_contracts')
      .select('*')
      .eq('project_id', id)
      .order('created_at', { ascending: true }),
  ])

  if (projectRes.error) {
    res.status(projectRes.error.code === 'PGRST116' ? 404 : 500).json({ error: projectRes.error.message })
    return
  }

  res.json({
    project: projectRes.data,
    versions: versionsRes.data ?? [],
    messages: messagesRes.data ?? [],
    contracts: contractsRes.data ?? [],
  })
})

/** PATCH /api/projects/:id — update project name */
router.patch('/projects/:id', requireUser, async (req, res) => {
  const { id } = req.params
  const { name } = req.body as { name?: string }

  const { data, error } = await req.supabase
    .from('projects')
    .update({ name })
    .eq('id', id)
    .select()
    .single()

  if (error) { res.status(500).json({ error: error.message }); return }
  res.json(data)
})

/** DELETE /api/projects/:id */
router.delete('/projects/:id', requireUser, async (req, res) => {
  const { id } = req.params
  const { error } = await req.supabase.from('projects').delete().eq('id', id)
  if (error) { res.status(500).json({ error: error.message }); return }
  res.json({ ok: true })
})

/** PATCH /api/projects/:id/files — update current_files (manual edits, no version) */
router.patch('/projects/:id/files', requireUser, async (req, res) => {
  const { id } = req.params
  const { files } = req.body as { files?: Record<string, unknown> }
  if (!files) { res.status(400).json({ error: 'files required' }); return }

  const { data, error } = await req.supabase
    .from('projects')
    .update({ current_files: files })
    .eq('id', id)
    .select()
    .single()

  if (error) { res.status(500).json({ error: error.message }); return }
  res.json(data)
})

// ─────────────────────────────────────────────────────────────────────────────
// Versions
// ─────────────────────────────────────────────────────────────────────────────

/** POST /api/projects/:id/versions — insert a new version */
router.post('/projects/:id/versions', requireUser, async (req, res) => {
  const { id } = req.params
  const { label, summary, files } = req.body as {
    label?: string
    summary?: string
    files?: Record<string, unknown>
  }
  if (!files) { res.status(400).json({ error: 'files required' }); return }

  // Compute next seq
  const { data: existing } = await req.supabase
    .from('project_versions')
    .select('seq')
    .eq('project_id', id)
    .order('seq', { ascending: false })
    .limit(1)
    .single()

  const nextSeq = (existing?.seq ?? 0) + 1

  const { data, error } = await req.supabase
    .from('project_versions')
    .insert({ project_id: id, seq: nextSeq, label, summary, files })
    .select()
    .single()

  if (error) { res.status(500).json({ error: error.message }); return }
  res.status(201).json(data)
})

/** POST /api/projects/:id/versions/:vid/restore — call RPC restore_version */
router.post('/projects/:id/versions/:vid/restore', requireUser, async (req, res) => {
  const { id, vid } = req.params

  const { error } = await req.supabase.rpc('restore_version', {
    p_project: id,
    p_version: vid,
  })

  if (error) { res.status(500).json({ error: error.message }); return }

  // Return the refreshed project
  const { data: project, error: fetchErr } = await req.supabase
    .from('projects')
    .select('*')
    .eq('id', id)
    .single()

  if (fetchErr) { res.status(500).json({ error: fetchErr.message }); return }
  res.json(project)
})

// ─────────────────────────────────────────────────────────────────────────────
// Messages
// ─────────────────────────────────────────────────────────────────────────────

/** POST /api/projects/:id/messages — insert a message */
router.post('/projects/:id/messages', requireUser, async (req, res) => {
  const { id } = req.params
  const {
    role,
    content,
    files,
    stats,
    actions,
    kind,
    version_id,
    model_type,
    prompt_tokens,
    completion_tokens,
    cost_usd,
  } = req.body as {
    role?: string
    content?: string
    files?: unknown
    stats?: unknown
    actions?: unknown
    kind?: string
    version_id?: string
    model_type?: string
    prompt_tokens?: number
    completion_tokens?: number
    cost_usd?: number
  }
  if (!role || content === undefined) {
    res.status(400).json({ error: 'role and content required' })
    return
  }

  // Compute next seq
  const { data: last } = await req.supabase
    .from('messages')
    .select('seq')
    .eq('project_id', id)
    .order('seq', { ascending: false })
    .limit(1)
    .single()

  const nextSeq = (last?.seq ?? 0) + 1

  const { data, error } = await req.supabase
    .from('messages')
    .insert({
      project_id: id,
      seq: nextSeq,
      role,
      content,
      files: files ?? null,
      stats: stats ?? null,
      actions: actions ?? null,
      kind: kind ?? null,
      version_id: version_id ?? null,
      model_type: model_type ?? null,
      prompt_tokens: prompt_tokens ?? 0,
      completion_tokens: completion_tokens ?? 0,
      cost_usd: cost_usd ?? 0,
    })
    .select()
    .single()

  if (error) { res.status(500).json({ error: error.message }); return }
  res.status(201).json(data)
})

/** PATCH /api/projects/:id/messages/:mid — update actions_done */
router.patch('/projects/:id/messages/:mid', requireUser, async (req, res) => {
  const { mid } = req.params
  const { actions_done } = req.body as { actions_done?: boolean }

  const { data, error } = await req.supabase
    .from('messages')
    .update({ actions_done })
    .eq('id', mid)
    .select()
    .single()

  if (error) { res.status(500).json({ error: error.message }); return }
  res.json(data)
})

// ─────────────────────────────────────────────────────────────────────────────
// Deployed contracts
// ─────────────────────────────────────────────────────────────────────────────

/** POST /api/projects/:id/contracts — record a deployed contract */
router.post('/projects/:id/contracts', requireUser, async (req, res) => {
  const { id } = req.params
  const {
    manifestId,
    name,
    category,
    contractId,
    network,
    txHash,
    explorerUrl,
    deployer,
    config,
  } = req.body as {
    manifestId?: string
    name?: string
    category?: string
    contractId?: string
    network?: string
    txHash?: string
    explorerUrl?: string
    deployer?: string
    config?: Record<string, unknown>
  }
  if (!manifestId || !contractId) {
    res.status(400).json({ error: 'manifestId and contractId required' })
    return
  }

  const { data, error } = await req.supabase
    .from('deployed_contracts')
    .insert({
      project_id: id,
      manifest_id: manifestId,
      name: name ?? null,
      category: category ?? null,
      contract_id: contractId,
      network: network ?? 'testnet',
      tx_hash: txHash ?? null,
      explorer_url: explorerUrl ?? null,
      deployer: deployer ?? null,
      config: config ?? {},
    })
    .select()
    .single()

  if (error) { res.status(500).json({ error: error.message }); return }
  res.status(201).json(data)
})

// ─────────────────────────────────────────────────────────────────────────────
// Shares + Clone
// ─────────────────────────────────────────────────────────────────────────────

/** POST /api/projects/:id/share — create a share token */
router.post('/projects/:id/share', requireUser, async (req, res) => {
  const { id } = req.params

  const { data, error } = await req.supabase
    .from('project_shares')
    .insert({ project_id: id, created_by: req.user.id })
    .select('token')
    .single()

  if (error) { res.status(500).json({ error: error.message }); return }
  res.json({
    token: data.token,
    url: `${FRONTEND_ORIGIN}/p/${data.token}`,
  })
})

/** POST /api/projects/:id/clone — clone a project (owner cloning their own) */
router.post('/projects/:id/clone', requireUser, async (req, res) => {
  const { id } = req.params
  const { data, error } = await req.supabase.rpc('clone_project', {
    p_source: id,
  })
  if (error) { res.status(500).json({ error: error.message }); return }
  res.json({ id: data })
})

/** GET /api/shared/:token — read-only public view (no auth required) */
router.get('/shared/:token', async (req, res) => {
  const { token } = req.params
  const admin = adminClient()

  const { data: share, error: shareErr } = await admin
    .from('project_shares')
    .select('project_id')
    .eq('token', token)
    .single()

  if (shareErr || !share) { res.status(404).json({ error: 'not found' }); return }

  const projectId = share.project_id as string

  const [projectRes, versionsRes, messagesRes] = await Promise.all([
    admin.from('projects').select('*').eq('id', projectId).single(),
    admin
      .from('project_versions')
      .select('*')
      .eq('project_id', projectId)
      .order('seq', { ascending: true }),
    admin
      .from('messages')
      .select('*')
      .eq('project_id', projectId)
      .order('seq', { ascending: true }),
  ])

  if (projectRes.error) { res.status(404).json({ error: 'not found' }); return }

  res.json({
    project: projectRes.data,
    versions: versionsRes.data ?? [],
    messages: messagesRes.data ?? [],
  })
})

/** POST /api/shared/:token/clone — clone a shared project (requires auth) */
router.post('/shared/:token/clone', requireUser, async (req, res) => {
  const { token } = req.params
  const admin = adminClient()

  const { data: share, error: shareErr } = await admin
    .from('project_shares')
    .select('project_id')
    .eq('token', token)
    .single()

  if (shareErr || !share) { res.status(404).json({ error: 'share not found' }); return }

  const { data, error } = await req.supabase.rpc('clone_project', {
    p_source: share.project_id as string,
    p_share_token: token,
  })

  if (error) { res.status(500).json({ error: error.message }); return }
  res.json({ id: data })
})

export default router
