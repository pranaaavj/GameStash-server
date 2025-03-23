import crypto from 'crypto';
import User from '../models/user.model.js';

export const generateReferralCode = async () => {
  let referralCode = crypto.randomBytes(6).toString('hex');
  let isReferralCodeExist = await User.findOne({ referralCode });
  while (isReferralCodeExist) {
    referralCode = crypto.randomBytes(6).toString('hex');
    isReferralCodeExist = await User.findOne({ referralCode });
  }
};
