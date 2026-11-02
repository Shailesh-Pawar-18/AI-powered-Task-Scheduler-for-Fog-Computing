import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { connectDb, dbStatus } from './db.js';
import authRouter from './routes/auth.js';
import datasetsRouter from './routes/datasets.js';
import nodesRouter from './routes/nodes.js';

const app = express();
app.use(cors({ origin: process.env.CLIENT_ORIGIN || '*' }));
app.use(express.json({ limit: '25mb' }));

app.get('/api/health', (_req, res) => res.json({ ok: true, db: dbStatus() }));

// Routes mounted in later tasks:
app.use('/api/auth', authRouter);
app.use('/api/datasets', datasetsRouter);
app.use('/api/nodes', nodesRouter);

app.use((err, _req, res, _next) => {
  console.error('[error]', err);
  res.status(500).json({ error: 'Internal server error' });
});

const PORT = process.env.PORT || 4000;
if (!process.env.JWT_SECRET) console.warn('[server] JWT_SECRET not set — using an insecure dev default. Set it in server/.env for anything beyond local dev.');
await connectDb(process.env.MONGODB_URI || 'mongodb://localhost:27017/fog_scheduler');
const server = app.listen(PORT, () => console.log(`[server] listening on http://localhost:${PORT}`));
server.on('error', (err) => console.error('[server] failed to start:', err.message));
