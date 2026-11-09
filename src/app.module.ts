import { Module } from '@nestjs/common';
import { AuthModule } from './modules/auth/auth.module';
import { BlogsModule } from './modules/blogs/blogs.module';
import { UserModule } from './modules/user/user.module';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MailerModule } from '@nestjs-modules/mailer';
import { CronModule } from './tasks/cron.module';
import { ScheduleModule } from '@nestjs/schedule';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { TestModule } from './modules/test/test.module';
import { CacheModule } from '@nestjs/cache-manager';
import { redisStore } from 'cache-manager-redis-yet';

@Module({
  imports: [
    TestModule,
    AuthModule,
    BlogsModule,
    UserModule,
    CronModule,
    DashboardModule,
    ScheduleModule.forRoot(),
    MailerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        transport: {
          host: config.getOrThrow('SMTP_HOST'),
          port: config.getOrThrow<number>('SMTP_PORT'),
          secure: false,
          auth: {
            user: config.getOrThrow('SMTP_AUTH_USER'),
            pass: config.getOrThrow('SMTP_AUTH_PASS'),
          },
        },
      }),
    }),
    CacheModule.registerAsync({
      isGlobal: true,
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => ({
        store: await redisStore({
          url: configService.get<string>('REDIS_URL'),
          ttl: 5 * 60 * 1000,
        }),
      }),
    }),
    ConfigModule.forRoot({ isGlobal: true })],
  providers: [],
})
export class AppModule { }
