import * as Joi from 'joi';

export const AddEmployeeSchema = Joi.object({
  name: Joi.string().required(),
  email: Joi.string().email().required(),
  
  // 👇 Password is OPTIONAL here because the server will generate it
  password: Joi.string().optional(), 
  
  mobile: Joi.string().length(10).pattern(/^[0-9]+$/).required(),
  role: Joi.string().valid('Admin', 'Manager', 'Employee').required(),
});