import mongoose from 'mongoose';

const urlSchema = new mongoose.Schema({
  id: {
    type: String,
    required: true,
    index: true,
  },
  userId: {
    type: String,
    required: true,
    index: true,
  },
  longUrl: {
    type: String,
    required: true,
    trim: true,
  },
  shortCode: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },
  vanityCode: {
    type: String,
    trim: true,
  },
  clicks: {
    type: Number,
    required: true,
    default: 0,
  },
  qrCode: {
    type: String,
    required: true,
  },
  groupId: {
    type: String,
    required: true,
    default: 'uncategorized',
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  expiresAt: {
    type: Date,
    default: null,
  },
  maxClicks: {
    type: Number,
    default: null,
  },
  password: {
    type: String,
    default: null,
  },
  active: {
    type: Boolean,
    default: true,
  },
  tags: {
    type: [String],
    default: [],
  },
  clickEvents: {
    type: [
      {
        timestamp: { type: Date, default: Date.now },
        referrer: { type: String, default: '' },
        userAgent: { type: String, default: '' },
      }
    ],
    default: [],
  },
});

// Compound unique index for links
urlSchema.index({ id: 1, userId: 1 }, { unique: true });

const Url = mongoose.model('Url', urlSchema);
export default Url;
