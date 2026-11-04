import * as fs from 'node:fs';
import {
  BadGatewayException,
  ConflictException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { GoogleGenAI } from '@google/genai';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import {
  ChatService,
  MAX_TOOL_ROUNDS,
  toFunctionDeclaration,
} from './chat.service';

jest.mock('node:fs', () => ({ existsSync: jest.fn() }));
jest.mock('@google/genai', () => ({ GoogleGenAI: jest.fn() }));
jest.mock('@modelcontextprotocol/sdk/client/index.js', () => ({
  Client: jest.fn(),
}));
jest.mock('@modelcontextprotocol/sdk/client/stdio.js', () => ({
  StdioClientTransport: jest.fn(),
  getDefaultEnvironment: () => ({}),
}));

const tools = [
  {
    name: 'get_users',
    description: 'List users',
    inputSchema: {
      type: 'object',
      properties: { id: { type: 'integer' } },
      $schema: 'http://json-schema.org/draft-07/schema#',
    },
  },
  {
    name: 'remove_user',
    description: 'Remove a user',
    inputSchema: { type: 'object', properties: { id: { type: 'integer' } } },
    annotations: { destructiveHint: true },
  },
];

/** A Gemini response that answers in text. */
const textReply = (text: string) => ({
  candidates: [{ content: { role: 'model', parts: [{ text }] } }],
  functionCalls: undefined,
  text,
});

/** A Gemini response that requests a function call. */
const callReply = (name: string, args: Record<string, unknown>) => {
  const functionCall = { id: `call-${name}`, name, args };
  return {
    candidates: [{ content: { role: 'model', parts: [{ functionCall }] } }],
    functionCalls: [functionCall],
    text: undefined,
  };
};

describe('ChatService', () => {
  let service: ChatService;
  let env: Record<string, string | undefined>;
  let mcp: Record<'connect' | 'listTools' | 'callTool' | 'close', jest.Mock>;
  let generateContent: jest.Mock;
  /** Copies of the `contents` sent to Gemini on each call. */
  let sentHistories: unknown[][];

  beforeEach(async () => {
    env = {
      GEMINI_API_KEY: 'test-key',
      GEMINI_MODEL: 'gemini-from-env',
      PORT: '3001',
    };
    (fs.existsSync as jest.Mock).mockReturnValue(true);

    mcp = {
      connect: jest.fn().mockResolvedValue(undefined),
      listTools: jest.fn().mockResolvedValue({ tools }),
      callTool: jest.fn().mockResolvedValue({
        content: [{ type: 'text', text: '{"code":1}' }],
        isError: false,
      }),
      close: jest.fn().mockResolvedValue(undefined),
    };
    (Client as unknown as jest.Mock).mockImplementation(() => mcp);

    sentHistories = [];
    generateContent = jest.fn();
    (GoogleGenAI as unknown as jest.Mock).mockImplementation(() => ({
      models: {
        generateContent: (req: { contents: unknown[] }) => {
          sentHistories.push(structuredClone(req.contents));
          return generateContent(req);
        },
      },
    }));

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChatService,
        {
          provide: ConfigService,
          useValue: { get: jest.fn((key: string) => env[key]) },
        },
      ],
    }).compile();

    service = module.get<ChatService>(ChatService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('setup', () => {
    it('rejects requests when GEMINI_API_KEY is missing', async () => {
      env.GEMINI_API_KEY = undefined;

      await expect(service.info()).rejects.toBeInstanceOf(
        ServiceUnavailableException,
      );
    });

    it.each([undefined, '', '   '])(
      'rejects requests when GEMINI_MODEL is %p',
      async (value) => {
        env.GEMINI_MODEL = value;

        await expect(service.info()).rejects.toThrow(
          new ServiceUnavailableException(
            'GEMINI_MODEL is not set in API-server/.env.dev',
          ),
        );
      },
    );

    it('rejects requests when the MCP server is not built', async () => {
      (fs.existsSync as jest.Mock).mockReturnValue(false);

      await expect(service.info()).rejects.toThrow(/MCP server not found/);
    });

    it('retries the connection after a failure', async () => {
      mcp.connect.mockRejectedValueOnce(new Error('spawn failed'));

      await expect(service.info()).rejects.toThrow(/spawn failed/);
      await expect(service.info()).resolves.toBeDefined();
    });
  });

  describe('info', () => {
    it('returns the model and the MCP tools with their destructive flag', async () => {
      expect(await service.info()).toEqual({
        model: 'gemini-from-env',
        tools: [
          { name: 'get_users', description: 'List users', destructive: false },
          {
            name: 'remove_user',
            description: 'Remove a user',
            destructive: true,
          },
        ],
      });
    });

    it('trims GEMINI_MODEL', async () => {
      env.GEMINI_MODEL = '  gemini-custom  ';

      expect((await service.info()).model).toBe('gemini-custom');
    });
  });

  describe('toFunctionDeclaration', () => {
    it('passes the JSON schema through without $schema', () => {
      expect(toFunctionDeclaration(tools[0] as never)).toEqual({
        name: 'get_users',
        description: 'List users',
        parametersJsonSchema: {
          type: 'object',
          properties: { id: { type: 'integer' } },
        },
      });
    });
  });

  describe('send', () => {
    it('returns a text reply', async () => {
      generateContent.mockResolvedValue(textReply('Hello!'));

      expect(await service.send('s1', 'hi')).toEqual({
        steps: [],
        reply: 'Hello!',
      });
      expect(generateContent).toHaveBeenCalledWith(
        expect.objectContaining({ model: 'gemini-from-env' }),
      );
    });

    it('runs a tool call through MCP and feeds the result back to Gemini', async () => {
      generateContent
        .mockResolvedValueOnce(callReply('get_users', {}))
        .mockResolvedValueOnce(textReply('There is 1 user.'));

      const turn = await service.send('s1', 'list users');

      expect(mcp.callTool).toHaveBeenCalledWith({
        name: 'get_users',
        arguments: {},
      });
      expect(turn).toEqual({
        steps: [
          { name: 'get_users', args: {}, status: 'ok', result: '{"code":1}' },
        ],
        reply: 'There is 1 user.',
      });
      expect(sentHistories[1][2]).toEqual({
        role: 'user',
        parts: [
          {
            functionResponse: {
              id: 'call-get_users',
              name: 'get_users',
              response: { output: '{"code":1}' },
            },
          },
        ],
      });
    });

    it('reports MCP tool errors to Gemini', async () => {
      mcp.callTool.mockResolvedValue({
        content: [{ type: 'text', text: 'API down' }],
        isError: true,
      });
      generateContent
        .mockResolvedValueOnce(callReply('get_users', {}))
        .mockResolvedValueOnce(textReply('The API is down.'));

      const turn = await service.send('s1', 'list users');

      expect(turn.steps[0].status).toBe('error');
      expect(sentHistories[1][2]).toMatchObject({
        parts: [{ functionResponse: { response: { error: 'API down' } } }],
      });
    });

    it('keeps the conversation history between messages', async () => {
      generateContent
        .mockResolvedValueOnce(textReply('first'))
        .mockResolvedValueOnce(textReply('second'));

      await service.send('s1', 'one');
      await service.send('s1', 'two');

      expect(sentHistories[1]).toHaveLength(3);
    });

    it('rolls the turn back and throws BadGateway when Gemini fails', async () => {
      generateContent
        .mockRejectedValueOnce(
          new Error('{"error":{"message":"API key not valid"}}'),
        )
        .mockResolvedValueOnce(textReply('ok'));

      await expect(service.send('s1', 'hi')).rejects.toThrow(
        new BadGatewayException('Gemini error: API key not valid'),
      );
      await service.send('s1', 'again');

      expect(sentHistories[1]).toEqual([
        { role: 'user', parts: [{ text: 'again' }] },
      ]);
    });

    it('stops after MAX_TOOL_ROUNDS tool rounds', async () => {
      generateContent.mockResolvedValue(callReply('get_users', {}));

      const turn = await service.send('s1', 'loop');

      expect(mcp.callTool).toHaveBeenCalledTimes(MAX_TOOL_ROUNDS);
      expect(turn.reply).toMatch(/too many tool calls/);
    });
  });

  describe('destructive tools', () => {
    beforeEach(() => {
      generateContent.mockResolvedValueOnce(
        callReply('remove_user', { id: 2 }),
      );
    });

    it('pauses the turn and asks for confirmation', async () => {
      expect(await service.send('s1', 'remove user 2')).toEqual({
        steps: [],
        confirm: { name: 'remove_user', args: { id: 2 } },
      });
      expect(mcp.callTool).not.toHaveBeenCalled();
    });

    it('rejects new messages while a confirmation is pending', async () => {
      await service.send('s1', 'remove user 2');

      await expect(service.send('s1', 'hello')).rejects.toBeInstanceOf(
        ConflictException,
      );
    });

    it('runs the tool when approved', async () => {
      generateContent.mockResolvedValueOnce(textReply('Removed.'));
      await service.send('s1', 'remove user 2');

      const turn = await service.confirm('s1', true);

      expect(mcp.callTool).toHaveBeenCalledWith({
        name: 'remove_user',
        arguments: { id: 2 },
      });
      expect(turn).toEqual({
        steps: [
          {
            name: 'remove_user',
            args: { id: 2 },
            status: 'ok',
            result: '{"code":1}',
          },
        ],
        reply: 'Removed.',
      });
    });

    it('tells Gemini the user declined without running the tool', async () => {
      generateContent.mockResolvedValueOnce(textReply('Okay, cancelled.'));
      await service.send('s1', 'remove user 2');

      const turn = await service.confirm('s1', false);

      expect(mcp.callTool).not.toHaveBeenCalled();
      expect(turn.steps[0].status).toBe('declined');
      expect(sentHistories[1][2]).toMatchObject({
        parts: [
          {
            functionResponse: {
              response: { error: 'The user declined this action.' },
            },
          },
        ],
      });
    });
  });

  describe('confirm', () => {
    it('throws Conflict when nothing is pending', async () => {
      await expect(service.confirm('s1', true)).rejects.toBeInstanceOf(
        ConflictException,
      );
    });
  });

  describe('reset', () => {
    it('forgets the session history', async () => {
      generateContent.mockResolvedValue(textReply('ok'));
      await service.send('s1', 'one');

      expect(service.reset('s1')).toEqual({ ok: true });
      await service.send('s1', 'two');

      expect(sentHistories[1]).toHaveLength(1);
    });
  });
});
