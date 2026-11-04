#!/bin/sh
set -eu

workspace_name="$1"
cd /app
dependency_stamp="/app/node_modules/.acmp-${workspace_name}-dependencies"
dependency_hash=$(node -e 'const fs=require("fs"),crypto=require("crypto"); const hash=crypto.createHash("sha256"); for(const file of ["package.json","package-lock.json",`apps/${process.argv[1]}/package.json`]) hash.update(fs.readFileSync(file)); hash.update(process.version+process.platform+process.arch); process.stdout.write(hash.digest("hex"));' "$workspace_name")

if [ ! -f "$dependency_stamp" ] || [ "$(cat "$dependency_stamp")" != "$dependency_hash" ]; then
  echo "Updating locked $workspace_name dependencies in the development volume..."
  npm ci --no-audit --no-fund
  echo "$dependency_hash" > "$dependency_stamp"
fi

if [ "$workspace_name" = "api" ] && [ "${RUN_MIGRATIONS:-false}" = "true" ]; then
  npm run migration:run -w @acmp/api
fi
exec npm run dev -w "@acmp/$workspace_name"
