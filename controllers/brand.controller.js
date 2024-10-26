import { paginate } from '../utils/index.js';
import { NotFoundError } from '../errors/index.js';
import Brand from '../models/brand.model.js';

/**
 * @route GET - admin/brands
 * @desc  Admin - Listing all brands
 * @access Private
 */
export const getBrands = async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;

  const brands = await paginate(Brand, page, limit);

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
