import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { AppController } from './app.controller';

describe('AppController', () => {
  let app: INestApplication;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
    }).compile();

    app = module.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('redirects the root path to the Swagger docs', async () => {
    await request(app.getHttpServer())
      .get('/')
      .expect(302)
      .expect('Location', '/api');
  });
});
