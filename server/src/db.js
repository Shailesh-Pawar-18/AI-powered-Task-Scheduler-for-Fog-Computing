import mongoose from 'mongoose';

export async function connectDb(uri) {
  try {
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 4000 });
    console.log('[db] connected to', uri);
  } catch (err) {
    console.error('[db] connection failed:', err.message);
    console.error('[db] API will run but data routes will return 503 until MongoDB is up.');
  }
}

export function dbStatus() {
  return mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
}

export function requireDb(_req, res, next) {
  if (mongoose.connection.readyState !== 1) {
    return res.status(503).json({ error: 'Database unavailable. Start MongoDB and retry.' });
  }
  next();
}
