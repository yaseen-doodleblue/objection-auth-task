// src/models/user.model.ts
import { Model } from 'objection';

export class UserModel extends Model {
  // 1. Table Name
  static tableName = 'users';

  // 2. Properties (For TypeScript intelligence)
  id!: number;
  name!: string;
  email!: string;
  password!: string;
  mobile!: string;
  role!: string;
  status!: string;

  // 3. Schema Validation (Optional but good for JSON Schema)
  static get jsonSchema() {
    return {
      type: 'object',
      required: ['name', 'email', 'password'],
      properties: {
        id: { type: 'integer' },
        name: { type: 'string', minLength: 1 },
        email: { type: 'string' },
        password: { type: 'string' },
        mobile: { type: 'string' },
        role: { type: 'string' },
        status: { type: 'string' },
      },
    };
  }
}