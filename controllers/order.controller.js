import Order from '../models/order.model.js';
import Product from '../models/product.model.js';
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
  } = req.body;
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
      item.price * (1 - item.discount / 100) * item.quantity;
    item.totalPrice = itemTotalPrice;
    subtotal += itemTotalPrice;

    // Update stock
    product.stock -= item.quantity;
    await product.save();
  }

  // Apply coupon discount
  const couponAmount = subtotal * (couponDiscount / 100);
  const finalPrice = subtotal - couponAmount;

  // Create order
  const order = new Order({
    user: userId,
    orderItems,
    shippingAddress,
    paymentMethod,
    couponCode: couponCode || null,
    couponDiscount: couponAmount,
    subtotal,
    totalAmount: finalPrice,
  });

  await order.save();
  res.status(201).json({
    success: true,
    message: 'Order placed successfully',
    data: order,
  });
};

/*****************************************/
// Order Management - Admin
/*****************************************/

/**
 * @route POST - user/order/:orderId
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
