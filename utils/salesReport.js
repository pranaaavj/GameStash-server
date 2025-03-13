import writeXlsxFile from 'write-excel-file/node';
import path from 'path';

export const generateExcelReport = async (salesData) => {
  const data = [
    ['Order ID', 'Customer', 'Date', 'Total Amount', 'Discount', 'Final Price'],
    ...salesData.map((sale) => [
      sale._id,
      sale.user?.name || 'Guest',
      new Date(sale.placedAt).toLocaleDateString(),
      sale.totalAmount,
      sale.totalDiscount,
      sale.finalPrice,
    ]),
  ];

  const filePath = path.join(__dirname, '../reports/sales_report.xlsx');
  await writeXlsxFile(data, { filePath });

  return filePath;
};
