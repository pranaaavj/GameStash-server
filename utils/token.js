import jwt from 'jsonwebtoken';
import { ForbiddenError } from '../errors/index.js';

// Creating refresh token
export const createRefreshToken = async (userInfo) => {
  return jwt.sign({ userId: userInfo._id }, process.env.REFRESH_TOKEN_SECRET, {
    expiresIn: '1d',
  });
};

//Creating access token
export const createAccessToken = async (userInfo) => {
  return jwt.sign(
    { userId: userInfo._id, role: userInfo.role },
    process.env.ACCESS_TOKEN_SECRET,
    { expiresIn: '1d' }
  );
};

// Verifying token using the secret provided
export const verifyToken = async (token, secret) => {
  try {
    return jwt.verify(token, secret);
  } catch (error) {
    throw new ForbiddenError('Invalid or expired token. Please log in again');
  }
};
