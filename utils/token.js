import jwt from 'jsonwebtoken';
import { ForbiddenError } from '../errors/index.js';

export const createRefreshToken = async (userInfo) => {
  return jwt.sign({ userId: userInfo._id }, process.env.REFRESH_TOKEN_SECRET, {
    expiresIn: '10d',
  });
};

export const createAccessToken = async (userInfo) => {
  return jwt.sign(
    { userId: userInfo._id, role: userInfo.role },
    process.env.ACCESS_TOKEN_SECRET,
    { expiresIn: '10m' }
  );
};

export const verifyToken = async (token, secret) => {
  try {
    return jwt.verify(token, secret);
  } catch (error) {
    console.log(error);
    throw new ForbiddenError('Invalid or expired token.');
  }
};

export const decodeAccessToken = async (token) => {
  try {
    return jwt.decode(token, { complete: true });
  } catch (error) {
    throw new ForbiddenError('Invalid token structure');
  }
};
