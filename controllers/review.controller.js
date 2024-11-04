import Review from '../models/review.model.js';
import Product from '../models/product.model.js';
import User from '../models/user.model.js';
import { reviewSchema } from '../validations/admin.validations.js';
import { NotFoundError, BadRequestError } from '../errors/index.js';
import { isValidObjectId } from 'mongoose';

/*****************************************/
// Reviews CRUD
/*****************************************/

/**
 * @route GET - user/review/:productId
 * @desc  User - Getting the review of a product
 * @access Public
 */
export const getReviewsByProduct = async (req, res) => {
  const { productId } = req.params;

  // Validating object ID
  if (!productId || !isValidObjectId(productId)) {
    throw new BadRequestError(
      'It seems the product ID format is incorrect. Please check and try again.'
    );
  }

  const reviews = await Review.find({ product: productId }).populate(
    'user',
    'name'
  );

  if (!reviews.length) {
    throw new NotFoundError('No reviews found for this product.');
  }

  res.status(200).json({
    success: true,
    message: 'Product reviews retrieved successfully.',
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
    throw new NotFoundError('We couldn’t find the specified product.');
  }

  const userExists = await User.findById(userId);
  if (!userExists) {
    throw new NotFoundError(
      'We couldn’t find an account associated with this ID.'
    );
  }

  const review = await Review.create({
    product: productId,
    user: userId,
    rating,
    comment,
  });

  res.status(201).json({
    success: true,
    message: 'Thank you! Your review has been added successfully.',
    data: review,
  });
};
