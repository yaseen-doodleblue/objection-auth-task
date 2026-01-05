import { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  return knex.schema.createTable('users', (table) => {
    table.increments('id').primary(); // ID
    table.string('name').notNullable();
    table.string('email').unique().notNullable();
    table.string('password').notNullable();
    table.string('mobile', 15);
    table.string('role').notNullable(); // Admin, Manager, etc.
    table.string('status').defaultTo('Active');
    table.timestamps(true, true); // created_at, updated_at
  });
}

export async function down(knex: Knex): Promise<void> {
  return knex.schema.dropTable('users');
}