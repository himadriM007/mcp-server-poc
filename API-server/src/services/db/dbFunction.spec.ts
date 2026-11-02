import { callDbFunction } from './dbFunction';
import { DbService } from './db.service';

describe('callDbFunction', () => {
  const query = jest.fn();
  const dbService = { query } as unknown as DbService;
  const error = { data: null, code: 0, message: 'Failed' };

  beforeEach(() => {
    query.mockReset();
  });

  it('passes the args as JSON', async () => {
    const response = { data: [{ id: 1 }], code: 1, message: 'OK' };
    query.mockResolvedValue({ rows: [{ response }] });

    const result = await callDbFunction(dbService, 'fn_test', { id: 1 }, '');

    expect(query).toHaveBeenCalledWith('SELECT fn_test($1) AS response', [
      '{"id":1}',
    ]);
    expect(result).toEqual(response);
  });

  it('passes null args as SQL NULL', async () => {
    const response = { data: [], code: 1, message: 'OK' };
    query.mockResolvedValue({ rows: [{ response }] });

    await callDbFunction(dbService, 'fn_test', null, '');

    expect(query).toHaveBeenCalledWith(expect.any(String), [null]);
  });

  it('wraps a single object in an array', async () => {
    const response = { data: { id: 1 }, code: 1, message: 'OK' };
    query.mockResolvedValue({ rows: [{ response }] });

    const result = await callDbFunction(dbService, 'fn_test', null, '');

    expect(result.data).toEqual([{ id: 1 }]);
  });

  it('keeps null data', async () => {
    query.mockResolvedValue({ rows: [{ response: error }] });

    expect(await callDbFunction(dbService, 'fn_test', null, '')).toEqual(error);
  });

  it('returns an error response when the query fails', async () => {
    query.mockRejectedValue(new Error('connection refused'));

    expect(await callDbFunction(dbService, 'fn_test', null, 'Failed')).toEqual(
      error,
    );
  });

  it('rejects an invalid function name without querying', async () => {
    const result = await callDbFunction(
      dbService,
      'fn_test(); DROP TABLE tbl_users; --',
      null,
      'Failed',
    );

    expect(query).not.toHaveBeenCalled();
    expect(result).toEqual(error);
  });
});
