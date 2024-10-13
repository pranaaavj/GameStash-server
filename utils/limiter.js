import rateLimit from 'express-rate-limit';

export const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 mins
  max: 100, // maximum request per IP address
  standardHeaders: true,
  legacyHeaders: false,
  message:
    'Too many request from this IP address, please try again after 15 mins',
});
