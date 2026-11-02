import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const router = Router();

// Hash the configured admin password once at module load.
const ADMIN_USER = process.env.ADMIN_USERNAME || 'admin';
const ADMIN_HASH = bcrypt.hashSync(process.env.ADMIN_PASSWORD || 'admin123', 10);
const EXPIRES_IN = '8h';

router.post('/login', (req, res) => {
  const { username, password } = req.body || {};
  if (typeof username !== 'string' || typeof password !== 'string') {
    return res.status(400).json({ error: 'username and password are required' });
  }
  const userOk = username === ADMIN_USER;
  const passOk = bcrypt.compareSync(password, ADMIN_HASH);
  if (!userOk || !passOk) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  const token = jwt.sign({ sub: username, role: 'admin' }, process.env.JWT_SECRET || 'dev', {
    expiresIn: EXPIRES_IN,
  });
  res.json({ token, expiresIn: EXPIRES_IN });
});

export default router;
