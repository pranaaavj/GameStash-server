import PDFDocument from 'pdfkit';
import ExcelJS from 'exceljs';
import path from 'path';
import fs from 'fs';
import Order from '../models/order.model.js';
import { generateSalesData } from '../utils/generateSalesData.js';
import User from '../models/user.model.js';
import { paginate } from '../utils/paginate.js';

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

  const bestSellingGenres = await Order.aggregate([
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
      bestSellingGenres,
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
 * @route GET - /admin/reports/sales/pdf
 * @desc  Admin - Generate Sales Report (PDF)
 * @access Private
 */

const drawTableRow = (doc, y, columnWidths, rowData, alignments = []) => {
  const rowHeight = 18; // Compact row height
  let x = 50;

  // Draw row background
  doc
    .rect(50, y, doc.page.width - 100, rowHeight)
    .fill(rowData.isHeader ? '#2c3e50' : '#ffffff');

  rowData.data.forEach((data, index) => {
    // Set text styling
    doc
      .fontSize(rowData.isHeader ? 9 : 8) // Smaller font sizes
      .font(rowData.isHeader ? 'Helvetica-Bold' : 'Helvetica')
      .fillColor(rowData.isHeader ? '#ffffff' : '#333333');

    // Calculate text position with precise padding
    const textX =
      x + (alignments[index] === 'right' ? columnWidths[index] - 6 : 6);
    const textY = y + rowHeight / 4;

    // Render text with truncation
    doc.text(data.toString(), textX, textY, {
      width: columnWidths[index] - 12,
      align: alignments[index] || 'left',
      lineBreak: false,
      ellipsis: true,
    });

    // Draw cell borders
    doc
      .lineWidth(0.3)
      .rect(x, y, columnWidths[index], rowHeight)
      .stroke('#e0e0e0');

    x += columnWidths[index];
  });

  return rowHeight;
};
export const generateSalesPDF = async (req, res) => {
  try {
    const { startDate, endDate, period } = req.query;
    const { summary, salesData } = await generateSalesData(
      startDate,
      endDate,
      period
    );

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
      'attachment; filename="sales_report.pdf"'
    );
    doc.pipe(res);

    // Header Section
    doc
      .fillColor('#2c3e50')
      .fontSize(18)
      .font('Helvetica-Bold')
      .text('SALES REPORT', { align: 'center' })
      .moveDown(0.3);

    doc
      .fontSize(10)
      .fillColor('#666666')
      .font('Helvetica')
      .text(
        `Period: ${
          period || 'Custom Range'
        } | Generated: ${new Date().toLocaleDateString('en-IN')}`,
        {
          align: 'center',
        }
      )
      .moveDown(1);

    // Summary Section
    doc
      .fontSize(10)
      .fillColor('#2c3e50')
      .font('Helvetica-Bold')
      .text('Summary', 50, 140)
      .moveDown(0.5);

    const summaryData = [
      ['Total Orders:', summary.totalOrders.toString()],
      ['Total Sales:', `${summary.totalSales.toFixed(2)}`],
      ['Total Discounts:', `${summary.totalDiscounts.toFixed(2)}`],
      ['Coupon Discounts:', `${summary.totalCouponDiscounts.toFixed(2)}`],
      ['Shipping Charges:', `${summary.totalShippingCharges.toFixed(2)}`],
      ['Net Revenue:', `${summary.netRevenue.toFixed(2)}`],
    ];

    let summaryY = 160;
    summaryData.forEach(([label, value]) => {
      doc
        .font('Helvetica-Bold')
        .fontSize(10)
        .fillColor('#333333')
        .text(label, 70, summaryY, { width: 150 });
      doc
        .font('Helvetica')
        .fontSize(10)
        .text(value, 220, summaryY, { width: 150, align: 'right' });
      summaryY += 20;
    });

    // Divider
    doc
      .moveTo(50, summaryY + 10)
      .lineTo(doc.page.width - 50, summaryY + 10)
      .lineWidth(1)
      .stroke('#cccccc');

    // Table Section
    const pageWidth = doc.page.width - 100;
    const columnWidths = [
      Math.round(pageWidth * 0.12), // Order ID (98px)
      Math.round(pageWidth * 0.18), // Customer (148px)
      Math.round(pageWidth * 0.14), // Date (82px)
      Math.round(pageWidth * 0.14), // Total (110px)
      Math.round(pageWidth * 0.14), // Total (110px)
      Math.round(pageWidth * 0.14), // Total (110px)
      Math.round(pageWidth * 0.15), // Net Total (110px)
    ];

    const headers = [
      'Order ID',
      'Customer',
      'Date',
      'Discount',
      'Coupon',
      'Total',
      'Net Total',
    ].map((h) => h.trim());
    const alignments = ['left', 'left', 'left', 'left', 'left', 'left', 'left'];

    let currentY = summaryY + 40; // Tighter spacing

    currentY += drawTableRow(
      doc,
      currentY,
      columnWidths,
      {
        data: headers,
        isHeader: true,
      },
      alignments
    );

    salesData.forEach((order, index) => {
      if (currentY > doc.page.height - 60) {
        doc.addPage();
        currentY = 50;
        currentY += drawTableRow(
          doc,
          currentY,
          columnWidths,
          {
            data: headers,
            isHeader: true,
          },
          alignments
        );
      }

      const rowData = {
        data: [
          order.orderId ? order.orderId.slice(-8) : 'N/A', // Order ID
          order.customer
            ? order.customer.substring(0, 16).trim() +
              (order.customer.length > 16 ? '...' : '')
            : 'N/A', // Customer Name
          order.orderDate
            ? new Date(order.orderDate).toLocaleDateString('en-IN', {
                day: '2-digit',
                month: '2-digit',
                year: '2-digit',
              })
            : 'N/A', // Date
          order.discount !== undefined
            ? `₹${order.discount.toFixed(2)}`
            : '₹0.00', // Total Amount
          order.couponDiscount !== undefined
            ? `₹${order.couponDiscount.toFixed(2)}`
            : '₹0.00', // Total Amount
          order.totalOrderAmount !== undefined
            ? `₹${order.totalOrderAmount.toFixed(2)}`
            : '₹0.00', // Total Amount
          order.netTotal !== undefined
            ? `₹${order.netTotal.toFixed(2)}`
            : '₹0.00', // Net Total
        ],
        isHeader: false,
      };

      // Alternating row colors
      if (index % 2 !== 0) {
        doc.rect(50, currentY, doc.page.width - 100, 18).fill('#f8f9fa');
      }

      currentY += drawTableRow(
        doc,
        currentY,
        columnWidths,
        rowData,
        alignments
      );
    });

    doc.end();
  } catch (error) {
    console.error('PDF Generation Error:', error);
    res.status(500).json({ error: 'Failed to generate PDF report' });
  }
};

/**
 * @route GET - /admin/reports/sales/excel
 * @desc  Admin - Generate Sales Report (Excel)
 * @access Private
 */
export const generateSalesExcel = async (req, res) => {
  try {
    const { startDate, endDate, period } = req.query;
    const { summary, salesData } = await generateSalesData(
      startDate,
      endDate,
      period
    );

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Sales Report');

    // Add Summary Section
    worksheet.addRow(['Sales Summary']).font = { bold: true };
    worksheet.addRow(['Total Orders', summary.totalOrders]);
    worksheet.addRow(['Total Sales', `₹${summary.totalSales}`]);
    worksheet.addRow(['Total Discounts', `₹${summary.totalDiscounts}`]);
    worksheet.addRow([
      'Total Coupon Discounts',
      `₹${summary.totalCouponDiscounts}`,
    ]);
    worksheet.addRow([
      'Total Shipping Charges',
      `₹${summary.totalShippingCharges}`,
    ]);
    worksheet.addRow(['Net Revenue', `₹${summary.netRevenue}`]);
    worksheet.addRow([]);

    // Table Headers
    worksheet.addRow([
      'Serial No',
      'Order Date',
      'Order ID',
      'Customer',
      'Total Order Amount',
      'Offer Discount',
      'Coupon Discount',
      'Shipping Charge',
      'Net Total (₹)',
    ]).font = { bold: true };

    // Order Details
    salesData.forEach((order, index) => {
      worksheet.addRow([
        index + 1,
        order.orderDate,
        order.orderId,
        order.customer,
        `₹${order.totalOrderAmount}`,
        `₹${order.discount}`,
        `₹${order.couponDiscount}`,
        `₹${order.shippingCharge}`,
        `₹${order.netTotal}`,
      ]);
    });

    // Save & Send File
    const filePath = path.join(
      import.meta.dirname,
      '../reports/sales_report.xlsx'
    );
    await workbook.xlsx.writeFile(filePath);

    res.download(filePath, 'sales_report.xlsx', (err) => {
      if (err) {
        console.error('Error downloading the file:', err);
        res.status(500).send('Could not download the file.');
      }
      fs.unlinkSync(filePath);
    });
  } catch (error) {
    console.error('Error generating sales report:', error);
    res.status(500).json({ message: 'Failed to generate sales report.' });
  }
};
