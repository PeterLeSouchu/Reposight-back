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
  created_at: string;
  html_url: string;
  user: {
    login: string;
    avatar_url: string;
  } | null;
}

export interface GitHubApiPullRequest {
  number: number;
  title: string;
  created_at: string;
  html_url: string;
  user: {
    login: string;
    avatar_url: string;
  } | null;
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
