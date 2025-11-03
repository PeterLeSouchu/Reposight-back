/**
 * Types et interfaces pour le module Users
 */

/**
 * Utilisateur enregistré en BDD DynamoDB
 */
export interface User {
  githubId: string;
  username: string;
  email: string;
  avatar: string;
  githubAccessToken: string;
  favorites: string[];
  createdAt: string;
  updatedAt: string;
}

/**
 * Données pour créer un nouvel utilisateur
 */
export interface CreateUserDto {
  githubId: string | number;
  username: string;
  email: string;
  avatar: string;
  githubAccessToken?: string;
}

/**
 * Données pour mettre à jour un utilisateur
 */
export interface UpdateUserDto {
  githubAccessToken?: string;
  username?: string;
  email?: string;
  avatar?: string;
}

/**
 * Réponse du profil utilisateur (champs publics uniquement)
 */
export interface UserProfileResponse {
  avatar: string;
  username: string;
  email: string;
}
