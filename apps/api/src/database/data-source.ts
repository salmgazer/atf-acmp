import { DataSource, DataSourceOptions } from "typeorm";
import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config();

// Use process.cwd() as fallback for ESM compatibility
const baseDir = typeof __dirname !== 'undefined' ? __dirname : process.cwd() + '/src/database';

export const dataSourceOptions: DataSourceOptions = {
  type: "postgres",
  host: process.env.DATABASE_HOST || "localhost",
  port: parseInt(process.env.DATABASE_PORT || "5432", 10),
  username: process.env.DATABASE_USER || "postgres",
  password: process.env.DATABASE_PASSWORD || "postgres",
  database: process.env.DATABASE_NAME || "acmp_dev",
  entities: [path.join(baseDir, "/entities/**/*.entity{.ts,.js}")],
  migrations: [path.join(baseDir, "/migrations/**/*{.ts,.js}")],
  synchronize: process.env.NODE_ENV === "development",
  migrationsRun: process.env.NODE_ENV !== "development", // Auto-run migrations in staging/production
  logging: process.env.NODE_ENV === "development",
  ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: false } : false,
};

const dataSource = new DataSource(dataSourceOptions);

export default dataSource;
