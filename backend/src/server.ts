import { createServer } from 'node:http';
import { Server } from 'socket.io';
import { app } from './app.js';
import { connectDatabase } from './config/database.js';
import { env } from './config/env.js';
import { configureSockets } from './realtime/socket.js';

await connectDatabase();
const server = createServer(app), io = new Server(server, { cors: { origin: env.FRONTEND_ORIGIN.split(',').map((v) => v.trim()), credentials: true } });
app.set('io', io); configureSockets(io);
server.listen(env.PORT, () => console.log(JSON.stringify({ level: 'info', message: 'Effort Tracker API listening', port: env.PORT })));
