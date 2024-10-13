import {
  BadRequestError,
  NotFoundError,
  UnauthorizedError,
  ForbiddenError,
  ConflictError,
} from '../errors/index.js';
import {
  createAccessToken,
  createRefreshToken,
  verifyToken,
  generateOtp,
} from '../utils/index.js';
import {
  loginSchema,
  registerSchema,
  verifyOtpSchema,
} from '../validations/auth.validation.js';
import User from '../models/user.model.js';
import Otp from '../models/otp.model.js';

/**
 * @route auth/sent-otp
 * @desc  Creating otp and storing the email
 * @access Public
 */
export const sentOtpUser = async (req, res) => {
  const { email } = req.body;
  if (!email) throw new BadRequestError('No email provided');

  const user = await User.findOne({ email });
  if (user)
    throw new ConflictError(
      "You're already verified, Please login or use another email"
    );

  const otpSent = await Otp.findOne({ email });
  //Todo: Add retry otp functionality
  if (otpSent) throw new ConflictError('OTP already sent');

  const otp = generateOtp();
  const otpExist = await Otp.findOne({ otp });
  while (otpExist) {
    otp = generateOtp();
    otpExist = await Otp.findOne({ otp });
  }
  await Otp.create({ email, otp });

  res.status(200).json({
    success: true,
    message: 'OTP sent successfully',
    data: null,
  });
};

/**
 * @route auth/verify-otp
 * @desc  Verifying otp sent to user via email
 * @access Private - Only users who are otp verified
 */
export const verifyOtpUser = async (req, res) => {
  const { otp, email } = await verifyOtpSchema.validateAsync(req.body, {
    abortEarly: false,
  });

  const correctOtp = await Otp.findOne({ email });
  if (!correctOtp) throw new NotFoundError('Please send the otp first.');

  if (correctOtp?.otp !== otp) {
    throw new UnauthorizedError('Invalid or expired OTP, Try again later');
  }

  //todo change the otp verified to true after correct otp

  res.status(200).json({
    success: true,
    message: 'OTP verification successful',
    data: null,
  });
};

/**
 * @route auth/register
 * @desc  User register after otp validation
 * @access Private - Only users who are otp verified
 */
export const registerUser = async (req, res) => {
  const { name, email, password } = await registerSchema.validateAsync(
    req.body,
    {
      abortEarly: false,
    }
  );
  //Todo: Check for whether the user is otp verified in the otp schema
  const user = await User.create({
    name,
    email,
    password,
  });

  res.send({
    success: true,
    message: 'User created successfully',
    data: user,
  });
};

/**
 * @route auth/login
 * @desc  User login
 * @access Public
 */
export const loginUser = async (req, res) => {
  const { email, password } = await loginSchema.validateAsync(req.body, {
    abortEarly: false,
  });

  const user = await User.findOne({ email });
  if (!user) {
    throw new NotFoundError("You're not registered, Please sign up first.");
  }

  const isPasswordCorrect = await user.comparePassword(password);
  if (!isPasswordCorrect) {
    throw new UnauthorizedError('Invalid Credentials');
  }

  const accessToken = await createAccessToken(user);
  const refreshToken = await createRefreshToken(user);
  res
    .status(200)
    .cookie('jwt', refreshToken, {
      httpOnly: true,
      sameSite: 'none',
      secure: process.env.NODE_ENV !== 'development',
      maxAge: 1000 * 60 * 60 * 24,
    })
    .json({
      success: true,
      message: 'User successfully logged in',
      data: { user, accessToken },
    });
};

/**
 * @route auth/refresh-token
 * @desc  Validating refresh token and generating new access token
 * @access Public
 */
export const refreshToken = async (req, res) => {
  const refreshToken = req.cookies?.jwt;

  if (!refreshToken)
    throw new BadRequestError('Refresh token is missing from the request');

  const decoded = await verifyToken(
    refreshToken,
    process.env.REFRESH_TOKEN_SECRET
  );

  const user = await User.findById({ _id: decoded.userId });
  if (!user)
    throw new ForbiddenError('Invalid refresh token, User not authorized');

  const accessToken = await createAccessToken(user);

  res.json({
    success: true,
    message: 'Generated Access token',
    data: { accessToken },
  });
};

/**
 * @route auth/logout
 * @desc  Logs out user and clears cookies
 * @access Public
 */
export const logoutUser = (req, res) => {
  const refreshToken = req.cookies?.jwt;
  if (!refreshToken) throw new BadRequestError('No refresh token');

  res
    .clearCookie('jwt', {
      httpOnly: true,
      sameSite: 'none',
      secure: process.env.NODE_ENV !== 'development',
    })
    .json({
      success: true,
      message: 'User logged out successfully',
      data: null,
    });
};
