import { Server as HttpServer } from 'http';
import { Server as SocketServer } from 'socket.io';

let io: SocketServer | null = null;

export function initSocket(server: HttpServer) {
  io = new SocketServer(server, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST']
    }
  });

  io.on('connection', (socket) => {
    console.log(`Socket.io client connected: ${socket.id}`);

    // Allow client to join room for a specific order
    socket.on('joinOrderTrack', (orderId: string) => {
      socket.join(`order:${orderId}`);
      console.log(`Socket: client ${socket.id} joined tracking room: order:${orderId}`);
    });

    socket.on('leaveOrderTrack', (orderId: string) => {
      socket.leave(`order:${orderId}`);
      console.log(`Socket: client ${socket.id} left tracking room: order:${orderId}`);
    });

    socket.on('disconnect', () => {
      console.log(`Socket.io client disconnected: ${socket.id}`);
    });
  });

  return io;
}

export function emitOrderUpdate(orderId: string, orderData: any) {
  if (io) {
    io.to(`order:${orderId}`).emit('orderStatusChanged', orderData);
    // Also broadcast order changes generally (e.g. for admin dashboards)
    io.emit('orderUpdate', orderData);
    console.log(`Socket: Emitted update for order:${orderId}`);
  }
}
