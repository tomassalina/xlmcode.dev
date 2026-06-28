import { Router } from 'express'
import { serverClient } from '../lib/supabase.js'
import { requireUser } from '../middleware/auth.js'

const router = Router()

const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN ?? 'http://localhost:5173'
const API_BASE = process.env.API_BASE ?? 'http://localhost:8787'

/**
 * POST /auth/otp/start
 * Sends a magic-link / OTP to the given email.
 */
router.post('/otp/start', async (req, res) => {
  const { email } = req.body as { email?: string }
  if (!email) {
    res.status(400).json({ error: 'email required' })
    return
  }
  const supabase = serverClient(req, res)
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: true },
  })
  if (error) {
    res.status(400).json({ error: error.message })
    return
  }
  res.json({ ok: true })
})

/**
 * POST /auth/otp/verify
 * Verifies the OTP token and sets session cookies via the SSR adapter.
 */
router.post('/otp/verify', async (req, res) => {
  const { email, token } = req.body as { email?: string; token?: string }
  if (!email || !token) {
    res.status(400).json({ error: 'email and token required' })
    return
  }
  const supabase = serverClient(req, res)
  const { data, error } = await supabase.auth.verifyOtp({
    email,
    token,
    type: 'email',
  })
  if (error) {
    res.status(400).json({ error: error.message })
    return
  }
  res.json({ user: data.user })
})

/**
 * GET /auth/google
 * Initiates Google OAuth flow — redirects to provider.
 */
router.get('/google', async (req, res) => {
  const supabase = serverClient(req, res)
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: `${API_BASE}/auth/callback` },
  })
  if (error || !data.url) {
    res.status(500).json({ error: error?.message ?? 'OAuth error' })
    return
  }
  res.redirect(data.url)
})

/**
 * GET /auth/callback?code=...
 * Exchanges the OAuth code for a session, sets cookies, and redirects to the app.
 */
router.get('/callback', async (req, res) => {
  const code = req.query['code'] as string | undefined
  if (!code) {
    res.status(400).json({ error: 'missing code' })
    return
  }
  const supabase = serverClient(req, res)
  const { error } = await supabase.auth.exchangeCodeForSession(code)
  if (error) {
    res.status(400).json({ error: error.message })
    return
  }
  res.redirect(FRONTEND_ORIGIN)
})

/**
 * POST /auth/logout
 * Signs out the user and clears the session.
 */
router.post('/logout', async (req, res) => {
  const supabase = serverClient(req, res)
  await supabase.auth.signOut()
  res.json({ ok: true })
})

/**
 * GET /auth/me
 * Returns the current user + their profile row.
 */
router.get('/me', requireUser, async (req, res) => {
  const { data: profile, error } = await req.supabase
    .from('profiles')
    .select('*')
    .eq('id', req.user.id)
    .single()

  if (error) {
    res.status(500).json({ error: error.message })
    return
  }
  res.json({ user: req.user, profile })
})

export default router
