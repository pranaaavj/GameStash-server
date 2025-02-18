import Joi from 'joi';

// User profile schema
export const userProfileSchema = Joi.object({
  name: Joi.string().min(3).max(50).required().messages({
    'string.empty': 'Name cannot be empty.',
    'string.min': 'Name should have at least 3 characters.',
    'string.max': 'Name should have at most 50 characters.',
  }),
  phoneNumber: Joi.string()
    .pattern(/^[0-9]{10,15}$/)
    .messages({
      'string.pattern.base': 'Phone number should be between 10 and 15 digits.',
    })
    .allow(''),
  profilePicture: Joi.string()
    .uri()
    .messages({
      'string.uri': 'Profile picture must be a valid URL.',
    })
    .allow(''),
});

// Address schema
export const addressSchema = Joi.object({
  addressName: Joi.string().trim().required().messages({
    'string.empty': 'Address name is required.',
    'any.required': 'Address name is required.',
  }),
  addressLine: Joi.string().trim().required().messages({
    'string.empty': 'Address line is required.',
    'any.required': 'Address line is required.',
  }),
  city: Joi.string().trim().optional(),
  state: Joi.string().trim().required().messages({
    'string.empty': 'State is required.',
    'any.required': 'State is required.',
  }),
  zip: Joi.string().trim().required().messages({
    'string.empty': 'ZIP code is required.',
    'any.required': 'ZIP code is required.',
  }),
  country: Joi.string().trim().required().messages({
    'string.empty': 'Country is required.',
    'any.required': 'Country is required.',
  }),
  isDefault: Joi.boolean().optional(),
}).unknown(true);

// Schema for individual order items
const orderItemSchema = Joi.object({
  product: Joi.string().trim().required().messages({
    'string.empty': 'Product ID is required.',
    'any.required': 'Product ID is required.',
  }),
  quantity: Joi.number().min(1).required().messages({
    'number.base': 'Quantity must be a number.',
    'number.min': 'Quantity must be at least 1.',
    'any.required': 'Quantity is required.',
  }),
  price: Joi.number().min(0).required().messages({
    'number.base': 'Price must be a number.',
    'number.min': 'Price must be at least 0.',
    'any.required': 'Price is required.',
  }),
  totalPrice: Joi.number().min(0).required().messages({
    'number.base': 'Total price must be a number.',
    'number.min': 'Total price must be at least 0.',
    'any.required': 'Total price is required.',
  }),
  discount: Joi.number().min(0).max(100).optional().messages({
    'number.base': 'Discount must be a number.',
    'number.min': 'Discount cannot be negative.',
    'number.max': 'Discount cannot exceed 100.',
  }),
}).required();

// Place order schema
export const placeOrderSchema = Joi.object({
  orderItems: Joi.array().items(orderItemSchema).min(1).required().messages({
    'array.base': 'Order items must be an array.',
    'array.min': 'At least one order item is required.',
    'any.required': 'Order items are required.',
  }),
  totalAmount: Joi.number().min(0).optional().messages({
    'number.base': 'Total amount must be a number.',
    'number.min': 'Total amount cannot be negative.',
    'any.required': 'Total amount is required.',
  }),
  totalDiscount: Joi.number().min(0).optional().messages({
    'number.base': 'Total discount must be a number.',
    'number.min': 'Total discount cannot be negative.',
  }),
  finalPrice: Joi.number().min(0).optional().messages({
    'number.base': 'Final price must be a number.',
    'number.min': 'Final price cannot be negative.',
    'any.required': 'Final price is required.',
  }),
  shippingAddress: Joi.string().trim().required().messages({
    'string.empty': 'Shipping address is required.',
    'any.required': 'Shipping address is required.',
  }),
  paymentMethod: Joi.string()
    .valid('Wallet', 'UPI', 'Cash on Delivery', 'Credit Card', 'Razorpay')
    .required()
    .messages({
      'any.only':
        'Payment method must be one of Wallet, UPI, Cash on Delivery, or Credit Card.',
      'any.required': 'Payment method is required.',
    }),
  couponCode: Joi.string().optional().allow(null),
  couponDiscount: Joi.number().min(0).optional().messages({
    'number.base': 'Coupon discount must be a number.',
    'number.min': 'Coupon discount cannot be negative.',
  }),
}).unknown(true);

export const verifyRazorpaySchema = Joi.object({
  razorpayOrderId: Joi.string().trim().required().messages({
    'string.empty': 'Razorpay Order ID is required.',
    'any.required': 'Razorpay Order ID is required.',
  }),
  paymentId: Joi.string().trim().required().messages({
    'string.empty': 'Payment ID is required.',
    'any.required': 'Payment ID is required.',
  }),
  signature: Joi.string().trim().required().messages({
    'string.empty': 'Payment signature is required.',
    'any.required': 'Payment signature is required.',
  }),
  orderItems: Joi.array().items(orderItemSchema).min(1).required().messages({
    'array.base': 'Order items must be an array.',
    'array.min': 'At least one order item is required.',
    'any.required': 'Order items are required.',
  }),
  shippingAddress: Joi.string().trim().required().messages({
    'string.empty': 'Shipping address is required.',
    'any.required': 'Shipping address is required.',
  }),
  paymentMethod: Joi.string()
    .valid('Wallet', 'UPI', 'Cash on Delivery', 'Credit Card', 'Razorpay')
    .required()
    .messages({
      'any.only':
        'Payment method must be one of Wallet, UPI, Cash on Delivery, Credit Card, or Razorpay.',
      'any.required': 'Payment method is required.',
    }),
  couponCode: Joi.string().optional().allow(null),
  couponDiscount: Joi.number().min(0).optional().messages({
    'number.base': 'Coupon discount must be a number.',
    'number.min': 'Coupon discount cannot be negative.',
  }),
}).unknown(true);
