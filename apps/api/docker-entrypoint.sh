#!/bin/sh
set -e

echo "Starting ACMP API..."
echo "NODE_ENV: $NODE_ENV"

# Debug: Show what's actually in the dist folder
echo "Contents of /app/dist:"
ls -la /app/dist/ 2>/dev/null || echo "dist folder not found"

# Determine the correct dist path
# NestJS monorepo outputs to dist/apps/api/src/ when using project references
DIST_PATH=""
if [ -f "dist/apps/api/src/main.js" ]; then
  DIST_PATH="dist/apps/api/src"
elif [ -f "dist/src/main.js" ]; then
  DIST_PATH="dist/src"
elif [ -f "dist/main.js" ]; then
  DIST_PATH="dist"
else
  echo "ERROR: Cannot find main.js in any expected location!"
  echo "Checking dist structure..."
  find /app/dist -name "main.js" 2>/dev/null || echo "No main.js found"
  exit 1
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
