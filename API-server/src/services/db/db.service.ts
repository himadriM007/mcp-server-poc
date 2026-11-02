import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pool, QueryResult, QueryResultRow } from 'pg';

@Injectable()
export class DbService implements OnModuleDestroy {
  private readonly logger = new Logger(DbService.name);
  private readonly pool: Pool;

  constructor(private readonly configService: ConfigService) {
    this.pool = new Pool({
      host: this.configService.get<string>('DB_HOST'),
      port: this.configService.get<number>('DB_PORT'),
      user: this.configService.get<string>('DB_USER'),
      password: this.configService.get<string>('DB_PASSWORD'),
      database: this.configService.get<string>('DB_NAME'),
      ssl: this.configService.get<string>('DB_SSL') === 'true',
    });
  }

  async query<T extends QueryResultRow = any>(
    text: string,
    params?: any[],
  ): Promise<QueryResult<T>> {
    return this.pool.query<T>(text, params);
  }

  async testConnection(): Promise<boolean> {
    try {
      await this.pool.query('SELECT 1');
      this.logger.log('Database connection established');
      return true;
    } catch (error) {
      this.logger.error('Database connection failed', error as Error);
      throw error;
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.pool.end();
  }
}
