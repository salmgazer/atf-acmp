#!/bin/sh
set -e

echo "Starting ACMP API..."

# Run migrations if not in development mode (dev uses synchronize)
if [ "$NODE_ENV" != "development" ]; then
  echo "Running database migrations..."
  npx typeorm migration:run -d dist/src/database/data-source.js || {
    echo "Migration failed, but continuing to start the application..."
  }
  echo "Migrations complete."
fi

# Start the application
echo "Starting Node.js application..."
exec node dist/src/main.js
