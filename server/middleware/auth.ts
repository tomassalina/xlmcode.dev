import type { Request, Response, NextFunction } from 'express'
import type { SupabaseClient, User } from '@supabase/supabase-js'
import { serverClient } from '../lib/supabase.js'

// Augment Express Request to carry the per-request supabase client + user.
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      supabase: SupabaseClient
      user: User
    }
  }
}

/**
 * Validates the session cookie and attaches `req.supabase` + `req.user`.
 * Uses getUser() (not getSession()) to validate the JWT server-side.
 * Returns 401 if there is no valid session.
 */
export async function requireUser(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const supabase = serverClient(req, res)
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    res.status(401).json({ error: 'unauthorized' })
    return
  }

  req.supabase = supabase
  req.user = user
  next()
}
