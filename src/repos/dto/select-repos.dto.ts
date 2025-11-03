import { IsArray, IsNumber } from 'class-validator';
import { Type } from 'class-transformer';

/**
 * DTO pour la requête POST /repos/select
 */
export class SelectReposDto {
  @IsArray({ message: 'repoIds doit être un tableau' })
  @IsNumber({}, { each: true, message: 'Chaque repoId doit être un nombre' })
  @Type(() => Number)
  repoIds: number[];
}
