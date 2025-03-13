import Wishlist from '../models/wishlist.model.js';
import Product from '../models/product.model.js';
import Cart from '../models/cart.model.js';
import { BadRequestError, NotFoundError } from '../errors/index.js';

/*****************************************/
// Wishlist - User
/*****************************************/

/**
 * @route POST - /user/wishlist
 * @desc  Add product to wishlist
 * @access Private
 */
export const addToWishlist = async (req, res) => {
  const { productId } = req.body;
  const userId = req.user.id;

  if (!productId) {
    throw new BadRequestError('Product ID is required.');
  }

  const product = await Product.findById(productId);
  if (!product) {
    throw new NotFoundError('Product not found.');
  }

  let wishlist = await Wishlist.findOne({ user: userId });

  if (!wishlist) {
    wishlist = await Wishlist.create({ user: userId, products: [productId] });
  } else {
    if (wishlist.products.includes(productId)) {
      throw new BadRequestError('Product is already in wishlist.');
    }
    wishlist.products.push(productId);
  }

  await wishlist.save();

  res.status(201).json({
    success: true,
    message: 'Product added to wishlist.',
    data: wishlist,
  });
};

/**
 * @route GET - /user/wishlist
 * @desc  Get user wishlist
 * @access Private
 */
export const getWishlist = async (req, res) => {
  const userId = req.user.id;

  const wishlist = await Wishlist.findOne({ user: userId }).populate(
    'products',
    'name price images stock'
  );

  if (!wishlist) {
    return res.status(200).json({
      success: true,
      message: 'Wishlist is empty.',
      data: { products: [] },
    });
  }

  res.status(200).json({
    success: true,
    message: 'Wishlist retrieved successfully.',
    data: wishlist,
  });
};

/**
 * @route DELETE - /user/wishlist/:productId
 * @desc  Remove product from wishlist
 * @access Private
 */
export const removeFromWishlist = async (req, res) => {
  const { productId } = req.params;
  const userId = req.user.id;

  if (!productId) {
    throw new BadRequestError('Product ID is required.');
  }

  const wishlist = await Wishlist.findOne({ user: userId });

  if (!wishlist) {
    throw new NotFoundError('Wishlist not found.');
  }

  wishlist.products = wishlist.products.filter(
    (id) => id.toString() !== productId
  );

  await wishlist.save();

  res.status(200).json({
    success: true,
    message: 'Product removed from wishlist.',
    data: wishlist,
  });
};

/**
 * @route POST - /user/wishlist/move-to-cart
 * @desc  Move product from wishlist to cart
 * @access Private
 */
export const moveToCart = async (req, res) => {
  const { productId } = req.params;
  const userId = req.user.id;

  const wishlist = await Wishlist.findOne({ user: userId });
  if (!wishlist) {
    throw new NotFoundError('Wishlist not found.');
  }

  if (!wishlist.products.includes(productId)) {
    throw new BadRequestError('Product is not in wishlist.');
  }

  const product = await Product.findById(productId);
  if (!product) {
    throw new NotFoundError('Product not found.');
  }

  if (product.stock < 1) {
    throw new BadRequestError('Product is out of stock.');
  }

  let cart = await Cart.findOne({ user: userId });

  if (!cart) {
    cart = await Cart.create({
      user: userId,
      items: [{ product: productId, quantity: 1 }],
    });
  } else {
    const existingItem = cart.items.find(
      (item) => item.product.toString() === productId
    );
    if (existingItem) {
      throw new BadRequestError('Product is already in cart.');
    }
    cart.items.push({ product: productId, quantity: 1 });
  }

  wishlist.products = wishlist.products.filter(
    (id) => id.toString() !== productId
  );

  await wishlist.save();
  await cart.save();

  res.status(200).json({
    success: true,
    message: 'Product moved to cart.',
    data: { wishlist, cart },
  });
};
