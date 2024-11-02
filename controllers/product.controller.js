import { NotFoundError, BadRequestError } from '../errors/index.js';
import {
  productSchema,
  editProductSchema,
} from '../validations/admin.validations.js';
import Product from '../models/product.model.js';
import Brand from '../models/brand.model.js';
import Genre from '../models/genre.model.js';
import { aggregatePaginate, paginate } from '../utils/index.js';
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
 * @desc  Admin - Getting one product
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
  const {
    name,
    price,
    genre,
    platform,
    brand,
    stock,
    description,
    images,
    systemRequirements,
  } = await productSchema.validateAsync(req.body, {
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
    systemRequirements,
  });

  res.status(201).json({
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

  res.status(204).json({
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

  res.status(204).json({
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
 * @access Public
 */
export const getProducts = async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;

  // Custom query options
  const queryOptions = {
    filter: { isActive: true },
    populate: [
      {
        from: 'genres',
        localField: 'genre',
        as: 'genre',
        match: { isActive: true },
        single: true,
      },
      {
        from: 'brands',
        localField: 'brand',
        as: 'brand',
        match: { isActive: true },
        single: true,
      },
    ],
  };

  // Function to paginate the data
  const products = await aggregatePaginate(Product, page, limit, queryOptions);

  if (products?.result?.length === 0) {
    throw new NotFoundError('No products found');
  }

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

/**
 * @route GET - /product/:productId
 * @desc  User - Getting one product
 * @access Public
 */
export const getProduct = async (req, res) => {
  const productId = req.params.productId.trim();

  // Validating object Id
  if (!productId || !isValidObjectId(productId)) {
    throw new BadRequestError('Invalid product ID format.');
  }

  const product = await Product.findById(productId).populate('genre brand');
  if (!product) {
    throw new NotFoundError('No Product found.');
  }
  console.log(product);
  res.status(200).json({
    success: true,
    message: 'Product fetched successfully.',
    data: product,
  });
};

/**
 * @route GET - /products/:genre
 * @desc  User - Getting one product by the genre
 * @access Public
 */
export const getProductsByGenre = async (req, res) => {
  const genreName = req.params.genre;
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;

  if (!genreName) {
    throw new BadRequestError('Genre must be provided');
  }

  const genre = await Genre.findOne({ name: genreName });
  if (!genre) {
    throw new NotFoundError('Genre not found.');
  }

  const queryOptions = {
    filter: { genre: genre._id, isActive: true },
    populate: [
      { path: 'genre', select: 'name isActive', match: { isActive: true } },
      { path: 'brand', select: 'name isActive', match: { isActive: true } },
    ],
    sort: { updatedAt: -1 },
  };

  const products = await paginate(Product, page, limit, queryOptions);

  if (products?.result?.length === 0) {
    throw new NotFoundError('No active products found for this genre.');
  }

  res.status(200).json({
    success: true,
    message: 'Products fetched successfully.',
    data: {
      products: products.result,
      totalPages: products.totalPages,
      currentPage: products.currentPage,
    },
  });
};
