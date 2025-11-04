import { Module, forwardRef } from '@nestjs/common';
import { UsersModule } from '../users/users.module';
import { ReposController } from './repos.controller';
import { ReposService } from './repos.service';

@Module({
  imports: [forwardRef(() => UsersModule)],
  controllers: [ReposController],
  providers: [ReposService],
  exports: [ReposService],
})
export class ReposModule {}
