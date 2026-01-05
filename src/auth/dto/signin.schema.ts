import * as Joi from 'joi';

export const SignInSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required(),
});