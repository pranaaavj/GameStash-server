import express from 'express';
import {
  loginUser,
  registerUser,
  logoutUser,
  refreshToken,
  sentOtpUser,
  verifyOtpUser,
  forgetPasswordUser,
  verifyOtpPasswordUser,
  resetPasswordUser,
} from '../controllers/auth.controller.js';

const router = express.Router();

router
  .post('/login', loginUser)
  .post('/logout', logoutUser)
  .post('/send-otp', sentOtpUser)
  .post('/verify-otp', verifyOtpUser)
  .post('/register', registerUser)
  .post('/refresh-token', refreshToken)
  .post('/forget-password', forgetPasswordUser)
  .post('/verify-otp-password', verifyOtpPasswordUser)
  .post('/reset-password', resetPasswordUser);

export default router;
