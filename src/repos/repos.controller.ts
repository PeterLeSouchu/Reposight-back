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

  @Get(':repoId/commits/metadata')
  @UseGuards(JwtAuthGuard)
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
