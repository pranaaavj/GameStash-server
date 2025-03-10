import mongoose from 'mongoose';

const OfferSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    type: {
      type: String,
      enum: ['Product', 'Brand'],
      required: true,
    },
    targetId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      refPath: 'type',
    },
    discountType: {
      type: String,
      enum: ['percentage', 'amount'],
      required: true,
    },
    discountValue: {
      type: Number,
      required: true,
    },
    startDate: {
      type: Date,
      required: true,
    },
    endDate: {
      type: Date,
      required: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

OfferSchema.pre('save', function (next) {
  if (this.expirationDate < new Date()) {
    this.isActive = false;
  }
  next();
});

export default mongoose.model('Offer', OfferSchema);
