export interface RepoInfo {
  id: number;
  name: string;
  description: string | null;
  url: string;
  languages: Array<{
    name: string;
    percentage: number;
  }>;
  isFork: boolean;
  isPrivate: boolean;
  sizeMb: number;
  contributorsCount: number;
  starsCount: number;
  lastCommit: {
    sha: string;
    message: string;
    author: string;
    authorAvatar: string;
    date: string;
  };
}

export interface RecentActivityItem {
  type: 'commit' | 'pr' | 'issue';
  title: string;
  author: string;
  authorAvatar: string;
  date: string;
  url: string;
  // Pour les commits uniquement
  sha?: string;
  // Pour les PRs et issues uniquement
  number?: number;
}

export interface RecentActivityStats {
  commits: number;
  prs: number;
  issues: number;
}

export interface RecentActivity {
  stats: RecentActivityStats;
  items: RecentActivityItem[];
}

export interface DailyStats {
  date: string;
  commits: number;
  prs: number;
  issues: number;
}

export interface WeeklyComparison {
  commits: {
    currentWeek: number;
    lastWeek: number;
    percentage: number;
  };
  prs: {
    currentWeek: number;
    lastWeek: number;
    percentage: number;
  };
  issues: {
    currentWeek: number;
    lastWeek: number;
    percentage: number;
  };
}

export interface Contributor {
  username: string;
  commits: number;
  avatar: string;
  url: string;
}

export interface RepoDashboard {
  info: RepoInfo;
  recentActivity: RecentActivity;
  dailyStats: DailyStats[];
  weeklyComparison: WeeklyComparison;
  contributors: Contributor[];
}
