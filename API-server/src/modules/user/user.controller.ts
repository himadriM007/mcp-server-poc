import { Body, Controller, Delete, Get, Post, Query } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { UserService } from './user.service';
import {
  CreateUserDto,
  GetUserDto,
  RemoveUserDto,
  UserResponseDto,
} from './user.dto';
import { UserResponse } from './user.model';

@ApiTags('users')
@ApiBadRequestResponse({ description: 'The request failed validation.' })
@Controller()
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get()
  @ApiOperation({
    summary: 'Get users',
    description:
      'Returns one user when id is provided, otherwise all users. Only active users are returned. A missing user returns code 1 with null data.',
  })
  @ApiOkResponse({ type: UserResponseDto })
  find(@Query() dto: GetUserDto): Promise<UserResponse> {
    return this.userService.getUsers(dto.id);
  }

  @Post()
  @ApiOperation({
    summary: 'Add a user',
    description:
      'Creates a user and returns its id, name and email. A duplicate email returns code 0, including an email held by an inactive user.',
  })
  @ApiCreatedResponse({ type: UserResponseDto })
  create(@Body() dto: CreateUserDto): Promise<UserResponse> {
    return this.userService.create(dto);
  }

  @Delete()
  @ApiOperation({
    summary: 'Remove a user',
    description:
      'Marks the user as inactive and returns its id, name and email. A missing or already inactive user returns code 0.',
  })
  @ApiOkResponse({ type: UserResponseDto })
  remove(@Query() dto: RemoveUserDto): Promise<UserResponse> {
    return this.userService.remove(dto);
  }
}
