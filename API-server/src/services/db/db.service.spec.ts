import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { DbService } from './db.service';

describe('DbService', () => {
  let service: DbService;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          envFilePath: '.env.dev',
          isGlobal: true,
        }),
      ],
      providers: [DbService],
    }).compile();

    service = module.get<DbService>(DbService);
  });

  afterAll(async () => {
    await service.onModuleDestroy();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should connect to the database', async () => {
    await expect(service.testConnection()).resolves.toBe(true);
  });
});
