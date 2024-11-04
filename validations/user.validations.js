import Joi from 'joi';

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
