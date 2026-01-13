import { Model } from 'objection';

export class UserModel extends Model {
  static tableName = 'users';

  id!: number;
  name!: string;
  email!: string;
  password!: string;
  mobile!: string;
  role!: string;
  status!: string;
  failed_attempts!: number;
  locked_until!: string | null;

  // TypeScript Types (Optional, helps IntelliSense)
  address?: any;
  bank_details?: any;

  static get jsonSchema() {
    return {
      type: 'object',
      required: ['name', 'email', 'password'],
      properties: {
        id: { type: 'integer' },
        name: { type: 'string' },
        email: { type: 'string' },
        password: { type: 'string' },
        mobile: { type: 'string' },
        role: { type: 'string' },
        status: { type: 'string' },
        failed_attempts: { type: 'integer' },
        locked_until: { type: ['string', 'null'] }
      },
    };
  }


  static get relationMappings() {
    // We import them HERE, not at the top of the file.
    // This forces Node.js to load them only when needed.
    const AddressModel = require('./address.model').AddressModel;
    const BankDetailsModel = require('./bank-details.model').BankDetailsModel;

    // Safety Check: If these print "undefined" in your terminal, we know the path is wrong.
    if (!AddressModel || !BankDetailsModel) {
      console.error("CRITICAL ERROR: Could not load AddressModel or BankDetailsModel inside UserModel.");
    }

    return {
      address: {
        relation: Model.HasOneRelation,
        modelClass: AddressModel,
        join: {
          from: 'users.id',
          to: 'employee_address.user_id',
        },
      },
      bank_details: {
        relation: Model.HasOneRelation,
        modelClass: BankDetailsModel,
        join: {
          from: 'users.id',
          to: 'employee_bankdetails.user_id',
        },
      },
    };
  }
}