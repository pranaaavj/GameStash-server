import {
  NotFoundError,
  BadRequestError,
  UnauthorizedError,
} from '../errors/index.js';
import User from '../models/user.model.js';
import {
  createAccessToken,
  createRefreshToken,
  paginate,
  verifyToken,
} from '../utils/index.js';
import { isValidObjectId } from 'mongoose';
import { loginSchema } from '../validations/auth.validation.js';

/**
 * @route POST - admin/login
 * @desc  Admin login
 * @access Public
 */
export const loginAdmin = async (req, res) => {
  const { email, password } = await loginSchema.validateAsync(req.body, {
    abortEarly: false,
  });

  const user = await User.findOne({ email });
  if (!user) {
    throw new NotFoundError('No admin found with this email.');
  }

  if (user.role !== 'admin') {
    throw new UnauthorizedError(`You're not authorized to access here.`);
  }

  // const isPasswordCorrect = await user.comparePassword(password);
  // if (!isPasswordCorrect) {
  //   throw new UnauthorizedError(
  //     'Incorrect email or password. Please check your details and try again.'
  //   );
  // }

  const accessToken = await createAccessToken(user);
  const refreshToken = await createRefreshToken(user);

  res
    .status(200)
    .cookie('adminJwt', refreshToken, {
      httpOnly: true,
      secure: true,
      sameSite: 'none',
      maxAge: 1000 * 60 * 60 * 24,
    })
    .json({
      success: true,
      message: 'You’ve successfully logged in.',
      data: { user, accessToken },
    });
};

/**
 * @route POST - admin/logout
 * @desc  Logs out Admin and clears cookies
 * @access Public
 */
export const logoutAdmin = (req, res) => {
  const refreshToken = req.cookies?.adminJwt;
  if (!refreshToken) throw new BadRequestError('No refresh token found.');

  res
    .clearCookie('adminJwt', {
      httpOnly: true,
      sameSite: 'none',
      secure: process.env.NODE_ENV !== 'development',
    })
    .json({
      success: true,
      message: 'You have been logged out successfully.',
      data: null,
    });
};

/**
 * @route GET - admin/refresh-token
 * @desc  Validating refresh token and generating access token
 * @access Public
 */
export const refreshTokenAdmin = async (req, res) => {
  const refreshToken = req.cookies?.adminJwt;

  if (!refreshToken)
    throw new BadRequestError('Refresh token is missing from the request.');

  const decoded = await verifyToken(
    refreshToken,
    process.env.REFRESH_TOKEN_SECRET
  );

  const user = await User.findById(decoded?.userId);
  if (!user)
    throw new ForbiddenError('Invalid refresh token, You are not authorized.');

  const accessToken = await createAccessToken(user);

  res.json({
    success: true,
    message: 'Access token generated.',
    data: { accessToken },
  });
};

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
  const userId = req.params?.userId?.trim();

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

  if (user.role === 'admin') {
    throw new BadRequestError(`You cannot block an admin.`);
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
