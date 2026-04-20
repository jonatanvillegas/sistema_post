const mongoose = require('mongoose');

const migrationSchema = new mongoose.Schema(
  {
    _id: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      default: '',
    },
    appliedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    versionKey: false,
    timestamps: false,
    collection: 'migrations',
  }
);

module.exports = mongoose.model('Migration', migrationSchema);
