// src/database/database.module.ts
import { Global, Module } from '@nestjs/common';
import { Model } from 'objection';
import Knex from 'knex';
import knexConfig from '../../knexfile';

@Global() // Makes database available everywhere
@Module({
  providers: [
    {
      provide: 'KnexConnection',
      useFactory: async () => {
        const knex = Knex(knexConfig);
        Model.knex(knex); // Bind Objection to this connection
        return knex;
      },
    },
  ],
  exports: ['KnexConnection'],
})
export class DatabaseModule {}