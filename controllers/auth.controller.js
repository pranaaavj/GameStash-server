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
import { admin } from '../utils/firebaseAdmin.js';

/*****************************************/
// Authorization
/*****************************************/

/**
 * @route POST - auth/login
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

  if (user.status === 'blocked') {
    throw new ForbiddenError('User has been blocked');
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
    .cookie('userJwt', refreshToken, {
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
 * @route POST - auth/logout
 * @desc  Logs out user and clears cookies
 * @access Public
 */
export const logoutUser = (req, res) => {
  const refreshToken = req.cookies?.userJwt;
  if (!refreshToken) throw new BadRequestError('No refresh token found.');

  res
    .clearCookie('userJwt', {
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
 * @route POST - auth/register
 * @desc  User register after otp validation
 * @access Private - Only users who have OTP status 'verified'
 */
export const registerUser = async (req, res) => {
  const { name, email, password, phoneNumber } =
    await registerSchema.validateAsync(req.body, {
      abortEarly: false,
    });

  // User exist is validated in the mongoose validation
  const userOtp = await Otp.findOne({ email });
  if (!userOtp?.otpVerified) {
    throw new UnauthorizedError('Please verify your email first.');
  }

  await Otp.findByIdAndDelete({
    _id: userOtp._id,
  });

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
 * @route POST - auth/google
 * @desc  User signin  or signup via google
 * @access Public
 */
export const googleSignIn = async (req, res) => {
  const { idToken } = req.body;

  if (!idToken) {
    throw new BadRequestError('No Token present to verify user.');
  }

  const decodedToken = await admin.auth().verifyIdToken(idToken);
  if (!decodedToken) {
    throw new UnauthorizedError('User verification failed.');
  }

  const { name, picture, email, uid } = decodedToken;

  let user = await User.findOne({ name });
  if (user) {
    if (user.status === 'blocked') {
      throw new ForbiddenError('User has been blocked');
    }
  } else {
    user = await User.create({
      name,
      email,
      profilePicture: picture,
      firebase: {
        authenticated: true,
        provider: 'Google',
        uid,
      },
    });
  }

  const accessToken = await createAccessToken(user);
  const refreshToken = await createRefreshToken(user);

  res
    .status(200)
    .cookie('userJwt', refreshToken, {
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
 * @route GET - auth/refresh-token
 * @desc  Validating refresh token and generating access token
 * @access Public
 */
export const refreshToken = async (req, res) => {
  const refreshToken = req.cookies?.userJwt;

  if (!refreshToken)
    throw new BadRequestError('Refresh token is missing from the request.');

  const decoded = await verifyToken(
    refreshToken,
    process.env.REFRESH_TOKEN_SECRET
  );

  const user = await User.findById(decoded?.userId);
  if (!user) {
    throw new ForbiddenError('Invalid refresh token, You are not authorized.');
  }

  if (user.status === 'blocked') {
    throw new ForbiddenError('User has been blocked.');
  }

  const accessToken = await createAccessToken(user);

  res.json({
    success: true,
    message: 'Access token generated.',
    data: { accessToken },
  });
};

/**
 * @route POST - auth/reset-pass
 * @desc  sent Otp to user email
 * @access Private - Users who have sent the otp
 */
export const resetPassUser = async (req, res) => {
  const { email, password } = await loginSchema.validateAsync(req.body, {
    abortEarly: false,
  });

  const correctOtp = await Otp.findOne({ email });

  if (!correctOtp?.otpVerified) {
    throw new UnauthorizedError('Please verify with OTP before proceeding.');
  }

  const user = await User.findOne({ email });
  if (!user) {
    throw new NotFoundError(
      "This email isn't registered. Please register to continue."
    );
  }
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
 * @route POST - auth/send-otp
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

  if (!user && type == 'forgotPassword') {
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
 * @route POST - auth/verify-otp
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
    message: 'OTP verified successfully!',
    data: null,
  });
};

/**
 * @route POST - auth/reset-otp
 * @desc  Resetting the otp after one minute.
 * @access Private - Users who have sent the otp can reset
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

  await Otp.findByIdAndDelete({ _id: otpRecord._id });

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
