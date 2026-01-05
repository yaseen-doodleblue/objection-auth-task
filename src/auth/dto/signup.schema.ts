import * as Joi from 'joi';

export const SignUpSchema = Joi.object({
  name: Joi.string().required(),
  
  // Valid email format
  email: Joi.string().email().required(),
  
  // Min 8, Max 12 chars
  password: Joi.string().min(8).max(12).required(),
  
  // Exact 10 digits, only numbers
  mobile: Joi.string().length(10).pattern(/^[0-9]+$/).required(),
  
  // Only allow specific roles
  role: Joi.string().valid('Admin', 'Manager').required(),
  
  status: Joi.string().optional(),
});