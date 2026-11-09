import { DataSource, EntityManager } from "typeorm";

/** Session lock survives Redis replacement. No transaction stays open during email delivery. */
export async function withParticipantQueueLock<T>(db: DataSource, key: string, work: (manager: EntityManager) => Promise<T>): Promise<T> {
  const runner = db.createQueryRunner();
  let locked = false;
  try {
    await runner.connect();
    [{ locked }] = await runner.query("SELECT pg_try_advisory_lock(hashtextextended($1, 0)) AS locked", [key]);
    if (!locked) throw new Error("A participant queue worker already holds this delivery lock");
    return await work(runner.manager);
  } finally {
    try { if (locked && !runner.isReleased) await runner.query("SELECT pg_advisory_unlock(hashtextextended($1, 0))", [key]); }
    finally { if (!runner.isReleased) await runner.release(); }
  }
}
