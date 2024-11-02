import { NotFoundError, BadRequestError } from '../errors/index.js';
import User from '../models/user.model.js';
import { paginate } from '../utils/index.js';
import { isValidObjectId } from 'mongoose';

/**
 * @route GET - admin/users
 * @desc  Admin - Listing all users
 * @access Private
 */
export const getAllUsers = async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;

  const queryOptions = {
    sort: { createdAt: -1 },
  };

  const users = await paginate(User, page, limit, queryOptions);

  if (users?.result?.length === 0) {
    throw new NotFoundError('No users found');
  }

  res.status(200).json({
    success: true,
    message: 'All Users',
    data: {
      users: users.result,
      totalPages: users.totalPages,
      currentPage: users.currentPage,
    },
  });
};

/**
 * @route GET - admin/users/:userId
 * @desc  Admin - Getting one user
 * @access Private
 */
export const getOneUser = async (req, res) => {
  const userId = req.params.userId.trim();

  // Validate object ID
  if (!userId || !isValidObjectId(userId)) {
    throw new BadRequestError('Invalid user ID format.');
  }

  const user = await User.findById(userId);
  if (!user) {
    throw new NotFoundError('No User found.');
  }

  res.status(200).json({
    success: true,
    message: 'User fetched successfully.',
    data: user,
  });
};

/**
 * @route PATCH - admin/users
 * @desc  Admin - Toggling block and unblock of users
 * @access Private
 */
export const toggleBlockUser = async (req, res) => {
  const { userId } = req.body;

  // Validate object ID
  if (!userId || !isValidObjectId(userId)) {
    throw new BadRequestError('Invalid user ID format.');
  }

  const user = await User.findById(userId);
  if (!user) {
    throw new NotFoundError('No User found.');
  }

  user.status = user.status === 'blocked' ? 'active' : 'blocked';
  await user.save();

  res.status(200).json({
    success: true,
    message: `User ${
      user.status === 'blocked' ? 'blocked' : 'unblocked'
    } successfully.`,
    data: user,
  });
};
