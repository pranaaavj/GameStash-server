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
  productId: Joi.string(),
  name: Joi.string(),
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
  price: Joi.number().positive(),
  genre: Joi.string(),
  platform: Joi.string().valid(
    'PC',
    'PlayStation',
    'Xbox',
    'Nintendo',
    'Other'
  ),
  brand: Joi.string(),
  stock: Joi.number().integer().min(0),
  description: Joi.string(),
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
