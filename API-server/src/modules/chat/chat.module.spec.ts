import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { RouterModule } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { ChatModule } from './chat.module';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';
import { routes } from '../../routes/routes';

describe('ChatModule', () => {
  let module: TestingModule;
  let app: INestApplication;
  const turn = { steps: [], reply: 'Hi' };

  beforeEach(async () => {
    module = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true }),
        ChatModule,
        RouterModule.register(routes),
      ],
    })
      .overrideProvider(ChatService)
      .useValue({
        info: jest.fn().mockResolvedValue({ model: 'gemini-test', tools: [] }),
        send: jest.fn().mockResolvedValue(turn),
        confirm: jest.fn().mockResolvedValue(turn),
        reset: jest.fn().mockReturnValue({ ok: true }),
      })
      .compile();

    app = module.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('resolves ChatController', () => {
    expect(module.get(ChatController)).toBeDefined();
  });

  it('serves GET /chat/info', async () => {
    await request(app.getHttpServer())
      .get('/chat/info')
      .expect(200, { model: 'gemini-test', tools: [] });
  });

  it('serves POST /chat with 200', async () => {
    await request(app.getHttpServer())
      .post('/chat')
      .send({ sessionId: 's1', message: 'hi' })
      .expect(200, turn);
  });

  it('validates POST /chat', async () => {
    await request(app.getHttpServer()).post('/chat').send({}).expect(400);
  });

  it('serves POST /chat/confirm', async () => {
    await request(app.getHttpServer())
      .post('/chat/confirm')
      .send({ sessionId: 's1', approve: true })
      .expect(200, turn);
  });

  it('serves POST /chat/reset', async () => {
    await request(app.getHttpServer())
      .post('/chat/reset')
      .send({ sessionId: 's1' })
      .expect(200, { ok: true });
  });

  it.each([
    ['/chat/info', 'get', 'ChatInfoDto'],
    ['/chat', 'post', 'ChatTurnDto'],
    ['/chat/confirm', 'post', 'ChatTurnDto'],
    ['/chat/reset', 'post', 'ResetChatResponseDto'],
  ] as const)('documents %s in Swagger', (path, method, schema) => {
    const document = SwaggerModule.createDocument(
      app,
      new DocumentBuilder().build(),
    );
    const operation = document.paths[path][method];

    expect(operation?.summary).toBeDefined();
    expect(operation?.responses['200']).toMatchObject({
      content: {
        'application/json': {
          schema: { $ref: `#/components/schemas/${schema}` },
        },
      },
    });
  });
});
