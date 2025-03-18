import Order from '../models/order.model.js';
import {
  startOfDay,
  endOfDay,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  startOfYear,
  endOfYear,
} from 'date-fns';

export const generateSalesData = async (startDate, endDate, period) => {
  let start, end;

  switch (period) {
    case 'Daily':
      start = startOfDay(new Date());
      end = endOfDay(new Date());
      break;
    case 'Weekly':
      start = startOfWeek(new Date());
      end = endOfWeek(new Date());
      break;
    case 'Monthly':
      start = startOfMonth(new Date());
      end = endOfMonth(new Date());
      break;
    case 'Yearly':
      start = startOfYear(new Date());
      end = endOfYear(new Date());
      break;
    default:
      if (startDate && endDate) {
        start = new Date(startDate);
        end = new Date(endDate);
      } else {
        throw new Error('Invalid date range provided.');
      }
  }

  // Fetch delivered orders in the given period
  const orders = await Order.find({
    placedAt: { $gte: start, $lte: end },
    orderStatus: 'Delivered',
  }).populate('user', 'name');

  if (!orders.length) {
    throw new Error('No sales data found for the selected period.');
  }

  // Summary calculations
  const summary = {
    totalOrders: orders.length,
    totalSales: 0,
    totalDiscounts: 0,
    totalCouponDiscounts: 0,
    totalShippingCharges: 0,
    netRevenue: 0,
  };

  // Order-wise details
  const salesData = orders.map((order) => {
    summary.totalSales += order.totalAmount;
    summary.totalDiscounts += order.totalDiscount;
    summary.totalCouponDiscounts += order.couponDiscount;
    summary.totalShippingCharges += order.shippingAddress?.shippingCost || 0;
    summary.netRevenue += order.finalPrice;

    return {
      orderDate: new Date(order.placedAt).toLocaleDateString(),
      orderId: order._id.toString(),
      customer: order.user?.name || 'Guest',
      totalOrderAmount: order.totalAmount,
      discount: order.totalDiscount,
      couponDiscount: order.couponDiscount,
      shippingCharge: order.shippingAddress?.shippingCost || 0,
      netTotal: order.finalPrice,
    };
  });

  return { summary, salesData };
};
