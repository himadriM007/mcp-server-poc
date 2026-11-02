import { Test, TestingModule } from '@nestjs/testing';
import { UserService } from './user.service';
import { UserResponse } from './user.model';
import { DbService } from '../../services/db/db.service';
import { callDbFunction } from '../../services/db/dbFunction';

jest.mock('../../services/db/dbFunction');

describe('UserService', () => {
  const callDbFunctionMock = callDbFunction as jest.Mock;
  const dbService = { query: jest.fn() };
  let service: UserService;

  beforeEach(async () => {
    callDbFunctionMock.mockReset();

    const module: TestingModule = await Test.createTestingModule({
      providers: [UserService, { provide: DbService, useValue: dbService }],
    }).compile();

    service = module.get<UserService>(UserService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getUsers', () => {
    const response: UserResponse = {
      data: [{ id: 1, name: 'Jane', email: 'jane@example.com' }],
      code: 1,
      message: 'User fetched successfully',
    };

    beforeEach(() => {
      callDbFunctionMock.mockResolvedValue(response);
    });

    it('calls fn_get_users with null when no id is given', async () => {
      const result = await service.getUsers();

      expect(callDbFunctionMock).toHaveBeenCalledWith(
        dbService,
        'fn_get_users',
        null,
        'Failed to fetch users',
      );
      expect(result).toEqual(response);
    });

    it('calls fn_get_users with the id', async () => {
      await service.getUsers(1);

      expect(callDbFunctionMock).toHaveBeenCalledWith(
        dbService,
        'fn_get_users',
        { id: 1 },
        'Failed to fetch users',
      );
    });

    it('treats an id of 0 as a single user request', async () => {
      await service.getUsers(0);

      expect(callDbFunctionMock).toHaveBeenCalledWith(
        dbService,
        'fn_get_users',
        { id: 0 },
        'Failed to fetch users',
      );
    });
  });

  describe('create', () => {
    it('calls fn_add_user with the dto and returns its response', async () => {
      const dto = {
        name: 'Jane',
        email: 'jane@example.com',
        address: '221B Baker Street',
        phone: 123456789,
      };
      const response: UserResponse = {
        data: [{ id: 1, name: dto.name, email: dto.email }],
        code: 1,
        message: 'User added successfully',
      };
      callDbFunctionMock.mockResolvedValue(response);

      const result = await service.create(dto);

      expect(callDbFunctionMock).toHaveBeenCalledWith(
        dbService,
        'fn_add_user',
        dto,
        'Failed to add user',
      );
      expect(result).toEqual(response);
    });

    it('returns a rejection from fn_add_user unchanged', async () => {
      const response: UserResponse = {
        data: null,
        code: 0,
        message: 'A user with email jane@example.com already exists',
      };
      callDbFunctionMock.mockResolvedValue(response);

      const result = await service.create({
        name: 'Jane',
        email: 'jane@example.com',
        address: '221B Baker Street',
      });

      expect(result).toEqual(response);
    });
  });

  describe('remove', () => {
    it('calls fn_remove_user with the dto and adds the id to the user', async () => {
      const user = { name: 'Jane', email: 'jane@example.com' };
      const message = 'User Jane removed successfully';
      callDbFunctionMock.mockResolvedValue({
        data: [user],
        code: 1,
        message,
      });

      const result = await service.remove({ id: 1 });

      expect(callDbFunctionMock).toHaveBeenCalledWith(
        dbService,
        'fn_remove_user',
        { id: 1 },
        'Failed to remove user',
      );
      expect(result).toEqual({ data: [{ id: 1, ...user }], code: 1, message });
    });

    it('keeps data null when fn_remove_user reports an error', async () => {
      const response: UserResponse = {
        data: null,
        code: 0,
        message: 'Error #1: failed',
      };
      callDbFunctionMock.mockResolvedValue(response);

      expect(await service.remove({ id: 1 })).toEqual(response);
    });
  });
});
