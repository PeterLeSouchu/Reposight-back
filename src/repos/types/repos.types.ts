export interface GitHubApiRepo {
  id: number;
  name: string;
  full_name: string;
  description: string | null;
  html_url: string;
  private: boolean;
  language: string | null;
  stargazers_count: number;
  forks_count: number;
  default_branch: string;
  pushed_at: string;
}

export interface GitHubApiContributor {
  login: string;
  contributions: number;
  avatar_url: string;
  html_url: string;
}

export interface GitHubApiCommit {
  sha: string;
  commit: {
    message: string;
    author: {
      name: string;
      date: string;
    };
  };
  author: {
    login: string;
    avatar_url: string;
  } | null;
  html_url: string;
}

export interface GitHubApiRepoInfo {
  name: string;
  description: string | null;
  fork: boolean;
  private: boolean;
  stargazers_count: number;
  size: number;
  languages_url: string;
  html_url: string;
}

export interface GitHubApiLanguage {
  [language: string]: number;
}

export interface GitHubApiIssue {
  number: number;
  title: string;
  html_url: string;
  state: 'open' | 'closed';
  created_at: string;
  updated_at: string;
  closed_at: string | null;
  user: {
    login: string;
    avatar_url: string;
  } | null;
  labels: Array<{ name: string }>;
  comments: number;
  pull_request?: unknown;
}

export interface GitHubApiPullRequest {
  number: number;
  title: string;
  created_at: string;
  html_url: string;
  state: 'open' | 'closed';
  updated_at: string;
  closed_at: string | null;
  merged_at: string | null;
  user: {
    login: string;
    avatar_url: string;
  } | null;
}

export interface PullRequest {
  number: number;
  title: string;
  author: {
    login: string;
    avatar: string;
  };
  state: 'open' | 'closed' | 'merged';
  createdAt: string;
  updatedAt: string;
  closedAt: string | null;
  mergedAt: string | null;
  url: string;
}

export interface PullRequestsMetadata {
  authors: AuthorInfo[];
  states: string[];
}

export interface PullRequestsResponse {
  pullRequests: PullRequest[];
  pagination: PaginationInfo;
}

export interface GitHubRepo {
  id: number;
  name: string;
  fullName: string;
  description: string | null;
  htmlUrl: string;
  private: boolean;
  language: string | null;
  pushedAt: string;
  selectedAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface DynamoDBRepo {
  repoId: number;
  userId: number;
  name: string;
  fullName: string;
  description: string;
  htmlUrl: string;
  private: boolean;
  language: string | null;
  pushedAt: string;
  selectedAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface Commit {
  sha: string;
  message: string;
  author: {
    name: string;
    login: string | null;
    avatar: string | null;
  };
  date: string;
  url: string;
}

export interface PaginationInfo {
  page: number;
  perPage: number;
  total: number | null;
  totalPages: number | null;
  hasNext: boolean;
  hasPrevious: boolean;
}

export interface CommitsResponse {
  commits: Commit[];
  pagination: PaginationInfo;
}

export interface AuthorInfo {
  username: string;
  avatar: string;
}

export interface CommitsMetadata {
  authors: AuthorInfo[];
  branches: string[];
}

export interface GitHubApiBranch {
  name: string;
  commit: {
    sha: string;
    url: string;
  };
  protected: boolean;
}

export interface Issue {
  number: number;
  title: string;
  author: {
    login: string;
    avatar: string;
  };
  state: 'open' | 'closed';
  createdAt: string;
  updatedAt: string;
  closedAt: string | null;
  comments: number;
  labels: string[];
  url: string;
}

export interface IssuesMetadata {
  authors: AuthorInfo[];
  states: string[];
}

export interface IssuesResponse {
  issues: Issue[];
  pagination: PaginationInfo;
}
