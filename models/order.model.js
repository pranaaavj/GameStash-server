import mongoose from 'mongoose';

const orderItemSchema = new mongoose.Schema({
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true,
  },
  quantity: {
    type: Number,
    required: true,
    min: 1,
  },
  price: {
    type: Number,
    required: true,
  },
  discount: {
    type: Number,
    default: 0,
  },
  totalPrice: {
    type: Number,
    required: true,
  },
  status: {
    type: String,
    enum: ['Pending', 'Shipped', 'Delivered', 'Cancelled', 'Returned'],
    default: 'Pending',
  },
  returnRequest: {
    requested: {
      type: Boolean,
      default: false,
    },
    reason: {
      type: String,
    },
    approved: {
      type: Boolean,
      default: false,
    },
    responseSent: {
      type: Boolean,
      default: false,
    },
  },
});

const OrderSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    orderItems: [orderItemSchema],
    totalAmount: {
      type: Number,
      required: true,
    },
    totalDiscount: {
      type: Number,
      default: 0,
    },
    finalPrice: {
      type: Number,
      required: true,
    },
    couponCode: {
      type: String,
      default: null,
    },
    couponDiscount: {
      type: Number,
      default: 0,
    },
    shippingAddress: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Address',
      required: true,
    },
    paymentMethod: {
      type: String,
      enum: ['Wallet', 'UPI', 'Cash on Delivery', 'Credit Card'],
      required: true,
    },
    paymentStatus: {
      type: String,
      enum: ['Pending', 'Paid', 'Failed'],
      default: 'Pending',
    },
    orderStatus: {
      type: String,
      enum: ['Processing', 'Shipped', 'Delivered', 'Cancelled'],
      default: 'Processing',
    },
    placedAt: {
      type: Date,
      default: Date.now,
    },
    deliveryBy: {
      type: Date,
    },
    refundedAmount: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

OrderSchema.pre('save', function (next) {
  if (!this.deliveryBy && this.orderStatus === 'Shipped') {
    const deliveryDate = new Date();
    deliveryDate.setDate(deliveryDate.getDate() + 5); // Set delivery date to 5 days after shipping
    this.deliveryBy = deliveryDate;
  }
  next();
});

export default mongoose.model('Order', OrderSchema);
