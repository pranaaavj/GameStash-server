import mongoose from 'mongoose';

const ReviewSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    rating: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
    },
    comment: {
      type: String,
      required: true,
    },
  },
  { timestamps: true }
);

// Calculate the average rating for a product
ReviewSchema.statics.calculateAverageRating = async function (productId) {
  const result = await this.aggregate([
    { $match: { product: new mongoose.Types.ObjectId(productId) } },
    {
      $group: {
        _id: '$product',
        averageRating: { $avg: '$rating' },
        reviewCount: { $sum: 1 },
      },
    },
  ]);

  try {
    await mongoose.model('Product').findByIdAndUpdate(productId, {
      averageRating: result[0]?.averageRating || 0,
      reviewCount: result[0]?.reviewCount || 0,
    });
  } catch (error) {
    console.error('Error calculating average rating:', error);
  }
};

// Update average rating after saving a review
ReviewSchema.post('save', function () {
  this.constructor.calculateAverageRating(this.product);
});

// Update average rating after deleting a review
ReviewSchema.post('remove', function () {
  this.constructor.calculateAverageRating(this.product);
});

export default mongoose.model('Review', ReviewSchema);
