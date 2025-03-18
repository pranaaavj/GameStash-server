import mongoose from 'mongoose';
import Offer from '../models/offer.model.js';
import { selectBestOfferForProduct } from '../utils/bestOfferForProduct.js';

const ProductSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      trim: true,
      required: true,
    },
    price: {
      type: Number,
      required: true,
    },
    description: {
      type: String,
      required: true,
    },
    images: {
      type: [String],
      required: true,
    },
    genre: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Genre',
      required: true,
    },
    platform: {
      type: String,
      required: true,
      enum: ['PC', 'PlayStation', 'Xbox', 'Nintendo', 'Other'],
    },
    brand: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Brand',
      required: true,
    },
    systemRequirements: {
      cpu: { type: String, required: true },
      gpu: { type: String, required: true },
      ram: { type: String, required: true },
      storage: { type: String, required: true },
    },
    stock: {
      type: Number,
      required: true,
    },
    reservedStock: {
      type: Number,
      default: 0,
    },
    reviewCount: {
      type: Number,
      default: 0,
    },
    averageRating: {
      type: Number,
      default: 0,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    applicableOffers: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Offer',
      },
    ],
    bestOffer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Offer',
      default: null,
    },
    discountedPrice: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

// Text index for name and description with adjusted weights
ProductSchema.index(
  { name: 'text', description: 'text' },
  { weights: { name: 2, description: 1 } }
);

// Single-field indexes for basic sorting and filtering
ProductSchema.index({ price: 1 });
ProductSchema.index({ averageRating: 1 });
ProductSchema.index({ isActive: 1 });
ProductSchema.index({ createdAt: -1 }); // For "new arrivals"

// Compound indexes for filtering combinations
ProductSchema.index({ price: 1, isActive: 1 }); // Sorting/filtering active products by price
ProductSchema.index({ averageRating: -1, isActive: 1 }); // Sorting/filtering active products by ratings
ProductSchema.index({ genre: 1, isActive: 1 }); // Filtering active products by genre
ProductSchema.index({ brand: 1, isActive: 1 });

ProductSchema.pre('save', async function (next) {
  if (this.isNew) {
    const brandOffers = await Offer.find({
      type: 'Brand',
      targetId: this.brand,
      isActive: true,
    });

    if (brandOffers.length) {
      this.applicableOffers = brandOffers.map((offer) => offer._id);

      await selectBestOfferForProduct(this._id);
    }
  }

  next();
});

export default mongoose.model('Product', ProductSchema);
