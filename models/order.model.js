import mongoose from 'mongoose';
import { AddressSchema } from './address.model.js';

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
    enum: [
      'Pending',
      'Shipped',
      'Delivered',
      'Cancelled',
      'Returned',
      'Return Requested',
      'Return Rejected',
    ],
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
    shippingAddress: AddressSchema,
    paymentMethod: {
      type: String,
      enum: ['Wallet', 'Cash on Delivery', 'Razorpay'],
      required: true,
    },
    paymentStatus: {
      type: String,
      enum: ['Pending', 'Paid', 'Failed'],
      default: 'Pending',
    },
    razorpayOrderId: {
      type: String,
      default: null,
    },
    orderStatus: {
      type: String,
      enum: [
        'Processing',
        'Shipped',
        'Delivered',
        'Cancelled',
        'Returned',
        'Return Requested',
        'Partially Cancelled',
        'Partially Returned',
        'Partially Delivered',
      ],
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
  const statuses = this.orderItems.map((item) => item.status);

  const activeOrderItems = this.orderItems.filter(
    (item) => item.status !== 'Cancelled'
  );

  if (this.isModified('orderItems') && activeOrderItems.length > 0) {
    const currentTotalAmount = activeOrderItems.reduce(
      (sum, item) => sum + item.totalPrice,
      0
    );

    let currentCouponDiscount = 0;
    if (this.couponDiscount > 0 && this.totalAmount > 0) {
      currentCouponDiscount =
        (currentTotalAmount / this.totalAmount) * this.couponDiscount;
      currentCouponDiscount = Math.round(currentCouponDiscount * 100) / 100;
    }

    this.finalPrice = Math.max(0, currentTotalAmount - currentCouponDiscount);
  }

  if (this.orderItems.every((item) => item.status === 'Cancelled')) {
    this.finalPrice = 0;
  }

  if (statuses.every((status) => status === 'Cancelled')) {
    this.orderStatus = 'Cancelled';
  } else if (statuses.every((status) => status === 'Returned')) {
    this.orderStatus = 'Returned';
  } else if (statuses.every((status) => status === 'Return Rejected')) {
    this.orderStatus = 'Return Rejected';
  } else if (statuses.includes('Return Requested')) {
    this.orderStatus = 'Return Requested';
  } else if (
    statuses.every((status) => status === 'Delivered' || status === 'Cancelled')
  ) {
    if (statuses.includes('Delivered') && statuses.includes('Cancelled')) {
      this.orderStatus = 'Partially Cancelled';
    } else {
      this.orderStatus = 'Delivered';
    }
  } else if (
    statuses.every((status) => status === 'Shipped' || status === 'Cancelled')
  ) {
    this.orderStatus = 'Shipped';
  } else if (
    statuses.every(
      (status) => status === 'Processing' || status === 'Cancelled'
    )
  ) {
    this.orderStatus = 'Processing';
  } else if (
    statuses.includes('Shipped') &&
    statuses.includes('Delivered') &&
    !statuses.includes('Return Requested')
  ) {
    this.orderStatus = 'Partially Delivered';
  } else if (
    statuses.includes('Cancelled') &&
    statuses.includes('Delivered') &&
    !statuses.includes('Return Requested')
  ) {
    this.orderStatus = 'Partially Cancelled';
  } else if (
    statuses.includes('Returned') &&
    (statuses.includes('Shipped') || statuses.includes('Delivered')) &&
    !statuses.includes('Return Requested')
  ) {
    this.orderStatus = 'Partially Returned';
  } else if (
    statuses.includes('Delivered') &&
    statuses.includes('Return Rejected') &&
    !statuses.includes('Return Requested')
  ) {
    this.orderStatus = 'Delivered'; // Return rejection shouldn't change order status
  } else if (statuses.includes('Shipped')) {
    this.orderStatus = 'Shipped';
  } else if (statuses.includes('Processing')) {
    this.orderStatus = 'Processing';
  } else {
    this.orderStatus = 'Processing';
  }

  next();
});

export default mongoose.model('Order', OrderSchema);
