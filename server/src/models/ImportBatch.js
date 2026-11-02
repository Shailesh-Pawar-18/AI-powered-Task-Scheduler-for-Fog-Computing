import mongoose from 'mongoose';

const schema = new mongoose.Schema({
  source: { type: String, enum: ['sample', 'synthetic', 'upload', 'secom'], default: 'upload' },
  fileName: String,
  rowsReceived: Number,
  rowsInvalid: Number,
  duplicatesRemoved: Number,
  rowsStored: Number,
}, { timestamps: true });

export const ImportBatch = mongoose.model('ImportBatch', schema);
