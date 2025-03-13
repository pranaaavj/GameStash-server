import {
  NotFoundError,
  BadRequestError,
  UnauthorizedError,
} from '../errors/index.js';
import User from '../models/user.model.js';
import {
  createAccessToken,
  createRefreshToken,
  paginate,
  verifyToken,
} from '../utils/index.js';
import { isValidObjectId } from 'mongoose';
import Order from '../models/order.model.js';
import { loginSchema } from '../validations/auth.validation.js';
import PDFDocument from 'pdfkit';
import writeXlsxFile from 'write-excel-file/node';
import path from 'path';

/*****************************************/
// Admin
/*****************************************/

/**
 * @route POST - admin/login
 * @desc  Admin login
 * @access Public
 */
export const loginAdmin = async (req, res) => {
  const { email, password } = await loginSchema.validateAsync(req.body, {
    abortEarly: false,
  });

  const user = await User.findOne({ email });
  if (!user) {
    throw new NotFoundError('No admin found with this email.');
  }

  if (user.role !== 'admin') {
    throw new UnauthorizedError(`You're not authorized to access here.`);
  }

  const isPasswordCorrect = await user.comparePassword(password);
  if (!isPasswordCorrect) {
    throw new UnauthorizedError(
      'Incorrect email or password. Please check your details and try again.'
    );
  }

  const accessToken = await createAccessToken(user);
  const refreshToken = await createRefreshToken(user);

  res
    .status(200)
    .cookie('adminJwt', refreshToken, {
      httpOnly: true,
      secure: true,
      sameSite: 'none',
      maxAge: 1000 * 60 * 60 * 24,
    })
    .json({
      success: true,
      message: 'You’ve successfully logged in.',
      data: { user, accessToken },
    });
};

/**
 * @route POST - admin/logout
 * @desc  Logs out Admin and clears cookies
 * @access Public
 */
export const logoutAdmin = (req, res) => {
  const refreshToken = req.cookies?.adminJwt;
  if (!refreshToken) throw new BadRequestError('No refresh token found.');

  res
    .clearCookie('adminJwt', {
      httpOnly: true,
      sameSite: 'none',
      secure: process.env.NODE_ENV !== 'development',
    })
    .json({
      success: true,
      message: 'You have been logged out successfully.',
      data: null,
    });
};

/**
 * @route GET - admin/refresh-token
 * @desc  Validating refresh token and generating access token
 * @access Public
 */
export const refreshTokenAdmin = async (req, res) => {
  const refreshToken = req.cookies?.adminJwt;

  if (!refreshToken)
    throw new BadRequestError('Refresh token is missing from the request.');

  const decoded = await verifyToken(
    refreshToken,
    process.env.REFRESH_TOKEN_SECRET
  );

  const user = await User.findById(decoded?.userId);
  if (!user)
    throw new ForbiddenError('Invalid refresh token, You are not authorized.');

  const accessToken = await createAccessToken(user);

  res.json({
    success: true,
    message: 'Access token generated.',
    data: { accessToken },
  });
};

/**
 * @route GET - admin/users
 * @desc  Admin - Listing all users
 * @access Private
 */
export const getAllUsers = async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;

  const queryOptions = {
    sort: { createdAt: -1 },
  };

  const users = await paginate(User, page, limit, queryOptions);

  if (users?.result?.length === 0) {
    throw new NotFoundError('No users found');
  }

  res.status(200).json({
    success: true,
    message: 'All Users',
    data: {
      users: users.result,
      totalPages: users.totalPages,
      currentPage: users.currentPage,
    },
  });
};

/**
 * @route GET - admin/users/:userId
 * @desc  Admin - Getting one user
 * @access Private
 */
export const getOneUser = async (req, res) => {
  const userId = req.params?.userId?.trim();

  // Validate object ID
  if (!userId || !isValidObjectId(userId)) {
    throw new BadRequestError('Invalid user ID format.');
  }

  const user = await User.findById(userId);
  if (!user) {
    throw new NotFoundError('No User found.');
  }

  res.status(200).json({
    success: true,
    message: 'User fetched successfully.',
    data: user,
  });
};

/**
 * @route PATCH - admin/users
 * @desc  Admin - Toggling block and unblock of users
 * @access Private
 */
export const toggleBlockUser = async (req, res) => {
  const { userId } = req.body;

  // Validate object ID
  if (!userId || !isValidObjectId(userId)) {
    throw new BadRequestError('Invalid user ID format.');
  }

  const user = await User.findById(userId);
  if (!user) {
    throw new NotFoundError('No User found.');
  }

  if (user.role === 'admin') {
    throw new BadRequestError(`You cannot block an admin.`);
  }

  user.status = user.status === 'blocked' ? 'active' : 'blocked';
  await user.save();

  res.status(200).json({
    success: true,
    message: `User ${
      user.status === 'blocked' ? 'blocked' : 'unblocked'
    } successfully.`,
    data: user,
  });
};

/**
 * @route GET - /admin/reports/sales
 * @desc  Admin - Get Sales Report (Daily, Weekly, Monthly, Yearly, Custom Range)
 * @access Private
 */
export const getSalesReport = async (req, res) => {
  const { period, startDate, endDate } = req.query;

  let filter = { orderStatus: 'Delivered' };
  let start, end, groupFormat;

  switch (period) {
    case 'day':
      start = new Date();
      start.setHours(0, 0, 0, 0);
      end = new Date();
      end.setHours(23, 59, 59, 999);
      groupFormat = '%Y-%m-%d'; // Group by day
      break;
    case 'week':
      start = new Date();
      start.setDate(start.getDate() - 7);
      end = new Date();
      groupFormat = '%Y-%U'; // Group by week number
      break;
    case 'month':
      start = new Date();
      start.setMonth(start.getMonth() - 1);
      end = new Date();
      groupFormat = '%Y-%m'; // Group by month
      break;
    case 'year':
      start = new Date();
      start.setFullYear(start.getFullYear() - 1);
      end = new Date();
      groupFormat = '%Y'; // Group by year
      break;
    case 'custom':
      if (!startDate || !endDate) {
        throw new BadRequestError(
          'Custom range requires startDate and endDate.'
        );
      }
      start = new Date(startDate);
      end = new Date(endDate);
      groupFormat = '%Y-%m-%d'; // Default to daily grouping for custom range
      break;
    default:
      start = new Date(0);
      end = new Date();
      groupFormat = '%Y-%m-%d';
  }

  filter.placedAt = { $gte: start, $lte: end };

  const salesReport = await Order.aggregate([
    { $match: filter },
    {
      $group: {
        _id: { $dateToString: { format: groupFormat, date: '$placedAt' } },
        totalRevenue: { $sum: '$finalPrice' },
        totalOrders: { $sum: 1 },
        totalDiscount: { $sum: '$totalDiscount' },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  // Get best-selling categories
  const categoryData = await Order.aggregate([
    { $match: filter },
    { $unwind: '$orderItems' },
    {
      $lookup: {
        from: 'products',
        localField: 'orderItems.product',
        foreignField: '_id',
        as: 'productDetails',
      },
    },
    { $unwind: '$productDetails' },
    {
      $group: {
        _id: '$productDetails.genre',
        totalSold: { $sum: '$orderItems.quantity' },
      },
    },
    {
      $lookup: {
        from: 'genres',
        localField: '_id',
        foreignField: '_id',
        as: 'genreDetails',
      },
    },
    { $unwind: '$genreDetails' },
    {
      $project: {
        name: '$genreDetails.name',
        totalSold: 1,
      },
    },
    { $sort: { totalSold: -1 } },
    { $limit: 10 },
  ]);

  // Get best-selling products
  const bestSellingProducts = await Order.aggregate([
    { $match: filter },
    { $unwind: '$orderItems' },
    {
      $group: {
        _id: '$orderItems.product',
        totalSold: { $sum: '$orderItems.quantity' },
      },
    },
    {
      $lookup: {
        from: 'products',
        localField: '_id',
        foreignField: '_id',
        as: 'productDetails',
      },
    },
    { $unwind: '$productDetails' },
    {
      $project: {
        name: '$productDetails.name',
        totalSold: 1,
      },
    },
    { $sort: { totalSold: -1 } },
    { $limit: 10 },
  ]);

  // Get best-selling brands
  const bestSellingBrands = await Order.aggregate([
    { $match: filter },
    { $unwind: '$orderItems' },
    {
      $lookup: {
        from: 'products',
        localField: 'orderItems.product',
        foreignField: '_id',
        as: 'productDetails',
      },
    },
    { $unwind: '$productDetails' },
    {
      $group: {
        _id: '$productDetails.brand',
        totalSold: { $sum: '$orderItems.quantity' },
      },
    },
    {
      $lookup: {
        from: 'brands',
        localField: '_id',
        foreignField: '_id',
        as: 'brandDetails',
      },
    },
    { $unwind: '$brandDetails' },
    {
      $project: {
        name: '$brandDetails.name',
        totalSold: 1,
      },
    },
    { $sort: { totalSold: -1 } },
    { $limit: 10 },
  ]);

  // Total Revenue, Order Count, and Customers
  const totalRevenue = salesReport.reduce(
    (sum, item) => sum + item.totalRevenue,
    0
  );
  const ordersCount = salesReport.reduce(
    (sum, item) => sum + item.totalOrders,
    0
  );
  const customers = await User.find({ role: 'user' }).countDocuments();

  res.status(200).json({
    success: true,
    message: 'Sales report retrieved successfully',
    data: {
      totalRevenue,
      ordersCount,
      customers,
      revenueData: salesReport,
      bestSellingProducts,
      bestSellingBrands,
      categoryData,
    },
  });
};

/**
 * @route GET - /admin/reports/sales/data
 * @desc  Admin - Get Sales Data (Paginated List)
 * @access Private
 */
export const getSalesData = async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const { startDate, endDate } = req.query;

  let filter = { orderStatus: 'Delivered' };

  if (startDate && endDate) {
    filter.placedAt = {
      $gte: new Date(startDate),
      $lte: new Date(endDate),
    };
  }

  const queryOptions = {
    filter,
    sort: { placedAt: -1 },
    populate: [{ path: 'user', select: 'name' }],
  };

  const salesData = await paginate(Order, page, limit, queryOptions);

  res.status(200).json({
    success: true,
    message: 'Sales data retrieved successfully',
    data: {
      sales: salesData.result,
      totalPage: salesData.totalPages,
      currentPage: salesData.currentPage,
    },
  });
};

/**
 * @route GET - /admin/reports/sales/excel
 * @desc  Admin - Generate Sales Report (Excel)
 * @access Private
 */
export const generateSalesExcel = async (req, res) => {
  const { startDate, endDate } = req.query;

  let filter = { orderStatus: 'Delivered' };
  if (startDate && endDate) {
    filter.placedAt = {
      $gte: new Date(startDate),
      $lte: new Date(endDate),
    };
  }

  const salesData = await Order.find(filter).populate('user', 'name');

  if (salesData.length === 0) {
    throw new NotFoundError('No sales data found for the selected period.');
  }

  const excelData = [
    ['Order ID', 'Customer', 'Date', 'Total Amount', 'Discount', 'Final Price'],
    ...salesData.map((sale) => [
      sale._id.toString(),
      sale.user?.name || 'Guest',
      new Date(sale.placedAt).toLocaleDateString(),
      sale.totalAmount,
      sale.totalDiscount,
      sale.finalPrice,
    ]),
  ];

  const filePath = path.join(__dirname, '../reports/sales_report.xlsx');
  await writeXlsxFile(excelData, { filePath });

  res.download(filePath, 'sales_report.xlsx');
};

/**
 * @route GET - /admin/reports/sales/pdf
 * @desc  Admin - Generate Sales Report (PDF)
 * @access Private
 */
export const generateSalesPDF = async (req, res) => {
  const { startDate, endDate } = req.query;

  let filter = { orderStatus: 'Delivered' };
  if (startDate && endDate) {
    filter.placedAt = {
      $gte: new Date(startDate),
      $lte: new Date(endDate),
    };
  }

  const salesData = await Order.find(filter).populate('user', 'name');

  if (salesData.length === 0) {
    throw new NotFoundError('No sales data found for the selected period.');
  }

  const pdfPath = path.join(__dirname, '../reports/sales_report.pdf');
  const doc = new PDFDocument({ margin: 30 });
  doc.pipe(fs.createWriteStream(pdfPath));

  doc.fontSize(16).text('Sales Report', { align: 'center' }).moveDown();
  doc.fontSize(10);

  salesData.forEach((sale, index) => {
    doc.text(`Order ID: ${sale._id}`);
    doc.text(`Customer: ${sale.user?.name || 'Guest'}`);
    doc.text(`Date: ${new Date(sale.placedAt).toLocaleDateString()}`);
    doc.text(`Total Amount: ₹${sale.totalAmount}`);
    doc.text(`Discount: ₹${sale.totalDiscount}`);
    doc.text(`Final Price: ₹${sale.finalPrice}`);
    doc.moveDown();
    if (index !== salesData.length - 1) doc.moveDown();
  });

  doc.end();
  res.download(pdfPath, 'sales_report.pdf');
};
