declare module "node:sqlite" {
  export class StatementSync {
    all(...params: unknown[]): unknown[];
    get(...params: unknown[]): Record<string, unknown>;
    run(...params: unknown[]): void;
  }

  export class DatabaseSync {
    constructor(
      location?: string,
      options?: {
        open?: boolean;
        readOnly?: boolean;
      },
    );
    exec(sql: string): void;
    prepare(sql: string): StatementSync;
    close(): void;
  }
}
