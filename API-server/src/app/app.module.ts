import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { RouterModule } from '@nestjs/core';
import { AppController } from './app.controller';
import { DbModule } from '../services/db/db.module';
import { UserModule } from '../modules/user/user.module';
import { routes } from '../routes/routes';

@Module({
  imports: [
    ConfigModule.forRoot({
      envFilePath: '.env.dev',
      isGlobal: true,
    }),
    DbModule,
    UserModule,
    RouterModule.register(routes),
  ],
  controllers: [AppController],
})
export class AppModule {}
