import mongoose from 'mongoose';
import { sendEmail } from '../utils/index.js';

const OtpSchema = new mongoose.Schema({
  email: {
    type: String,
    unique: true,
    trim: true,
  },
  otp: {
    type: String,
    unique: true,
  },
  type: {
    type: String,
    enum: ['registration', 'forgotPassword'],
    required: true,
  },
  otpVerified: {
    type: Boolean,
    default: false,
  },
  expiresAt: {
    type: Date,
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

OtpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

OtpSchema.pre('save', function (next) {
  const message =
    this.type === 'registration'
      ? 'account creation'
      : 'resetting your password';

  if (this.isNew) {
    setImmediate(async () => {
      try {
        await sendEmail(
          this.email,
          'Your OTP for GameStash Account Creation',
          `<h3>Welcome to GameStash! Your One-Time Password (OTP) for ${message} is: ${this.otp}</h3> 
    <p>Please enter this code within the next 10 minutes to complete the process.</p>`
        );
      } catch (error) {
        next(error);
      }
    });
  }
  next();
});

export default mongoose.model('Otp', OtpSchema);
