import { Module } from '@nestjs/common';
import { UsersService } from './users.service';

@Module({
  providers: [UsersService],
  exports: [UsersService], // Important : exporter pour l'utiliser dans AuthModule
})
export class UsersModule {}
