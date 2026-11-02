import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateUserDto, GetUserDto, RemoveUserDto } from './user.dto';

describe('User DTOs', () => {
  describe('GetUserDto', () => {
    it('allows id to be omitted', async () => {
      const dto = new GetUserDto();
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('rejects a non-numeric id', async () => {
      const dto = new GetUserDto();
      (dto as unknown as { id: unknown }).id = 'abc';
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('converts an id from the query string to a number', async () => {
      const dto = plainToInstance(GetUserDto, { id: '1' });
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
      expect(dto.id).toBe(1);
    });

    it('rejects a non-integer id', async () => {
      const dto = plainToInstance(GetUserDto, { id: '1.5' });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'id')).toBe(true);
    });
  });

  describe('CreateUserDto', () => {
    const valid = () => {
      const dto = new CreateUserDto();
      dto.name = 'Jane';
      dto.email = 'jane@example.com';
      dto.address = '221B Baker Street';
      return dto;
    };

    it('passes without phone (optional)', async () => {
      const errors = await validate(valid());
      expect(errors).toHaveLength(0);
    });

    it('passes with phone provided', async () => {
      const dto = valid();
      dto.phone = 123456789;
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it.each(['name', 'email', 'address'])(
      'fails when %s is missing',
      async (field: string) => {
        const dto = valid();
        delete (dto as unknown as Record<string, unknown>)[field];
        const errors = await validate(dto);
        expect(errors.some((e) => e.property === field)).toBe(true);
      },
    );

    it.each(['name', 'email', 'address'])(
      'fails when %s is empty',
      async (field: string) => {
        const dto = valid();
        (dto as unknown as Record<string, unknown>)[field] = '';
        const errors = await validate(dto);
        expect(errors.some((e) => e.property === field)).toBe(true);
      },
    );

    it('fails with an invalid email', async () => {
      const dto = valid();
      dto.email = 'not-an-email';
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'email')).toBe(true);
    });

    it('fails with a non-numeric phone', async () => {
      const dto = valid();
      (dto as unknown as { phone: unknown }).phone = 'abc';
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'phone')).toBe(true);
    });
  });

  describe('RemoveUserDto', () => {
    it('requires id', async () => {
      const dto = new RemoveUserDto();
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'id')).toBe(true);
    });

    it('passes with a numeric id', async () => {
      const dto = new RemoveUserDto();
      dto.id = 1;
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('converts an id from the query string to a number', async () => {
      const dto = plainToInstance(RemoveUserDto, { id: '1' });
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
      expect(dto.id).toBe(1);
    });

    it('rejects a non-numeric id', async () => {
      const dto = plainToInstance(RemoveUserDto, { id: 'abc' });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'id')).toBe(true);
    });
  });
});
