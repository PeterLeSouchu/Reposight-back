/**
 * Types et interfaces pour le module Users
 */

/**
 * Utilisateur enregistré en BDD DynamoDB
 */
export interface User {
  githubId: number; // Stocké comme number dans DynamoDB
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
 * Utilisateur tel qu'il est stocké dans DynamoDB (avec les noms de clés réels)
 */
export interface DynamoDBUser {
  github_id: number; // Clé de partition
  username: string;
  email: string;
  avatar: string;
  githubAccessToken: string;
  favorites: string[];
  createdAt: string;
  updatedAt: string;
}

/**
 * Réponse du profil utilisateur (champs publics uniquement)
 */
export interface UserProfileResponse {
  avatar: string;
  username: string;
  email: string;
}
