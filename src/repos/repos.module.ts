import { Module } from '@nestjs/common';
import { UsersModule } from '../users/users.module';
import { ReposController } from './repos.controller';
import { ReposService } from './repos.service';

@Module({
  imports: [UsersModule], // Important : pour utiliser UsersService
  controllers: [ReposController],
  providers: [ReposService],
  exports: [ReposService], // Au cas où d'autres modules en auraient besoin
})
export class ReposModule {}
