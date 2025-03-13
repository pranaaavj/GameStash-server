import Cart from '../models/cart.model.js';
import Product from '../models/product.model.js';
import Coupon from '../models/coupon.model.js';
import { NotFoundError, BadRequestError } from '../errors/index.js';

/*****************************************/
// Cart CRUD
/*****************************************/

/**
 * @route GET user/cart
 * @desc Get the cart for a specific user
 * @access Private
 */
export const getCart = async (req, res) => {
  const userId = req.user.id;

  const cart = await Cart.findOne({ user: userId }).populate({
    path: 'items.product',
    // match: { isActive: true },
    populate: { path: 'bestOffer' },
  });

  if (!cart) {
    throw new NotFoundError('Cart not found');
  }

  res.status(200).json({
    success: true,
    message: 'Cart fetched successfully',
    data: cart,
  });
};

/**
 * @route POST user/cart
 * @desc Add an item to the cart
 * @access Private
 */
export const addItemToCart = async (req, res) => {
  const userId = req.user.id;
  const { productId, quantity } = req.body;

  // Finding the product
  const product = await Product.findById(productId);
  if (!product) {
    throw new NotFoundError('Product not found');
  }

  // Finding the cart
  let cart = await Cart.findOne({ user: userId });
  if (!cart) {
    cart = new Cart({ user: userId, items: [] });
  }

  const existingItemIndex = cart.items.findIndex((item) =>
    item.product.equals(productId)
  );

  if (existingItemIndex >= 0) {
    // Update quantity if item already exists
    cart.items[existingItemIndex].quantity += quantity;
  } else {
    // Add new item to cart
    cart.items.push({ product: productId, quantity });
  }

  await cart.save();

  res.status(200).json({
    success: true,
    message: 'Item added to cart successfully',
    data: cart,
  });
};

/**
 * @desc Update the quantity of a specific item in the cart
 * @route PATCH user/cart
 * @access Private
 */
export const updateCartItem = async (req, res) => {
  const userId = req.user.id;
  const { productId, quantity } = req.body;

  if (quantity < 1) {
    throw new BadRequestError('Quantity must be at least 1');
  }

  const cart = await Cart.findOne({ user: userId });
  if (!cart) {
    throw new NotFoundError('Cart not found');
  }

  const item = cart.items.find((item) => item.product.equals(productId));
  if (!item) {
    throw new NotFoundError('Item not found in cart');
  }

  const product = await Product.findById(productId);
  if (!product) {
    throw new NotFoundError('Product not found');
  }

  if (product.stock < quantity) {
    throw new BadRequestError('Insufficient stock');
  }

  item.quantity = quantity;
  await cart.save();

  res.status(200).json({
    success: true,
    message: 'Cart item updated successfully',
    data: cart,
  });
};

/**
 * @desc Remove an item from the cart
 * @route DELETE user/cart/:productId
 * @access Private
 */
export const removeItemFromCart = async (req, res) => {
  const userId = req.user.id;
  const productId = req.params.productId.trim();

  const cart = await Cart.findOne({ user: userId });
  if (!cart) {
    throw new NotFoundError('Cart not found');
  }

  cart.items = cart.items.filter((item) => !item.product.equals(productId));
  await cart.save();

  res.status(200).json({
    success: true,
    message: 'Item removed from cart successfully',
    data: cart,
  });
};

/**
 * @desc Clear the entire cart
 * @route DELETE user/cart
 * @access Private
 */
export const clearCart = async (req, res) => {
  const userId = req.user.id;

  const cart = await Cart.findOne({ user: userId });
  if (!cart) {
    throw new NotFoundError('Cart not found');
  }

  cart.items = [];
  cart.total = 0; // Clear total as well
  await cart.save();

  res.status(200).json({
    success: true,
    message: 'Cart cleared successfully',
    data: cart,
  });
};

// /**
//  * @route POST /user/cart/apply-coupon
//  * @desc  Apply a coupon to the user's cart
//  * @access Private
//  */

// export const applyCoupon = async (req, res) => {
//   const { code } = req.body;
//   const userId = req.user.id;

//   if (!code) {
//     throw new BadRequestError('Coupon code is required.');
//   }

//   const coupon = await Coupon.findOne({ code: code.toUpperCase() });
//   if (!coupon) {
//     throw new NotFoundError('Invalid coupon code.');
//   }

//   if (!coupon.isActive) {
//     throw new BadRequestError('This coupon is not active.');
//   }

//   const currentDate = new Date();
//   if (currentDate < coupon.startDate || currentDate > coupon.endDate) {
//     throw new BadRequestError('This coupon has expired.');
//   }

//   const cart = await Cart.findOne({ user: userId });
//   if (!cart || cart.items.length === 0) {
//     throw new BadRequestError(
//       'Your cart is empty. Add items to apply coupons.'
//     );
//   }

//   if (cart.total < coupon.minOrderAmount) {
//     throw new BadRequestError(
//       `Minimum order amount should be $${coupon.minOrderAmount} to use this coupon.`
//     );
//   }

//   const userUsage = coupon.usersUsed.find((entry) =>
//     entry.userId.equals(userId)
//   );
//   if (userUsage && userUsage.timesUsed >= coupon.perUserLimit) {
//     throw new BadRequestError(
//       'You have reached the usage limit for this coupon.'
//     );
//   }

//   let discountAmount = 0;
//   if (coupon.discountType === 'percentage') {
//     discountAmount = (cart.total * coupon.discountValue) / 100;
//     if (coupon.maxDiscountAmount) {
//       discountAmount = Math.min(discountAmount, coupon.maxDiscountAmount);
//     }
//   } else {
//     discountAmount = coupon.discountValue;
//   }

//   cart.discount = discountAmount;
//   cart.finalTotal = cart.total - discountAmount;
//   await cart.save();

//   res.status(200).json({
//     success: true,
//     message: `Coupon applied successfully. You saved $${discountAmount}.`,
//     data: {
//       appliedCoupon: coupon.code,
//       discount: discountAmount,
//       finalTotal: cart.finalTotal,
//     },
//   });
// };
