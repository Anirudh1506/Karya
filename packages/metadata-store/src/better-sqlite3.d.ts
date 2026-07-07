declare module "better-sqlite3" {
  export interface Statement<TParameters extends unknown[] = unknown[]> {
    run(...params: TParameters): { changes: number; lastInsertRowid: number | bigint };
    get(...params: TParameters): unknown;
    all(...params: TParameters): unknown[];
  }

  export interface Database {
    pragma(source: string): unknown;
    exec(source: string): void;
    prepare<TParameters extends unknown[] = unknown[]>(source: string): Statement<TParameters>;
    transaction<TArgs extends unknown[], TResult>(fn: (...args: TArgs) => TResult): (...args: TArgs) => TResult;
    close(): void;
  }

  export interface Options {
    readonly?: boolean;
    fileMustExist?: boolean;
  }

  export default function Database(path: string, options?: Options): Database;
}
