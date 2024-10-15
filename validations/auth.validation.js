import Joi from 'joi';

export const registerSchema = Joi.object({
  name: Joi.string().required().messages({
    'string.empty': 'Name cannot be empty',
    'any.required': '{{#label}} cannot be empty.',
  }),
  email: Joi.string().email().required().messages({
    'string.empty': 'Email cannot be empty.',
    'string.email': 'Please enter a valid email.',
    'any.required': '{{#label}} cannot be empty.',
  }),
  password: Joi.string()
    .regex(/^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d]{6,}$/)
    .required()
    .messages({
      'string.empty': 'Password cannot be empty',
      'string.pattern.base':
        'Password must be at least 6 characters with one number and one alphabet',
      'any.required': '{{#label}} cannot be empty.',
    }),
  phoneNumber: Joi.string().required().max(10).messages({
    'string.empty': 'Number cannot be empty',
    'string.max': 'Number cannot exceed 10 digits',
    'any.required': '{{#label}} cannot be empty.',
  }),
});

export const loginSchema = Joi.object({
  email: Joi.string().email().required().label('Email').messages({
    'string.empty': 'Email cannot be empty',
    'string.email': 'Please enter a valid email',
    'any.required': '{#label} cannot be empty.',
  }),
  password: Joi.string().required().label('Password').messages({
    'any.required': 'The {#label} field is required.',
    'string.empty': 'Password cannot be empty',
  }),
});

export const verifyOtpSchema = Joi.object({
  otp: Joi.string().required().messages({
    'string.empty': 'Otp cannot be empty',
    'any.required': '{{#label}} cannot be empty.',
  }),
  email: Joi.string().email().required().messages({
    'string.empty': 'Email cannot be empty',
    'string.email': 'Please enter a valid email',
    'any.required': '{{#label}} cannot be empty.',
  }),
});
