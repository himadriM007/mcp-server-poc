import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  BadGatewayException,
  ConflictException,
  Injectable,
  Logger,
  OnModuleDestroy,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  GoogleGenAI,
  type Content,
  type FunctionCall,
  type FunctionDeclaration,
  type Part,
} from '@google/genai';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import {
  StdioClientTransport,
  getDefaultEnvironment,
} from '@modelcontextprotocol/sdk/client/stdio.js';
import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import { ChatInfo, ChatTurn, ToolStep } from './chat.model';

export const MAX_TOOL_ROUNDS = 10;
const MAX_SESSIONS = 200;

const SYSTEM_INSTRUCTION =
  'You are a helpful assistant that manages users in an internal user directory. ' +
  'Use the available tools to look up, add or remove users instead of guessing. ' +
  'Before adding a user, make sure you have a name, email and address. ' +
  'Summarise tool results in plain language; do not dump raw JSON unless asked. ' +
  'Format answers with Markdown where it helps (lists, bold, tables).';

interface Engine {
  model: string;
  mcp: Client;
  ai: GoogleGenAI;
  tools: Tool[];
  declarations: FunctionDeclaration[];
  destructive: Set<string>;
}

interface Session {
  history: Content[];
  busy: boolean;
  round: number;
  turnStart: number;
  pending?: { calls: FunctionCall[]; parts: Part[]; index: number };
}

/** MCP tool -> Gemini function declaration (Gemini accepts the JSON Schema directly). */
export function toFunctionDeclaration(tool: Tool): FunctionDeclaration {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { $schema, ...schema } = tool.inputSchema as Record<string, unknown>;
  return {
    name: tool.name,
    description: tool.description ?? tool.title ?? tool.name,
    parametersJsonSchema: schema,
  };
}

function resultText(content: unknown): string {
  if (!Array.isArray(content)) return '';
  return content
    .map((c) =>
      c?.type === 'text' ? c.text : `[${c?.type ?? 'unknown'} content]`,
    )
    .join('\n');
}

function errorMessage(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err);
  try {
    // Gemini SDK errors carry the API's JSON body as the message.
    return JSON.parse(message)?.error?.message ?? message;
  } catch {
    return message;
  }
}

/**
 * Chatbot backed by Gemini, using the MCP-server's tools (which call this API's /users).
 *
 * Per message: send history + tool declarations to Gemini; run requested function calls
 * through MCP; feed results back; repeat until Gemini answers in text. Destructive tools
 * pause the turn until the client calls confirm().
 */
@Injectable()
export class ChatService implements OnModuleDestroy {
  private readonly logger = new Logger(ChatService.name);
  private readonly sessions = new Map<string, Session>();
  private engine?: Promise<Engine>;

  constructor(private readonly configService: ConfigService) {}

  async info(): Promise<ChatInfo> {
    const { model, tools, destructive } = await this.getEngine();
    return {
      model,
      tools: tools.map((t) => ({
        name: t.name,
        description: t.description ?? '',
        destructive: destructive.has(t.name),
      })),
    };
  }

  /** Starts a new turn with a user message. */
  async send(sessionId: string, message: string): Promise<ChatTurn> {
    const engine = await this.getEngine();
    const s = this.getSession(sessionId);
    if (s.pending) {
      throw new ConflictException('Answer the pending confirmation first.');
    }
    if (s.busy) {
      throw new ConflictException('This chat is already processing a message.');
    }
    s.turnStart = s.history.length;
    s.round = 0;
    s.history.push({ role: 'user', parts: [{ text: message }] });
    return this.run(engine, s, undefined);
  }

  /** Resumes a turn paused on a destructive tool call. */
  async confirm(sessionId: string, approve: boolean): Promise<ChatTurn> {
    const engine = await this.getEngine();
    const s = this.sessions.get(sessionId);
    if (!s?.pending) {
      throw new ConflictException('Nothing is waiting for confirmation.');
    }
    return this.run(engine, s, approve);
  }

  reset(sessionId: string): { ok: true } {
    this.sessions.delete(sessionId);
    return { ok: true };
  }

  async onModuleDestroy(): Promise<void> {
    const engine = await this.engine?.catch(() => undefined);
    await engine?.mcp.close();
  }

  /** Connects to the MCP server lazily so the API still starts without a Gemini key. */
  private getEngine(): Promise<Engine> {
    if (!this.engine) {
      this.engine = this.connect().catch((err) => {
        this.engine = undefined; // retry on the next request
        throw err;
      });
    }
    return this.engine;
  }

  private async connect(): Promise<Engine> {
    const apiKey = this.configService.get<string>('GEMINI_API_KEY');
    if (!apiKey || apiKey === 'your_api_key_here') {
      throw new ServiceUnavailableException(
        'GEMINI_API_KEY is not set in API-server/.env.dev',
      );
    }

    // The model comes only from the env file; there is deliberately no built-in default.
    const model = this.configService.get<string>('GEMINI_MODEL')?.trim();
    if (!model) {
      throw new ServiceUnavailableException(
        'GEMINI_MODEL is not set in API-server/.env.dev',
      );
    }

    const serverPath =
      this.configService.get<string>('MCP_SERVER_PATH') ||
      path.resolve(process.cwd(), '..', 'MCP-server', 'dist', 'index.js');
    if (!fs.existsSync(serverPath)) {
      throw new ServiceUnavailableException(
        `MCP server not found at ${serverPath}. Run "npm run server:build" in MCP-server.`,
      );
    }

    // The MCP server's tools call back into this API.
    const apiBaseUrl =
      this.configService.get<string>('API_BASE_URL') ||
      `http://localhost:${this.configService.get<string>('PORT') ?? 3000}`;

    const mcp = new Client({ name: 'api-server-chat', version: '0.0.1' });
    try {
      await mcp.connect(
        new StdioClientTransport({
          command: process.execPath,
          args: [serverPath],
          env: { ...getDefaultEnvironment(), API_BASE_URL: apiBaseUrl },
          stderr: 'ignore', // the MCP server logs its banner to stderr
        }),
      );
    } catch (err) {
      throw new ServiceUnavailableException(
        `Could not start the MCP server: ${errorMessage(err)}`,
      );
    }
    mcp.onclose = () => {
      this.logger.warn(
        'MCP server connection closed; will reconnect on next request',
      );
      this.engine = undefined;
    };

    const { tools } = await mcp.listTools();
    this.logger.log(
      `Connected to MCP server (${tools.map((t) => t.name).join(', ')}), model ${model}`,
    );

    return {
      model,
      mcp,
      ai: new GoogleGenAI({ apiKey }),
      tools,
      declarations: tools.map(toFunctionDeclaration),
      destructive: new Set(
        tools.filter((t) => t.annotations?.destructiveHint).map((t) => t.name),
      ),
    };
  }

  private getSession(id: string): Session {
    let s = this.sessions.get(id);
    if (!s) {
      if (this.sessions.size >= MAX_SESSIONS) {
        // Drop the oldest conversation (Map keeps insertion order).
        this.sessions.delete(this.sessions.keys().next().value);
      }
      s = { history: [], busy: false, round: 0, turnStart: 0 };
      this.sessions.set(id, s);
    }
    return s;
  }

  private async run(
    engine: Engine,
    s: Session,
    decision: boolean | undefined,
  ): Promise<ChatTurn> {
    if (s.busy) {
      throw new ConflictException('This chat is already processing a message.');
    }
    s.busy = true;
    try {
      return await this.advance(engine, s, decision);
    } catch (err) {
      // Roll the whole turn back so the history stays valid for the next message.
      s.history.length = s.turnStart;
      s.pending = undefined;
      throw err;
    } finally {
      s.busy = false;
    }
  }

  private async advance(
    engine: Engine,
    s: Session,
    decision: boolean | undefined,
  ): Promise<ChatTurn> {
    const steps: ToolStep[] = [];

    while (true) {
      // 1. Run the function calls of the last model turn.
      if (s.pending) {
        const p = s.pending;
        while (p.index < p.calls.length) {
          const call = p.calls[p.index];
          const name = call.name ?? '';
          const args = (call.args ?? {}) as Record<string, unknown>;
          const needsApproval = engine.destructive.has(name);

          if (needsApproval && decision === undefined) {
            return { steps, confirm: { name, args } };
          }

          let response: Record<string, unknown>;
          if (needsApproval && decision === false) {
            response = { error: 'The user declined this action.' };
            steps.push({ name, args, status: 'declined', result: '' });
          } else {
            try {
              const result = await engine.mcp.callTool({
                name,
                arguments: args,
              });
              const text = resultText(result.content);
              response = result.isError ? { error: text } : { output: text };
              steps.push({
                name,
                args,
                status: result.isError ? 'error' : 'ok',
                result: text,
              });
            } catch (err) {
              const text = errorMessage(err);
              response = { error: text };
              steps.push({ name, args, status: 'error', result: text });
            }
          }
          decision = undefined; // a decision applies to one call only
          p.parts.push({ functionResponse: { id: call.id, name, response } });
          p.index++;
        }
        s.history.push({ role: 'user', parts: p.parts });
        s.pending = undefined;
        if (++s.round >= MAX_TOOL_ROUNDS) {
          return { steps, reply: '_Stopped: too many tool calls in a row._' };
        }
      }

      // 2. Ask Gemini.
      let response: Awaited<
        ReturnType<GoogleGenAI['models']['generateContent']>
      >;
      try {
        response = await engine.ai.models.generateContent({
          model: engine.model,
          contents: s.history,
          config: {
            systemInstruction: SYSTEM_INSTRUCTION,
            tools: [{ functionDeclarations: engine.declarations }],
          },
        });
      } catch (err) {
        throw new BadGatewayException(`Gemini error: ${errorMessage(err)}`);
      }

      // Keep the model turn as-is (it carries thought signatures Gemini needs back).
      const modelContent = response.candidates?.[0]?.content;
      if (modelContent) {
        s.history.push({ role: 'model', parts: modelContent.parts ?? [] });
      }

      const calls = response.functionCalls ?? [];
      if (calls.length === 0) {
        return { steps, reply: response.text ?? '(no response)' };
      }
      s.pending = { calls, parts: [], index: 0 };
    }
  }
}
