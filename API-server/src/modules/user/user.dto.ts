import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEmail,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';
import { UserResponse } from './user.model';

export class GetUserDto {
  @ApiPropertyOptional({ description: 'User id', example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  id?: number;
}

export class CreateUserDto {
  @ApiProperty({ description: 'Full name', example: 'Jane Doe' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ description: 'Email address', example: 'jane@example.com' })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({
    description: 'Postal address',
    example: '221B Baker Street, London',
  })
  @IsString()
  @IsNotEmpty()
  address: string;

  @ApiPropertyOptional({
    description: 'Phone number',
    example: 987654321,
    maximum: 2147483647,
  })
  @IsOptional()
  @IsNumber()
  phone?: number;
}

export class RemoveUserDto {
  @ApiProperty({ description: 'User id', example: 1 })
  @Type(() => Number)
  @IsInt()
  id: number;
}

export class UserDto {
  @ApiProperty({ description: 'User id', example: 1 })
  id: number;

  @ApiProperty({ description: 'Full name', example: 'Jane Doe' })
  name: string;

  @ApiPropertyOptional({
    description: 'Email address',
    example: 'jane@example.com',
  })
  email?: string;

  @ApiPropertyOptional({
    description: 'Postal address',
    example: '221B Baker Street, London',
  })
  address?: string;

  @ApiPropertyOptional({
    description: 'Phone number',
    example: 987654321,
    type: Number,
    nullable: true,
  })
  phone?: number | null;

  @ApiPropertyOptional({
    description: 'Whether the user is active',
    example: true,
  })
  is_active?: boolean;
}

export class UserResponseDto implements UserResponse {
  @ApiProperty({
    description: 'Matching users, or null on error or when none was found',
    type: [UserDto],
    nullable: true,
  })
  data: UserDto[] | null;

  @ApiProperty({
    description: '1 on success, 0 on error',
    enum: [0, 1],
    example: 1,
  })
  code: 0 | 1;

  @ApiProperty({
    description: 'Result of the request',
    example: 'User fetched successfully',
  })
  message: string;
}
