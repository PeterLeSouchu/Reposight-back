import type { Request } from 'express';

/**
 * Profil GitHub retourné par Passport
 */
export interface GitHubProfile {
  id: string | number;
}

/**
 * Callback Passport pour valider un utilisateur
 */
export type PassportDoneCallback = (
  error: Error | null,
  user?: AuthenticatedUser | false,
) => void;

/**
 * Utilisateur authentifié retourné par les stratégies
 */
export interface AuthenticatedUser {
  githubId: number;
  accessToken?: string;
}

/**
 * Payload JWT pour les access tokens
 */
export interface JwtAccessPayload {
  githubId: number;
  type: 'access';
}

/**
 * Payload JWT pour les refresh tokens
 */
export interface JwtRefreshPayload {
  githubId: number;
  type: 'refresh';
}

/**
 * Request avec refresh token (pour refresh-token.strategy)
 */
export interface RequestWithRefreshToken {
  cookies?: {
    refresh_token?: string;
  };
}

/**
 * Request Express avec utilisateur authentifié (depuis Passport)
 */
export interface RequestWithUser extends Request {
  user: AuthenticatedUser;
}
