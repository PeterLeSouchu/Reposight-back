import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { ReposService } from './repos.service';
import type { RequestWithUser } from '../auth/types/auth.types';

@Injectable()
export class RepoOwnershipGuard implements CanActivate {
  constructor(private reposService: ReposService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const userId = request.user.githubId;
    const repoId = parseInt(request.params.repoId);

    if (isNaN(repoId)) {
      throw new ForbiddenException('ID de repo invalide');
    }

    const hasAccess = await this.reposService.hasRepoAccess(userId, repoId);

    if (!hasAccess) {
      throw new ForbiddenException(
        "Ce repo n'appartient pas à votre compte GitHub ou vous n'y avez pas accès",
      );
    }

    return true;
  }
}
