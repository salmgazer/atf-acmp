#!/bin/sh
set -e

echo "Starting ACMP API..."
echo "NODE_ENV: $NODE_ENV"

# Determine the correct dist path (NestJS monorepo outputs to dist/apps/api/src/)
DIST_PATH="dist/apps/api/src"
if [ ! -d "$DIST_PATH" ]; then
  # Fallback for different build configurations
  DIST_PATH="dist/src"
fi

echo "Using dist path: $DIST_PATH"

# Run migrations if not in development mode (dev uses synchronize)
if [ "$NODE_ENV" != "development" ]; then
  echo "Running database migrations..."
  echo "Looking for migrations in: $DIST_PATH/database/migrations/"
  ls -la "$DIST_PATH/database/migrations/" 2>/dev/null || echo "Migration directory not found or empty"
  
  # Run migrations using TypeORM CLI
  if npx typeorm migration:run -d "$DIST_PATH/database/data-source.js"; then
    echo "Migrations completed successfully."
  else
    echo "WARNING: Migration failed with exit code $?. Continuing to start the application..."
    echo "This may cause issues if tables don't exist."
  fi
fi

# Start the application
echo "Starting Node.js application..."
exec node "$DIST_PATH/main.js"
