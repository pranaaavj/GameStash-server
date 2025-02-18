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
      enum: ['Wallet', 'Cash on Delivery', 'Credit Card', 'Razorpay'],
      required: true,
    },
    paymentStatus: {
      type: String,
      enum: ['Pending', 'Paid', 'Failed'],
      default: 'Pending',
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

// OrderSchema.pre('save', function (next) {
//   if (!this.deliveryBy && this.orderStatus === 'Shipped') {
//     const deliveryDate = new Date();
//     deliveryDate.setDate(deliveryDate.getDate() + 5); // Set delivery date to 5 days after shipping
//     this.deliveryBy = deliveryDate;
//   }
//   next();
// });

OrderSchema.pre('save', function (next) {
  const statuses = this.orderItems.map((item) => item.status);

  if (statuses.every((status) => status === 'Cancelled')) {
    this.orderStatus = 'Cancelled';
  } else if (statuses.every((status) => status === 'Returned')) {
    this.orderStatus = 'Returned';
  } else if (statuses.includes('Return Requested')) {
    this.orderStatus = 'Return Requested';
  } else if (statuses.includes('Pending') || statuses.includes('Shipped')) {
    this.orderStatus = 'Processing';
  } else if (statuses.includes('Cancelled') && statuses.includes('Delivered')) {
    this.orderStatus = 'Partially Cancelled';
  } else if (statuses.includes('Returned') && statuses.includes('Shipped')) {
    this.orderStatus = 'Partially Returned';
  } else if (statuses.every((status) => status === 'Delivered')) {
    this.orderStatus = 'Delivered';
  } else {
    this.orderStatus = 'Processing';
  }

  next();
});

export default mongoose.model('Order', OrderSchema);
