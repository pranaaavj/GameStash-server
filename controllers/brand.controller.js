import { paginate } from '../utils/index.js';
import { NotFoundError, BadRequestError } from '../errors/index.js';
import Brand from '../models/brand.model.js';
import { brandSchema } from '../validations/admin.validations.js';
import { isValidObjectId } from 'mongoose';

/*****************************************/
// Admin - Brands CRUD
/*****************************************/

/**
 * @route GET - admin/brands
 * @desc  Admin - Listing all brands
 * @access Private
 */
export const getAllBrands = async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;

  // Custom query options
  const queryOptions = {
    sort: { updatedAt: -1 },
  };

  const brands = await paginate(Brand, page, limit, queryOptions);

  if (brands?.result?.length === 0) {
    throw new NotFoundError('No brands found');
  }

  res.status(200).json({
    success: true,
    message: 'All Brands',
    data: {
      brands: brands.result,
      totalPages: brands.totalPages,
      currentPage: brands.currentPage,
    },
  });
};

/**
 * @route GET - admin/brand/:brandId
 * @desc  Admin - Getting one Brand
 * @access Private
 */
export const getOneBrand = async (req, res) => {
  const brandId = req.params.brandId.trim();

  // Validating object Id
  if (!brandId || !isValidObjectId(brandId)) {
    throw new BadRequestError('Invalid brand ID format.');
  }

  const brand = await Brand.findById(brandId);
  if (!brand) {
    throw new NotFoundError('No Brand found.');
  }

  res.status(200).json({
    success: true,
    message: 'Brand fetched successfully.',
    data: brand,
  });
};

/**
 * @route POST - admin/brands
 * @desc  Admin - Adding a brand
 * @access Private
 */
export const addBrand = async (req, res) => {
  const { name, description } = await brandSchema.validateAsync(req.body, {
    abortEarly: false,
  });

  const existingBrand = await Brand.findOne({ name });
  if (existingBrand) {
    throw new BadRequestError('Brand already exists.');
  }

  await Brand.create({ name, description });

  res.status(200).json({
    success: true,
    message: 'Brand added successfully',
    data: null,
  });
};

/**
 * @route PUT - admin/brands
 * @desc  Admin - Editing a brand
 * @access Private
 */
export const editBrand = async (req, res) => {
  const { brandId, name, description } = req.body;

  if (!brandId || !isValidObjectId(brandId.trim())) {
    throw new BadRequestError('Invalid brand ID format.');
  }

  const brand = await Brand.findById(brandId);
  if (!brand) {
    throw new NotFoundError('No Brand found.');
  }

  brand.name = name || brand.name;
  brand.description = description || brand.description;

  await brand.save();

  res.status(200).json({
    success: true,
    message: 'Brand updated successfully.',
    data: brand,
  });
};

/**
 * @route PATCH - admin/brands
 * @desc  Admin - Toggling brand listing
 * @access Private
 */
export const toggleBrandList = async (req, res) => {
  const { brandId } = req.body;

  if (!brandId || !isValidObjectId(brandId)) {
    throw new BadRequestError('Invalid brand ID format.');
  }

  const brand = await Brand.findById(brandId);
  if (!brand) {
    throw new NotFoundError('No Brand found');
  }

  brand.isActive = !brand.isActive;
  await brand.save();

  res.status(200).json({
    success: true,
    message: `Brand ${brand.isActive ? 'Listed' : 'Unlisted'} successfully.`,
    data: brand,
  });
};

/*****************************************/
// User - Brands
/*****************************************/

/**
 * @route GET - user/brands
 * @desc  User - Listing all brands
 * @access Public
 */
export const getBrandsUser = async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;

  // Custom query options
  const queryOptions = {
    filter: { isActive: true },
    sort: { updatedAt: -1 },
    select: '_id name',
  };

  const brands = await paginate(Brand, page, limit, queryOptions);

  if (brands?.result?.length === 0) {
    throw new NotFoundError('No brands found');
  }

  res.status(200).json({
    success: true,
    message: 'All Brands',
    data: {
      brands: brands.result,
      totalPages: brands.totalPages,
      currentPage: brands.currentPage,
    },
  });
};
