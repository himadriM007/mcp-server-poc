import { Injectable } from '@nestjs/common';
import { DbService } from '../../services/db/db.service';
import { callDbFunction } from '../../services/db/dbFunction';
import { User } from '../../models/user.model';
import { UserResponse } from './user.model';
import { CreateUserDto, RemoveUserDto } from './user.dto';

@Injectable()
export class UserService {
  constructor(private readonly dbService: DbService) {}

  getUsers(userId?: number): Promise<UserResponse> {
    return callDbFunction<User>(
      this.dbService,
      'fn_get_users',
      userId === undefined ? null : { id: userId },
      'Failed to fetch users',
    );
  }

  create(dto: CreateUserDto): Promise<UserResponse> {
    return callDbFunction<User>(
      this.dbService,
      'fn_add_user',
      dto,
      'Failed to add user',
    );
  }

  async remove(dto: RemoveUserDto): Promise<UserResponse> {
    const response = await callDbFunction<User>(
      this.dbService,
      'fn_remove_user',
      dto,
      'Failed to remove user',
    );

    // fn_remove_user returns only name and email.
    return {
      ...response,
      data: response.data?.map((user) => ({ ...user, id: dto.id })) ?? null,
    };
  }
}
