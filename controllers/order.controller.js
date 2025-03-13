import {
  placeOrderSchema,
  verifyRazorpaySchema,
} from '../validations/user.validations.js';
import Order from '../models/order.model.js';
import Cart from '../models/cart.model.js';
import crypto from 'crypto';
import Address from '../models/address.model.js';
import Product from '../models/product.model.js';
import Coupon from '../models/coupon.model.js';
import Wallet from '../models/wallet.model.js';
import { paginate } from '../utils/paginate.js';
import { isValidObjectId } from 'mongoose';
import { createRazorpayOrder } from '../utils/createRazorpayOrder.js';
import { BadRequestError, NotFoundError } from '../errors/index.js';

/*****************************************/
// Orders - User
/*****************************************/

/**
 * @route POST - user/order
 * @desc  User - Placing an order
 * @access Private
 */
export const placeOrder = async (req, res) => {
  const { orderItems, shippingAddress, paymentMethod, couponCode } =
    await placeOrderSchema.validateAsync(req.body, {
      abortEarly: false,
    });

  const userId = req?.user?.id;
  let subtotal = 0;
  let couponDiscount = 0;
  let appliedCoupon = null;
  let totalDiscount = 0;

  for (const item of orderItems) {
    const product = await Product.findById(item.product).populate('bestOffer');

    if (!product) {
      throw new NotFoundError(`Product not found for ID: ${item.product}`);
    }

    if (product.stock < item.quantity) {
      throw new BadRequestError(
        `Insufficient stock for product: ${product.name}`
      );
    }

    let itemDiscount = 0;
    let effectivePrice = product.price;

    if (product.bestOffer) {
      if (product.bestOffer.discountType === 'percentage') {
        itemDiscount = (product.price * product.bestOffer.discountValue) / 100;
      } else {
        itemDiscount = product.bestOffer.discountValue;
      }

      itemDiscount = Math.min(itemDiscount, product.price);
      effectivePrice = product.price - itemDiscount;
    }

    totalDiscount += itemDiscount * item.quantity;

    const itemTotalPrice = effectivePrice * item.quantity;
    item.totalPrice = itemTotalPrice;
    subtotal += itemTotalPrice;

    if (paymentMethod === 'Razorpay' || paymentMethod === 'COD') {
      product.reservedStock = (product.reservedStock || 0) + item.quantity;
    } else {
      product.stock -= item.quantity;
    }

    await product.save();
  }

  if (couponCode) {
    const coupon = await Coupon.findOne({ code: couponCode.toUpperCase() });

    if (!coupon) {
      throw new NotFoundError('Invalid coupon code.');
    }

    if (!coupon.isActive) {
      throw new BadRequestError('This coupon is no longer active.');
    }

    const currentDate = new Date();
    if (currentDate < coupon.startDate || currentDate > coupon.endDate) {
      throw new BadRequestError('This coupon has expired.');
    }

    if (subtotal < coupon.minOrderAmount) {
      throw new BadRequestError(
        `Minimum order amount should be ₹${coupon.minOrderAmount} to use this coupon.`
      );
    }

    const userUsage = coupon.usersUsed.find((entry) =>
      entry.userId.equals(userId)
    );
    if (userUsage && userUsage.timesUsed >= coupon.perUserLimit) {
      throw new BadRequestError(
        'You have reached the usage limit for this coupon.'
      );
    }

    if (coupon.discountType === 'percentage') {
      couponDiscount = (subtotal * coupon.discountValue) / 100;
      if (coupon.maxDiscountAmount) {
        couponDiscount = Math.min(couponDiscount, coupon.maxDiscountAmount);
      }
    } else {
      couponDiscount = coupon.discountValue;
    }

    couponDiscount = Math.min(couponDiscount, subtotal);

    totalDiscount += couponDiscount;

    const userCouponIndex = coupon.usersUsed.findIndex((entry) =>
      entry.userId.equals(userId)
    );

    if (userCouponIndex === -1) {
      coupon.usersUsed.push({ userId, timesUsed: 1 });
    } else {
      coupon.usersUsed[userCouponIndex].timesUsed += 1;
    }

    await coupon.save();
    appliedCoupon = coupon.code;
  }

  const finalPrice = Math.max(0, Math.round(subtotal - totalDiscount));

  const currentAddress = await Address.findById(shippingAddress);
  if (!currentAddress) {
    throw new NotFoundError('Address not found');
  }

  if (paymentMethod === 'Razorpay') {
    const razorpayOrder = await createRazorpayOrder(finalPrice);
    return res.status(200).json({
      success: true,
      message: 'Razorpay order created successfully',
      data: {
        razorpayOrderId: razorpayOrder.id,
        amount: razorpayOrder.amount,
        currency: razorpayOrder.currency,
      },
    });
  }

  const order = await Order.create({
    user: userId,
    orderItems,
    shippingAddress: currentAddress,
    paymentMethod,
    couponCode: appliedCoupon || null,
    couponDiscount,
    totalDiscount,
    totalAmount: subtotal,
    finalPrice,
  });

  if (paymentMethod !== 'Razorpay') {
    await Cart.deleteOne({ user: userId });
  }

  res.status(201).json({
    success: true,
    message: 'Order placed successfully',
    data: order,
  });
};

/**
 * @route POST - user/order/razorpay/verify
 * @desc  User - Verify razorpay order
 * @access Private
 */
export const verifyRazorpay = async (req, res) => {
  const {
    razorpayOrderId,
    paymentId,
    signature,
    shippingAddress,
    paymentMethod,
    couponCode,
  } = await verifyRazorpaySchema.validateAsync(req.body, { abortEarly: false });

  const userId = req?.user?.id;

  const expectedSignature = crypto
    .createHmac('sha256', process.env.RZP_SECRET_KEY)
    .update(`${razorpayOrderId}|${paymentId}`)
    .digest('hex');

  if (signature !== expectedSignature) {
    throw new BadRequestError('Invalid signature');
  }

  const currentAddress = await Address.findById(shippingAddress);
  if (!currentAddress) {
    throw new NotFoundError('Address not found');
  }

  const cart = await Cart.findOne({ user: userId }).populate({
    path: 'items.product',
    populate: { path: 'bestOffer' },
  });
  if (!cart || cart.items.length === 0) {
    throw new BadRequestError('Cart is empty or not found.');
  }

  let subtotal = 0;
  let totalDiscount = 0;
  let couponDiscount = 0;
  let appliedCoupon = null;

  const orderItems = cart.items.map((item) => {
    const product = item.product;
    if (!product) {
      throw new NotFoundError(`Product not found: ${item.product}`);
    }

    let price = product.price;
    let discountAmount = 0;

    if (product.bestOffer) {
      if (product.bestOffer.discountType === 'percentage') {
        discountAmount = (price * product.bestOffer.discountValue) / 100;
      } else {
        discountAmount = product.bestOffer.discountValue;
      }
      discountAmount = Math.min(discountAmount, price);
      price -= discountAmount;
      totalDiscount += discountAmount * item.quantity;
    }

    console.log(price, item.quantity);

    const totalPrice = price * item.quantity;

    subtotal += totalPrice;

    return {
      product: product._id,
      quantity: item.quantity,
      price: product.price,
      discount: discountAmount,
      totalPrice,
    };
  });

  if (couponCode) {
    const coupon = await Coupon.findOne({ code: couponCode.toUpperCase() });

    if (!coupon) {
      throw new NotFoundError('Invalid coupon code.');
    }

    if (!coupon.isActive) {
      throw new BadRequestError('This coupon is no longer active.');
    }

    const currentDate = new Date();
    if (currentDate < coupon.startDate || currentDate > coupon.endDate) {
      throw new BadRequestError('This coupon has expired.');
    }

    if (subtotal < coupon.minOrderAmount) {
      throw new BadRequestError(
        `Minimum order amount should be ₹${coupon.minOrderAmount} to use this coupon.`
      );
    }

    const userUsage = coupon.usersUsed.find((entry) =>
      entry.userId.equals(userId)
    );
    if (userUsage && userUsage.timesUsed >= coupon.perUserLimit) {
      throw new BadRequestError(
        'You have reached the usage limit for this coupon.'
      );
    }

    if (coupon.discountType === 'percentage') {
      couponDiscount = (subtotal * coupon.discountValue) / 100;
      if (coupon.maxDiscountAmount) {
        couponDiscount = Math.min(couponDiscount, coupon.maxDiscountAmount);
      }
    } else {
      couponDiscount = coupon.discountValue;
    }

    couponDiscount = Math.min(couponDiscount, subtotal);
    totalDiscount += couponDiscount;
    appliedCoupon = coupon.code;

    const userCouponIndex = coupon.usersUsed.findIndex((entry) =>
      entry.userId.equals(userId)
    );

    if (userCouponIndex === -1) {
      coupon.usersUsed.push({ userId, timesUsed: 1 });
    } else {
      coupon.usersUsed[userCouponIndex].timesUsed += 1;
    }

    await coupon.save();
  }

  const finalPrice = Math.round(subtotal - totalDiscount);

  const order = await Order.create({
    user: userId,
    orderItems,
    shippingAddress: currentAddress,
    paymentMethod,
    paymentStatus: 'Paid',
    couponCode: appliedCoupon || null,
    couponDiscount,
    totalDiscount,
    totalAmount: subtotal,
    finalPrice,
  });

  for (const item of cart.items) {
    await Product.findByIdAndUpdate(item.product._id, {
      $inc: { stock: -item.quantity, reservedStock: -item.quantity },
    });
  }

  await Cart.findByIdAndDelete(userId);

  res.status(200).json({
    success: true,
    message: 'Payment confirmed successfully',
    data: order,
  });
};

/**
 * @route PUT - user/order/:orderId
 * @desc  User - Cancel an order
 * @access Private
 */
export const cancelOrder = async (req, res) => {
  const { orderId } = req.params;
  const { productId } = req.body;

  if (!isValidObjectId(orderId)) {
    throw new BadRequestError('Invalid order ID.');
  }

  const order = await Order.findById(orderId).populate('orderItems.product');
  if (!order) {
    throw new NotFoundError('Order not found');
  }

  if (order.orderStatus === 'Cancelled') {
    throw new BadRequestError('Order is already cancelled.');
  }

  if (productId) {
    if (!isValidObjectId(productId)) {
      throw new BadRequestError('Invalid product ID.');
    }

    const orderItem = order.orderItems.find((item) =>
      item.product._id.equals(productId)
    );

    if (!orderItem) {
      throw new NotFoundError('Product does not exist in this order.');
    }

    const invalidStatus = [
      'Shipped',
      'Delivered',
      'Returned',
      'Return Requested',
      'Return Rejected',
    ];
    if (invalidStatus.includes(orderItem.status)) {
      throw new BadRequestError(
        `Product is already ${orderItem.status.toLowerCase()} and cannot be cancelled.`
      );
    }

    let refundAmount = orderItem.totalPrice;

    if (order.couponCode) {
      const totalOrderValue = order.totalAmount;
      const couponDiscount = order.couponDiscount;

      const productDiscountShare =
        (orderItem.totalPrice / totalOrderValue) * couponDiscount;

      refundAmount = Math.round(orderItem.totalPrice - productDiscountShare);
    }

    const product = await Product.findById(orderItem.product._id);
    if (product) {
      product.stock += orderItem.quantity;
      await product.save();
    }

    if (order.paymentStatus === 'Paid') {
      let wallet = await Wallet.findOne({ userId: order.user });

      if (!wallet) {
        wallet = await Wallet.create({ userId: order.user, transactions: [] });
      }

      wallet.transactions.push({
        type: 'credit',
        amount: refundAmount,
        status: 'completed',
      });

      wallet.balance += refundAmount;
      order.refundedAmount += refundAmount;

      await wallet.save();
    }

    orderItem.status = 'Cancelled';

    const remainingItems = order.orderItems.filter(
      (item) =>
        !['Cancelled', 'Returned', 'Return Rejected'].includes(item.status)
    );

    if (remainingItems.length === 0) {
      order.orderStatus = 'Cancelled';
    } else if (remainingItems.some((item) => item.status === 'Delivered')) {
      order.orderStatus = 'Partially Cancelled';
    }

    await order.save();

    return res.status(200).json({
      success: true,
      message: 'Product has been successfully cancelled.',
      data: order,
    });
  }

  const invalidOrderStatuses = ['Shipped', 'Delivered'];
  if (invalidOrderStatuses.includes(order.orderStatus)) {
    throw new BadRequestError(
      `Cannot cancel order as it is already ${order.orderStatus.toLowerCase()}.`
    );
  }

  for (const item of order.orderItems) {
    if (!['Cancelled', 'Returned', 'Return Rejected'].includes(item.status)) {
      const product = await Product.findById(item.product);
      if (product) {
        product.stock += item.quantity;
        await product.save();
      }
      item.status = 'Cancelled';
    }
  }

  if (order.paymentStatus === 'Paid') {
    let wallet = await Wallet.findOne({ userId: order.user });

    if (!wallet) {
      wallet = await Wallet.create({ userId: order.user, transactions: [] });
    }

    wallet.transactions.push({
      type: 'credit',
      amount: order.finalPrice,
      status: 'completed',
    });

    wallet.balance += order.finalPrice;
    order.refundedAmount = order.finalPrice;

    await wallet.save();
  }

  order.orderStatus = 'Cancelled';
  await order.save();

  res.status(200).json({
    success: true,
    message: 'Order has been successfully cancelled.',
    data: order,
  });
};

/**
 * @route PATCH - user/order/:orderId
 * @desc  User - Request to return an order
 * @access Private
 */
export const requestReturnOrder = async (req, res) => {
  const { orderId } = req.params;
  const { productId, reason = 'No Reason' } = req.body;

  if (!isValidObjectId(orderId)) {
    throw new BadRequestError('Invalid order ID.');
  }

  if (!isValidObjectId(productId)) {
    throw new BadRequestError('Invalid product ID.');
  }

  const order = await Order.findById(orderId).populate('orderItems.product');
  if (!order) {
    throw new NotFoundError('Order not found');
  }

  if (order.orderStatus === 'Cancelled') {
    throw new BadRequestError('Order is already cancelled.');
  }

  const orderItem = order.orderItems.find((obj) =>
    obj?.product?.equals(productId)
  );

  if (!orderItem) {
    throw new NotFoundError('Product does not exist in this order.');
  }

  const product = await Product.findById(orderItem.product);
  if (!product) {
    throw new NotFoundError('Product was not found');
  }

  const invalidStatus = ['Shipped', 'Cancelled'];
  if (invalidStatus.includes(orderItem.status)) {
    throw new BadRequestError(
      `Product is already ${orderItem.status.toLowerCase()}`
    );
  }

  if (orderItem.returnRequest.requested) {
    throw new BadRequestError(
      'Return request for this product has already been initiated.'
    );
  }

  orderItem.returnRequest = {
    requested: true,
    reason,
    approved: false,
    responseSent: false,
  };

  orderItem.status = 'Return Requested';

  await order.save();

  res.status(200).json({
    success: true,
    message: 'Return request has been sent.',
    data: order,
  });
};

/**
 * @route GET - user/order
 * @desc  User - Get all orders
 * @access Private
 */
export const getUserOrders = async (req, res) => {
  const userId = req.user.id;

  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;

  const queryOptions = {
    filter: { user: userId },
    sort: { updatedAt: -1 },
    populate: [{ path: 'orderItems.product', select: 'name price images' }],
  };

  const orders = await paginate(Order, page, limit, queryOptions);

  if (orders?.result?.length === 0) {
    throw new NotFoundError('No orders found for this user');
  }

  res.status(200).json({
    success: true,
    message: 'User orders retrieved successfully',
    data: {
      orders: orders?.result,
      totalPage: orders?.totalPages,
      currentPage: orders?.currentPage,
    },
  });
};

/**
 * @route GET - user/order/:orderId
 * @desc  User - Specific order details
 * @access Private
 */
export const getUserOrder = async (req, res) => {
  const userId = req.user.id;

  const { orderId } = req.params;
  if (!isValidObjectId(orderId)) {
    throw new BadRequestError('Invalid order ID.');
  }

  const order = await Order.findOne({ _id: orderId, user: userId }).populate({
    path: 'orderItems',
    populate: {
      path: 'product',
      model: 'Product',
    },
  });
  if (!order) {
    throw new NotFoundError('Order not found');
  }

  res.status(200).json({
    success: true,
    message: 'User order retrieved successfully',
    data: order,
  });
};

/*****************************************/
// Order Management - Admin
/*****************************************/

/**
 * @route PATCH - admin/order/:orderId
 * @desc  Admin - Updating order status
 * @access Private
 */
export const updateOrderStatus = async (req, res) => {
  const { orderId } = req.params;
  const { status } = req.body;

  // Validate order ID
  if (!isValidObjectId(orderId)) {
    throw new BadRequestError('Invalid order ID.');
  }

  const order = await Order.findById(orderId).populate('orderItems.product');
  if (!order) {
    throw new NotFoundError('Order not found.');
  }

  const validTransitions = {
    Processing: ['Shipped', 'Cancelled'],
    Shipped: ['Delivered', 'Cancelled'],
    Delivered: [],
    Cancelled: [],
  };

  if (!validTransitions[order.orderStatus]?.includes(status)) {
    throw new BadRequestError(
      `Invalid status transition from ${order.orderStatus} to ${status}.`
    );
  }

  if (status === 'Shipped') {
    order.deliveryBy = new Date();
    order.deliveryBy.setDate(order.deliveryBy.getDate() + 5);
  }

  if (status === 'Cancelled' && order.orderStatus === 'Processing') {
    for (const item of order.orderItems) {
      const product = await Product.findById(item.product);
      if (product) {
        product.stock += item.quantity;
        await product.save();
      }
    }
  }

  let refundAmount = 0;
  if (status === 'Cancelled' && order.paymentStatus === 'Paid') {
    order.refundedAmount = order.finalPrice;
    refundAmount = order.finalPrice;

    let wallet = await Wallet.findOne({ userId: order.user });
    if (!wallet) {
      wallet = await Wallet.create({ userId: order.user, transactions: [] });
    }

    wallet.transactions.push({
      type: 'credit',
      amount: refundAmount,
      status: 'completed',
    });

    wallet.balance += refundAmount;
    order.refundedAmount = refundAmount;

    await wallet.save();
  }

  order.orderItems.forEach((item) => {
    if (item.status !== 'Cancelled') item.status = status;
  });
  order.orderStatus = status;

  await order.save();

  res.status(200).json({
    success: true,
    message: 'Order status updated successfully',
    data: order,
  });
};

/**
 * @route PUT - admin/order/:orderId
 * @desc  Admin - Process return request
 * @access Private
 */
export const requestReturnAdmin = async (req, res) => {
  const { orderId } = req.params;
  const { productId, action } = req.body;

  if (!isValidObjectId(orderId)) {
    throw new BadRequestError('Invalid order ID.');
  }

  if (!isValidObjectId(productId)) {
    throw new BadRequestError('Invalid product ID.');
  }

  if (!['approve', 'reject'].includes(action)) {
    throw new BadRequestError('Invalid action, please use approve or reject');
  }

  const order = await Order.findById(orderId);
  if (!order) {
    throw new NotFoundError('Order not found');
  }

  if (order.orderStatus === 'Cancelled') {
    throw new BadRequestError('Order is already cancelled.');
  }

  const orderItem = order.orderItems.find((obj) =>
    obj?.product?.equals(productId)
  );

  if (!orderItem) {
    throw new NotFoundError('Product does not exist in this order.');
  }

  const invalidStatus = [
    'Delivered',
    'Shipped',
    'Return Rejected',
    'Cancelled',
  ];

  if (invalidStatus.includes(orderItem.status)) {
    throw new BadRequestError(
      `Product is already ${orderItem.status.toLowerCase()}`
    );
  }

  if (!orderItem.returnRequest.requested) {
    throw new BadRequestError('No return request has been initiated.');
  }

  if (
    orderItem.returnRequest.approved ||
    orderItem.returnRequest.responseSent
  ) {
    throw new BadRequestError('Return request has already been processed.');
  }

  if (action === 'approve') {
    orderItem.returnRequest.approved = true;
    orderItem.status = 'Returned';

    const product = await Product.findById(productId);
    product.stock += orderItem.quantity;
    await product.save();

    const orderDiscount = order.couponDiscount;
    const orderTotal = order.finalPrice;

    const discountRatio = orderDiscount / orderTotal;
    const itemDiscount = orderItem.totalPrice * discountRatio;
    const refundAmount = (orderItem.totalPrice - itemDiscount).toFixed();

    let wallet = await Wallet.findOne({ userId: order.user });
    if (!wallet) {
      wallet = await Wallet.create({ userId: order.user, transactions: [] });
    }

    wallet.transactions.push({
      type: 'credit',
      amount: refundAmount,
      status: 'completed',
    });

    wallet.balance += refundAmount;
    await wallet.save();
  } else if (action === 'reject') {
    orderItem.returnRequest.approved = false;
    orderItem.status = 'Return Rejected';
  }

  orderItem.returnRequest.responseSent = true;

  await order.save();

  res.status(200).json({
    success: true,
    message: 'Return request has been processed.',
    data: order,
  });
};

/**
 * @route GET - admin/order
 * @desc  Admin - Get all orders
 * @access Private
 */
export const getAllOrders = async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;

  const queryOptions = {
    sort: { updatedAt: -1 },
    populate: [
      { path: 'orderItems.product', select: 'name price images' },
      { path: 'user', select: 'name _id' },
    ],
  };

  const orders = await paginate(Order, page, limit, queryOptions);

  res.status(200).json({
    success: true,
    message: 'All orders retrieved successfully',
    data: {
      orders: orders?.result,
      totalPage: orders?.totalPages,
      currentPage: orders?.currentPage,
    },
  });
};
