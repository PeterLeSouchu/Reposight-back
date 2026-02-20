import { IsArray, IsNumber, ArrayMaxSize, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class SelectReposDto {
  @ApiProperty({
    description: 'Liste des IDs de repos GitHub à sélectionner (max 25)',
    example: [123456, 789012],
    type: [Number],
  })
  @IsArray({ message: 'repoIds doit être un tableau' })
  @ArrayMaxSize(25, {
    message: 'Vous ne pouvez sélectionner que 25 repos maximum',
  })
  @Type(() => Number)
  @IsNumber({}, { each: true, message: 'Chaque repoId doit être un nombre' })
  @Min(1, { each: true, message: 'Chaque repoId doit être supérieur à 0' })
  repoIds: number[];
}
