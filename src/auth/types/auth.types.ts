import type { Request } from 'express';

/**
 * Types et interfaces pour le module Auth
 */

/**
 * Profil GitHub retourné par Passport
 */
export interface GitHubProfile {
  id: string;
  username: string;
  displayName?: string;
  profileUrl?: string;
  photos?: Array<{ value: string }>;
  emails?: Array<{ value: string }>;
  _json?: {
    avatar_url?: string;
    email?: string;
    [key: string]: unknown;
  };
  [key: string]: unknown;
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
  id: string;
  githubId: string;
  username: string;
  avatar: string;
  email: string;
  accessToken?: string;
  refreshToken?: string;
}

/**
 * Payload JWT pour les access tokens
 */
export interface JwtAccessPayload {
  id: string;
  githubId: string;
  username: string;
  avatar: string;
  email: string;
  type: 'access';
}

/**
 * Payload JWT pour les refresh tokens
 */
export interface JwtRefreshPayload {
  id: string;
  githubId: string;
  username: string;
  avatar: string;
  email: string;
  type: 'refresh';
}

/**
 * Union type pour les payloads JWT
 */
export type JwtPayload = JwtAccessPayload | JwtRefreshPayload;

/**
 * Request avec refresh token (pour refresh-token.strategy)
 */
export interface RequestWithRefreshToken {
  body?: {
    refreshToken?: string;
  };
  cookies?: {
    refresh_token?: string;
  };
  [key: string]: unknown;
}

/**
 * Request Express avec utilisateur authentifié (depuis Passport)
 */
export interface RequestWithUser extends Request {
  user: AuthenticatedUser;
}
