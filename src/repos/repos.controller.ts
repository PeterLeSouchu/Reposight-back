import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
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

  @Get('github')
  @UseGuards(JwtAuthGuard)
  async getGitHubRepos(@Req() req: RequestWithUser) {
    const userId = req.user.githubId;

    // Récupérer les repos GitHub disponibles (non sélectionnés)
    const repos = await this.reposService.getAvailableGitHubRepos(userId);

    return repos;
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  async getSelectedRepos(@Req() req: RequestWithUser) {
    const userId = req.user.githubId;

    const repos = await this.reposService.getSelectedRepos(userId);

    return repos;
  }

  @Post('select')
  @UseGuards(JwtAuthGuard)
  async saveSelectedRepos(
    @Req() req: RequestWithUser,
    @Body() body: SelectReposDto,
  ) {
    const userId = req.user.githubId;

    if (
      !body.repoIds ||
      !Array.isArray(body.repoIds) ||
      body.repoIds.length === 0
    ) {
      throw new BadRequestException('repoIds doit être un tableau non vide');
    }

    // Convertir les IDs en numbers (au cas où ils arrivent comme strings)
    const repoIds = body.repoIds
      .map((id) => Number(id))
      .filter((id) => !isNaN(id));

    if (repoIds.length === 0) {
      throw new BadRequestException(
        'Les repoIds doivent être des nombres valides',
      );
    }

    const savedRepos = await this.reposService.saveSelectedRepos(
      userId,
      repoIds,
    );

    return {
      message: `${savedRepos.length} repo(s) enregistré(s) avec succès`,
      repos: savedRepos,
    };
  }

  @Delete(':repoId')
  @UseGuards(JwtAuthGuard)
  async deleteRepo(
    @Req() req: RequestWithUser,
    @Param('repoId') repoId: string,
  ) {
    const userId = req.user.githubId;

    // Convertir repoId en number
    const repoIdNumber = Number(repoId);
    if (isNaN(repoIdNumber)) {
      throw new BadRequestException('repoId doit être un nombre valide');
    }

    await this.reposService.deleteRepo(userId, repoIdNumber);

    return {
      message: 'Repo supprimé avec succès',
    };
  }
}
