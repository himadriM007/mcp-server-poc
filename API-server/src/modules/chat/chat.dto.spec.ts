import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ChatMessageDto, ConfirmToolDto, ResetChatDto } from './chat.dto';

const errorsFor = async <T extends object>(
  cls: new () => T,
  plain: Record<string, unknown>,
) => {
  const errors = await validate(plainToInstance(cls, plain));
  return errors.map((e) => e.property);
};

describe('Chat DTOs', () => {
  describe('ChatMessageDto', () => {
    it('accepts a session id and message', async () => {
      expect(
        await errorsFor(ChatMessageDto, { sessionId: 's1', message: 'hi' }),
      ).toEqual([]);
    });

    it('requires both fields', async () => {
      expect(await errorsFor(ChatMessageDto, {})).toEqual([
        'message',
        'sessionId',
      ]);
    });

    it('rejects an empty message', async () => {
      expect(
        await errorsFor(ChatMessageDto, { sessionId: 's1', message: '' }),
      ).toEqual(['message']);
    });

    it('rejects a message over 4000 characters', async () => {
      expect(
        await errorsFor(ChatMessageDto, {
          sessionId: 's1',
          message: 'x'.repeat(4001),
        }),
      ).toEqual(['message']);
    });
  });

  describe('ConfirmToolDto', () => {
    it('accepts a boolean decision', async () => {
      expect(
        await errorsFor(ConfirmToolDto, { sessionId: 's1', approve: false }),
      ).toEqual([]);
    });

    it('rejects a non-boolean decision', async () => {
      expect(
        await errorsFor(ConfirmToolDto, { sessionId: 's1', approve: 'yes' }),
      ).toEqual(['approve']);
    });
  });

  describe('ResetChatDto', () => {
    it('requires a session id', async () => {
      expect(await errorsFor(ResetChatDto, { sessionId: '' })).toEqual([
        'sessionId',
      ]);
    });
  });
});
