import { BadRequestError, NotFoundError } from '../errors/index.js';
import Wallet from '../models/wallet.model.js';
import { createRazorpayOrder } from '../utils/createRazorpayOrder.js';
import crypto from 'crypto';
/**
 * @route GET - user/wallet
 * @desc  User - Get wallet
 * @access Private
 */
export const getOneWallet = async (req, res) => {
  const userId = req.user.id;

  let wallet = await Wallet.findOne({ userId });

  if (!wallet) {
    wallet = await Wallet.create({ userId, transactions: [] });
  }

  res.status(200).json({
    success: true,
    message: 'Wallet retrieved successfully',
    data: wallet,
  });
};

/**
 * @route POST - user/wallet
 * @desc  User - Add money to wallet
 * @access Private
 */
export const addMoneyWallet = async (req, res) => {
  const { amount } = req.body;
  const userId = req.user.id;

  if (!amount || amount <= 0) {
    throw new BadRequestError('Please provide the amount to add to wallet.');
  }

  const razorpayOrder = await createRazorpayOrder(amount);

  await Wallet.findOneAndUpdate(
    { userId },
    {
      $push: {
        transactions: {
          type: 'credit',
          amount,
          status: 'pending',
          razorpayOrderId: razorpayOrder.id,
        },
      },
    },
    { upsert: true, new: true }
  );

  res.status(201).json({
    success: true,
    message: 'Razorpay order created successfully.',
    data: {
      razorpayOrderId: razorpayOrder.id,
      amount: razorpayOrder.amount,
      currency: razorpayOrder.currency,
    },
  });
};

/**
 * @route PATCH - user/wallet
 * @desc  User - Verify payment with wallet
 * @access Private
 */
export const verifyAddMoneyWallet = async (req, res) => {
  const { razorpayOrderId, paymentId, signature } = req.body;

  const userId = req.user.id;

  const expectedSignature = crypto
    .createHmac('sha256', process.env.RZP_SECRET_KEY)
    .update(`${razorpayOrderId}|${paymentId}`)
    .digest('hex');

  if (signature !== expectedSignature) {
    throw new BadRequestError('Invalid signature');
  }

  const wallet = await Wallet.findOne({ userId });
  if (!wallet) {
    throw new NotFoundError('No wallet found.');
  }

  const transaction = wallet.transactions.find((transaction) => {
    return transaction?.razorpayOrderId === razorpayOrderId;
  });

  if (!transaction) {
    throw new NotFoundError('No transaction found.');
  }

  if (transaction.status !== 'pending') {
    throw new BadRequestError('Transaction already processed.');
  }

  wallet.balance += transaction.amount;
  transaction.status = 'completed';
  transaction.razorpayPaymentId = paymentId;

  await wallet.save();

  res.status(200).json({
    success: true,
    message: 'Razorpay order created successfully.',
    data: {},
  });
};
