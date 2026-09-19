#!/bin/sh
set -e

echo "Starting ACMP API..."
echo "NODE_ENV: $NODE_ENV"

# Run migrations if not in development mode (dev uses synchronize)
if [ "$NODE_ENV" != "development" ]; then
  echo "Running database migrations..."
  echo "Looking for migrations in: dist/src/database/migrations/"
  ls -la dist/src/database/migrations/ 2>/dev/null || echo "Migration directory not found or empty"
  
  # Run migrations using TypeORM CLI
  if npx typeorm migration:run -d dist/src/database/data-source.js; then
    echo "Migrations completed successfully."
  else
    echo "WARNING: Migration failed with exit code $?. Continuing to start the application..."
    echo "This may cause issues if tables don't exist."
  fi
fi

# Start the application
echo "Starting Node.js application..."
exec node dist/src/main.js
