import {
  Controller,
  Get,
  Req,
  UseGuards,
  NotFoundException,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { RequestWithUser } from '../auth/types/auth.types';
import type { UserProfileResponse } from './types/users.types';

@Controller('user')
export class UsersController {
  constructor(private usersService: UsersService) {}

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async getProfile(@Req() req: RequestWithUser): Promise<UserProfileResponse> {
    const githubId = req.user.githubId;

    // Récupérer l'utilisateur complet depuis DynamoDB
    const dbUser = await this.usersService.findByGitHubId(githubId);

    if (!dbUser) {
      throw new NotFoundException('Utilisateur non trouvé en base de données');
    }

    // Retourner uniquement les champs demandés
    return {
      avatar: dbUser.avatar,
      username: dbUser.username,
      email: dbUser.email,
    };
  }
}
