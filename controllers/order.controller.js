import Order from '../models/order.model.js';
import Product from '../models/product.model.js';
import { BadRequestError, NotFoundError } from '../errors/index.js';
import { placeOrderSchema } from '../validations/user.validations.js';
import { paginate } from '../utils/paginate.js';

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

    // Update stock
    product.stock -= item.quantity;
    await product.save();
  }

  // Apply coupon discount
  const couponAmount = subtotal * ((couponDiscount || 0) / 100);
  const finalPrice = subtotal - couponAmount;

  // Create order
  const order = new Order({
    user: userId,
    orderItems,
    shippingAddress,
    paymentMethod,
    couponCode: couponCode || null,
    couponDiscount: couponAmount,
    totalAmount: subtotal,
    finalPrice,
  });

  await order.save();

  res.status(201).json({
    success: true,
    message: 'Order placed successfully',
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
    populate: [{ path: 'orderItems.product', select: 'name price' }],
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
 * @desc  User - Cancel an order
 * @access Private
 */
export const cancelOrder = async (req, res) => {
  const { orderId } = req.params;

  const order = await Order.findById(orderId).populate('orderItems.product');
  if (!order) {
    throw new NotFoundError('Order not found');
  }

  if (order.orderStatus === 'Cancelled') {
    throw new BadRequestError('Order is already cancelled.');
  }

  if (order.orderStatus !== 'Shipped') {
    for (const item of order.orderItems) {
      const product = item.product;

      // Update the stock
      if (product) {
        product.stock += item.quantity;
        await product.save();
      }
    }
  }

  order.orderStatus = 'Cancelled';
  await order.save();

  res.status(200).json({
    success: true,
    message: 'Order has been successfully cancelled.',
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

  console.log(orderId, status);
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

  if (orders?.result?.length === 0) {
    throw new NotFoundError('No orders found for this user');
  }

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
