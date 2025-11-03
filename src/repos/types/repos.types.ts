/**
 * Types et interfaces pour le module Repos
 */

/**
 * Type unifié pour les repos
 * Utilisé à la fois pour les repos GitHub et les repos stockés en BDD
 * Toutes les propriétés sont en snake_case
 */
export interface Repo {
  // Identifiants
  id: number; // ID GitHub et BDD (number) - mappé vers repo_id dans DynamoDB
  // Note: user_id est uniquement dans DynamoDBRepo (info interne DynamoDB)

  // Propriétés du repo
  name: string;
  full_name: string;
  description: string | null;
  html_url: string;
  private: boolean;
  language: string | null;
  stargazers_count: number;
  forks_count: number;
  default_branch: string;
  pushed_at: string; // Date du dernier push au format ISO

  // Champs de gestion BDD (optionnels - présents uniquement en BDD)
  selected_at?: string;
  created_at?: string;
  updated_at?: string;
}

// Alias pour compatibilité avec le code existant
export type GitHubRepo = Repo;
export type StoredRepo = Repo;

/**
 * Repo tel qu'il est stocké dans DynamoDB (avec les noms de clés réels)
 */
export interface DynamoDBRepo {
  repo_id: number; // Clé de partition
  user_id: number; // Clé de partition
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
