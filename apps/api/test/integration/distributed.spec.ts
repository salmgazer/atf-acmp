import { createServer, Server as HttpServer } from 'http';
import { Server } from 'socket.io';
import { io, Socket } from 'socket.io-client';
import { createAdapter } from '@socket.io/redis-adapter';
import Redis from 'ioredis';
import { createKeyv } from '@keyv/redis';
import { SocketSessionsService } from '@/auth/socket-sessions.service';

const url = process.env.ACMP_TEST_REDIS_URL;
const integration = url ? describe : describe.skip;
integration('Distributed state regressions', () => {
  const servers: Server[] = [];
  const http: HttpServer[] = [];
  const redis: Redis[] = [];
  const clients: Socket[] = [];
  const ports: number[] = [];
  beforeAll(async () => {
    if (!['localhost', '127.0.0.1', 'redis'].includes(new URL(url!).hostname)) throw new Error('A local test Redis is required');
    for (let index = 0; index < 2; index++) {
      const publisher = new Redis(url!); const subscriber = publisher.duplicate();
      redis.push(publisher, subscriber);
      const host = createServer(); const server = new Server(host);
      http.push(host); servers.push(server);
      server.adapter(createAdapter(publisher, subscriber));
      await subscriber.psubscribe('socket.io#/#*');
      server.on('connection', socket => {
        socket.data.memberKey = 'participant:uuid';
        socket.on('join', async (room, ack) => { await socket.join(room); ack(); });
      });
      await new Promise<void>(resolve => host.listen(0, '127.0.0.1', resolve));
      ports.push((host.address() as { port: number }).port);
    }
  });
  afterAll(async () => {
    clients.forEach(client => client.disconnect());
    await Promise.all(servers.map(server => new Promise<void>(resolve => server.close(() => resolve()))));
    await Promise.all(redis.map(client => client.quit()));
  });
  async function client(index: number, room: string) {
    const socket = io('http://127.0.0.1:' + ports[index], { transports: ['websocket'], forceNew: true }); clients.push(socket);
    await new Promise<void>((resolve, reject) => { socket.once('connect', resolve); socket.once('connect_error', reject); });
    await new Promise<void>(resolve => socket.emit('join', room, resolve));
    return socket;
  }
  it('broadcasts to a client connected to another replica', async () => {
    const socket = await client(1, 'participant:uuid');
    const delivered = new Promise(resolve => socket.once('notification', resolve));
    servers[0].to('participant:uuid').emit('notification', { id: 'notification-1' });
    expect(await delivered).toEqual({ id: 'notification-1' });
  });
  it('revokes a session connected to another replica', async () => {
    const socket = await client(1, 'session:revoked');
    const sessions = new SocketSessionsService(); sessions.register(servers[0]);
    const disconnected = new Promise(resolve => socket.once('disconnect', resolve));
    sessions.revokeSession('revoked');
    await disconnected;
    expect(socket.connected).toBe(false);
  });
  it('shares a preview between independent cache clients', async () => {
    const a = createKeyv(url!, { namespace: 'acmp-regression' }); const b = createKeyv(url!, { namespace: 'acmp-regression' });
    try {
      const key = 'preview:' + Date.now(); const preview = { cohortId: 'c', matches: [{ teamId: 't', briefId: 'b' }] };
      await a.set(key, preview, 60000);
      expect(await b.get(key)).toEqual(preview);
      await b.delete(key); expect(await a.get(key)).toBeUndefined();
    } finally { await Promise.all([a.disconnect(), b.disconnect()]); }
  });
  it('removes departed members from rooms across replicas', async () => {
    await client(1, 'channel:private');
    expect(await servers[0].in('channel:private').fetchSockets()).toHaveLength(1);
    const sessions = new SocketSessionsService(); sessions.register(servers[0]);
    await sessions.removeChannelMember('private', 'uuid', 'participant');
    expect(await servers[0].in('channel:private').fetchSockets()).toHaveLength(0);
  });
});
