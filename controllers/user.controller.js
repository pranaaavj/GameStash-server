import { isValidObjectId } from 'mongoose';
import {
  NotFoundError,
  BadRequestError,
  UnauthorizedError,
} from '../errors/index.js';
import User from '../models/user.model.js';
import { userProfileSchema } from '../validations/user.validations.js';

/*****************************************/
// User
/*****************************************/

/**
 * @route GET - user/details/:userId
 * @desc  Get user details for user profile
 * @access Private
 */
export const getUserDetails = async (req, res) => {
  const userId = req.params?.userId?.trim();

  // Validate object ID
  if (!userId || !isValidObjectId(userId)) {
    throw new BadRequestError(
      'It seems the user ID format is incorrect. Please check and try again.'
    );
  }

  const user = await User.findById(userId);
  if (!user) {
    throw new NotFoundError(
      'We couldn’t find an account associated with this ID.'
    );
  }

  res.status(200).json({
    success: true,
    message: 'User details retrieved successfully.',
    data: user,
  });
};

/**
 * @route PATCH - user/details/:userId
 * @desc  Edit user details
 * @access Private
 */
export const editUserDetails = async (req, res) => {
  const { name, phoneNumber, profilePicture } =
    await userProfileSchema.validateAsync(req.body, {
      abortEarly: false,
    });
  const userId = req.params?.userId?.trim();

  // Validate object ID
  if (!userId || !isValidObjectId(userId)) {
    throw new BadRequestError(
      'It seems the user ID format is incorrect. Please check and try again.'
    );
  }

  // Finding the user
  const user = await User.findById(userId);
  if (!user) {
    throw new NotFoundError(
      'We couldn’t find an account associated with this ID.'
    );
  }

  user.name = name;
  user.profilePicture = profilePicture;
  if (phoneNumber) user.phoneNumber = phoneNumber;

  await user.save();

  res.status(200).json({
    success: true,
    message: 'Your profile has been updated successfully.',
    data: user,
  });
};

/**
 * @route PATCH - user/details/change-pass/:userId
 * @desc  Edit user details
 * @access Private
 */
export const changePassUser = async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const userId = req.params?.userId?.trim();

  // Validate object ID
  if (!userId || !isValidObjectId(userId)) {
    throw new BadRequestError(
      'It seems the user ID format is incorrect. Please check and try again.'
    );
  }

  // Finding the user
  const user = await User.findById(userId);
  if (!user) {
    throw new NotFoundError(
      'We couldn’t find an account associated with this ID.'
    );
  }

  // Checking if user entered the correct password
  const isPasswordCorrect = await user.comparePassword(currentPassword);
  if (!isPasswordCorrect) {
    throw new UnauthorizedError(
      'The current password you entered is incorrect. Please try again.'
    );
  }

  const passwordRegex = /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d]{6,}$/;
  if (!passwordRegex.test(newPassword)) {
    throw new BadRequestError(
      'Your new password must have at least 6 characters, including one letter and one number.'
    );
  }

  if (currentPassword === newPassword) {
    throw new BadRequestError(
      'Your new password should be different from your current password.'
    );
  }

  user.password = newPassword;
  await user.save();

  res.status(200).json({
    success: true,
    message: 'Your password has been updated successfully.',
    data: user,
  });
};
