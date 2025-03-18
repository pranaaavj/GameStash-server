import { UnauthorizedError, ForbiddenError } from '../errors/index.js';
import { verifyToken } from '../utils/token.js';
import User from '../models/user.model.js';

export const verifyAuth =
  (requiredRole = ['user']) =>
  async (req, res, next) => {
    const header = req.headers?.authorization || req.headers?.Authorization;

    if (!header || !header.startsWith('Bearer '))
      throw new UnauthorizedError(
        'Authorization token is missing. Access Denied'
      );

    const token = header.split('Bearer ')[1];

    const decoded = await verifyToken(token, process.env.ACCESS_TOKEN_SECRET);

    const user = await User.findById(decoded.userId);
    if (!user) {
      throw ForbiddenError('User not found, please register first.');
    }

    if (user.status === 'blocked') {
      throw new ForbiddenError('You have been blocked by the admin.');
    }

    req.user = {
      id: decoded.userId,
      role: decoded.role,
    };

    if (requiredRole.length && !requiredRole.includes(req?.user?.role)) {
      throw new ForbiddenError("You're not authorized, Access denied");
    }

    next();
  };
