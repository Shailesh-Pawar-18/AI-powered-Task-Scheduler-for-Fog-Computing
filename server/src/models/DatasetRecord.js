import mongoose from 'mongoose';

const schema = new mongoose.Schema({
  batchId: { type: mongoose.Schema.Types.ObjectId, ref: 'ImportBatch', index: true },
  timestamp: { type: Date, default: null },
  deviceType: { type: String, enum: ['healthcare', 'traffic', 'industrial'], index: true },
  priority: { type: String, enum: ['low', 'medium', 'high', 'critical'], index: true },
  cpu: Number,
  memory: Number,
  latency: Number,
  sensorId: String,
  rowHash: { type: String, unique: true },
}, { timestamps: true });

export const DatasetRecord = mongoose.model('DatasetRecord', schema);
