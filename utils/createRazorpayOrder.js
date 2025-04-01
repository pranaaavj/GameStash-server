import 'dotenv/config';
import { v4 as uuid } from 'uuid';
import Razorpay from 'razorpay';

export const razorpay = new Razorpay({
  key_id: process.env.RZP_KEY_ID,
  key_secret: process.env.RZP_SECRET_KEY,
});

export const createRazorpayOrder = async (amount) => {
  const options = {
    amount: amount * 100,
    currency: 'INR',
    receipt: `receipt_${uuid().replace(/-/g, '').slice(0, 20)}`,
  };

  return await razorpay.orders.create(options);
};
