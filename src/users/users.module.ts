import { Module, forwardRef } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { ReposModule } from '../repos/repos.module';

@Module({
  imports: [forwardRef(() => ReposModule)], // Import pour utiliser ReposService dans UsersController (forwardRef pour éviter dépendance circulaire)
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService], // Important : exporter pour l'utiliser dans AuthModule
})
export class UsersModule {}
