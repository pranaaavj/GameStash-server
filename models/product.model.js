import mongoose from 'mongoose';

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
  },
  { timestamps: true }
);

export default mongoose.model('Product', ProductSchema);
