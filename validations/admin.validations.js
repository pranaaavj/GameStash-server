import Joi from 'joi';

// Product Schema
export const productSchema = Joi.object({
  name: Joi.string().required().messages({
    'string.empty': 'Name cannot be empty',
    'any.required': '{{#label}} cannot be empty',
  }),
  images: Joi.alternatives()
    .try(
      Joi.string().uri().label('Image URL'),
      Joi.array()
        .items(Joi.string().uri().label('Image URL'))
        .label('Images Array')
    )
    .required()
    .label('Images')
    .messages({
      'alternatives.match':
        'Images should be either a single valid URL or an array of URLs.',
      'string.uri': 'Each image must be a valid URL.',
      'array.includes': 'All items in the array must be valid URLs.',
    }),
  price: Joi.number().positive().precision(2).required().messages({
    'number.base': 'Price must be a number',
    'number.positive': 'Price must be a positive number',
    'number.precision': 'Price can have at most two decimal places',
    'any.required': '{{#label}} cannot be empty',
  }),
  genre: Joi.string().required().messages({
    'string.empty': 'Genre cannot be empty',
    'any.required': '{{#label}} cannot be empty',
  }),
  platform: Joi.string().required().messages({
    'string.empty': 'Platform cannot be empty',
    'any.required': '{{#label}} cannot be empty',
  }),
  brand: Joi.string().required().messages({
    'string.empty': 'Brand cannot be empty',
    'any.required': '{{#label}} cannot be empty',
  }),
  stock: Joi.number().integer().min(0).required().messages({
    'number.base': 'Stock must be a number',
    'number.integer': 'Stock must be an integer',
    'number.min': 'Stock cannot be negative',
    'any.required': '{{#label}} cannot be empty',
  }),
  description: Joi.string().min(10).required().messages({
    'string.empty': 'Description cannot be empty',
    'string.min': 'Description must be at least 10 characters long',
    'any.required': '{{#label}} cannot be empty',
  }),
  systemRequirements: Joi.object({
    cpu: Joi.string().required().messages({
      'string.empty': 'CPU requirement cannot be empty',
      'any.required': 'CPU is required',
    }),
    gpu: Joi.string().required().messages({
      'string.empty': 'GPU requirement cannot be empty',
      'any.required': 'GPU is required',
    }),
    ram: Joi.string().required().messages({
      'string.empty': 'RAM requirement cannot be empty',
      'any.required': 'RAM is required',
    }),
    storage: Joi.string().required().messages({
      'string.empty': 'Storage requirement cannot be empty',
      'any.required': 'Storage is required',
    }),
  }).required(),
});

// Edit Product Schema
export const editProductSchema = Joi.object({
  productId: Joi.string().messages({
    'string.empty': 'Product ID cannot be empty.',
  }),

  name: Joi.string().messages({
    'string.empty': 'Product name cannot be empty.',
  }),

  images: Joi.alternatives()
    .try(
      Joi.string().uri().label('Image URL'),
      Joi.array()
        .items(Joi.string().uri().label('Image URL'))
        .label('Images Array')
    )
    .messages({
      'alternatives.match':
        'Images should be either a single valid URL or an array of valid URLs.',
      'string.uri': 'Each image must be a valid URL.',
      'array.includes': 'All items in the array must be valid URLs.',
    }),

  price: Joi.number().positive().messages({
    'number.base': 'Price must be a number.',
    'number.positive': 'Price must be a positive number.',
  }),

  genre: Joi.string().messages({
    'string.empty': 'Genre cannot be empty.',
  }),

  platform: Joi.string()
    .valid('PC', 'PlayStation', 'Xbox', 'Nintendo', 'Other')
    .messages({
      'any.only':
        'Platform must be one of PC, PlayStation, Xbox, Nintendo, or Other.',
      'string.empty': 'Platform cannot be empty.',
    }),

  brand: Joi.string().messages({
    'string.empty': 'Brand cannot be empty.',
  }),

  stock: Joi.number().integer().min(0).messages({
    'number.base': 'Stock must be a number.',
    'number.integer': 'Stock must be an integer.',
    'number.min': 'Stock cannot be negative.',
  }),

  description: Joi.string().messages({
    'string.empty': 'Description cannot be empty.',
  }),

  systemRequirements: Joi.object({
    cpu: Joi.string().label('CPU').messages({
      'string.empty': 'CPU details cannot be empty.',
    }),
    gpu: Joi.string().label('GPU').messages({
      'string.empty': 'GPU details cannot be empty.',
    }),
    ram: Joi.string().label('RAM').messages({
      'string.empty': 'RAM details cannot be empty.',
    }),
    storage: Joi.string().label('Storage').messages({
      'string.empty': 'Storage details cannot be empty.',
    }),
  }).messages({
    'object.base':
      'System requirements must be an object containing CPU, GPU, RAM, and Storage details.',
  }),
});

// Add Brand schema
export const brandSchema = Joi.object({
  name: Joi.string().min(2).max(50).trim().required().messages({
    'string.base': 'Brand name should be a type of text.',
    'string.empty': 'Brand name cannot be empty.',
    'string.min': 'Brand name should have a minimum length of 2 characters.',
    'string.max': 'Brand name should have a maximum length of 50 characters.',
    'any.required': 'Brand name is required.',
  }),

  description: Joi.string().max(500).trim().allow('').messages({
    'string.base': 'Description should be a type of text.',
    'string.max': 'Description should have a maximum length of 500 characters.',
  }),
});

// Add genre schema
export const genreSchema = Joi.object({
  name: Joi.string().min(3).max(50).required().messages({
    'string.empty': 'Genre name cannot be empty.',
    'string.min': 'Genre name must be at least 3 characters long.',
    'string.max': 'Genre name cannot exceed 50 characters.',
    'any.required': 'Genre name is required.',
  }),
  description: Joi.string().max(250).allow('').messages({
    'string.max': 'Description cannot exceed 250 characters.',
  }),
});

// Review schema
export const reviewSchema = Joi.object({
  productId: Joi.string().required().messages({
    'string.base': 'Product ID must be a string',
    'string.empty': 'Product ID cannot be empty',
    'any.required': 'Product ID is required',
  }),
  userId: Joi.string().required().messages({
    'string.base': 'User ID must be a string',
    'string.empty': 'User ID cannot be empty',
    'any.required': 'User ID is required',
  }),
  rating: Joi.number().integer().min(1).max(5).required().messages({
    'number.base': 'Rating must be a number',
    'number.integer': 'Rating must be an integer',
    'number.min': 'Rating cannot be less than 1',
    'number.max': 'Rating cannot be more than 5',
    'any.required': 'Rating is required',
  }),
  comment: Joi.string().min(10).required().messages({
    'string.base': 'Comment must be a string',
    'string.empty': 'Comment cannot be empty',
    'string.min': 'Comment must be at least 10 characters long',
    'any.required': 'Comment is required',
  }),
});

// Offer schema
export const offerSchema = Joi.object({
  name: Joi.string().required().messages({
    'string.empty': 'Offer name cannot be empty',
    'any.required': '{{#label}} cannot be empty',
  }),
  type: Joi.string().valid('Product', 'Brand').required().messages({
    'any.only': 'Type must be either Product or Brand',
    'string.empty': 'Offer type cannot be empty',
    'any.required': '{{#label}} cannot be empty',
  }),
  targetId: Joi.string().required().messages({
    'string.empty': 'Target ID cannot be empty',
    'any.required': '{{#label}} cannot be empty',
  }),
  discountType: Joi.string().valid('percentage', 'amount').required().messages({
    'any.only': 'Discount type must be either percentage or amount',
    'string.empty': 'Discount type cannot be empty',
    'any.required': '{{#label}} cannot be empty',
  }),
  discountValue: Joi.number()
    .positive()
    .required()
    .custom((value, helpers) => {
      if (helpers.state.ancestors[0].discountType === 'percentage') {
        if (value < 1 || value > 80) {
          return helpers.message(
            'Invalid discount value, it must be between 1 and 80.'
          );
        }
      }
      return value;
    })
    .messages({
      'number.base': 'Discount value must be a number',
      'number.positive': 'Discount value must be a positive number',
      'any.required': '{{#label}} cannot be empty',
    }),
  startDate: Joi.date()
    .custom((value, helpers) => {
      const now = new Date();
      const startOfToday = new Date(now.setHours(0, 0, 0, 0)); // Normalize to start of the day

      if (value < startOfToday) {
        return helpers.message(
          'Offer start date must be today or in the future'
        );
      }
      return value;
    })
    .required()
    .messages({
      'date.base': 'Offer start date must be a valid date',
      'any.required': '{{#label}} cannot be empty',
    }),
  endDate: Joi.date().greater(Joi.ref('startDate')).required().messages({
    'date.base': 'Offer end date must be a valid date',
    'date.greater': 'Offer end date must be after the start date',
    'any.required': '{{#label}} cannot be empty',
  }),
});

// Edit offer schema
export const editOfferSchema = Joi.object({
  name: Joi.string().messages({
    'string.empty': 'Offer name cannot be empty',
  }),

  type: Joi.string().valid('Product', 'Brand').messages({
    'any.only': 'Type must be either Product or Brand',
    'string.empty': 'Offer type cannot be empty',
  }),

  targetId: Joi.string().messages({
    'string.empty': 'Target ID cannot be empty',
  }),

  discountType: Joi.string().valid('percentage', 'amount').messages({
    'any.only': 'Discount type must be either percentage or amount',
    'string.empty': 'Discount type cannot be empty',
  }),

  discountValue: Joi.number()
    .positive()
    .custom((value, helpers) => {
      if (helpers.state.ancestors[0].discountType === 'percentage') {
        if (value < 1 || value > 80) {
          return helpers.message(
            'Invalid discount value. It must be between 1 and 80 for percentage type.'
          );
        }
      }
      return value;
    })
    .messages({
      'number.base': 'Discount value must be a number',
      'number.positive': 'Discount value must be a positive number',
    }),

  startDate: Joi.date().optional().messages({
    'date.base': 'Offer start date must be a valid date',
  }),

  endDate: Joi.date().optional().greater(Joi.ref('startDate')).messages({
    'date.base': 'Offer end date must be a valid date',
    'date.greater': 'Offer end date must be after the start date',
  }),
});

// Coupon Schema Validation
export const couponSchema = Joi.object({
  code: Joi.string().uppercase().trim().required().messages({
    'string.empty': 'Coupon code cannot be empty',
    'any.required': '{{#label}} cannot be empty',
  }),
  discountType: Joi.string().valid('percentage', 'amount').required().messages({
    'any.only': 'Discount type must be either percentage or amount',
    'string.empty': 'Discount type cannot be empty',
    'any.required': '{{#label}} cannot be empty',
  }),
  minOrderAmount: Joi.number().min(0).default(0).messages({
    'number.base': 'Minimum order value must be a number',
    'number.min': 'Minimum order value must be at least 0',
  }),
  discountValue: Joi.when('discountType', {
    is: 'amount',
    then: Joi.number()
      .positive()
      .max(Joi.ref('minOrderAmount'))
      .required()
      .messages({
        'number.base': 'Discount value must be a number',
        'number.positive': 'Discount value must be a positive number',
        'number.max': 'Discount value cannot exceed the minimum order amount',
        'any.required': '{{#label}} cannot be empty',
      }),
    otherwise: Joi.number()
      .positive()
      .required()
      .messages({
        'number.base': 'Discount value must be a number',
        'number.positive': 'Discount value must be a positive number',
        'any.required': '{{#label}} cannot be empty',
      })
      .custom((value, helpers) => {
        if (helpers.state.ancestors[0].discountType === 'percentage') {
          if (value < 1 || value > 80) {
            return helpers.message(
              'Invalid discount value, it must be between 1 and 80.'
            );
          }
        }
        return value;
      }),
  }),
  maxDiscountAmount: Joi.when('discountType', {
    is: 'percentage',
    then: Joi.number().positive().required().messages({
      'number.base': 'Maximum discount must be a number',
      'number.positive': 'Maximum discount must be a positive number',
      'any.required':
        'Maximum discount amount is required for percentage-based coupons',
    }),
  }),
  usageLimit: Joi.number().integer().min(1).required().messages({
    'number.base': 'Usage limit must be a number',
    'number.integer': 'Usage limit must be an integer',
    'number.min': 'Usage limit must be at least 1',
    'any.required': '{{#label}} cannot be empty',
  }),
  perUserLimit: Joi.number()
    .integer()
    .min(1)
    .max(Joi.ref('usageLimit'))
    .required()
    .messages({
      'number.base': 'Per-user limit must be a number',
      'number.integer': 'Per-user limit must be an integer',
      'number.min': 'Per-user limit must be at least 1',
      'number.max': 'Per-user limit cannot exceed the total usage limit',
      'any.required': 'Per-user limit is required',
    }),
  startDate: Joi.date()
    .custom((value, helpers) => {
      const now = new Date();
      const startOfToday = new Date(now.setHours(0, 0, 0, 0));

      if (value < startOfToday) {
        return helpers.message(
          'Coupon start date must be today or in the future'
        );
      }
      return value;
    })
    .required()
    .messages({
      'date.base': 'Coupon start date must be a valid date',
      'any.required': '{{#label}} cannot be empty',
    }),
  endDate: Joi.date().greater(Joi.ref('startDate')).required().messages({
    'date.base': 'Offer end date must be a valid date',
    'date.greater': 'Offer end date must be after the start date',
    'any.required': '{{#label}} cannot be empty',
  }),
});

// Edit coupon schema
export const editCouponSchema = Joi.object({
  code: Joi.string().uppercase().messages({
    'string.empty': 'Coupon code cannot be empty',
    'string.uppercase': 'Coupon code must be in uppercase',
  }),

  discountType: Joi.string().valid('percentage', 'amount').messages({
    'any.only': 'Discount type must be either percentage or amount',
    'string.empty': 'Discount type cannot be empty',
  }),

  discountValue: Joi.number()
    .positive()
    .messages({
      'number.base': 'Discount value must be a number',
      'number.positive': 'Discount value must be a positive number',
    })
    .custom((value, helpers) => {
      if (helpers.state.ancestors[0].discountType === 'percentage') {
        if (value < 1 || value > 80) {
          return helpers.message(
            'Invalid discount value, it must be between 1 and 80.'
          );
        }
      }
      return value;
    }),

  minOrderAmount: Joi.number().min(0).messages({
    'number.base': 'Minimum order value must be a number',
    'number.min': 'Minimum order value must be at least 0',
  }),

  maxDiscountAmount: Joi.when('discountType', {
    is: 'percentage',
    then: Joi.number().positive().required().messages({
      'number.base': 'Maximum discount must be a number',
      'number.positive': 'Maximum discount must be a positive number',
      'any.required':
        'Maximum discount amount is required for percentage-based coupons',
    }),
  }),

  usageLimit: Joi.number().integer().min(1).messages({
    'number.base': 'Usage limit must be a number',
    'number.integer': 'Usage limit must be an integer',
    'number.min': 'Usage limit must be at least 1',
  }),

  perUserLimit: Joi.number().integer().min(1).messages({
    'number.base': 'Per-user limit must be a number',
    'number.integer': 'Per-user limit must be an integer',
    'number.min': 'Per-user limit must be at least 1',
  }),

  startDate: Joi.date().optional().messages({
    'date.base': 'Coupon start date must be a valid date',
  }),

  endDate: Joi.date().greater(Joi.ref('startDate')).optional().messages({
    'date.base': 'Coupon end date must be a valid date',
    'date.greater': 'Coupon end date must be after the start date',
  }),

  isActive: Joi.boolean().messages({
    'boolean.base': 'isActive must be a boolean value',
  }),
});
