import { UnauthorizedError, ForbiddenError } from '../errors/index.js';
import { verifyToken } from '../utils/token.js';

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

    req.user = {
      userId: decoded.userId,
      role: decoded.role,
    };

    if (requiredRole.length && !requiredRole.includes(req?.user?.role)) {
      throw new ForbiddenError("You're not authorized, Access denied");
    }

    next();
  };
