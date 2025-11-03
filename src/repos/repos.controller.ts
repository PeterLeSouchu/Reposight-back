import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { RequestWithUser } from '../auth/types/auth.types';
import { ReposService } from './repos.service';
import type { SelectReposDto } from './types/repos.types';

@Controller('repos')
export class ReposController {
  constructor(private reposService: ReposService) {}

  /**
   * Route pour récupérer les repos GitHub de l'utilisateur
   * Retourne TOUS les repos GitHub (le filtrage peut être fait côté frontend)
   */
  @Get('github')
  @UseGuards(JwtAuthGuard)
  async getGitHubRepos(@Req() req: RequestWithUser) {
    const userId = req.user.githubId;

    // Récupérer les repos GitHub disponibles (non sélectionnés)
    const repos = await this.reposService.getAvailableGitHubRepos(userId);

    return repos;
  }

  /**
   * Route pour récupérer les repos sélectionnés par l'utilisateur (enregistrés en BDD)
   */
  @Get()
  @UseGuards(JwtAuthGuard)
  async getSelectedRepos(@Req() req: RequestWithUser) {
    const userId = req.user.githubId;

    const repos = await this.reposService.getSelectedRepos(userId);

    return repos;
  }

  /**
   * Route pour enregistrer les repos sélectionnés par l'utilisateur en BDD
   * Body: { repos: [...] } - Les objets repos complets depuis GET /repos/github
   */
  @Post('select')
  @UseGuards(JwtAuthGuard)
  async saveSelectedRepos(
    @Req() req: RequestWithUser,
    @Body() body: SelectReposDto,
  ) {
    const userId = req.user.githubId;

    if (!body.repos || !Array.isArray(body.repos) || body.repos.length === 0) {
      throw new BadRequestException('repos doit être un tableau non vide');
    }

    const savedRepos = await this.reposService.saveSelectedRepos(
      userId,
      body.repos,
    );

    return {
      message: `${savedRepos.length} repo(s) enregistré(s) avec succès`,
      repos: savedRepos,
    };
  }
}
