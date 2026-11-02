import { Test, TestingModule } from '@nestjs/testing';
import { UserController } from './user.controller';
import { UserService } from './user.service';
import { UserResponse } from './user.model';

describe('UserController', () => {
  let controller: UserController;
  let userService: Record<'getUsers' | 'create' | 'remove', jest.Mock>;

  const errorResponse: UserResponse = {
    data: null,
    code: 0,
    message: 'Something went wrong',
  };

  beforeEach(async () => {
    userService = {
      getUsers: jest.fn(),
      create: jest.fn(),
      remove: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [UserController],
      providers: [{ provide: UserService, useValue: userService }],
    }).compile();

    controller = module.get<UserController>(UserController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('find', () => {
    it('requests all users when id is not provided', async () => {
      const response: UserResponse = {
        data: [{ id: 1, name: 'Jane' }],
        code: 1,
        message: '1 user(s) fetched successfully',
      };
      userService.getUsers.mockResolvedValue(response);

      expect(await controller.find({})).toEqual(response);
      expect(userService.getUsers).toHaveBeenCalledWith(undefined);
    });

    it('requests a single user when id is provided', async () => {
      const response: UserResponse = {
        data: [{ id: 1, name: 'Jane' }],
        code: 1,
        message: 'User fetched successfully',
      };
      userService.getUsers.mockResolvedValue(response);

      expect(await controller.find({ id: 1 })).toEqual(response);
      expect(userService.getUsers).toHaveBeenCalledWith(1);
    });

    it('returns an error response from UserService', async () => {
      userService.getUsers.mockResolvedValue(errorResponse);

      expect(await controller.find({})).toEqual(errorResponse);
    });
  });

  describe('create', () => {
    const dto = {
      name: 'Jane',
      email: 'jane@example.com',
      address: '221B Baker Street',
      phone: 123456789,
    };

    it('delegates to UserService', async () => {
      const response: UserResponse = {
        data: [{ id: 1, name: dto.name, email: dto.email }],
        code: 1,
        message: 'User added successfully',
      };
      userService.create.mockResolvedValue(response);

      expect(await controller.create(dto)).toEqual(response);
      expect(userService.create).toHaveBeenCalledWith(dto);
    });

    it('returns an error response from UserService', async () => {
      userService.create.mockResolvedValue(errorResponse);

      expect(await controller.create(dto)).toEqual(errorResponse);
    });
  });

  describe('remove', () => {
    it('delegates to UserService with the dto', async () => {
      const response: UserResponse = {
        data: [{ id: 1, name: 'Jane', email: 'jane@example.com' }],
        code: 1,
        message: 'User Jane removed successfully',
      };
      userService.remove.mockResolvedValue(response);

      expect(await controller.remove({ id: 1 })).toEqual(response);
      expect(userService.remove).toHaveBeenCalledWith({ id: 1 });
    });

    it('returns an error response from UserService', async () => {
      userService.remove.mockResolvedValue(errorResponse);

      expect(await controller.remove({ id: 1 })).toEqual(errorResponse);
    });
  });
});
