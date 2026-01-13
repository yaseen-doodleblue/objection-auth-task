import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // 1. Create Address Table
  await knex.schema.createTable('employee_address', (table) => {
    table.increments('id').primary();
    table.integer('user_id').unsigned().notNullable().references('id').inTable('users').onDelete('CASCADE');
    table.string('street').notNullable();
    table.string('city').notNullable();
    table.string('state').notNullable();
    table.string('zip_code').notNullable();
    table.string('country').notNullable();
  });

  // 2. Create Bank Details Table
  await knex.schema.createTable('employee_bankdetails', (table) => {
    table.increments('id').primary();
    table.integer('user_id').unsigned().notNullable().references('id').inTable('users').onDelete('CASCADE');
    table.string('bank_name').notNullable();
    table.string('account_number').notNullable();
    table.string('ifsc_code').notNullable();
    table.string('branch_name').notNullable();
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('employee_bankdetails');
  await knex.schema.dropTableIfExists('employee_address');
}