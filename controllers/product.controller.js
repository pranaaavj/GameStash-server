import {
  productSchema,
  editProductSchema,
} from '../validations/admin.validations.js';
import Brand from '../models/brand.model.js';
import Genre from '../models/genre.model.js';
import Product from '../models/product.model.js';
import mongoose, { isValidObjectId } from 'mongoose';
import { aggregatePaginate, paginate } from '../utils/index.js';
import {
  NotFoundError,
  BadRequestError,
  InternalServerError,
} from '../errors/index.js';
import cloudinary from '../config/cloudinary.js';

/*****************************************/
// Products CRUD - Admin
/*****************************************/

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
      {
        path: 'bestOffer',
        select: 'name type discountValue discountType endDate',
      },
    ],
  };

  const products = await paginate(Product, page, limit, queryOptions);

  res.status(200).json({
    success: true,
    message: 'All products retrieved successfully.',
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
    throw new BadRequestError(
      'The product ID format seems incorrect. Please check and try again.'
    );
  }

  const product = await Product.findById(productId).populate('genre brand');
  if (!product) {
    throw new NotFoundError('We couldn’t find the specified product.');
  }

  res.status(200).json({
    success: true,
    message: 'Product retrieved successfully.',
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

  console.log(typeof price);

  const brandExist = await Brand.findById(brand);
  if (!brandExist) {
    throw new NotFoundError('The specified brand is not available.');
  }

  const genreExist = await Genre.findById(genre);
  if (!genreExist) {
    throw new NotFoundError('The specified genre is not available.');
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
    message: 'Product added successfully.',
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

  // Validating object Id
  if (!productId || !isValidObjectId(productId.trim())) {
    throw new BadRequestError(
      'The product ID format seems incorrect. Please check and try again.'
    );
  }

  const updatedProduct = await editProductSchema.validateAsync(req.body, {
    abortEarly: false,
  });

  // Checking for the product
  const oldProduct = await Product.findById({ _id: productId });
  if (!oldProduct) {
    throw new NotFoundError('We couldn’t find the specified product.');
  }

  if (updatedProduct.brand) {
    // Checking for brand if brand is updated
    const brandExist = await Brand.findById(updatedProduct.brand);
    if (!brandExist) {
      throw new NotFoundError('The specified brand is not available.');
    }
    oldProduct.brand = brandExist._id;
  }

  if (updatedProduct.genre) {
    // Checking for genre if genre is updated
    const genreExist = await Genre.findById(updatedProduct.genre);
    if (!genreExist) {
      throw new NotFoundError('The specified genre is not available.');
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
 * @desc  Admin - Toggling product listing
 * @access Private
 */
export const toggleProductList = async (req, res) => {
  const { productId } = req.body;

  // Validating Object Id
  if (!productId || !isValidObjectId(productId)) {
    throw new BadRequestError(
      'The product ID format seems incorrect. Please check and try again.'
    );
  }

  // Checking for product
  const product = await Product.findById({ _id: productId });
  if (!product) {
    throw new NotFoundError('We couldn’t find the specified product.');
  }

  // Toggling the product status
  product.isActive = !product.isActive;
  await product.save();

  res.status(200).json({
    success: true,
    message: `Product ${
      product.isActive ? 'activated' : 'deactivated'
    } successfully.`,
    data: product,
  });
};

/**
 * @route POST admin/images/upload
 * @desc Upload image to Cloudinary
 * @access Private
 */
export const uploadImageCloudinary = async (req, res, next) => {
  try {
    if (!req.file) {
      throw new BadRequestError('No file uploaded.');
    }

    cloudinary.uploader
      .upload_stream({ folder: 'products' }, (error, uploadedImage) => {
        if (error) {
          return next(new InternalServerError('Cloudinary upload failed.'));
        }

        res.status(200).json({
          success: true,
          message: 'Image uploaded successfully',
          data: {
            url: uploadedImage.secure_url,
            publicId: uploadedImage.public_id,
          },
        });
      })
      .end(req.file.buffer);
  } catch (error) {
    next(error);
  }
};
/**
 * @route DELETE admin/images/:public_id
 * @desc Delete image from Cloudinary
 * @access Private
 */
export const deleteImageCloudinary = async (req, res, next) => {
  try {
    const { public_id } = req.params;

    console.log(public_id);
    if (!public_id) {
      throw new BadRequestError('Public ID is required.');
    }

    const fullPublicId = `products/${public_id}`;
    const response = await cloudinary.uploader.destroy(fullPublicId);
    if (response.result !== 'ok') {
      throw new InternalServerError('Failed to delete image from Cloudinary.');
    }

    res.status(200).json({
      success: true,
      message: 'Image deleted successfully',
    });
  } catch (error) {
    next(error);
  }
};

/*****************************************/
// Products listing - User Side
/*****************************************/

/**
 * @route GET - user/products
 * @desc  User - Listing all products
 * @access Public
 */
export const getProducts = async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const type = req.query.type || 'latest';

  const filter = { isActive: true };
  let sort = { createdAt: -1 };

  if (type === 'toprated') {
    sort = { averageRating: -1 };
  } else if (type === 'discounted') {
    filter.bestOffer = { $ne: null };
    sort = { 'bestOffer.discountValue': -1 };
  }

  const queryOptions = {
    filter,
    sort,
    populate: [
      {
        from: 'genres',
        localField: 'genre',
        foreignField: '_id',
        as: 'genreData',
        single: true,
      },
      {
        from: 'brands',
        localField: 'brand',
        foreignField: '_id',
        as: 'brandData',
        single: true,
      },
      {
        from: 'offers',
        localField: 'bestOffer',
        foreignField: '_id',
        as: 'bestOffer',
        match: { isActive: true },
        single: true,
      },
    ],
    // Custom pipeline stages to add after the populate stages
    additionalPipeline: [
      // Filter out products with inactive brands or genres
      {
        $match: {
          $and: [
            { 'genreData.isActive': true },
            { 'brandData.isActive': true },
          ],
        },
      },
    ],
  };

  // Function to paginate the data
  const products = await aggregatePaginate(Product, page, limit, queryOptions);

  res.status(200).json({
    success: true,
    message: 'Available products retrieved successfully.',
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
    throw new BadRequestError(
      'The product ID format seems incorrect. Please check and try again.'
    );
  }

  const product = await Product.findById(productId).populate(
    'genre brand bestOffer'
  );
  if (!product) {
    throw new NotFoundError('We couldn’t find the specified product.');
  }

  res.status(200).json({
    success: true,
    message: 'Product details retrieved successfully.',
    data: product,
  });
};

/**
 * @route GET - /products/:genre
 * @desc  User - Getting products by genre
 * @access Public
 */
export const getProductsByGenre = async (req, res) => {
  const genreName = req.params.genre;
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;

  if (!genreName) {
    throw new BadRequestError('Genre must be specified.');
  }

  const genre = await Genre.findOne({ name: genreName });
  if (!genre) {
    throw new NotFoundError('We couldn’t find the specified genre.');
  }

  // Custom query options
  const queryOptions = {
    filter: { genre: genre._id, isActive: true },
    populate: [
      { path: 'genre', select: 'name isActive', match: { isActive: true } },
      { path: 'brand', select: 'name isActive', match: { isActive: true } },
    ],
    sort: { updatedAt: -1 },
  };

  const products = await paginate(Product, page, limit, queryOptions);

  res.status(200).json({
    success: true,
    message: 'Products by genre retrieved successfully.',
    data: {
      products: products.result,
      totalPages: products.totalPages,
      currentPage: products.currentPage,
    },
  });
};

/**
 * @route GET - /product/related
 * @desc  User - Getting related products
 * @access Public
 */
export const getRelatedProducts = async (req, res) => {
  const { productId } = req.params;
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;

  if (!productId) {
    throw new BadRequestError('Product ID must be specified.');
  }

  const product = await Product.findById(productId);
  if (!product) {
    throw new NotFoundError('Product not found.');
  }

  const genreId = product.genre;

  const queryOptions = {
    filter: {
      genre: genreId,
      isActive: true,
      _id: { $ne: productId },
    },
    populate: [
      { path: 'genre', select: 'name isActive', match: { isActive: true } },
      { path: 'brand', select: 'name isActive', match: { isActive: true } },
    ],
    sort: { updatedAt: -1 },
  };

  const products = await paginate(Product, page, limit, queryOptions);

  res.status(200).json({
    success: true,
    message: 'Related products retrieved successfully.',
    data: {
      products: products.result,
      totalPages: products.totalPages,
      currentPage: products.currentPage,
    },
  });
};

/**
 * @route GET - /products/search
 * @desc  User - User searching products
 * @access Public
 */
export const searchProducts = async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;

  const { search, sort, genres, brands } = req.query;

  const matchStage = { isActive: true };

  if (search) {
    const searchRegex = new RegExp(search, 'i');

    matchStage.$or = [{ name: searchRegex }, { description: searchRegex }];
  }

  const pipeline = [{ $match: matchStage }];

  pipeline.push(
    {
      $lookup: {
        from: 'genres',
        localField: 'genre',
        foreignField: '_id',
        as: 'genre',
      },
    },
    {
      $unwind: {
        path: '$genre',
        preserveNullAndEmptyArrays: true,
      },
    },
    {
      $lookup: {
        from: 'brands',
        localField: 'brand',
        foreignField: '_id',
        as: 'brand',
      },
    },
    {
      $unwind: {
        path: '$brand',
        preserveNullAndEmptyArrays: true,
      },
    },
    {
      $lookup: {
        from: 'offers',
        localField: 'bestOffer',
        foreignField: '_id',
        as: 'bestOffer',
      },
    },
    {
      $unwind: {
        path: '$bestOffer',
        preserveNullAndEmptyArrays: true,
      },
    }
  );

  if (search) {
    const searchRegex = new RegExp(search, 'i');
    pipeline.push({
      $match: {
        $or: [
          { name: searchRegex },
          { 'genre.name': searchRegex },
          { 'brand.name': searchRegex },
        ],
      },
    });
  }

  pipeline.push({
    $match: {
      $and: [
        { 'genre.isActive': true },
        { 'brand.isActive': true },
        {
          $or: [{ bestOffer: { $eq: null } }, { 'bestOffer.isActive': true }],
        },
      ],
    },
  });

  if (genres) {
    pipeline.push({
      $match: {
        'genre._id': {
          $in: genres.split(',').map((id) => new mongoose.Types.ObjectId(id)),
        },
      },
    });
  }

  if (brands) {
    pipeline.push({
      $match: {
        'brand._id': {
          $in: brands.split(',').map((id) => new mongoose.Types.ObjectId(id)),
        },
      },
    });
  }

  const sortStage = {};

  if (sort) {
    const [key, order] = sort.split(':');

    if (key === 'price') {
      pipeline.push({
        $addFields: {
          sortPrice: {
            $cond: [
              { $gt: ['$discountedPrice', 0] },
              '$discountedPrice',
              '$price',
            ],
          },
        },
      });
      sortStage['sortPrice'] = order === 'desc' ? -1 : 1;
    } else {
      sortStage[key] = order === 'desc' ? -1 : 1;
    }
  } else {
    sortStage['popularity'] = -1;
  }

  sortStage['_id'] = 1;

  pipeline.push({ $sort: sortStage });
  pipeline.push({ $skip: (page - 1) * limit }, { $limit: limit });

  const products = await Product.aggregate(pipeline).exec();

  const countPipeline = [{ $match: matchStage }];

  countPipeline.push(
    {
      $lookup: {
        from: 'genres',
        localField: 'genre',
        foreignField: '_id',
        as: 'genre',
      },
    },
    {
      $unwind: {
        path: '$genre',
        preserveNullAndEmptyArrays: true,
      },
    },
    {
      $lookup: {
        from: 'brands',
        localField: 'brand',
        foreignField: '_id',
        as: 'brand',
      },
    },
    {
      $unwind: {
        path: '$brand',
        preserveNullAndEmptyArrays: true,
      },
    }
  );

  if (search) {
    const searchRegex = new RegExp(search, 'i');
    countPipeline.push({
      $match: {
        $or: [
          { name: searchRegex },
          { 'genre.name': searchRegex },
          { 'brand.name': searchRegex },
        ],
      },
    });
  }

  countPipeline.push({
    $match: {
      $and: [{ 'genre.isActive': true }, { 'brand.isActive': true }],
    },
  });

  if (genres) {
    countPipeline.push({
      $match: {
        'genre._id': {
          $in: genres.split(',').map((id) => new mongoose.Types.ObjectId(id)),
        },
      },
    });
  }

  if (brands) {
    countPipeline.push({
      $match: {
        'brand._id': {
          $in: brands.split(',').map((id) => new mongoose.Types.ObjectId(id)),
        },
      },
    });
  }

  countPipeline.push({ $count: 'total' });
  const countResult = await Product.aggregate(countPipeline).exec();
  const total = countResult.length > 0 ? countResult[0].total : 0;

  res.status(200).json({
    success: true,
    message: 'Search results retrieved successfully.',
    data: {
      products,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
    },
  });
};
