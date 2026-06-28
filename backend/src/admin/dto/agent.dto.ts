import { IsString, IsEmail, IsOptional, MinLength, IsBoolean } from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateAgentDto {
  @ApiProperty({ example: 'John Doe' })
  @IsString()
  name: string;

  @ApiProperty({ example: 'agent@example.com' })
  @IsEmail()
  email: string;

  @ApiPropertyOptional({ example: '9876543210' })
  @Transform(({ value }) => (value === '' || value == null ? undefined : value))
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiProperty({ minLength: 6 })
  @IsString()
  @MinLength(6)
  password: string;
}

export class UpdateAgentDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional()
  @Transform(({ value }) => (value === '' || value == null ? undefined : value))
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({ minLength: 6 })
  @Transform(({ value }) => (value === '' || value == null ? undefined : value))
  @IsOptional()
  @IsString()
  @MinLength(6)
  password?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
