import * as Joi from 'joi';

export const AddEmployeeSchema = Joi.object({
  // User Basic Details
  name: Joi.string().required(),
  email: Joi.string().email().required(),
  password: Joi.string().optional(), // Server generates if empty
  mobile: Joi.string().length(10).pattern(/^[0-9]+$/).required(),
  role: Joi.string().valid('Admin', 'Manager', 'Employee').required(),

  // Nested Address Object
  address: Joi.object({
    street: Joi.string().required(),
    city: Joi.string().required(),
    state: Joi.string().required(),
    zip_code: Joi.string().required(),
    country: Joi.string().required(),
  }).required(),

  // Nested Bank Details Object
  bank_details: Joi.object({
    bank_name: Joi.string().required(),
    account_number: Joi.string().required(),
    ifsc_code: Joi.string().required(),
    branch_name: Joi.string().required(),
  }).required(),
});