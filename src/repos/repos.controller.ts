import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ReposService } from './repos.service';

@Controller('repos')
export class ReposController {
  constructor(private reposService: ReposService) {}

  /**
   * Route pour récupérer les repos GitHub de l'utilisateur
   * Retourne TOUS les repos GitHub (le filtrage peut être fait côté frontend)
   */
  @Get('github')
  @UseGuards(JwtAuthGuard)
  async getGitHubRepos(@Req() req: Request) {
    // req.user est disponible grâce à JwtAuthGuard
    const user = req.user as any;
    const userId = user.githubId; // Le githubId vient du JWT

    // Récupérer les repos GitHub disponibles (non sélectionnés)
    const repos = await this.reposService.getAvailableGitHubRepos(userId);

    return repos;
  }
}
