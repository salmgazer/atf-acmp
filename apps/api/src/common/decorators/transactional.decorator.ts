import { Repository } from "typeorm";
import { Logger } from "@nestjs/common";

const effectsKey = Symbol('afterCommit');
export function afterCommit(service: object, effect: () => Promise<unknown> | void): void {
  const effects = (service as any)[effectsKey];
  if (effects) effects.push(effect);
  else void effect();
}

/** Bind every repository of a service operation to the same DB transaction. */
export function Transactional(lockScope?: string): MethodDecorator {
  return (_target, _key, descriptor: PropertyDescriptor) => {
    const operation = descriptor.value;
    descriptor.value = async function (...args: unknown[]) {
      const repositories = Object.entries(this as Record<string, unknown>)
        .filter((entry): entry is [string, Repository<any>] => entry[1] instanceof Repository);
      const first = repositories[0]?.[1];
      if (!first) return operation.apply(this, args);
      const inherited = (this as any)[effectsKey];
      const effects: Array<() => Promise<unknown> | void> = inherited || [];
      const result = await first.manager.transaction(async manager => {
        if (lockScope) await manager.query("SELECT pg_advisory_xact_lock(hashtext($1))", [`${lockScope}:${String(args[0])}`]);
        const scoped = Object.assign(Object.create(Object.getPrototypeOf(this)), this);
        scoped[effectsKey] = effects;
        for (const [name, repository] of repositories) scoped[name] = manager.getRepository(repository.target);
        return operation.apply(scoped, args);
      });
      if (!inherited) for (const effect of effects) {
        try { await effect(); } catch (error) { new Logger('Transactional').error('Post-commit delivery failed', error); }
      }
      return result;
    };
  };
}
