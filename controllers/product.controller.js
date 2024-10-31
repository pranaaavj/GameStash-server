import { NotFoundError, BadRequestError } from '../errors/index.js';
import {
  productSchema,
  editProductSchema,
} from '../validations/admin.validations.js';
import Product from '../models/product.model.js';
import Brand from '../models/brand.model.js';
import Genre from '../models/genre.model.js';
import { paginate } from '../utils/index.js';
import { isValidObjectId } from 'mongoose';

// Admin Side

/**
 * @route GET - admin/products
 * @desc  Admin - Listing all products
 * @access Private
 */
export const getAllProducts = async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;

  // Custom query options
  const queryOptions = {
    sort: { updatedAt: -1 },
    populate: [
      { path: 'genre', select: 'name -_id' },
      { path: 'brand', select: 'name -_id' },
    ],
  };

  // Function to paginate the data
  const products = await paginate(Product, page, limit, queryOptions);

  if (products?.result?.length === 0) {
    throw new NotFoundError('No products found');
  }

  res.status(200).json({
    success: true,
    message: 'All Products',
    data: {
      products: products.result,
      totalPages: products.totalPages,
      currentPage: products.currentPage,
    },
  });
};

/**
 * @route GET - admin/products/:productId
 * @desc  Admin || User  - Getting one product
 * @access Private
 */
export const getOneProduct = async (req, res) => {
  const productId = req.params.productId.trim();

  // Validating object Id
  if (!productId || !isValidObjectId(productId)) {
    throw new BadRequestError('Invalid product ID format.');
  }

  const product = await Product.findById(productId).populate('genre brand');
  if (!product) {
    throw new NotFoundError('No Product found.');
  }

  res.status(200).json({
    success: true,
    message: 'Product fetched successfully.',
    data: product,
  });
};

/**
 * @route POST - admin/products
 * @desc  Admin - Adding a product
 * @access Private
 */
export const addProduct = async (req, res) => {
  const { name, price, genre, platform, brand, stock, description, images } =
    await productSchema.validateAsync(req.body, {
      abortEarly: false,
    });

  // Checking for brand
  const brandExist = await Brand.findOne({ name: brand });
  if (!brandExist) {
    throw new NotFoundError('This Brand is not available.');
  }

  // Checking for genre
  const genreExist = await Genre.findOne({ name: genre });
  if (!genreExist) {
    throw new NotFoundError('This Genre is not available.');
  }

  await Product.create({
    name,
    price,
    images,
    genre: genreExist._id,
    platform,
    brand: brandExist._id,
    stock,
    description,
  });

  res.status(200).json({
    success: true,
    message: 'Product added successfully',
    data: null,
  });
};

/**
 * @route PUT - admin/products
 * @desc  Admin - Editing a product
 * @access Private
 */
export const editProduct = async (req, res) => {
  const { productId } = req.body;
  console.log(req.body);
  // Validating object Id
  if (!productId || !isValidObjectId(productId.trim())) {
    throw new BadRequestError('Invalid product ID format.');
  }

  const updatedProduct = await editProductSchema.validateAsync(req.body, {
    abortEarly: false,
  });

  // Checking for the product
  const oldProduct = await Product.findById({ _id: productId });
  if (!oldProduct) {
    throw new NotFoundError('No Product found.');
  }

  if (updatedProduct.brand) {
    // Checking for brand if brand is updated
    const brandExist = await Brand.findOne({ name: updatedProduct.brand });
    if (!brandExist) {
      throw new NotFoundError('This Brand is not available.');
    }

    oldProduct.brand = brandExist._id;
  }

  if (updatedProduct.genre) {
    // Checking for genre if genre is updated
    const genreExist = await Genre.findOne({ name: updatedProduct.genre });
    if (!genreExist) {
      throw new NotFoundError('This Genre is not available.');
    }

    oldProduct.genre = genreExist._id;
  }

  // Looping through updated product
  Object.keys(updatedProduct).forEach((key) => {
    if (key !== 'brand' && key !== 'genre') {
      oldProduct[key] = updatedProduct[key];
    }
  });

  await oldProduct.save();

  res.status(200).json({
    success: true,
    message: 'Product updated successfully.',
    data: oldProduct,
  });
};

/**
 * @route PATCH - admin/products
 * @desc  Admin -  Toggling product listing
 * @access Private
 */
export const toggleProductList = async (req, res) => {
  const { productId } = req.body;

  // Validating Object Id
  if (!productId || !isValidObjectId(productId)) {
    throw new BadRequestError('Invalid product ID format.');
  }

  // Checking for product
  const product = await Product.findById({ _id: productId });
  if (!product) {
    throw new NotFoundError('No Product found');
  }

  // Toggling the product status
  product.isActive = !product.isActive;
  await product.save();

  res.status(200).json({
    success: true,
    message: `Product ${
      product.isActive ? 'Listed' : 'UnListed'
    } successfully.`,
    data: product,
  });
};

// User side

/**
 * @route GET - user/products
 * @desc  User - Listing specific products
 * @access Private
 */
export const getProducts = async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;

  // Custom query options
  const queryOptions = {
    populate: [
      { path: 'genre', select: 'name -_id' },
      { path: 'brand', select: 'name -_id' },
    ],
  };

  // Function to paginate the data
  const products = await paginate(Product, page, limit, queryOptions);

  if (products?.result?.length === 0) {
    throw new NotFoundError('No products found');
  }

  console.log(products);

  res.status(200).json({
    success: true,
    message: 'User products',
    data: {
      products: products.result,
      totalPages: products.totalPages,
      currentPage: products.currentPage,
    },
  });
};
