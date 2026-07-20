import 'reflect-metadata';
import { DataSource } from 'typeorm';
import configuration from '../config/configuration';

/**
 * Standalone TypeORM DataSource used by the CLI for migrations
 * (npm run migration:run / migration:generate). The Nest runtime builds its
 * own connection from the same config in app.module.ts.
 */
const cfg = configuration();

export default new DataSource({
  type: 'postgres',
  host: cfg.db.host,
  port: cfg.db.port,
  username: cfg.db.username,
  password: cfg.db.password,
  database: cfg.db.database,
  ssl: cfg.db.ssl ? { rejectUnauthorized: false } : false,
  entities: [__dirname + '/../**/*.entity.{ts,js}'],
  migrations: [__dirname + '/migrations/*.{ts,js}'],
  synchronize: false,
  logging: cfg.env === 'development' ? ['error', 'warn', 'migration'] : ['error'],
});
