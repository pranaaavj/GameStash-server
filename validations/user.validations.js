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
}).unknown(true);
