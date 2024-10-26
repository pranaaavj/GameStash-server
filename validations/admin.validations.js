import Joi from 'joi';

export const productSchema = Joi.object({
  name: Joi.string().required().messages({
    'string.empty': 'Name cannot be empty',
    'any.required': '{{#label}} cannot be empty',
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
});
