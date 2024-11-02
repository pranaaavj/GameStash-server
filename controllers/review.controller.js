import Review from '../models/review.model.js';
import Product from '../models/product.model.js';
import User from '../models/user.model.js';
import { reviewSchema } from '../validations/admin.validations.js';
import { NotFoundError, BadRequestError } from '../errors/index.js';
import { isValidObjectId } from 'mongoose';

/**
 * @route GET - user/review/:productId
 * @desc  User - Getting the review of a product
 * @access Public
 */
export const getReviewsByProduct = async (req, res) => {
  const { productId } = req.params;

  // Validating object Id
  if (!productId || !isValidObjectId(productId)) {
    throw new BadRequestError('Invalid product ID format.');
  }

  const reviews = await Review.find({ product: productId }).populate(
    'user',
    'name'
  );

  if (!reviews.length) {
    throw new NotFoundError('No reviews found for this product');
  }

  res.status(200).json({
    success: true,
    message: 'Reviews fetched successfully',
    data: reviews,
  });
};

/**
 * @route POST - user/review
 * @desc  User - Adding new review
 * @access Public
 */
export const addReview = async (req, res) => {
  const { productId, userId, rating, comment } =
    await reviewSchema.validateAsync(req.body, { abortEarly: false });

  const productExists = await Product.findById(productId);
  if (!productExists) {
    throw new NotFoundError('Product not found');
  }

  const userExists = await User.findById(userId);
  if (!userExists) {
    throw new NotFoundError('User not found');
  }

  const review = await Review.create({
    product: productId,
    user: userId,
    rating,
    comment,
  });

  res.status(201).json({
    success: true,
    message: 'Review added successfully',
    data: review,
  });
};
