import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { RouterModule } from '@nestjs/core';
import { AppController } from './app.controller';
import { DbModule } from '../services/db/db.module';
import { UserModule } from '../modules/user/user.module';
import { ChatModule } from '../modules/chat/chat.module';
import { routes } from '../routes/routes';

@Module({
  imports: [
    ConfigModule.forRoot({
      envFilePath: '.env.dev',
      isGlobal: true,
    }),
    DbModule,
    UserModule,
    ChatModule,
    RouterModule.register(routes),
  ],
  controllers: [AppController],
})
export class AppModule {}
