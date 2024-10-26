import { NotFoundError } from '../errors/index.js';
import Product from '../models/product.model.js';
import Brand from '../models/brand.model.js';
import Genre from '../models/genre.model.js';
import { paginate } from '../utils/index.js';
import { productSchema } from '../validations/admin.validations.js';

/**
 * @route GET - admin/products
 * @desc  Admin - Listing all products
 * @access Private
 */
export const getProducts = async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;

  // const skip = (page - 1) * limit;
  // const total = await Product.countDocuments();
  // const products = await Product.find().lean().skip(skip).limit(limit);

  // Function to paginate the data
  const products = await paginate(Product, page, limit);

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
 * @route POST - admin/products
 * @desc  Admin - Adding a product
 * @access Private
 */
export const addProduct = async (req, res) => {
  const { name, price, genre, platform, brand, stock, description } =
    await productSchema.validateAsync(req.body, {
      abortEarly: false,
    });

  const brandExist = await Brand.findOne({ name: brand });
  if (!brandExist) {
    throw new NotFoundError('This brand is not available.');
  }

  const genreExist = await Genre.findOne({ name: genre });
  if (!genreExist) {
    throw new NotFoundError('This genre is not available.');
  }
  console.log(genreExist, brandExist);
  await Product.create({
    name,
    price,
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
