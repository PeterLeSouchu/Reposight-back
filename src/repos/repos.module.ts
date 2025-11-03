import { Module, forwardRef } from '@nestjs/common';
import { UsersModule } from '../users/users.module';
import { ReposController } from './repos.controller';
import { ReposService } from './repos.service';

@Module({
  imports: [forwardRef(() => UsersModule)], // Important : pour utiliser UsersService (forwardRef pour éviter dépendance circulaire)
  controllers: [ReposController],
  providers: [ReposService],
  exports: [ReposService], // Au cas où d'autres modules en auraient besoin
})
export class ReposModule {}
