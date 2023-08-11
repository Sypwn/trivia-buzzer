import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import path from 'path';

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, '../client')));
app.use('/host', express.static(path.join(__dirname, '../host')));

interface User {
  name: string;
  color: string | null;
  buzz_time: number;
  ping_time: number;
}
const socketMap: { [socketId: string]: User } = {};
const allowedColors = new Set(['red', 'yellow', 'green', 'blue', 'purple']);

function isColorAlreadyAssigned(desiredColor: string): boolean {
  for (const socketId in socketMap) {
    if (socketMap[socketId].color === desiredColor) {
      return true;  // Return true immediately if the color is found
    }
  }
  return false;  // Return false if the loop completes without finding the color
}

interface Buzzer {
  name: string;
  color: string;
}

function getBuzzedUsers(socketMap: { [socketId: string]: User }): Buzzer[] {
  const buzzedUsers: User[] = Object.values(socketMap).filter(
    (user) => user.buzz_time > 0
  );

  buzzedUsers.sort((a, b) => a.buzz_time - b.buzz_time);

  return buzzedUsers.map((user) => {
    return { 
      name: user.name, 
      color: user.color as string // Impossible for user to have buzz_time but no color
    }
  });
}

io.on('connection', (socket) => {
  console.log(socket.id + ' connected from ' + socket.handshake.address);

  // Add user to map
  socketMap[socket.id] = {name: socket.id, color: null, buzz_time: 0, ping_time: 0};

  // Event listener for 'name' events received from the connected clients
  socket.on('name', (data) => {

    // Verify a name was provided
    if (!data.name || (data.name.trim() == "")){
      console.log(socketMap[socket.id].name + ' submitted empty name');
      io.to(socket.id).emit('name_error', 'Please provide a name.')

    // Verify name is not "Host"
    } else if (data.name == "Host") {
      console.log(socketMap[socket.id].name + ' attempted to set name to "Host"');
      io.to(socket.id).emit('name_error', 'That name is not allowed.')

    // Verify valid color was provided
    } else if (!data.color || !allowedColors.has(data.color)) {
      console.log(socketMap[socket.id].name + ' provided invalid color: ' + data.color);
      io.to(socket.id).emit('name_error', 'Please select a color.')

    // Verify color is not taken
    } else if (isColorAlreadyAssigned(data.color)) {
      console.log(socketMap[socket.id].name + ' provided color already in use: ' + data.color);
      io.to(socket.id).emit('name_error', 'That color is already in use.')
      
    // Accept name request
    } else {
      console.log(socketMap[socket.id].name + ' set name to ' + data.name + ' and color to ' + data.color);
      socketMap[socket.id].name = data.name;
      socketMap[socket.id].color = data.color;
      io.to(socket.id).emit('name_ok', data);
    }    
  });

  // Event listener for 'buzz' events received from the connected clients
  socket.on('buzz', () => {
    // Get current timestamp
    const now = performance.now();

    // If we're already waiting for a pong, or if this user doesn't have a valid name&color, drop this buzz
    if ((socketMap[socket.id].ping_time > 0) || (socketMap[socket.id].color == null)) {
      console.warn('Unexpected buzz from ' + socketMap[socket.id].name + " at " + now.toFixed(2));
      return;
    }

    // If this user doesn't have a buzz-time
    if (socketMap[socket.id].buzz_time == 0) {

      // Send a timing ping
      io.to(socket.id).emit('ping');

      // Store the starting time
      socketMap[socket.id].ping_time = now;
    }

    // Send buzz to everyone
    io.emit('buzz_single', {name: socketMap[socket.id].name, color: socketMap[socket.id].color});

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

    const buzzers = getBuzzedUsers(socketMap);
    // Update all clients with current buzz list
    io.emit('buzz_list', buzzers);
    //for (const buzzer of buzzers) {
    //  console.log("  " + buzzer.name + " : " + buzzer.color);
    //}
    
  });

  socket.on('code', (code) => {
    console.log(socketMap[socket.id].name + ' sent code: ' + code);
    if (code === "secret_code") {
      console.log(socketMap[socket.id].name + ' is now a Host');
      socketMap[socket.id].name = 'Host'
      io.to(socket.id).emit('code_ok');
    }
  });

  socket.on('reset', () => {
    if (socketMap[socket.id].name != "Host") {
      console.warn(socketMap[socket.id].name + " attempted to send a reset.");
    } else {
      console.log(socketMap[socket.id].name + " sent reset");
      for (const user in socketMap) {
        socketMap[user].buzz_time = 0;
        socketMap[user].ping_time = 0;
      }
      io.emit('reset');
    }
  });

  // Event listener for 'disconnect' events when a user disconnects
  socket.on('disconnect', () => {
    console.log(socketMap[socket.id].name + ' disconnected'); // Log a message when a user disconnects

    // Remove the user's entry from the socketIdToNameMap
    delete socketMap[socket.id];
  });
});

server.listen(3000, () => {
  console.log('listening on *:3000');

  // Event listener for the 'SIGBREAK' signal (CTRL + Break)
  process.on('SIGBREAK', () => {
    console.log('List of currently connected users:');
    for (const socketId in socketMap) {
      console.log(socketMap[socketId].name);
    }
    io.emit('buzz_list', []);
  });
});
