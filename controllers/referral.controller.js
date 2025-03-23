import { BadRequestError } from '../errors/badRequest.error.js';
import User from '../models/user.model.js';
import Wallet from '../models/wallet.model.js';

/**
 * @route POST - user/referral/apply
 * @desc  User applies referral code
 * @access Private
 */
export const applyReferralCode = async (req, res) => {
  const { referralCode } = req.body;
  const userId = req.user.id;

  const user = await User.findById(userId);
  if (!user) {
    throw new NotFoundError('User not found.');
  }

  if (user.referredBy) {
    throw new BadRequestError('You have already used a referral code.');
  }

  const referrer = await User.findOne({ referralCode });
  if (!referrer) {
    throw new BadRequestError('Invalid referral code.');
  }

  user.referredBy = referrer._id;
  await user.save();

  await Wallet.findOneAndUpdate(
    { userId: user },
    {
      $inc: { balance: 100 },
      $push: {
        transactions: {
          type: 'credit',
          amount: 100,
          status: 'completed',
        },
      },
    },
    { upsert: true, new: true }
  );

  await Wallet.findOneAndUpdate(
    { userId: referrer._id },
    {
      $inc: { balance: 300 },
      $push: {
        transactions: {
          type: 'credit',
          amount: 300,
          status: 'completed',
        },
      },
    },
    { upsert: true }
  );

  res.status(200).json({
    success: true,
    message: 'Referral code applied successfully.',
    data: {
      referredBy: referrer.name,
      reward: '₹300 credited to the referrer’s wallet.',
    },
  });
};
