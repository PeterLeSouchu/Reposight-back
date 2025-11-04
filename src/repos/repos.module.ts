import { Module, forwardRef } from '@nestjs/common';
import { UsersModule } from '../users/users.module';
import { ReposController } from './repos.controller';
import { ReposService } from './repos.service';
import { RepoOwnershipGuard } from './repo-ownership.guard';

@Module({
  imports: [forwardRef(() => UsersModule)],
  controllers: [ReposController],
  providers: [ReposService, RepoOwnershipGuard],
  exports: [ReposService],
})
export class ReposModule {}
