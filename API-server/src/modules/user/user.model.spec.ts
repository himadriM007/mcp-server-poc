import { UserResponse } from './user.model';

describe('UserResponse', () => {
  it('holds a list of users on success', () => {
    const response: UserResponse = {
      data: [
        {
          id: 1,
          name: 'Jane',
          email: 'jane@example.com',
          address: '221B Baker Street',
          phone: 123456789,
        },
      ],
      code: 1,
      message: 'User fetched successfully',
    };

    expect(response.data).toHaveLength(1);
    expect(response.code).toBe(1);
  });

  it('allows null data on error', () => {
    const response: UserResponse = {
      data: null,
      code: 0,
      message: 'Failed to fetch users',
    };

    expect(response.data).toBeNull();
    expect(response.code).toBe(0);
  });

  it('only allows 0 or 1 as code', () => {
    // @ts-expect-error code must be 0 or 1
    const response: UserResponse = { data: null, code: 2, message: 'Invalid' };

    expect(response.code).toBe(2);
  });
});
