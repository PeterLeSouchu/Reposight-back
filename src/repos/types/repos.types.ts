/**
 * Types et interfaces pour le module Repos
 */

/**
 * Repo GitHub retourné par l'API GitHub
 */
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
  default_branch?: string;
  [key: string]: unknown; // Pour les autres propriétés potentielles
}

/**
 * Repo enregistré en BDD DynamoDB
 * Note: repoId est stocké comme string dans DynamoDB (clé de partition)
 */
export interface StoredRepo {
  userId: string;
  repoId: string; // Stocké comme string dans DynamoDB
  name: string;
  full_name: string;
  description: string;
  html_url: string;
  private: boolean;
  language: string | null;
  stargazers_count: number;
  forks_count: number;
  default_branch: string;
  selectedAt: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Body de la requête POST /repos/select
 */
export interface SelectReposDto {
  repoIds: number[];
}
