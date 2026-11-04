import { ChatGateway } from './chat.gateway';
import { SenderType } from '@/database/entities/chat.entity';

describe('Chat staff permissions', () => {
  function fixture() {
    const chat = { getUserChannels: jest.fn(async () => []), findChannel: jest.fn(async () => ({ type: 'staff' })), createMessage: jest.fn(async () => ({ id: 'message' })), isChannelMember: jest.fn(async () => true) };
    const gateway = new ChatGateway(chat as any, {} as any, {} as any, {} as any, {} as any);
    const emit = jest.fn();
    gateway.server = { to: jest.fn(() => ({ emit })) } as any;
    const client = { id: 'socket', user: { id: 'staff', type: SenderType.STAFF, role: 'viewer', name: 'Staff', email: 'staff@example.test' }, handshake: { auth: { token: 'test-token' } }, data: {}, join: jest.fn(), once: jest.fn(), use: jest.fn(), emit: jest.fn(), to: jest.fn(() => ({ emit })), disconnect: jest.fn() };
    return { chat, gateway, client };
  }

  it('blocks viewer WebSocket messages and typing without writing or broadcasting', async () => {
    const { chat, gateway, client } = fixture();
    await expect(gateway.handleSendMessage(client as any, { channelId: 'channel', content: 'Forbidden' })).resolves.toMatchObject({ success: false });
    await gateway.handleTyping(client as any, { channelId: 'channel', isTyping: true });
    expect(chat.createMessage).not.toHaveBeenCalled();
    expect(gateway.server.to).not.toHaveBeenCalled();
    expect(client.to).not.toHaveBeenCalled();
  });

  it.each(['super_admin', 'program_manager', 'evaluator'])('allows %s to send messages', async role => {
    const { chat, gateway, client } = fixture();
    client.user.role = role;
    await expect(gateway.handleSendMessage(client as any, { channelId: 'channel', content: 'Hello' })).resolves.toMatchObject({ success: true });
    expect(chat.createMessage).toHaveBeenCalledWith(expect.objectContaining({ senderId: 'staff', senderType: SenderType.STAFF, content: 'Hello' }));
  });

  it('applies a role downgrade to an already connected socket before its next message', async () => {
    const { chat, gateway, client } = fixture();
    const principal = { sub: 'staff', principalId: 'staff', sessionId: 'session', role: 'evaluator', email: 'staff@example.test', exp: Math.floor(Date.now() / 1000) + 3600 };
    jest.spyOn(gateway as any, 'verifyToken').mockResolvedValueOnce(principal).mockResolvedValueOnce({ ...principal, role: 'viewer' });
    await gateway.handleConnection(client as any);
    expect(client.user.role).toBe('evaluator');
    const middleware = client.use.mock.calls[0][0] as any;
    const next = jest.fn();
    await middleware(['send_message', {}], next);
    expect(next).toHaveBeenCalledWith();
    expect(client.user.role).toBe('viewer');
    await expect(gateway.handleSendMessage(client as any, { channelId: 'channel', content: 'After demotion' })).resolves.toMatchObject({ success: false });
    expect(chat.createMessage).not.toHaveBeenCalled();
    const onDisconnect = client.once.mock.calls[0][1] as any;
    onDisconnect();
  });
});
