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
import {
  BadRequestError,
  NotFoundError,
  UnauthorizedError,
} from '../errors/index.js';
import PDFDocument from 'pdfkit';

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

  const orderItemsSnapshot = [];

  for (const item of orderItems) {
    const product = await Product.findById(item.product).populate('bestOffer');

    if (!product)
      throw new NotFoundError(`Product not found for ID: ${item.product}`);

    if (product.stock < item.quantity)
      throw new BadRequestError(
        `Insufficient stock for product: ${product.name}`
      );

    let itemDiscount = 0;
    if (product.bestOffer) {
      itemDiscount =
        product.bestOffer.discountType === 'percentage'
          ? (product.price * product.bestOffer.discountValue) / 100
          : product.bestOffer.discountValue;

      itemDiscount = Math.min(itemDiscount, product.price);
    }

    subtotal += product.price * item.quantity;
    totalDiscount += itemDiscount * item.quantity;

    orderItemsSnapshot.push({
      product: {
        ...product.toObject(),
      },
      discount: itemDiscount,
      price: product.price,
      quantity: item.quantity,
      totalPrice: (product.price - itemDiscount) * item.quantity,
    });

    product.stock -= item.quantity;
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

  if (paymentMethod === 'Wallet') {
    let wallet = await Wallet.findOne({ userId });

    if (!wallet) {
      wallet = await Wallet.create({ userId, transactions: [] });
    }

    if (wallet.balance < finalPrice) {
      throw new BadRequestError('Insufficient wallet balance');
    }

    wallet.balance -= finalPrice;

    wallet.transactions.push({
      type: 'debit',
      amount: finalPrice,
      status: 'completed',
      description: `Payment for order`,
    });

    await wallet.save();
  }

  const order = await Order.create({
    user: userId,
    orderItems: orderItemsSnapshot,
    shippingAddress: currentAddress,
    paymentMethod,
    couponCode: appliedCoupon || null,
    couponDiscount,
    totalDiscount,
    totalAmount: subtotal,
    finalPrice,
    paymentStatus: paymentMethod === 'Wallet' ? 'Paid' : 'Pending',
  });

  await Cart.deleteOne({ user: userId });

  if (paymentMethod === 'Razorpay') {
    const razorpayOrder = await createRazorpayOrder(finalPrice);

    order.razorpayOrderId = razorpayOrder.id;
    await order.save();

    return res.status(200).json({
      success: true,
      message: 'Razorpay order created successfully',
      data: {
        razorpayOrderId: razorpayOrder.id,
        amount: razorpayOrder.amount,
        currency: razorpayOrder.currency,
        orderId: order._id,
      },
    });
  }

  res.status(201).json({
    success: true,
    message: 'Order placed successfully',
    data: order,
  });
};

/**
 * @route POST - user/order/razorpay
 * @desc  User - Verify razorpay order
 * @access Private
 */
export const verifyRazorpay = async (req, res) => {
  const { razorpayOrderId, paymentId, signature } =
    await verifyRazorpaySchema.validateAsync(req.body, { abortEarly: false });
  const { orderId } = req.params;
  const userId = req?.user?.id;

  const expectedSignature = crypto
    .createHmac('sha256', process.env.RZP_SECRET_KEY)
    .update(`${razorpayOrderId}|${paymentId}`)
    .digest('hex');

  if (signature !== expectedSignature) {
    throw new BadRequestError('Invalid signature');
  }

  const order = await Order.findById(orderId);
  if (!order) {
    throw new BadRequestError('No order found with this Id.');
  }

  if (order.user.toString() !== userId) {
    throw new UnauthorizedError('You are not authorized to access this order');
  }

  if (order.paymentStatus === 'Paid') {
    throw new BadRequestError('This order has already been paid.');
  }

  for (const item of order.orderItems) {
    await Product.findByIdAndUpdate(item.product._id, {
      $inc: { stock: -item.quantity, reservedStock: -item.quantity },
    });
  }

  order.paymentStatus = 'Paid';
  await order.save();

  res.status(200).json({
    success: true,
    message: 'Payment confirmed successfully',
    data: order,
  });
};

/**
 * @route PATCH - user/order/razorpay
 * @desc  User - Mark payment as failed
 * @access Private
 */
export const markPaymentAsFailed = async (req, res) => {
  const { orderId } = req.params;
  const userId = req.user.id;

  const order = await Order.findById(orderId);
  if (!order) {
    throw new NotFoundError('Order not found.');
  }

  if (order.user.toString() !== userId) {
    throw new UnauthorizedError('You are not authorized to update this order.');
  }

  if (order.paymentStatus === 'Paid') {
    throw new BadRequestError('This order has already been paid.');
  }

  order.paymentStatus = 'Failed';
  await order.save();

  res.status(200).json({
    success: true,
    message: 'Payment marked as failed.',
  });
};

/**
 * @route PUT - user/order/razorpay
 * @desc  User - Retry payment
 * @access Private
 */
export const retryPayment = async (req, res) => {
  const { orderId } = req.params;
  const { paymentMethod } = req.body;
  const userId = req.user.id;

  if (!orderId) {
    throw new BadRequestError('Order ID is required.');
  }

  const order = await Order.findById(orderId);
  if (!order) {
    throw new NotFoundError('Order not found.');
  }

  if (order.user.toString() !== userId) {
    throw new BadRequestError('Unauthorized access to this order.');
  }

  if (order.paymentStatus !== 'Failed') {
    throw new BadRequestError('This order is not eligible for retry.');
  }

  if (order.paymentStatus === 'Paid') {
    throw new BadRequestError('This order has already been paid.');
  }

  const validPaymentMethods = ['Wallet', 'Razorpay'];
  if (!validPaymentMethods.includes(paymentMethod)) {
    throw new BadRequestError('Invalid payment method.');
  }

  const activeOrderItems = order.orderItems.filter(
    (item) => item.status !== 'Cancelled'
  );

  const currentTotalAmount = activeOrderItems.reduce(
    (sum, item) => sum + item.totalPrice,
    0
  );

  let currentCouponDiscount = 0;
  if (order.couponDiscount > 0 && order.totalAmount > 0) {
    currentCouponDiscount =
      (currentTotalAmount / order.totalAmount) * order.couponDiscount;

    currentCouponDiscount = Math.round(currentCouponDiscount * 100) / 100;
  }

  const amountToCharge = Math.max(
    0,
    currentTotalAmount - currentCouponDiscount
  );

  if (paymentMethod === 'Razorpay') {
    const paymentResponse = await createRazorpayOrder(amountToCharge);

    order.razorpayOrderId = paymentResponse.id;
    order.paymentStatus = 'Pending';
    await order.save();

    return res.status(200).json({
      success: true,
      message: 'Razorpay payment initiated successfully.',
      data: {
        orderId: order._id,
        razorpayOrderId: paymentResponse.id,
        amount: paymentResponse.amount,
        currency: paymentResponse.currency,
      },
    });
  }

  if (paymentMethod === 'Wallet') {
    let wallet = await Wallet.findOne({ userId });

    if (!wallet) {
      wallet = await Wallet.create({ userId, balance: 0, transactions: [] });
    }

    if (wallet.balance < amountToCharge) {
      throw new BadRequestError('Insufficient wallet balance');
    }

    wallet.balance -= amountToCharge;

    wallet.transactions.push({
      type: 'debit',
      amount: amountToCharge,
      status: 'completed',
      description: `Payment for order #${order._id.toString().slice(-6)}`,
    });

    await wallet.save();

    order.paymentMethod = 'Wallet';
    order.paymentStatus = 'Paid';
    await order.save();

    return res.status(200).json({
      success: true,
      message: 'Payment completed successfully using wallet balance.',
      data: {
        order,
        originalAmount: order.finalPrice,
        actualChargedAmount: amountToCharge,
      },
    });
  }

  res.status(400).json({
    success: false,
    message: 'Invalid payment retry request.',
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
        description: `Refund amount of order ${order._id.toString().slice(-6)}`,
      });

      wallet.balance += Number(refundAmount);
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

    wallet.balance += Number(order.finalPrice);
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
export const generateInvoicePDF = async (req, res) => {
  try {
    const { orderId } = req.params;
    const order = await Order.findById(orderId)
      .populate('user')
      .populate('orderItems.product');

    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    const doc = new PDFDocument({
      margin: 50,
      size: 'A4',
      layout: 'portrait',
      font: 'Helvetica',
      bufferPages: true,
    });

    // Set up response headers
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="invoice_${orderId}.pdf"`
    );
    doc.pipe(res);

    // Header Section
    let y = 45;
    doc
      // .image('public/images/logo.png', 50, y, { width: 50 })
      .fillColor('#2c3e50')
      .fontSize(20)
      .font('Helvetica-Bold')
      .text('INVOICE', 400, y, { align: 'right' });

    // Invoice Details
    doc
      .fontSize(10)
      .fillColor('#666666')
      .text(`Invoice #: ${orderId.slice(-8)}`, 400, y + 30, { align: 'right' })
      .text(
        `Date: ${order.placedAt.toLocaleDateString('en-IN')}`,
        400,
        y + 45,
        {
          align: 'right',
        }
      );

    // Company and Customer Info
    y = 120;
    const companyInfo = {
      name: 'Your Company Name',
      address: ['123 Business Street', 'City, State', 'PIN: 123456'],
      contacts: ['Phone: +91 12345 67890', 'email@company.com'],
    };

    doc
      .font('Helvetica-Bold')
      .fillColor('#2c3e50')
      .text('From:', 50, y)
      .font('Helvetica')
      .fillColor('#333333');

    companyInfo.address.forEach((line, i) => {
      doc.text(line, 50, y + 15 + i * 15);
    });
    companyInfo.contacts.forEach((line, i) => {
      doc.text(line, 50, y + 60 + i * 15);
    });

    // Bill To Section
    const customerAddress = [
      order.user?.name || 'N/A',
      order.shippingAddress?.addressLine || 'N/A',
      `${order.shippingAddress?.city || 'N/A'}, ${
        order.shippingAddress?.state || 'N/A'
      } ${order.shippingAddress?.pinCode || ''}`,
      `Phone: ${order.user?.phone || 'N/A'}`,
    ];

    doc
      .font('Helvetica-Bold')
      .fillColor('#2c3e50')
      .text('Bill To:', 300, y)
      .font('Helvetica')
      .fillColor('#333333');

    customerAddress.forEach((line, i) => {
      doc.text(line, 300, y + 15 + i * 15);
    });

    // Order Items Table
    y = 240;
    const columnWidths = [250, 80, 80, 80];
    const alignments = ['left', 'right', 'right', 'right'];

    // Table Header
    doc
      .rect(50, y, 500, 20)
      .fill('#2c3e50')
      .font('Helvetica-Bold')
      .fontSize(10)
      .fillColor('#ffffff');

    ['Item', 'Price', 'Qty', 'Total'].forEach((text, i) => {
      const x =
        i === 0
          ? 55
          : 50 + columnWidths.slice(0, i).reduce((a, b) => a + b) + 5;
      doc.text(text, x, y + 5, {
        width: columnWidths[i] - 10,
        align: alignments[i],
      });
    });

    // Table Rows
    y += 25;
    order.orderItems.forEach((item, index) => {
      if (y > doc.page.height - 100) {
        doc.addPage();
        y = 50;
      }

      const row = [
        item.product.name.substring(0, 40),
        `₹${item.price.toFixed(2)}`,
        item.quantity.toString(),
        `₹${item.totalPrice.toFixed(2)}`,
      ];

      if (index % 2 === 0) {
        doc.rect(50, y - 5, 500, 20).fill('#f8f9fa');
      }

      row.forEach((text, i) => {
        const x =
          i === 0
            ? 55
            : 50 + columnWidths.slice(0, i).reduce((a, b) => a + b) + 5;
        doc
          .font('Helvetica')
          .fontSize(9)
          .fillColor('#333333')
          .text(text, x, y, {
            width: columnWidths[i] - 10,
            align: alignments[i],
          });
      });

      y += 20;
    });

    // Summary Section
    y += 50;
    const summaryLines = [
      { label: 'Subtotal:', value: order.totalAmount },
      { label: 'Discounts:', value: -order.totalDiscount },
      { label: 'Coupon Discount:', value: -order.couponDiscount },
      { label: 'Shipping:', value: 0 },
      { label: 'Total:', value: order.finalPrice },
    ];

    summaryLines.forEach((line, i) => {
      doc
        .font('Helvetica-Bold')
        .fontSize(10)
        .fillColor('#2c3e50')
        .text(line.label, 400, y + i * 20, { align: 'left' })
        .text(`₹${Math.abs(line.value).toFixed(2)}`, 500, y + i * 20, {
          align: 'left',
          width: 80,
        });
    });

    // Payment Information
    y += 100;
    doc
      .font('Helvetica')
      .fontSize(10)
      .fillColor('#666666')
      .text(
        `Payment Method: ${order.paymentMethod} | Status: ${order.paymentStatus}`,
        50,
        y
      )
      .text(`Order Status: ${order.orderStatus}`, 50, y + 20);

    // Footer
    doc
      .fontSize(8)
      .fillColor('#666666')
      .text('Thank you for your business!', 50, doc.page.height - 50, {
        align: 'center',
      });

    doc.end();
  } catch (error) {
    console.error('Invoice Generation Error:', error);
    res.status(500).json({ error: 'Failed to generate invoice' });
  }
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
    populate: [
      {
        path: 'orderItems.product',
        select: 'name price images discountedPrice',
      },
    ],
  };

  const orders = await paginate(Order, page, limit, queryOptions);

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

    wallet.balance += Number(refundAmount);
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
      description: 'Return amount',
    });

    order.refundedAmount += Number(refundAmount);

    wallet.balance += Number(refundAmount);
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
