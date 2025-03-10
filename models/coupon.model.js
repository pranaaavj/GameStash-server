import mongoose from 'mongoose';

const couponSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
    },
    discountType: {
      type: String,
      enum: ['percentage', 'amount'],
      required: true,
    },
    discountValue: {
      type: Number,
      required: true,
      min: 1,
    },
    minOrderAmount: {
      type: Number,
      default: 0,
    },
    maxDiscountAmount: {
      type: Number,
      default: null,
    },
    usageLimit: {
      type: Number,
      default: 1,
    },
    perUserLimit: {
      type: Number,
      default: 1,
    },
    usersUsed: [
      {
        userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        timesUsed: { type: Number, default: 0 },
      },
    ],
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

couponSchema.pre('save', function (next) {
  const currentDate = new Date();
  currentDate.setHours(0, 0, 0, 0);

  if (this.endDate < currentDate) {
    this.isActive = false;
  }

  next();
});

export default mongoose.model('Coupon', couponSchema);
