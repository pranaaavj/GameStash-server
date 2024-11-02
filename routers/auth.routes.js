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
  googleSignIn,
} from '../controllers/auth.controller.js';

const router = express.Router();

router
  .post('/login', loginUser)
  .post('/logout', logoutUser)
  .post('/send-otp', sendOtpUser)
  .post('/verify-otp', verifyOtpUser)
  .post('/reset-otp', resetOtpUser)
  .post('/register', registerUser)
  .post('/google', googleSignIn)
  .post('/reset-pass', resetPassUser)
  .get('/refresh-token', refreshToken);

export default router;
