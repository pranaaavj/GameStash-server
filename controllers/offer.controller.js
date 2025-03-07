import Offer from '../models/offer.model.js';
import Product from '../models/product.model.js';
import Brand from '../models/brand.model.js';
import { paginate } from '../utils/paginate.js';
import { offerSchema } from '../validations/admin.validations.js';
import { isValidObjectId } from 'mongoose';
import { NotFoundError, BadRequestError } from '../errors/index.js';
import { selectBestOfferForProduct } from '../utils/bestOfferForProduct.js';

/**
 * @route POST - admin/offers
 * @desc  Admin - Create a new offer
 * @access Private
 */
export const addOffer = async (req, res) => {
  const {
    name,
    type,
    targetId,
    discountType,
    discountValue,
    startDate,
    endDate,
  } = await offerSchema.validateAsync(req.body, {
    abortEarly: false,
  });

  const targetExists =
    type === 'Product'
      ? await Product.findById(targetId)
      : await Brand.findById(targetId);

  if (!targetExists) {
    throw new NotFoundError(
      `${type} not found. Please provide a valid ${type} ID.`
    );
  }

  if (
    type === 'Product' &&
    discountType === 'amount' &&
    discountValue > targetExists.price
  ) {
    throw new BadRequestError(
      'Discount amount cannot exceed the product price.'
    );
  }

  if (
    discountType === 'percentage' &&
    (discountValue < 1 || discountValue > 80)
  ) {
    throw new BadRequestError(
      'Invalid percentage value. Must be between 0 and 80.'
    );
  }

  if (discountType !== 'percentage' && type === 'Brand') {
    throw new BadRequestError(
      'Only percentage discounts are allowed for brands.'
    );
  }

  const currentDate = new Date();
  currentDate.setHours(0, 0, 0, 0);

  const parsedStartDate = new Date(startDate);
  parsedStartDate.setHours(0, 0, 0, 0);

  const newOffer = await Offer.create({
    name,
    type,
    targetId,
    discountType,
    discountValue,
    startDate,
    endDate,
    isActive: currentDate >= parsedStartDate,
  });

  if (type === 'Product') {
    await Product.findByIdAndUpdate(targetId, {
      $push: { applicableOffers: newOffer._id },
    });

    await selectBestOfferForProduct(targetId);
  } else if (type === 'Brand') {
    const products = await Product.find({ brand: targetId });

    for (const product of products) {
      product.applicableOffers.push(newOffer._id);
      await product.save();

      await selectBestOfferForProduct(product._id);
    }
  }

  res.status(201).json({
    success: true,
    message: 'Offer created successfully.',
    data: newOffer,
  });
};

/**
 * @route GET - admin/offers
 * @desc  Admin - Listing all offers
 * @access Private
 */
export const getAllOffers = async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;

  // Custom query options
  const queryOptions = {
    sort: { updatedAt: -1 },
    populate: [{ path: 'targetId', select: 'name' }],
  };

  const offers = await paginate(Offer, page, limit, queryOptions);

  res.status(200).json({
    success: true,
    message: 'All Offers retrieved successfully',
    data: {
      offers: offers.result,
      totalPages: offers.totalPages,
      currentPage: offers.currentPage,
    },
  });
};

/**
 * @route GET - admin/offers/:offerId
 * @desc  Admin - Get one offer
 * @access Private
 */
export const getOneOffer = async (req, res) => {
  const { offerId } = req.params;

  if (!offerId || !isValidObjectId(offerId)) {
    throw new BadRequestError('Invalid offer Id format.');
  }

  const offer = await Offer.findById(offerId).populate('targetId');
  if (!offer) {
    throw new NotFoundError('Offer not found.');
  }

  res.status(200).json({
    success: true,
    message: 'Offer retrieved successfully.',
    data: offer,
  });
};

/**
 * @route PUT - admin/offers/:offerId
 * @desc  Admin - Edit an offer
 * @access Private
 */
export const editOffer = async (req, res) => {
  const { offerId } = req.params;
  const {
    name,
    type,
    targetId,
    discountType,
    discountValue,
    startDate,
    endDate,
  } = req.body;

  if (!offerId || !isValidObjectId(offerId)) {
    throw new BadRequestError('Invalid offer Id format.');
  }

  const offer = await Offer.findById(offerId);
  if (!offer) {
    throw new NotFoundError('Offer not found.');
  }

  let targetExists = null;

  if (type !== offer.type || targetId !== String(offer.targetId)) {
    if (type == 'Brand') {
      targetExists = await Brand.findById(targetId);

      if (!targetExists) {
        throw new NotFoundError('The selected Brand does not exist.');
      }
    } else if (type === 'Product') {
      targetExists = await Product.findById(targetId);

      if (!targetExists) {
        throw new NotFoundError(
          'Product not found. Please provide a valid product ID.'
        );
      }
    }

    offer.type = type;
    offer.targetId = targetId;
  }

  if (offer.type === 'Brand' && discountType !== 'percentage') {
    throw new BadRequestError(
      'Brands can only have percentage-based discounts.'
    );
  }

  if (type === 'Product' && discountType === 'amount') {
    const target = targetExists || (await Product.findById(offer.targetId));

    if (target && discountValue > target.price) {
      throw new BadRequestError(
        'Discount amount cannot exceed the product price.'
      );
    }
  }

  if (
    discountType === 'percentage' &&
    (discountValue < 1 || discountValue > 80)
  ) {
    throw new BadRequestError(
      'Invalid percentage value. Must be between 1% and 80%.'
    );
  }

  const currentDate = new Date();
  currentDate.setHours(0, 0, 0, 0);

  const newStartDate = startDate ? new Date(startDate) : offer.startDate;
  newStartDate.setHours(0, 0, 0, 0);

  const newEndDate = endDate ? new Date(endDate) : offer.endDate;
  newEndDate.setHours(23, 59, 59, 999);

  if (currentDate > offer.endDate) {
    throw new BadRequestError('Expired offers cannot be edited.');
  }

  if (newStartDate < currentDate) {
    throw new BadRequestError('Start date must be in the future.');
  }

  if (newEndDate < newStartDate) {
    throw new BadRequestError('End date must be after the start date.');
  }

  if (
    startDate &&
    newStartDate < currentDate &&
    offer.startDate >= currentDate
  ) {
    throw new BadRequestError('Cannot change start date to a past date.');
  }

  offer.name = name || offer.name;
  offer.discountType = discountType || offer.discountType;
  offer.discountValue = discountValue || offer.discountValue;
  offer.startDate = startDate || offer.startDate;
  offer.endDate = endDate || offer.endDate;
  offer.isActive = currentDate >= newStartDate;

  await offer.save();

  if (type === 'Product') {
    await selectBestOfferForProduct(targetId);
  } else if (type === 'Brand') {
    const products = await Product.find({ brand: targetId });

    for (const product of products) {
      await selectBestOfferForProduct(product._id);
    }
  }

  res.status(200).json({
    success: true,
    message: 'Offer updated successfully.',
    data: offer,
  });
};

/**
 * @route PATCH - admin/offers/:offerId
 * @desc  Admin - Delete an offer
 * @access Private
 */
export const toggleOfferList = async (req, res) => {
  const { offerId } = req.params;

  if (!offerId || !isValidObjectId(offerId)) {
    throw new BadRequestError('Invalid offer Id format.');
  }

  const offer = await Offer.findById(offerId);
  if (!offer) {
    throw new NotFoundError('Offer not found.');
  }

  offer.isActive = !offer.isActive;
  await offer.save();

  res.status(200).json({
    success: true,
    message: `Offer ${offer.isActive ? 'listed' : 'unlisted'} successfully.`,
    data: null,
  });
};
