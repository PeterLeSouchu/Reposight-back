export interface GitHubRepo {
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
  selected_at?: string;
  created_at?: string;
  updated_at?: string;
}

export interface DynamoDBRepo {
  repo_id: number;
  user_id: number;
  name: string;
  full_name: string;
  description: string;
  html_url: string;
  private: boolean;
  language: string | null;
  stargazers_count: number;
  forks_count: number;
  default_branch: string;
  pushed_at: string;
  selected_at: string;
  created_at: string;
  updated_at: string;
}
