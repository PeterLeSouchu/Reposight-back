import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { RequestWithUser } from '../auth/types/auth.types';
import { ReposService } from './repos.service';
import { SelectReposDto } from './dto/select-repos.dto';

@ApiTags('Repos')
@ApiBearerAuth()
@Controller('repos')
export class ReposController {
  constructor(private reposService: ReposService) {}

  @Get('github')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Lister les repos GitHub disponibles de l\'utilisateur' })
  @ApiResponse({ status: 200, description: 'Liste des repos GitHub' })
  @ApiResponse({ status: 401, description: 'Non authentifié' })
  async getGitHubRepos(@Req() req: RequestWithUser) {
    const userId = req.user.githubId;

    const repos = await this.reposService.getAvailableGitHubRepos(userId);

    return repos;
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Récupérer les repos sélectionnés par l\'utilisateur' })
  @ApiResponse({ status: 200, description: 'Liste des repos sélectionnés + repos supprimés de GitHub' })
  @ApiResponse({ status: 401, description: 'Non authentifié' })
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
  @ApiOperation({ summary: 'Enregistrer les repos sélectionnés (max 25)' })
  @ApiResponse({ status: 201, description: 'Repos enregistrés avec succès' })
  @ApiResponse({ status: 400, description: 'Données invalides' })
  @ApiResponse({ status: 401, description: 'Non authentifié' })
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

  @Get(':repoId/commits/metadata')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Métadonnées des commits (auteurs, branches)' })
  @ApiParam({ name: 'repoId', type: Number, description: 'ID du repo GitHub' })
  @ApiResponse({ status: 200, description: 'Métadonnées des commits' })
  @ApiResponse({ status: 401, description: 'Non authentifié' })
  async getCommitsMetadata(
    @Req() req: RequestWithUser,
    @Param('repoId', ParseIntPipe) repoId: number,
  ) {
    const userId = req.user.githubId;

    const metadata = await this.reposService.getCommitsMetadata(userId, repoId);

    return metadata;
  }

  @Get(':repoId/commits')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Lister les commits d\'un repo avec filtres' })
  @ApiParam({ name: 'repoId', type: Number, description: 'ID du repo GitHub' })
  @ApiQuery({ name: 'page', required: false, type: Number, description: 'Numéro de page (défaut: 1)' })
  @ApiQuery({ name: 'perPage', required: false, type: Number, description: 'Nombre par page (défaut: 100)' })
  @ApiQuery({ name: 'search', required: false, type: String, description: 'Recherche dans les messages de commit' })
  @ApiQuery({ name: 'author', required: false, type: String, description: 'Filtrer par auteur' })
  @ApiQuery({ name: 'branch', required: false, type: String, description: 'Filtrer par branche' })
  @ApiResponse({ status: 200, description: 'Liste paginée des commits' })
  @ApiResponse({ status: 401, description: 'Non authentifié' })
  async getCommits(
    @Req() req: RequestWithUser,
    @Param('repoId', ParseIntPipe) repoId: number,
    @Query('page') page?: string,
    @Query('perPage') perPage?: string,
    @Query('search') search?: string,
    @Query('author') author?: string,
    @Query('branch') branch?: string,
  ) {
    const userId = req.user.githubId;

    const pageNumber = page ? parseInt(page, 10) : 1;
    const perPageNumber = perPage ? parseInt(perPage, 10) : 100;

    const commits = await this.reposService.getCommits(
      userId,
      repoId,
      pageNumber,
      perPageNumber,
      search,
      author,
      branch,
    );

    return commits;
  }

  @Get(':repoId/pull-requests/metadata')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Métadonnées des pull requests (auteurs)' })
  @ApiParam({ name: 'repoId', type: Number, description: 'ID du repo GitHub' })
  @ApiResponse({ status: 200, description: 'Métadonnées des pull requests' })
  @ApiResponse({ status: 401, description: 'Non authentifié' })
  async getPullRequestsMetadata(
    @Req() req: RequestWithUser,
    @Param('repoId', ParseIntPipe) repoId: number,
  ) {
    const userId = req.user.githubId;

    const metadata = await this.reposService.getPullRequestsMetadata(
      userId,
      repoId,
    );

    return metadata;
  }

  @Get(':repoId/pull-requests')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Lister les pull requests d\'un repo avec filtres' })
  @ApiParam({ name: 'repoId', type: Number, description: 'ID du repo GitHub' })
  @ApiQuery({ name: 'page', required: false, type: Number, description: 'Numéro de page (défaut: 1)' })
  @ApiQuery({ name: 'perPage', required: false, type: Number, description: 'Nombre par page (défaut: 100)' })
  @ApiQuery({ name: 'author', required: false, type: String, description: 'Filtrer par auteur' })
  @ApiQuery({ name: 'state', required: false, type: String, description: 'Filtrer par état (open, closed, all)' })
  @ApiResponse({ status: 200, description: 'Liste paginée des pull requests' })
  @ApiResponse({ status: 401, description: 'Non authentifié' })
  async getPullRequests(
    @Req() req: RequestWithUser,
    @Param('repoId', ParseIntPipe) repoId: number,
    @Query('page') page?: string,
    @Query('perPage') perPage?: string,
    @Query('author') author?: string,
    @Query('state') state?: string,
  ) {
    const userId = req.user.githubId;

    const pageNumber = page ? parseInt(page, 10) : 1;
    const perPageNumber = perPage ? parseInt(perPage, 10) : 100;

    const pullRequests = await this.reposService.getPullRequests(
      userId,
      repoId,
      pageNumber,
      perPageNumber,
      author,
      state,
    );

    return pullRequests;
  }

  @Get(':repoId/issues/metadata')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Métadonnées des issues (auteurs)' })
  @ApiParam({ name: 'repoId', type: Number, description: 'ID du repo GitHub' })
  @ApiResponse({ status: 200, description: 'Métadonnées des issues' })
  @ApiResponse({ status: 401, description: 'Non authentifié' })
  async getIssuesMetadata(
    @Req() req: RequestWithUser,
    @Param('repoId', ParseIntPipe) repoId: number,
  ) {
    const userId = req.user.githubId;

    const metadata = await this.reposService.getIssuesMetadata(userId, repoId);

    return metadata;
  }

  @Get(':repoId/issues')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Lister les issues d\'un repo avec filtres' })
  @ApiParam({ name: 'repoId', type: Number, description: 'ID du repo GitHub' })
  @ApiQuery({ name: 'page', required: false, type: Number, description: 'Numéro de page (défaut: 1)' })
  @ApiQuery({ name: 'perPage', required: false, type: Number, description: 'Nombre par page (défaut: 100)' })
  @ApiQuery({ name: 'author', required: false, type: String, description: 'Filtrer par auteur' })
  @ApiQuery({ name: 'state', required: false, type: String, description: 'Filtrer par état (open, closed, all)' })
  @ApiResponse({ status: 200, description: 'Liste paginée des issues' })
  @ApiResponse({ status: 401, description: 'Non authentifié' })
  async getIssues(
    @Req() req: RequestWithUser,
    @Param('repoId', ParseIntPipe) repoId: number,
    @Query('page') page?: string,
    @Query('perPage') perPage?: string,
    @Query('author') author?: string,
    @Query('state') state?: string,
  ) {
    const userId = req.user.githubId;

    const pageNumber = page ? parseInt(page, 10) : 1;
    const perPageNumber = perPage ? parseInt(perPage, 10) : 100;

    const issues = await this.reposService.getIssues(
      userId,
      repoId,
      pageNumber,
      perPageNumber,
      author,
      state,
    );

    return issues;
  }

  @Get(':repoId')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Récupérer le dashboard d\'un repo (détails complets)' })
  @ApiParam({ name: 'repoId', type: Number, description: 'ID du repo GitHub' })
  @ApiResponse({ status: 200, description: 'Détails complets du repo' })
  @ApiResponse({ status: 401, description: 'Non authentifié' })
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
  @ApiOperation({ summary: 'Supprimer un repo sélectionné' })
  @ApiParam({ name: 'repoId', type: Number, description: 'ID du repo GitHub' })
  @ApiResponse({ status: 200, description: 'Repo supprimé avec succès' })
  @ApiResponse({ status: 401, description: 'Non authentifié' })
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
