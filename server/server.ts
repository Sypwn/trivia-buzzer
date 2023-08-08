import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import path from 'path';

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, '../client')));

interface User {
  name: string;
  buzz_time: number;
  ping_time: number;
}
const socketMap: { [socketId: string]: User } = {};

function getBuzzedUsers(socketMap: { [socketId: string]: User }): string[] {
  const buzzedUsers: User[] = Object.values(socketMap).filter(
    (user) => user.buzz_time > 0
  );

  buzzedUsers.sort((a, b) => a.buzz_time - b.buzz_time);

  return buzzedUsers.map((user) => user.name);
}

io.on('connection', (socket) => {
  console.log(socket.id + ' connected from ' + socket.handshake.address);

  // Add user to map
  socketMap[socket.id] = {name: socket.id, ping_time: 0, buzz_time: 0};

  // Event listener for 'name' events received from the connected clients
  socket.on('name', (name) => {
    console.log(socketMap[socket.id].name + ' set name to ' + name);

    // Store the socket ID and corresponding name in the map
    socketMap[socket.id].name = name;
  });

  // Event listener for 'buzz' events received from the connected clients
  socket.on('buzz', () => {
    // Get current timestamp
    const now = performance.now();

    // If we're already waiting for a pong, drop this buzz
    if (socketMap[socket.id].ping_time > 0) {
      console.warn('Unexpected buzz from ' + socketMap[socket.id].name + " at " + now.toFixed(2));
      return;
    }

    //Send a timing ping
    io.to(socket.id).emit('ping');

    // Store the starting time
    socketMap[socket.id].ping_time = now;

    console.log('buzz from ' + socketMap[socket.id].name + " at " + now.toFixed(2));
  });

  socket.on('pong', () => {
    // Get current timestamp
    const now = performance.now();
    console.log('pong from: ' + socketMap[socket.id].name + " at " + now.toFixed(2));

    // If we aren't expecting a pong, drop this
    if (socketMap[socket.id].ping_time == 0) {
      console.warn('Unexpected pong from ' + socketMap[socket.id].name + " at " + now.toFixed(2));
      return;
    }

    // Calculate latency and original buzz click time
    const latency = (now - socketMap[socket.id].ping_time) / 2
    socketMap[socket.id].buzz_time = socketMap[socket.id].ping_time - latency;
    console.log('Latency is ' + latency.toFixed(2) + "ms. Buzz time is " + socketMap[socket.id].buzz_time.toFixed(2));

    // Clear the ping time
    socketMap[socket.id].ping_time = 0;

    // Update all clients with current buzz list
    io.emit('buzz_list', getBuzzedUsers(socketMap));
  });

  // Event listener for 'disconnect' events when a user disconnects
  socket.on('disconnect', () => {
    console.log(socketMap[socket.id].name + ' disconnected'); // Log a message when a user disconnects

    // Remove the user's entry from the socketIdToNameMap
    delete socketMap[socket.id];

    // Send the updated user count to all connected clients
    io.emit('userCount', Object.keys(socketMap).length);
  });
});

server.listen(3000, () => {
  console.log('listening on *:3000');

  // Event listener for the 'SIGBREAK' signal (CTRL + Break)
  process.on('SIGBREAK', () => {
    console.log('List of currently connected users:');
    for (const socketId in socketMap) {
      console.log(socketMap[socketId].name);
      socketMap[socketId].buzz_time = 0;
      socketMap[socketId].ping_time = 0;
    }
    io.emit('buzz_list', []);
  });
});
