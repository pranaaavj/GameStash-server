import Offer from '../models/offer.model.js';
import Product from '../models/product.model.js';
import Brand from '../models/brand.model.js';
import { paginate } from '../utils/paginate.js';
import {
  offerSchema,
  editOfferSchema,
} from '../validations/admin.validations.js';
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

  if (discountType !== 'percentage' && type === 'Brand') {
    throw new BadRequestError(
      'Only percentage discounts are allowed for brands.'
    );
  }

  const currentDate = new Date();
  currentDate.setHours(0, 0, 0, 0);

  const parsedStartDate = new Date(startDate);
  parsedStartDate.setHours(0, 0, 0, 0);

  const parsedEndDate = new Date(endDate);
  parsedEndDate.setHours(23, 59, 59, 999);

  const newOffer = await Offer.create({
    name,
    type,
    targetId,
    discountType,
    discountValue,
    startDate: parsedStartDate,
    endDate: parsedEndDate,
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
  } = await editOfferSchema.validateAsync(req.body, {
    abortEarly: false,
  });

  if (!offerId || !isValidObjectId(offerId)) {
    throw new BadRequestError('Invalid offer Id format.');
  }

  const offer = await Offer.findById(offerId);
  if (!offer) {
    throw new NotFoundError('Offer not found.');
  }

  let targetExists = null;

  const isTargetChanged =
    type !== offer.type ||
    targetId !== String(offer.targetId) ||
    discountValue !== offer.discountValue ||
    discountType !== offer.discountType;

  if (isTargetChanged) {
    targetExists =
      type === 'Brand'
        ? await Brand.findById(targetId)
        : await Product.findById(targetId);

    if (!targetExists)
      throw new NotFoundError(`The selected ${type} does not exist`);
  }

  if (type === 'Brand' && discountType !== 'percentage') {
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

  const currentDate = new Date();
  currentDate.setHours(0, 0, 0, 0);

  if (currentDate > offer.endDate) {
    throw new BadRequestError('Expired offers cannot be edited.');
  }

  const parsedStartDate = startDate ? new Date(startDate) : offer.startDate;

  parsedStartDate.setHours(0, 0, 0, 0);

  const parsedEndDate = endDate ? new Date(endDate) : offer.endDate;
  parsedEndDate.setHours(23, 59, 59, 999);

  if (
    parsedStartDate.getTime() !== offer.startDate.getTime() &&
    parsedStartDate < currentDate
  ) {
    throw new BadRequestError('Offer start date must be in the future.');
  }

  offer.name = name || offer.name;
  offer.discountType = discountType || offer.discountType;
  offer.discountValue = discountValue || offer.discountValue;
  offer.startDate = parsedStartDate;
  offer.endDate = parsedEndDate;
  offer.isActive = currentDate >= parsedStartDate;

  const oldType = offer.type;
  const oldTargetId = offer.targetId;

  if (isTargetChanged) {
    offer.type = type;
    offer.targetId = targetId;
  }

  await offer.save();

  const affectedProductIds = new Set();

  if (isTargetChanged) {
    if (oldType === 'Brand') {
      const oldBrandProducts = await Product.find({ brand: oldTargetId });
      await Product.updateMany(
        { brand: oldTargetId },
        { $pull: { applicableOffers: offer._id } }
      );

      oldBrandProducts.forEach((product) =>
        affectedProductIds.add(product._id.toString())
      );
    } else if (oldType === 'Product') {
      const oldProduct = await Product.findById(oldTargetId);

      if (oldProduct) {
        oldProduct.applicableOffers = oldProduct.applicableOffers.filter(
          (offerId) => String(offerId) !== String(offer._id)
        );

        await oldProduct.save();
        affectedProductIds.add(oldTargetId.toString());
      }
    }

    if (type === 'Brand') {
      const newBrandProducts = await Product.find({ brand: targetId });

      for (const product of newBrandProducts) {
        await Product.findByIdAndUpdate(product._id, {
          $addToSet: { applicableOffers: offer._id },
        });
        affectedProductIds.add(product._id.toString());
      }
    } else if (type === 'Product') {
      await Product.findByIdAndUpdate(targetId, {
        $addToSet: { applicableOffers: offer._id },
      });

      affectedProductIds.add(targetId);
    }
  }

  for (const productId of affectedProductIds) {
    await selectBestOfferForProduct(productId);
  }

  res.status(200).json({
    success: true,
    message: 'Offer updated successfully.',
    data: offer,
  });
};

/**
 * @route PATCH - admin/offers/:offerId
 * @desc  Admin - Toggle offer listing
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

  const affectedProductIds = new Set();

  if (offer.type === 'Product') {
    if (offer.isActive) {
      await Product.findByIdAndUpdate(offer.targetId, {
        $addToSet: { applicableOffers: offer._id },
      });
    } else {
      await Product.findByIdAndUpdate(offer.targetId, {
        $pull: { applicableOffers: offer._id },
      });
    }
    affectedProductIds.add(offer.targetId);
  } else if (offer.type === 'Brand') {
    const products = await Product.find({ brand: offer.targetId });

    for (const product of products) {
      if (offer.isActive) {
        product.applicableOffers.push(offer._id);
      } else {
        product.applicableOffers = product.applicableOffers.filter(
          (offerId) => offerId.toString() !== offer._id.toString()
        );
      }
      await product.save();
      affectedProductIds.add(product._id.toString());
    }
  }

  for (const productId of affectedProductIds) {
    await selectBestOfferForProduct(productId);
  }

  res.status(200).json({
    success: true,
    message: `Offer ${
      offer.isActive ? 'activated' : 'deactivated'
    } successfully.`,
    data: null,
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
