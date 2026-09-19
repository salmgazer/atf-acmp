# Database Schema Rules

## CRITICAL: Schema Changes via Migrations Only

**NEVER modify entity files directly to add/remove/alter columns.**

All database schema changes MUST be done through TypeORM migration files:

1. Create migration file: `npm run migration:generate -- -n MigrationName`
2. Or create empty migration: `npm run migration:create -- -n MigrationName`
3. Write SQL in the `up()` and `down()` methods
4. Run migration: `npm run migration:run`

### Why This Matters
- Production database has existing data that must be preserved
- Migrations provide rollback capability
- Team members need reproducible schema changes
- Entity decorators alone don't modify the actual database

### Migration File Location
```
apps/api/src/database/migrations/
```

### Example Migration
```typescript
import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCityToOrganization1234567890 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "organization" ADD COLUMN "city" varchar(255)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "organization" DROP COLUMN "city"
    `);
  }
}
```

### After Creating Migration
Update the corresponding entity file to match the new schema so TypeORM knows about the columns.

### Checklist for Schema Changes
- [ ] Create migration file with `up()` and `down()` methods
- [ ] Test migration locally: `npm run migration:run`
- [ ] Update entity file to reflect changes
- [ ] Commit both migration and entity changes together
- [ ] Run migration on staging after deploy
