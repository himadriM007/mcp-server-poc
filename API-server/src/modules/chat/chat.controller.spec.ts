import { Test, TestingModule } from '@nestjs/testing';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';
import { ChatInfo, ChatTurn } from './chat.model';

describe('ChatController', () => {
  let controller: ChatController;
  let chatService: Record<'info' | 'send' | 'confirm' | 'reset', jest.Mock>;

  beforeEach(async () => {
    chatService = {
      info: jest.fn(),
      send: jest.fn(),
      confirm: jest.fn(),
      reset: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ChatController],
      providers: [{ provide: ChatService, useValue: chatService }],
    }).compile();

    controller = module.get<ChatController>(ChatController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('info delegates to ChatService', async () => {
    const info: ChatInfo = { model: 'gemini-test', tools: [] };
    chatService.info.mockResolvedValue(info);

    expect(await controller.info()).toEqual(info);
  });

  it('send passes the session id and message', async () => {
    const turn: ChatTurn = { steps: [], reply: 'Hi' };
    chatService.send.mockResolvedValue(turn);

    expect(
      await controller.send({ sessionId: 's1', message: 'hello' }),
    ).toEqual(turn);
    expect(chatService.send).toHaveBeenCalledWith('s1', 'hello');
  });

  it('confirm passes the session id and decision', async () => {
    const turn: ChatTurn = { steps: [], reply: 'Done' };
    chatService.confirm.mockResolvedValue(turn);

    expect(
      await controller.confirm({ sessionId: 's1', approve: false }),
    ).toEqual(turn);
    expect(chatService.confirm).toHaveBeenCalledWith('s1', false);
  });

  it('reset passes the session id', () => {
    chatService.reset.mockReturnValue({ ok: true });

    expect(controller.reset({ sessionId: 's1' })).toEqual({ ok: true });
    expect(chatService.reset).toHaveBeenCalledWith('s1');
  });
});
