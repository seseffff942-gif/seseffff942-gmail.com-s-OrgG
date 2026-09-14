import fs from 'fs';
import path from 'path';
import type pg from 'pg';

export interface LocalDbOptions {
  pool: pg.Pool | null;
  storageDir?: string;
}

function cleanCol(col: string): string {
  const trimmed = col.trim();
  if (trimmed === '*' || trimmed.includes('(') || trimmed.includes(' AS ') || trimmed.includes(' as ')) {
    return trimmed;
  }
  if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
    return trimmed;
  }
  return `"${trimmed.replace(/"/g, '')}"`;
}

function parseColumns(cols: string | undefined): string {
  if (!cols || cols.trim() === '*' || cols.trim() === '') return '*';
  return cols
    .split(',')
    .map(c => cleanCol(c))
    .join(', ');
}

export class LocalQueryBuilder<T = any> implements PromiseLike<{ data: any; error: any }> {
  private pool: pg.Pool | null;
  private table: string;
  private op: 'select' | 'insert' | 'update' | 'delete' | 'upsert' = 'select';
  private selectCols: string = '*';
  private insertData: any[] = [];
  private updateData: Record<string, any> = {};
  private onConflictCol: string = 'id';
  private conditions: Array<{ sql: string; val?: any }> = [];
  private orderClauses: string[] = [];
  private limitCount?: number;
  private offsetCount?: number;
  private isSingle: boolean = false;
  private isMaybeSingle: boolean = false;

  constructor(pool: pg.Pool | null, table: string) {
    this.pool = pool;
    this.table = table.replace(/[^a-zA-Z0-9_]/g, '');
  }

  select(cols: string = '*'): this {
    this.selectCols = parseColumns(cols);
    return this;
  }

  insert(data: any | any[]): this {
    this.op = 'insert';
    this.insertData = Array.isArray(data) ? data : [data];
    return this;
  }

  update(data: Record<string, any>): this {
    this.op = 'update';
    this.updateData = data || {};
    return this;
  }

  delete(): this {
    this.op = 'delete';
    return this;
  }

  upsert(data: any | any[], options?: { onConflict?: string }): this {
    this.op = 'upsert';
    this.insertData = Array.isArray(data) ? data : [data];
    if (options?.onConflict) {
      this.onConflictCol = options.onConflict;
    }
    return this;
  }

  eq(column: string, value: any): this {
    if (value === null || value === undefined) {
      this.conditions.push({ sql: `${cleanCol(column)} IS NULL` });
    } else {
      this.conditions.push({ sql: `${cleanCol(column)} = $PARAM`, val: value });
    }
    return this;
  }

  neq(column: string, value: any): this {
    if (value === null || value === undefined) {
      this.conditions.push({ sql: `${cleanCol(column)} IS NOT NULL` });
    } else {
      this.conditions.push({ sql: `${cleanCol(column)} != $PARAM`, val: value });
    }
    return this;
  }

  gt(column: string, value: any): this {
    this.conditions.push({ sql: `${cleanCol(column)} > $PARAM`, val: value });
    return this;
  }

  gte(column: string, value: any): this {
    this.conditions.push({ sql: `${cleanCol(column)} >= $PARAM`, val: value });
    return this;
  }

  lt(column: string, value: any): this {
    this.conditions.push({ sql: `${cleanCol(column)} < $PARAM`, val: value });
    return this;
  }

  lte(column: string, value: any): this {
    this.conditions.push({ sql: `${cleanCol(column)} <= $PARAM`, val: value });
    return this;
  }

  ilike(column: string, pattern: string): this {
    this.conditions.push({ sql: `${cleanCol(column)} ILIKE $PARAM`, val: pattern });
    return this;
  }

  like(column: string, pattern: string): this {
    this.conditions.push({ sql: `${cleanCol(column)} LIKE $PARAM`, val: pattern });
    return this;
  }

  in(column: string, values: any[]): this {
    if (!Array.isArray(values) || values.length === 0) {
      this.conditions.push({ sql: '1 = 0' });
    } else {
      const placeholders = values.map(() => '$PARAM').join(', ');
      this.conditions.push({ sql: `${cleanCol(column)} IN (${placeholders})`, val: values });
    }
    return this;
  }

  is(column: string, value: any): this {
    if (value === null) {
      this.conditions.push({ sql: `${cleanCol(column)} IS NULL` });
    } else if (value === false) {
      this.conditions.push({ sql: `(${cleanCol(column)} IS FALSE OR ${cleanCol(column)} IS NULL)` });
    } else if (value === true) {
      this.conditions.push({ sql: `${cleanCol(column)} IS TRUE` });
    } else {
      this.conditions.push({ sql: `${cleanCol(column)} IS ${value}` });
    }
    return this;
  }

  or(filterString: string): this {
    if (!filterString || typeof filterString !== 'string') return this;
    const parts = filterString.split(',').map(p => p.trim()).filter(Boolean);
    const orSqlParts: string[] = [];
    for (const part of parts) {
      if (part.includes('.eq.')) {
        const [c, val] = part.split('.eq.');
        this.conditions.push({ sql: `_OR_DUMMY_`, val: val }); // placeholder for param
        orSqlParts.push(`${cleanCol(c)} = $PARAM`);
      } else if (part.includes('.ilike.')) {
        const [c, val] = part.split('.ilike.');
        this.conditions.push({ sql: `_OR_DUMMY_`, val: val });
        orSqlParts.push(`${cleanCol(c)} ILIKE $PARAM`);
      } else if (part.includes('.like.')) {
        const [c, val] = part.split('.like.');
        this.conditions.push({ sql: `_OR_DUMMY_`, val: val });
        orSqlParts.push(`${cleanCol(c)} LIKE $PARAM`);
      } else if (part.includes('.neq.')) {
        const [c, val] = part.split('.neq.');
        this.conditions.push({ sql: `_OR_DUMMY_`, val: val });
        orSqlParts.push(`${cleanCol(c)} != $PARAM`);
      }
    }
    // Pull the last orSqlParts.length items out and combine into one OR condition
    if (orSqlParts.length > 0) {
      const vals: any[] = [];
      for (let i = 0; i < orSqlParts.length; i++) {
        const dummy = this.conditions.pop();
        if (dummy?.val !== undefined) vals.unshift(dummy.val);
      }
      // Re-add as single compound condition
      this.conditions.push({
        sql: `(${orSqlParts.join(' OR ')})`,
        val: vals // array of vals to unpack in buildWhere
      });
    }
    return this;
  }

  order(column: string, options?: { ascending?: boolean; nullsFirst?: boolean }): this {
    const dir = options?.ascending === false ? 'DESC' : 'ASC';
    let clause = `${cleanCol(column)} ${dir}`;
    if (options?.nullsFirst === true) {
      clause += ' NULLS FIRST';
    } else if (options?.nullsFirst === false) {
      clause += ' NULLS LAST';
    }
    this.orderClauses.push(clause);
    return this;
  }

  limit(count: number): this {
    this.limitCount = count;
    return this;
  }

  range(from: number, to: number): this {
    this.offsetCount = Math.max(0, from);
    this.limitCount = Math.max(0, to - from + 1);
    return this;
  }

  single(): this {
    this.isSingle = true;
    this.limitCount = 1;
    return this;
  }

  maybeSingle(): this {
    this.isMaybeSingle = true;
    this.limitCount = 1;
    return this;
  }

  private buildWhere(params: any[]): string {
    if (this.conditions.length === 0) return '';
    const parts = this.conditions.map(c => {
      if (Array.isArray(c.val)) {
        let sql = c.sql;
        for (const v of c.val) {
          params.push(v);
          sql = sql.replace('$PARAM', `$${params.length}`);
        }
        return sql;
      }
      if (c.val !== undefined) {
        params.push(c.val);
        return c.sql.replace('$PARAM', `$${params.length}`);
      }
      return c.sql;
    });
    return ` WHERE ${parts.join(' AND ')}`;
  }

  async execute(): Promise<{ data: any; error: any }> {
    if (!this.pool) {
      console.warn(`[LocalDb] Pool no disponible al consultar "${this.table}"`);
      return { data: this.isSingle || this.isMaybeSingle ? null : [], error: { message: 'Database pool not initialized' } };
    }

    try {
      const params: any[] = [];
      let queryText = '';

      if (this.op === 'select') {
        const where = this.buildWhere(params);
        let order = '';
        if (this.orderClauses.length > 0) {
          order = ` ORDER BY ${this.orderClauses.join(', ')}`;
        }
        let limitOffset = '';
        if (this.limitCount !== undefined) {
          limitOffset += ` LIMIT ${this.limitCount}`;
        }
        if (this.offsetCount !== undefined) {
          limitOffset += ` OFFSET ${this.offsetCount}`;
        }
        queryText = `SELECT ${this.selectCols} FROM public."${this.table}"${where}${order}${limitOffset};`;
      } else if (this.op === 'insert') {
        if (this.insertData.length === 0) {
          return { data: this.isSingle ? null : [], error: null };
        }
        const sample = this.insertData[0];
        const rawKeys = Object.keys(sample);
        const colNames = rawKeys.map(cleanCol).join(', ');
        const valuePlaceholders: string[] = [];

        for (const row of this.insertData) {
          const rowPlaceholders: string[] = [];
          for (const key of rawKeys) {
            let val = row[key];
            if (typeof val === 'object' && val !== null && !(val instanceof Date)) {
              val = JSON.stringify(val);
            }
            params.push(val === undefined ? null : val);
            rowPlaceholders.push(`$${params.length}`);
          }
          valuePlaceholders.push(`(${rowPlaceholders.join(', ')})`);
        }
        queryText = `INSERT INTO public."${this.table}" (${colNames}) VALUES ${valuePlaceholders.join(', ')} RETURNING *;`;
      } else if (this.op === 'update') {
        const setClauses: string[] = [];
        for (const [key, rawVal] of Object.entries(this.updateData)) {
          let val = rawVal;
          if (typeof val === 'object' && val !== null && !(val instanceof Date)) {
            val = JSON.stringify(val);
          }
          params.push(val === undefined ? null : val);
          setClauses.push(`${cleanCol(key)} = $${params.length}`);
        }
        if (setClauses.length === 0) {
          return { data: this.isSingle ? null : [], error: null };
        }
        const where = this.buildWhere(params);
        queryText = `UPDATE public."${this.table}" SET ${setClauses.join(', ')}${where} RETURNING *;`;
      } else if (this.op === 'delete') {
        const where = this.buildWhere(params);
        queryText = `DELETE FROM public."${this.table}"${where} RETURNING *;`;
      } else if (this.op === 'upsert') {
        if (this.insertData.length === 0) {
          return { data: this.isSingle ? null : [], error: null };
        }
        const sample = this.insertData[0];
        const rawKeys = Object.keys(sample);
        const colNames = rawKeys.map(cleanCol).join(', ');
        const valuePlaceholders: string[] = [];

        for (const row of this.insertData) {
          const rowPlaceholders: string[] = [];
          for (const key of rawKeys) {
            let val = row[key];
            if (typeof val === 'object' && val !== null && !(val instanceof Date)) {
              val = JSON.stringify(val);
            }
            params.push(val === undefined ? null : val);
            rowPlaceholders.push(`$${params.length}`);
          }
          valuePlaceholders.push(`(${rowPlaceholders.join(', ')})`);
        }

        const conflictColClean = cleanCol(this.onConflictCol);
        const updateSets = rawKeys
          .filter(k => cleanCol(k) !== conflictColClean)
          .map(k => `${cleanCol(k)} = EXCLUDED.${cleanCol(k)}`)
          .join(', ');

        const onConflictClause = updateSets.length > 0
          ? `ON CONFLICT (${conflictColClean}) DO UPDATE SET ${updateSets}`
          : `ON CONFLICT (${conflictColClean}) DO NOTHING`;

        queryText = `INSERT INTO public."${this.table}" (${colNames}) VALUES ${valuePlaceholders.join(', ')} ${onConflictClause} RETURNING *;`;
      }

      const res = await this.pool.query(queryText, params);
      const rows = res.rows || [];

      if (this.isSingle) {
        if (rows.length === 0) {
          return { data: null, error: { message: 'Row not found' } };
        }
        return { data: rows[0], error: null };
      }

      if (this.isMaybeSingle) {
        return { data: rows[0] || null, error: null };
      }

      return { data: rows, error: null };
    } catch (err: any) {
      console.error(`[LocalDb Query Error on ${this.table}]:`, err?.message || err);
      return { data: this.isSingle || this.isMaybeSingle ? null : [], error: err };
    }
  }

  then<TResult1 = { data: any; error: any }, TResult2 = never>(
    onfulfilled?: ((value: { data: any; error: any }) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null
  ): Promise<TResult1 | TResult2> {
    return this.execute().then(onfulfilled, onrejected);
  }
}

export class LocalStorageBucket {
  private baseDir: string;
  private bucketName: string;

  constructor(baseDir: string, bucketName: string) {
    this.baseDir = baseDir;
    this.bucketName = bucketName;
  }

  private getBucketPath(): string {
    const dir = path.join(this.baseDir, this.bucketName);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    return dir;
  }

  async upload(fileName: string, buffer: Buffer, options?: { contentType?: string; upsert?: boolean }) {
    try {
      const bucketDir = this.getBucketPath();
      const cleanFileName = fileName.replace(/^[\/\\]+/, '');
      const filePath = path.join(bucketDir, cleanFileName);
      const fileDir = path.dirname(filePath);
      if (!fs.existsSync(fileDir)) {
        fs.mkdirSync(fileDir, { recursive: true });
      }
      fs.writeFileSync(filePath, buffer);
      return { data: { path: cleanFileName }, error: null };
    } catch (err: any) {
      console.error(`[LocalStorage Upload Error in ${this.bucketName}]:`, err?.message || err);
      return { data: null, error: err };
    }
  }

  getPublicUrl(fileName: string) {
    const cleanFileName = fileName.replace(/^[\/\\]+/, '');
    const publicUrl = `/storage/v1/object/public/${this.bucketName}/${cleanFileName}`;
    return { data: { publicUrl } };
  }

  async download(fileName: string) {
    try {
      const bucketDir = this.getBucketPath();
      const cleanFileName = fileName.replace(/^[\/\\]+/, '');
      const filePath = path.join(bucketDir, cleanFileName);
      if (!fs.existsSync(filePath)) {
        return { data: null, error: new Error('File not found') };
      }
      const data = fs.readFileSync(filePath);
      return { data, error: null };
    } catch (err: any) {
      return { data: null, error: err };
    }
  }
}

export class LocalStorage {
  private baseDir: string;

  constructor(baseDir: string) {
    this.baseDir = baseDir;
    if (!fs.existsSync(this.baseDir)) {
      fs.mkdirSync(this.baseDir, { recursive: true });
    }
  }

  async listBuckets() {
    try {
      if (!fs.existsSync(this.baseDir)) return { data: [], error: null };
      const entries = fs.readdirSync(this.baseDir, { withFileTypes: true });
      const buckets = entries.filter(e => e.isDirectory()).map(e => ({ name: e.name }));
      return { data: buckets, error: null };
    } catch (err: any) {
      return { data: [], error: err };
    }
  }

  async createBucket(name: string, _options?: any) {
    try {
      const bucketDir = path.join(this.baseDir, name);
      if (!fs.existsSync(bucketDir)) {
        fs.mkdirSync(bucketDir, { recursive: true });
      }
      return { data: { name }, error: null };
    } catch (err: any) {
      return { data: null, error: err };
    }
  }

  from(bucketName: string): LocalStorageBucket {
    return new LocalStorageBucket(this.baseDir, bucketName);
  }
}

export class LocalDbClient {
  public pool: pg.Pool | null;
  public storage: LocalStorage;

  constructor(options: LocalDbOptions) {
    this.pool = options.pool;
    const storagePath = options.storageDir || path.join(process.cwd(), 'storage');
    this.storage = new LocalStorage(storagePath);
  }

  from<T = any>(table: string): LocalQueryBuilder<T> {
    return new LocalQueryBuilder<T>(this.pool, table);
  }

  async rpc(fnName: string, args?: any): Promise<{ data: any; error: any }> {
    if (fnName === 'exec_sql' && args?.sql && this.pool) {
      try {
        const res = await this.pool.query(args.sql);
        return { data: res.rows, error: null };
      } catch (err: any) {
        return { data: null, error: err };
      }
    }
    return { data: null, error: new Error(`RPC function "${fnName}" not implemented in localDb`) };
  }
}

export function createLocalDb(options: LocalDbOptions): LocalDbClient {
  return new LocalDbClient(options);
}
