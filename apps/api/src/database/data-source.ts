import { DataSource, DataSourceOptions } from "typeorm";
import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config();

export const dataSourceOptions: DataSourceOptions = {
  type: "postgres",
  host: process.env.DATABASE_HOST || "localhost",
  port: parseInt(process.env.DATABASE_PORT || "5432", 10),
  username: process.env.DATABASE_USER || "postgres",
  password: process.env.DATABASE_PASSWORD || "postgres",
  database: process.env.DATABASE_NAME || "acmp_dev",
  entities: [path.join(__dirname, "/entities/**/*.entity{.ts,.js}")],
  migrations: [path.join(__dirname, "/migrations/**/*{.ts,.js}")],
  synchronize: process.env.NODE_ENV === "development",
  logging: process.env.NODE_ENV === "development",
  ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: false } : false,
};

const dataSource = new DataSource(dataSourceOptions);

export default dataSource;
