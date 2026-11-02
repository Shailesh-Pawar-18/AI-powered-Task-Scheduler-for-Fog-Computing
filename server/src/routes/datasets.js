import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { requireDb } from '../db.js';
import { cleanRows } from '../lib/cleaning.js';
import { DatasetRecord } from '../models/DatasetRecord.js';
import { ImportBatch } from '../models/ImportBatch.js';

const router = Router();
router.use(requireAuth, requireDb);

router.post('/import', async (req, res, next) => {
  try {
    const { source = 'upload', fileName, rows } = req.body || {};
    if (!Array.isArray(rows)) return res.status(400).json({ error: 'rows[] required' });

    const { valid, invalidCount, duplicatesRemoved } = cleanRows(rows);

    const batch = await ImportBatch.create({
      source, fileName,
      rowsReceived: rows.length,
      rowsInvalid: invalidCount,
      duplicatesRemoved,
      rowsStored: 0,
    });

    let stored = 0;
    if (valid.length) {
      const docs = valid.map((r) => ({ ...r, batchId: batch._id }));
      try {
        // ordered:false → insert all non-colliding docs in one pass
        const inserted = await DatasetRecord.insertMany(docs, { ordered: false });
        stored = inserted.length;
      } catch (e) {
        // Cross-batch duplicate-key collisions are expected and non-fatal:
        // count what actually got inserted. Re-throw anything else so the
        // error handler sees it (don't return 200 on a real failure).
        const isDuplicateKey =
          e?.code === 11000 || e?.name === 'MongoBulkWriteError' || Array.isArray(e?.writeErrors);
        if (!isDuplicateKey) throw e;
        stored = e.insertedDocs?.length ?? e.result?.result?.nInserted ?? 0;
      }
    }
    batch.rowsStored = stored;
    await batch.save();

    res.json({ batch });
  } catch (err) { next(err); }
});

router.get('/', async (req, res, next) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 100, 1000);
    const skip = parseInt(req.query.skip) || 0;
    const filter = {};
    if (req.query.type) filter.deviceType = req.query.type;
    if (req.query.priority) filter.priority = req.query.priority;
    const [total, records] = await Promise.all([
      DatasetRecord.countDocuments(filter),
      DatasetRecord.find(filter).sort({ timestamp: 1 }).skip(skip).limit(limit).lean(),
    ]);
    res.json({ total, records });
  } catch (err) { next(err); }
});

router.get('/stats', async (_req, res, next) => {
  try {
    const total = await DatasetRecord.countDocuments();
    const group = async (field) =>
      Object.fromEntries((await DatasetRecord.aggregate([
        { $group: { _id: `$${field}`, n: { $sum: 1 } } },
      ])).map((d) => [d._id, d.n]));
    res.json({ total, byType: await group('deviceType'), byPriority: await group('priority') });
  } catch (err) { next(err); }
});

router.delete('/', async (_req, res, next) => {
  try {
    const { deletedCount } = await DatasetRecord.deleteMany({});
    await ImportBatch.deleteMany({});
    res.json({ deleted: deletedCount });
  } catch (err) { next(err); }
});

export default router;
