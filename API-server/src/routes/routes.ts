import { Routes } from '@nestjs/core';
import { UserModule } from '../modules/user/user.module';
import { ChatModule } from '../modules/chat/chat.module';

export const routes: Routes = [
  {
    path: 'users',
    module: UserModule,
  },
  {
    path: 'chat',
    module: ChatModule,
  },
];
