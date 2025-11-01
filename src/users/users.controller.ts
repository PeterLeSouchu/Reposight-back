import {
  Controller,
  Get,
  Req,
  UseGuards,
  NotFoundException,
} from '@nestjs/common';
import type { Request } from 'express';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('user')
export class UsersController {
  constructor(private usersService: UsersService) {}

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async getProfile(@Req() req: Request) {
    // req.user est disponible grâce à JwtAuthGuard et contient le githubId
    const user = req.user as any;
    const githubId = user.githubId;

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
