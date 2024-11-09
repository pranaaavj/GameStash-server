import Product from './product.model.js';
import mongoose from 'mongoose';

const cartSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true,
  },
  items: [
    {
      product: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product',
        required: true,
      },
      quantity: {
        type: Number,
        required: true,
        min: 1,
        default: 1,
      },
    },
  ],
  total: {
    type: Number,
    required: true,
    default: 0,
  },
  shipping: {
    type: Number,
    default: 0,
  },
  discount: {
    type: Number,
    default: 0,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

// Calculate the total based on the quantity and the discounts
cartSchema.pre('save', async function (next) {
  let total = 0;

  for (const item of this.items) {
    const product = await Product.findById(item.product);
    if (product) {
      total += product.price * item.quantity;
    }
  }

  this.total = total + this.shipping - this.discount;
  this.updatedAt = Date.now();

  next();
});

export default mongoose.model('Cart', cartSchema);
