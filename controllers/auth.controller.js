import {
  verifyToken,
  generateOtp,
  createAccessToken,
  createRefreshToken,
} from '../utils/index.js';
import {
  NotFoundError,
  ConflictError,
  BadRequestError,
  ForbiddenError,
  UnauthorizedError,
  TooManyRequestError,
} from '../errors/index.js';
import {
  loginSchema,
  registerSchema,
  verifyOtpSchema,
} from '../validations/auth.validation.js';
import Otp from '../models/otp.model.js';
import User from '../models/user.model.js';

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
    throw new NotFoundError(
      "This email isn't registered. Please register to continue."
    );
  }

  const isPasswordCorrect = await user.comparePassword(password);
  if (!isPasswordCorrect) {
    throw new UnauthorizedError(
      'Incorrect email or password. Please check your details and try again.'
    );
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
      message: 'You’ve successfully logged in.',
      data: { user, accessToken },
    });
};

/**
 * @route auth/logout
 * @desc  Logs out user and clears cookies
 * @access Public
 */
export const logoutUser = (req, res) => {
  const refreshToken = req.cookies?.jwt;
  if (!refreshToken) throw new BadRequestError('No refresh token found.');

  res
    .clearCookie('jwt', {
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
 * @route auth/register
 * @desc  User register after otp validation
 * @access Private - Only users who have OTP status 'verified'
 */
export const registerUser = async (req, res) => {
  const { name, email, password, phoneNumber } =
    await registerSchema.validateAsync(req.body, {
      abortEarly: false,
    });
  const userOtp = await Otp.findOne({ email });
  if (!userOtp?.otpVerified) {
    throw new UnauthorizedError('Please verify your email first.');
  }

  const user = await User.create({
    name,
    email,
    password,
    phoneNumber,
    status: 'active',
  });

  res.send({
    success: true,
    message: 'You are registered successfully. Please log in.',
    data: user,
  });
};

/**
 * @route auth/refresh-token
 * @desc  Validating refresh token and generating access token
 * @access Public
 */
export const refreshToken = async (req, res) => {
  const refreshToken = req.cookies?.jwt;

  if (!refreshToken)
    throw new BadRequestError('Refresh token is missing from the request.');

  const decoded = await verifyToken(
    refreshToken,
    process.env.REFRESH_TOKEN_SECRET
  );

  const user = await User.findById({ _id: decoded.userId });
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
 * @route auth/reset-pass
 * @desc  sent Otp to user email
 * @access Private - Users who have sent the otp
 */
export const resetPassUser = async (req, res) => {
  const { email, password } = await loginSchema.validateAsync(req.body, {
    abortEarly: false,
  });

  const correctOtp = await Otp.findOne({ email });

  if (!correctOtp?.otpVerified) {
    throw new UnauthorizedError('OTP verification failed. Please try again.');
  }

  const user = await User.findOne({ email });
  user.password = password;
  await user.save();

  await Otp.deleteOne({ _id: correctOtp._id });

  res.status(200).json({
    success: true,
    message:
      'Your password has been updated successfully. You can now log in with your new password.',
    data: null,
  });
};

/**
 * @route auth/send-otp
 * @desc  sent Otp to user email
 * @access Private - Users who have provided the email
 */
export const sendOtpUser = async (req, res) => {
  const { email, type } = req.body;
  if (!email || !type)
    throw new BadRequestError('Email or type was not provided.');

  await Otp.deleteMany({ email, type });

  const user = await User.findOne({ email });
  if (user && type == 'registration') {
    throw new ConflictError(
      "You're already verified, Please log in or use a different email."
    );
  }

  if (!user && type == 'forgetPassword') {
    throw new ConflictError(
      'No account found with this email. Please register first.'
    );
  }

  const otp = generateOtp();
  const otpExist = await Otp.findOne({ otp });
  while (otpExist) {
    otp = generateOtp();
    otpExist = await Otp.findOne({ otp });
  }

  await Otp.create({
    email,
    otp,
    type,
    expiresAt: new Date(Date.now() + 1000 * 60 * 10),
    createdAt: new Date(),
  });

  res.status(200).json({
    success: true,
    message: 'OTP sent successfully, Please check your email.',
    data: null,
  });
};

/**
 * @route auth/verify-otp
 * @desc  Verifying the otp with otp schema
 * @access Private - Users who have sent the otp
 */
export const verifyOtpUser = async (req, res) => {
  const { otp, email, type } = await verifyOtpSchema.validateAsync(req.body, {
    abortEarly: false,
  });

  const otpRecord = await Otp.findOne({ email, otp, type });

  if (!otpRecord)
    throw new NotFoundError(
      'Invalid OTP. Please check your email or try again later.'
    );

  if (Date.now() > otpRecord.expiresAt - 1000 * 60 * 5) {
    throw new UnauthorizedError('OTP has expired, please try again.');
  }

  if (otpRecord.otpVerified) {
    throw new ConflictError(
      "You're already verified, Please log in or use a different email."
    );
  }

  otpRecord.otpVerified = true;
  await otpRecord.save();

  res.status(200).json({
    success: true,
    message: 'OTP verified successfully! Please enter your new password.',
    data: null,
  });
};

/**
 * @route auth/reset-otp
 * @desc  Resetting the otp after one minute.
 * @access Private - Users who have sent the otp
 */
export const resetOtpUser = async (req, res) => {
  const { email, type } = req.body;
  if (!email || !type)
    throw new BadRequestError('Email or type was not provided.');

  const otpRecord = await Otp.findOne({ email, type }).sort({
    createdAt: -1,
  });

  if (!otpRecord) {
    throw new NotFoundError('Please request an OTP first.');
  }

  const currentTime = Date.now();
  const otpCreatedTime = new Date(otpRecord.createdAt).getTime();
  const resetTime = (currentTime - otpCreatedTime) / (1000 * 60);

  if (resetTime < 1) {
    throw new TooManyRequestError(
      'Please wait 1 minute before requesting a new OTP'
    );
  }

  const newOtp = generateOtp();
  const otpExist = await Otp.findOne({ newOtp });
  while (otpExist) {
    newOtp = generateOtp();
    otpExist = await Otp.findOne({ newOtp });
  }

  await Otp.deleteOne({ _id: otpRecord._id });

  await Otp.create({
    email,
    otp: newOtp,
    type,
    expiresAt: new Date(Date.now() + 1000 * 60 * 10),
    createdAt: new Date(),
  });

  res.status(200).json({
    success: true,
    message: 'New OTP has been sent successfully.',
    data: null,
  });
};
