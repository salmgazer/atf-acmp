export default () => ({
  port: parseInt(process.env.PORT || "3001", 10),
  nodeEnv: process.env.NODE_ENV || "development",

  database: {
    host: process.env.DATABASE_HOST || "localhost",
    port: parseInt(process.env.DATABASE_PORT || "5432", 10),
    username: process.env.DATABASE_USER || "postgres",
    password: process.env.DATABASE_PASSWORD || "postgres",
    database: process.env.DATABASE_NAME || "acmp_dev",
  },

  redis: {
    host: process.env.REDIS_HOST || "localhost",
    port: parseInt(process.env.REDIS_PORT || "6379", 10),
    password: process.env.REDIS_PASSWORD || undefined,
  },

  jwt: {
    secret: process.env.JWT_SECRET || "dev-secret-change-in-production",
    expiresIn: process.env.JWT_EXPIRES_IN || "7d",
  },

  firebase: {
    projectId: process.env.FIREBASE_PROJECT_ID,
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    useApplicationDefaultCredentials: process.env.FIREBASE_USE_APPLICATION_DEFAULT_CREDENTIALS,
  },

  email: {
    mailchimpApiKey: process.env.MAILCHIMP_TRANSACTIONAL_API_KEY,
    fromEmail: process.env.EMAIL_FROM || "noreply@atfchallenge.org",
    fromName: process.env.EMAIL_FROM_NAME || "ATF AI Challenge",
  },

  mailchimp: {
    apiKey: process.env.MAILCHIMP_API_KEY,
    fromEmail: process.env.MAILCHIMP_FROM_EMAIL || "noreply@atfchallenge.org",
    fromName: process.env.MAILCHIMP_FROM_NAME || "ATF AI Challenge",
  },

  aws: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    region: process.env.AWS_REGION || "us-east-1",
    s3Bucket: process.env.AWS_S3_BUCKET,
  },

  cors: {
    origin: process.env.CORS_ORIGIN || "http://localhost:3000",
  },
});
