import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { RequestWithUser } from '../auth/types/auth.types';
import { ReposService } from './repos.service';
import { SelectReposDto } from './dto/select-repos.dto';

@Controller('repos')
export class ReposController {
  constructor(private reposService: ReposService) {}

  @Get('github')
  @UseGuards(JwtAuthGuard)
  async getGitHubRepos(@Req() req: RequestWithUser) {
    const userId = req.user.githubId;

    const repos = await this.reposService.getAvailableGitHubRepos(userId);

    return repos;
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  async getSelectedRepos(@Req() req: RequestWithUser) {
    const userId = req.user.githubId;

    const reposDeletedFromGithub = await this.reposService.syncRepos(userId);

    const repos = await this.reposService.getSelectedRepos(userId);

    return {
      repos,
      reposDeletedFromGithub,
    };
  }

  @Post('select')
  @UseGuards(JwtAuthGuard)
  async saveSelectedRepos(
    @Req() req: RequestWithUser,
    @Body() body: SelectReposDto,
  ) {
    const userId = req.user.githubId;

    const savedRepos = await this.reposService.saveSelectedRepos(
      userId,
      body.repoIds,
    );

    return {
      message: `${savedRepos.length} dépôt(s) enregistré(s) avec succès`,
      repos: savedRepos,
    };
  }

  @Get(':repoId')
  @UseGuards(JwtAuthGuard)
  async getRepoDashboard(
    @Req() req: RequestWithUser,
    @Param('repoId', ParseIntPipe) repoId: number,
  ) {
    const userId = req.user.githubId;

    const repository = await this.reposService.getRepoDetails(userId, repoId);

    return repository;
  }

  @Delete(':repoId')
  @UseGuards(JwtAuthGuard)
  async deleteRepo(
    @Req() req: RequestWithUser,
    @Param('repoId', ParseIntPipe) repoId: number,
  ) {
    const userId = req.user.githubId;

    await this.reposService.deleteRepo(userId, repoId);

    return {
      message: 'Dépôt supprimé avec succès',
    };
  }
}
