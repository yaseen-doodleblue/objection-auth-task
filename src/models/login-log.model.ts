import { Model } from 'objection';

export class LoginLogModel extends Model {
  static tableName = 'login_logs';

  // Properties
  id!: number;
  user_id!: number | null;
  email!: string;
  status!: string;
  ip_address!: string;
  attempt_time!: string;
}