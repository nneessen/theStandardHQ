declare module "pg" {
  export interface QueryResultRow {
    [column: string]: unknown;
  }

  export interface QueryResult<R extends QueryResultRow = QueryResultRow> {
    rows: R[];
    rowCount: number | null;
  }

  export interface ClientConfig {
    connectionString?: string;
  }

  export class Client {
    constructor(config?: string | ClientConfig);
    connect(): Promise<void>;
    end(): Promise<void>;
    query<R extends QueryResultRow = QueryResultRow>(
      queryText: string,
      values?: readonly unknown[],
    ): Promise<QueryResult<R>>;
  }
}
