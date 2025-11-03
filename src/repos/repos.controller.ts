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
  UsePipes,
  ValidationPipe,
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
  @UsePipes(new ValidationPipe({ transform: true }))
  async saveSelectedRepos(
    @Req() req: RequestWithUser,
    @Body() body: SelectReposDto,
  ) {
    const userId = req.user.githubId;

    // Pas besoin de validation manuelle : le pipe ValidationPipe s'en charge !
    // body.repoIds est déjà un array de numbers grâce à @Type(() => Number)

    const savedRepos = await this.reposService.saveSelectedRepos(
      userId,
      body.repoIds,
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
    @Param('repoId', ParseIntPipe) repoId: number,
  ) {
    const userId = req.user.githubId;

    // ParseIntPipe s'occupe de convertir et valider repoId automatiquement !
    // Pas besoin de Number() ni de vérifier isNaN

    await this.reposService.deleteRepo(userId, repoId);

    return {
      message: 'Repo supprimé avec succès',
    };
  }
}
