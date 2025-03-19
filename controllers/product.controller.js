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
 * @desc  User - Listing all  products
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
      {
        from: 'offers',
        localField: 'bestOffer',
        as: 'bestOffer',
        match: { isActive: true },
        single: true,
      },
    ],
  };

  // Function to paginate the data
  const products = await aggregatePaginate(Product, page, limit, queryOptions);

  if (products?.result?.length === 0) {
    throw new NotFoundError('No active products found.');
  }

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

  if (products?.result?.length === 0) {
    throw new NotFoundError('No active products found for this genre.');
  }

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
 * @route GET - /products/search
 * @desc  User - User searching products
 * @access Public
 */
export const searchProducts = async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;

  // Extract search, filters, and sorting options
  const { search, sort, priceRange, genres, brands, offers } = req.query;

  const matchStage = { isActive: true };

  if (search) {
    matchStage.$text = { $search: search }; // Requires text index
  }

  if (priceRange) {
    const [min, max] = priceRange.split('-').map(Number);
    matchStage.price = {
      $gte: min || 0,
      $lte: max || Number.MAX_SAFE_INTEGER,
    };
  }

  if (offers) {
    const { discounted, bundle } = offers;
    if (discounted === 'true') {
      matchStage.discount = { $gt: 0 };
    }
    if (bundle === 'true') {
      matchStage.bundle = true;
    }
  }

  // Build the aggregation pipeline
  const pipeline = [{ $match: matchStage }];

  // Add lookup stages for genres and brands
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
      $match: genres
        ? {
            'genre._id': {
              $in: genres
                .split(',')
                .map((id) => new mongoose.Types.ObjectId(id)),
            },
          }
        : {},
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
      $match: brands
        ? {
            'brand._id': {
              $in: brands
                .split(',')
                .map((id) => new mongoose.Types.ObjectId(id)),
            },
          }
        : {},
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

  // Add sorting stage
  const sortOptions = {};
  if (sort) {
    const [key, order] = sort.split(':');
    sortOptions[key] = order === 'desc' ? -1 : 1;
  }

  if (Object.keys(sortOptions).length) {
    pipeline.push({ $sort: sortOptions });
  }

  // Add pagination stages
  pipeline.push({ $skip: (page - 1) * limit }, { $limit: limit });

  // Execute the aggregation
  const products = await Product.aggregate(pipeline).exec();
  const total = await Product.countDocuments(matchStage);

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

// /**
//   @route GET - /products/search
//   @desc  User - User searching products
//  @access Public
//  /
// export const searchProducts = async (req, res) => {
//   const page = parseInt(req.query.page) || 1;
//   const limit = parseInt(req.query.limit) || 10;

//   const { search, sort, priceRange, genres, brands, offers } = req.query;

//   const matchStage = { isActive: true };

//   if (search) {
//     matchStage.$text = { $search: search };
//   }

//   if (priceRange) {
//     const [min, max] = priceRange.split('-').map(Number);
//     matchStage.price = {
//       $gte: min || 0,
//       $lte: max || Number.MAX_SAFE_INTEGER,
//     };
//   }

//   if (offers) {
//     const { discounted, bundle } = offers;
//     if (discounted === 'true') {
//       matchStage.discount = { $gt: 0 };
//     }
//     if (bundle === 'true') {
//       matchStage.bundle = true;
//     }
//   }

//   const genreMatch = genres
//     ? {
//         'genre._id': {
//           $in: genres.split(',').map((id) => new mongoose.Types.ObjectId(id)),
//         },
//       }
//     : {};

//   const brandMatch = brands
//     ? {
//         'brand._id': {
//           $in: brands.split(',').map((id) => new mongoose.Types.ObjectId(id)),
//         },
//       }
//     : {};

//   const sortOptions = {};
//   if (sort) {
//     const [key, order] = sort.split(':');
//     sortOptions[key] = order === 'desc' ? -1 : 1;
//   }

//   if (search) {
//     sortOptions.textScore = { $meta: 'textScore' };
//   }

//   const sharedPipeline = [
//     { $match: matchStage },
//     {
//       $lookup: {
//         from: 'genres',
//         localField: 'genre',
//         foreignField: '_id',
//         as: 'genre',
//       },
//     },
//     {
//       $unwind: {
//         path: '$genre',
//         preserveNullAndEmptyArrays: true,
//       },
//     },
//     { $match: genreMatch },
//     {
//       $lookup: {
//         from: 'brands',
//         localField: 'brand',
//         foreignField: '_id',
//         as: 'brand',
//       },
//     },
//     {
//       $unwind: {
//         path: '$brand',
//         preserveNullAndEmptyArrays: true,
//       },
//     },
//     { $match: brandMatch },
//   ];

//   const productsPipeline = [...sharedPipeline];

//   if (Object.keys(sortOptions).length) {
//     productsPipeline.push({ $sort: sortOptions });
//   }

//   productsPipeline.push(
//     { $skip: (page - 1) * limit },
//     { $limit: limit },
//     {
//       $project: {
//         name: 1,
//         price: 1,
//         averageRating: 1,
//         images: 1,
//         'genre.name': 1,
//         'brand.name': 1,
//         platform: 1,
//         ...(search && { textScore: { $meta: 'textScore' } }),
//       },
//     }
//   );

//   const totalCountPipeline = [...sharedPipeline, { $count: 'count' }];

//   const [results] = await Product.aggregate([
//     {
//       $facet: {
//         products: productsPipeline,
//         totalCount: totalCountPipeline,
//       },
//     },
//   ]);

//   const products = results.products || [];
//   const total = results.totalCount.length > 0 ? results.totalCount[0].count : 0;

//   res.status(200).json({
//     success: true,
//     message: 'Search results retrieved successfully.',
//     data: {
//       products,
//       totalPages: Math.ceil(total / limit),
//       currentPage: page,
//     },
//   });
// };
