import express from 'express';
import {
  loginUser,
  registerUser,
  logoutUser,
  refreshToken,
  resetPassUser,
  verifyOtpUser,
  sendOtpUser,
  resetOtpUser,
} from '../controllers/auth.controller.js';

const router = express.Router();

router
  .post('/login', loginUser)
  .post('/logout', logoutUser)
  .post('/send-otp', sendOtpUser)
  .post('/verify-otp', verifyOtpUser)
  .post('/reset-otp', resetOtpUser)
  .post('/register', registerUser)
  .post('/reset-pass', resetPassUser)
  .post('/refresh-token', refreshToken);

export default router;
