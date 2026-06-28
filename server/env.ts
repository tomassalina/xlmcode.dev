// Loads .env.local BEFORE any module that reads process.env at import time.
// MUST be the very first import in index.ts (ESM hoists imports, so this file —
// having no env-reading imports of its own — runs config() before the rest load).
import { config } from 'dotenv'

config({ path: '.env.local' })
