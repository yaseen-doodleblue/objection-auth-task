import { Model } from 'objection';

export class BankDetailsModel extends Model {
  static get tableName() {
    return 'employee_bankdetails';
  }

  id!: number;
  user_id!: number;
  bank_name!: string;
  account_number!: string;
  ifsc_code!: string;
  branch_name!: string;
}