import Coupon from '../models/coupon.model.js';
import {
  couponSchema,
  editCouponSchema,
} from '../validations/admin.validations.js';
import { BadRequestError } from '../errors/index.js';
import { isValidObjectId } from 'mongoose';
import { paginate } from '../utils/paginate.js';

/**
 * @route POST - /admin/coupons
 * @desc  Admin - Create a new coupon
 * @access Private
 */
export const addCoupon = async (req, res) => {
  let {
    code,
    discountType,
    discountValue,
    minOrderAmount,
    maxDiscountAmount,
    usageLimit,
    perUserLimit,
    startDate,
    endDate,
  } = await couponSchema.validateAsync(req.body, {
    abortEarly: false,
  });

  const existingCoupon = await Coupon.findOne({ code: code.toUpperCase() });
  if (existingCoupon) {
    throw new BadRequestError('Coupon code already exists.');
  }

  if (discountType === 'amount') {
    maxDiscountAmount = null;
  }

  const currentDate = new Date();
  currentDate.setHours(0, 0, 0, 0);

  const parsedStartDate = new Date(startDate);
  parsedStartDate.setHours(0, 0, 0, 0);

  const parsedEndDate = new Date(endDate);
  parsedEndDate.setHours(23, 59, 59, 999);

  const newCoupon = await Coupon.create({
    code: code.toUpperCase(),
    discountType,
    discountValue,
    minOrderAmount,
    maxDiscountAmount,
    usageLimit,
    perUserLimit,
    startDate: parsedStartDate,
    endDate: parsedEndDate,
    isActive: currentDate >= parsedStartDate,
  });

  res.status(201).json({
    success: true,
    message: 'Coupon created successfully.',
    data: newCoupon,
  });
};

/**
 * @route PUT - admin/coupons/:couponId
 * @desc  Admin - Edit an existing coupon
 * @access Private
 */
export const editCoupon = async (req, res) => {
  const { couponId } = req.params;
  let {
    name,
    code,
    discountType,
    discountValue,
    minOrderAmount,
    maxDiscountAmount,
    usageLimit,
    perUserLimit,
    startDate,
    endDate,
    isActive,
  } = await editCouponSchema.validateAsync(req.body, {
    abortEarly: false,
  });

  if (!couponId || !isValidObjectId(couponId)) {
    throw new BadRequestError('Invalid coupon ID format.');
  }

  const coupon = await Coupon.findById(couponId);
  if (!coupon) {
    throw new NotFoundError('Coupon not found.');
  }
  console.log(discountType);
  if (discountType === 'amount') {
    maxDiscountAmount = null;
  }

  const currentDate = new Date();
  currentDate.setHours(0, 0, 0, 0);

  if (currentDate > coupon.endDate) {
    throw new BadRequestError('Expired coupons cannot be edited.');
  }

  const parsedStartDate = startDate ? new Date(startDate) : coupon.startDate;
  parsedStartDate.setHours(0, 0, 0, 0);

  const parsedEndDate = endDate ? new Date(endDate) : coupon.endDate;
  parsedEndDate.setHours(23, 59, 59, 999);

  if (
    parsedStartDate.getTime() !== coupon.startDate.getTime() &&
    parsedStartDate < currentDate
  ) {
    throw new BadRequestError('Coupon start date must be in the future.');
  }

  coupon.name = name || coupon.name;
  coupon.code = code || coupon.code;
  coupon.discountType = discountType || coupon.discountType;
  coupon.discountValue = discountValue || coupon.discountValue;
  coupon.minOrderAmount = minOrderAmount ?? coupon.minOrderAmount;
  coupon.maxDiscountAmount = maxDiscountAmount;
  coupon.usageLimit = usageLimit ?? coupon.usageLimit;
  coupon.perUserLimit = perUserLimit ?? coupon.perUserLimit;
  coupon.startDate = parsedStartDate;
  coupon.endDate = parsedEndDate;
  coupon.isActive = isActive ?? coupon.isActive;

  await coupon.save();

  res.status(200).json({
    success: true,
    message: 'Coupon updated successfully.',
    data: coupon,
  });
};

/**
 * @route PATCH - admin/coupons/:couponId
 * @desc  Admin - Toggling coupon listing
 * @access Private
 */
export const toggleCouponList = async (req, res) => {
  const { couponId } = req.params;

  if (!couponId || !isValidObjectId(couponId)) {
    throw new BadRequestError('Invalid coupon Id format.');
  }

  const coupon = await Coupon.findById(couponId);
  if (!coupon) {
    throw new NotFoundError('Coupon not found.');
  }

  coupon.isActive = !coupon.isActive;
  await coupon.save();

  res.status(200).json({
    success: true,
    message: `Coupon ${
      coupon.isActive ? 'activated' : 'deactivated'
    } successfully.`,
    data: null,
  });
};

/**
 * @route GET - admin/coupons
 * @desc  Admin - Listing all coupons
 * @access Private
 */
export const getAllCoupons = async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;

  const queryOptions = {
    sort: { updatedAt: -1 },
  };

  const coupons = await paginate(Coupon, page, limit, queryOptions);

  res.status(200).json({
    success: true,
    message: 'All coupons retrieved successfully.',
    data: {
      coupons: coupons.result,
      totalPages: coupons.totalPages,
      currentPage: coupons.currentPage,
    },
  });
};

/**
 * @route GET - admin/coupons/:couponId
 * @desc  Admin - Get one coupon
 * @access Private
 */
export const getOneCoupon = async (req, res) => {
  const { couponId } = req.params;

  if (!couponId || !isValidObjectId(couponId)) {
    throw new BadRequestError('Invalid coupon Id format.');
  }

  const coupon = await Coupon.findById(couponId);
  if (!coupon) {
    throw new NotFoundError('Coupon not found.');
  }

  res.status(200).json({
    success: true,
    message: 'Coupon retrieved successfully.',
    data: coupon,
  });
};
