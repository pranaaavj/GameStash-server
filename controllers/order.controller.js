import {
  placeOrderSchema,
  verifyRazorpaySchema,
} from '../validations/user.validations.js';
import Order from '../models/order.model.js';
import Cart from '../models/cart.model.js';
import crypto from 'crypto';
import Address from '../models/address.model.js';
import Product from '../models/product.model.js';
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
  const {
    orderItems,
    shippingAddress,
    paymentMethod,
    couponCode,
    couponDiscount,
  } = await placeOrderSchema.validateAsync(req.body, {
    abortEarly: false,
  });

  const userId = req?.user?.id;

  // Validate stock and calculate item total prices
  let subtotal = 0;

  for (const item of orderItems) {
    const product = await Product.findById(item.product);
    if (!product) {
      throw new NotFoundError(`Product not found for ID: ${item.product}`);
    }

    if (product.stock < item.quantity) {
      throw new BadRequestError(
        `Insufficient stock for product: ${product.name}`
      );
    }

    // Calculate item price after discount and add to subtotal
    const itemTotalPrice =
      item.price * (1 - (item.discount || 0) / 100) * item.quantity;
    item.totalPrice = itemTotalPrice;
    subtotal += itemTotalPrice;

    if (paymentMethod === 'Razorpay' || paymentMethod === 'COD') {
      product.reservedStock = (product.reservedStock || 0) + item.quantity;
    } else {
      product.stock -= item.quantity;
    }

    await product.save();
  }

  // Apply coupon discount
  const couponAmount = subtotal * ((couponDiscount || 0) / 100);
  const finalPrice = subtotal - couponAmount;

  await Cart.findOneAndUpdate(
    { user: userId },
    {
      $set: {
        items: orderItems,
        total: subtotal,
        discount: couponAmount,
      },
    },
    { new: true, upsert: true }
  );

  const currentAddress = await Address.findById(shippingAddress);
  if (!currentAddress) {
    throw new NotFoundError('Address not found');
  }

  // Sending order to Razorpay
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

  // Create order
  const order = await Order.create({
    user: userId,
    orderItems,
    shippingAddress: currentAddress,
    paymentMethod,
    couponCode: couponCode || null,
    couponDiscount: couponAmount,
    totalAmount: subtotal,
    finalPrice,
  });

  // Clear cart after order is placed
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
    couponDiscount,
  } = await verifyRazorpaySchema.validateAsync(req.body, {
    abortEarly: false,
  });
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

  const cart = await Cart.findOne({ user: userId }).populate('items.product');
  if (!cart || cart.items.length === 0) {
    throw new BadRequestError('Cart is empty or not found.');
  }

  const order = await Order.create({
    user: userId,
    orderItems: cart.items.map((item) => ({
      product: item.product._id,
      quantity: item.quantity,
      price: item.product.price,
      discount: item.product.discount || 0,
      totalPrice:
        item.quantity *
        (item.product.price * (1 - (item.product.discount || 0) / 100)),
    })),
    shippingAddress: currentAddress,
    paymentMethod,
    paymentStatus: 'Paid',
    couponCode: couponCode || null,
    couponDiscount,
    totalAmount: cart.total,
    finalPrice: cart.total - cart.discount,
  });

  for (const item of cart.items) {
    await Product.findByIdAndUpdate(item.product._id, {
      $inc: {
        stock: -item.quantity,
        reservedStock: -item.quantity,
      },
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
    obj.product.equals(productId)
  );

  if (!orderItem) {
    throw new NotFoundError('Product does not exist in this order.');
  }

  const invalidStatus = ['Delivered', 'Shipped', 'Cancelled'];
  if (invalidStatus.includes(orderItem.status)) {
    throw new BadRequestError(
      `Product is already ${orderItem.status.toLowerCase()}`
    );
  }

  const product = await Product.findById(orderItem.product);
  if (!product) {
    throw new NotFoundError('Product was not found');
  }
  const cancelledQuantity = orderItem.quantity;
  product.stock += cancelledQuantity;
  orderItem.status = 'Cancelled';

  const allItemsCancelled = order.orderItems.every(
    (item) => item.status === 'Cancelled'
  );

  if (allItemsCancelled) {
    order.orderStatus = 'Cancelled';
  }

  await order.save();
  await product.save();

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

  const invalidStatus = ['Delivered', 'Shipped', 'Cancelled'];
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

  const product = await Product.findById(orderItem.product);
  if (!product) {
    throw new NotFoundError('Product was not found');
  }

  await product.save();
  await order.save();

  res.status(200).json({
    success: true,
    message: 'Return request has been sent.',
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

  const order = await Order.findById(orderId);
  if (!order) {
    throw new NotFoundError('Order not found');
  }

  if (order.orderStatus === 'Cancelled') {
    throw new BadRequestError('Cancelled order cannot be further changed.');
  }

  if (status === 'Cancelled' && order.orderStatus !== 'Shipped') {
    // Handle stock restoration if needed for cancellations
    for (const item of order.orderItems) {
      const product = await Product.findById(item.product);
      product.stock += item.quantity;
      await product.save();
    }
  }

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
    // Approve return request
    orderItem.returnRequest.approved = true;
    orderItem.status = 'Returned';

    const product = await Product.findById(productId);
    product.stock += orderItem.quantity;
    await product.save();
  } else if (action === 'reject') {
    // Reject return request
    orderItem.returnRequest.approved = false;
    orderItem.status = 'Return Rejected';
  } else {
    throw new BadRequestError(
      'Invalid action, please use "approve" or "reject"'
    );
  }

  // await Order.findByIdAndUpdate(
  //   {
  //     _id: orderId,
  //     'orderItems.product': productId,
  //   },
  //   {
  //     $set: {
  //       'orderItems.$.returnRequest.approved': action === 'approve',
  //       'orderItems.$.status': action === 'approve' ? 'Returned' : 'Rejected',
  //       'orderItems.$.returnRequest.responseSent': true,
  //     },
  //   }
  // );

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
      { path: 'orderItems.product', select: 'name price' },
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
