import { Module } from '@nestjs/common';

import { AuthModule } from './auth/auth.module';
import { ConfigModule } from '@nestjs/config';
import { ReposModule } from './repos/repos.module';
import { AppController } from './app.controller';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), AuthModule, ReposModule],
  controllers: [AppController],
  providers: [],
})
export class AppModule {}
