import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { DatabaseModule } from './database/database.module';
import { AuthModule } from './auth/auth.module';
import { PassportModule } from '@nestjs/passport'; 
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core'; 
import { MailerModule } from '@nestjs-modules/mailer'; 
import { HandlebarsAdapter } from '@nestjs-modules/mailer/dist/adapters/handlebars.adapter';
import { join } from 'path';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PassportModule,
    // 2. Configure Rate Limiting (10 requests per minute)
    ThrottlerModule.forRoot([{
      ttl: 60000, // 60 seconds (1 minute)
      limit: 10,  // Max 10 requests
    }]),

    DatabaseModule,
    AuthModule,
    
    MailerModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (config: ConfigService) => ({
        transport: {
          host: 'smtp.gmail.com', 
          secure: false,
          auth: {
            user: config.get('MAIL_USER'), 
            pass: config.get('MAIL_PASS'),  
          },
        },
        defaults: {
          from: '"Test Company" <yaseen.doodleblue@gmail.com>',
        },
        template: {
          dir: join(process.cwd(), 'dist/templates'),
          adapter: new HandlebarsAdapter(),
          options: {
            strict: true,
          },
        },
      }),
      inject: [ConfigService],
    }),
  ],
  // 3. Activate the Rate Limiter Globally
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}