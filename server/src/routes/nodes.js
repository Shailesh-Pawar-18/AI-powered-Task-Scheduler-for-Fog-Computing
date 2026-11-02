import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { planFogNodes } from '../lib/fogNodes.js';

const router = Router();
router.use(requireAuth);

router.get('/plan', (req, res, next) => {
  try {
    const records = parseInt(req.query.records) || 0;
    res.json(planFogNodes(records));
  } catch (err) { next(err); }
});

export default router;
