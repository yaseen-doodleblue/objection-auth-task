import { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  // 1. Add columns to 'users' table for locking
  await knex.schema.alterTable('users', (table) => {
    table.integer('failed_attempts').defaultTo(0);
    table.timestamp('locked_until').nullable(); // If this has a time, user is locked
  });

  // 2. Create a new table for Login History
  await knex.schema.createTable('login_logs', (table) => {
    table.increments('id').primary();
    table.integer('user_id').references('id').inTable('users').onDelete('CASCADE'); // Optional, if user exists
    table.string('email').notNullable(); // Store email even if user doesn't exist (for failed attempts)
    table.string('status').notNullable(); // 'Success' or 'Failed'
    table.string('ip_address').nullable();
    table.timestamp('attempt_time').defaultTo(knex.fn.now());
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTable('login_logs');
  await knex.schema.alterTable('users', (table) => {
    table.dropColumn('failed_attempts');
    table.dropColumn('locked_until');
  });
}