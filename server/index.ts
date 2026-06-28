import { config } from 'dotenv'
config({ path: '.env.local' })

import express from 'express'
import cors from 'cors'
import cookieParser from 'cookie-parser'

import authRouter from './routes/auth.js'
import projectsRouter from './routes/projects.js'
import contractsRouter from './routes/contracts.js'
import chatRouter from './routes/chat.js'

const PORT = parseInt(process.env.PORT ?? '8787', 10)
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN ?? 'http://localhost:5173'

const app = express()

app.use(
  cors({
    origin: FRONTEND_ORIGIN,
    credentials: true,
  }),
)
app.use(cookieParser())
app.use(express.json({ limit: '5mb' }))

// Routes
app.use('/auth', authRouter)
app.use('/api', projectsRouter)
app.use('/api', contractsRouter)
app.use('/api', chatRouter)

app.get('/health', (_req, res) => {
  res.json({ ok: true, ts: new Date().toISOString() })
})

app.listen(PORT, () => {
  console.log(`[server] listening on http://localhost:${PORT}`)
})
