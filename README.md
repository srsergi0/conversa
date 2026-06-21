# Conversa SDK

A clean, intuitive, event-driven abstraction layer on top of conversational sockets (designed to integrate seamlessly with Baileys).

## Features

- **Event-driven design:** Register simple handlers like `onDirectMessage`, `onSubscribedMessage`, and regex pattern matching commands.
- **Chat SDK-like structure:** Uses normalized classes (`Message`, `Thread`, `Channel`, `Author`) to handle conversation flows cleanly.
- **Decoupled by design:** No local database or web server dependencies; it is a pure, portable wrapper on top of Baileys sockets.

## Installation

```bash
bun add conversa
```

## Usage

Here is a complete, self-contained example showing how to create the Baileys socket and wrap it with `Conversa`:

```typescript
import makeWASocket, { useMultiFileAuthState } from 'baileys';
import { Chat } from 'conversa';

// 1. Initialize Baileys authentication state
const { state, saveCreds } = await useMultiFileAuthState('auth_store');

// 2. Create the Baileys WASocket connection
const socket = makeWASocket({
  auth: state,
  printQRInTerminal: true
});

socket.ev.on('creds.update', saveCreds);

// 3. Wrap it with Conversa Chat SDK!
const bot = new Chat('session_ventas', socket);

// Register a handler for Direct Messages (DMs)
bot.onDirectMessage(async (thread, message, channel) => {
  console.log(`💬 DM from ${message.author.name || message.author.id}: "${message.text}"`);
  
  if (message.text.toLowerCase() === 'hello') {
    await thread.post('Hello! I am Conversa SDK. How can I help you? 🚀');
  }
});

// Register a command using a regex pattern
bot.onNewMessage(/^!ping/i, async (thread, message) => {
  await thread.post('pong! 🏓');
});
```

### Dynamic Hooking (Useful for dynamic servers/reconnections)

If you are running a server that dynamically loads multiple sessions or connects/reconnects sockets, you can register global event handlers using `Chat.onCreated`:

```typescript
import { Chat } from 'conversa';

// Register global template handlers
Chat.onCreated((bot) => {
  console.log(`🤖 [Conversa] Bot created dynamically for: "${bot.sessionId}"`);

  bot.onDirectMessage(async (thread, message) => {
    if (message.text.toLowerCase() === 'hello') {
      await thread.post('Hello from a dynamically connected bot!');
    }
  });
});
```
