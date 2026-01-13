import { Model } from 'objection';

export class AddressModel extends Model {
  static get tableName() {
    return 'employee_address';
  }

  id!: number;
  user_id!: number;
  street!: string;
  city!: string;
  state!: string;
  zip_code!: string;
  country!: string;
}