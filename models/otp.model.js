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
  otpVerified: {
    type: Boolean,
    default: false,
  },
  expiresIn: {
    type: Date,
    default: Date.now(),
  }, //todo Complete the expires in functionality
  createdAt: {
    type: Date,
    default: Date.now(),
    expires: 60 * 60,
  },
});

OtpSchema.pre('save', function (next) {
  if (this.isNew) {
    setImmediate(async () => {
      try {
        await sendEmail(
          this.email,
          'Your OTP for GameStash Account Creation',
          `<h3>Welcome to GameStash! Your One-Time Password (OTP) for account creation is: ${this.otp}</h3> 
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
