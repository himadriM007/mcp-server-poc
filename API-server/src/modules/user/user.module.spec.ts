import { INestApplication } from '@nestjs/common';
import { RouterModule } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { UserModule } from './user.module';
import { UserController } from './user.controller';
import { UserService } from './user.service';
import { DbModule } from '../../services/db/db.module';
import { DbService } from '../../services/db/db.service';
import { routes } from '../../routes/routes';

describe('UserModule', () => {
  let module: TestingModule;
  let app: INestApplication;

  beforeEach(async () => {
    const response = { data: [], code: 1, message: 'OK' };

    module = await Test.createTestingModule({
      imports: [DbModule, UserModule, RouterModule.register(routes)],
    })
      .overrideProvider(DbService)
      .useValue({
        query: jest.fn().mockResolvedValue({ rows: [{ response }] }),
      })
      .compile();

    app = module.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('resolves UserController', () => {
    expect(module.get(UserController)).toBeDefined();
  });

  it('resolves UserService', () => {
    expect(module.get(UserService)).toBeDefined();
  });

  it('serves GET /users', async () => {
    await request(app.getHttpServer()).get('/users').expect(200);
  });

  it('serves POST /users', async () => {
    await request(app.getHttpServer()).post('/users').send({}).expect(201);
  });

  it('serves DELETE /users', async () => {
    await request(app.getHttpServer()).delete('/users?id=1').expect(200);
  });

  it('does not double the users prefix', async () => {
    await request(app.getHttpServer()).get('/users/users').expect(404);
  });

  it.each([
    ['get', '200'],
    ['post', '201'],
    ['delete', '200'],
  ] as const)(
    'documents the %s /users response in Swagger',
    (method, status) => {
      const document = SwaggerModule.createDocument(
        app,
        new DocumentBuilder().build(),
      );
      const operation = document.paths['/users'][method];

      expect(operation?.summary).toBeDefined();
      expect(operation?.responses[status]).toMatchObject({
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/UserResponseDto' },
          },
        },
      });
    },
  );
});
