import { Logger } from '@nestjs/common';
import { DbService } from './db.service';

export interface DbFunctionResponse<T> {
  data: T[] | null;
  code: 0 | 1;
  message: string;
}

// DB functions return data as either an array or a single object.
type DbFunctionResult<T> = Omit<DbFunctionResponse<T>, 'data'> & {
  data: T | T[] | null;
};

// The name is interpolated into the SQL because it cannot be a bind parameter.
const DB_FUNCTION_NAME = /^fn_[a-z0-9_]+$/;

const logger = new Logger('DbFunction');

export async function callDbFunction<T>(
  dbService: DbService,
  fn: string,
  args: object | null,
  errorMessage: string,
): Promise<DbFunctionResponse<T>> {
  try {
    if (!DB_FUNCTION_NAME.test(fn)) {
      throw new Error(`Invalid database function name: ${fn}`);
    }

    const result = await dbService.query<{ response: DbFunctionResult<T> }>(
      `SELECT ${fn}($1) AS response`,
      [args && JSON.stringify(args)],
    );
    const { data, code, message } = result.rows[0].response;

    if (data === null) {
      return { data: null, code, message };
    }
    return { data: Array.isArray(data) ? data : [data], code, message };
  } catch (error) {
    logger.error(errorMessage, error as Error);
    return { data: null, code: 0, message: errorMessage };
  }
}
