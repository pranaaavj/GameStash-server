import express from 'express';
import {
  loginUser,
  registerUser,
  logoutUser,
  refreshToken,
  sentOtpUser,
  verifyOtpUser,
} from '../controllers/auth.controller.js';

const router = express.Router();

router
  .post('/login', loginUser)
  .post('/logout', logoutUser)
  .post('/send-otp', sentOtpUser)
  .post('/verify-otp', verifyOtpUser)
  .post('/register', registerUser)
  .post('/refresh-token', refreshToken);

export default router;
