export interface User {
  githubId: number;
  githubAccessToken: string;
  isNewUser: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface UserProfileResponse {
  avatar: string;
  username: string;
  email: string;
  isNewUser: boolean;
}
