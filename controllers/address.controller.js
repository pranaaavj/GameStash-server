import Address from '../models/address.model.js';
import { addressSchema } from '../validations/user.validations.js';
import { isValidObjectId } from 'mongoose';
import { NotFoundError, BadRequestError } from '../errors/index.js';

/*****************************************/
// Address
/*****************************************/

/**
 * @route GET - user/addresses
 * @desc  User - Listing all addresses
 * @access Private
 */
export const getAllAddresses = async (req, res) => {
  const userId = req?.user?.id;

  const addresses = await Address.find({ user: userId }).sort({
    updatedAt: -1,
  });

  if (addresses.length === 0) {
    throw new NotFoundError('No addresses found.');
  }

  res.status(200).json({
    success: true,
    message: 'All addresses retrieved successfully.',
    data: addresses,
  });
};

/**
 * @route GET - user/address/:addressId
 * @desc  User - Getting one address
 * @access Private
 */
export const getOneAddress = async (req, res) => {
  const addressId = req.params.addressId.trim();

  // Validating object Id
  if (!addressId || !isValidObjectId(addressId)) {
    throw new BadRequestError(
      'The address ID format seems incorrect. Please check and try again.'
    );
  }

  const address = await Address.findById(addressId);

  if (!address) {
    throw new NotFoundError('We couldn’t find the specified address.');
  }

  res.status(200).json({
    success: true,
    message: 'Address retrieved successfully.',
    data: address,
  });
};

/**
 * @route POST - user/address
 * @desc  User - Adding an address
 * @access Private
 */
export const addAddress = async (req, res) => {
  const { addressName, addressLine, city, state, zip, country } =
    await addressSchema.validateAsync(req.body, {
      abortEarly: false,
    });

  const userId = req?.user?.id;

  if (!userId || !isValidObjectId(userId)) {
    throw new BadRequestError(
      'It seems the user ID format is incorrect. Please check and try again.'
    );
  }

  const newAddress = await Address.create({
    user: userId,
    addressName,
    addressLine,
    city,
    state,
    zip,
    country,
  });

  res.status(201).json({
    success: true,
    message: 'Address added successfully.',
    data: newAddress,
  });
};

/**
 * @route PUT - user/address/:addressId
 * @desc  User - Editing an address
 * @access Private
 */
export const editAddress = async (req, res) => {
  const addressId = req.params.addressId.trim();
  console.log(req.body);
  // Validating object Id
  if (!addressId || !isValidObjectId(addressId)) {
    throw new BadRequestError(
      'The address ID format seems incorrect. Please check and try again.'
    );
  }

  const updatedData = await addressSchema.validateAsync(req.body, {
    abortEarly: false,
  });

  // Checking for the address
  const address = await Address.findById(addressId);
  if (!address) {
    throw new NotFoundError('We couldn’t find the specified address.');
  }

  // Updating the address
  Object.keys(updatedData).forEach((key) => {
    address[key] = updatedData[key];
  });

  await address.save();

  res.status(200).json({
    success: true,
    message: 'Address updated successfully.',
    data: address,
  });
};

/**
 * @route DELETE - user/address/:addressId
 * @desc  User - Deleting an address
 * @access Private
 */
export const deleteAddress = async (req, res) => {
  const addressId = req.params.addressId.trim();

  // Validating object Id
  if (!addressId || !isValidObjectId(addressId)) {
    throw new BadRequestError(
      'The address ID format seems incorrect. Please check and try again.'
    );
  }

  // Checking for address
  const address = await Address.findByIdAndDelete(addressId);
  if (!address) {
    throw new NotFoundError('We couldn’t find the specified address.');
  }

  res.status(200).json({
    success: true,
    message: 'Address deleted successfully.',
    data: null,
  });
};
