import mongoose from 'mongoose';

const groupSchema = new mongoose.Schema({
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
  name: {
    type: String,
    required: true,
    trim: true,
  },
  color: {
    type: String,
    required: true,
    enum: ['navy', 'forest', 'brick', 'slate', 'teal'],
    default: 'navy',
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  archived: {
    type: Boolean,
    default: false,
  },
  shareId: {
    type: String,
    required: true,
    unique: true,
  }
});

// Ensure a user cannot have duplicate group IDs (e.g. 'uncategorized' or identical custom IDs)
groupSchema.index({ id: 1, userId: 1 }, { unique: true });

const Group = mongoose.model('Group', groupSchema);
export default Group;
