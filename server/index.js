const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Sirve archivos estáticos si tienes un frontend simple
app.use(express.static('public'));

// Evento que se ejecuta cuando un cliente se conecta
io.on('connection', (socket) => {
  console.log('A user connected');

  // Evento personalizado (ejemplo)
  socket.on('chat message', (msg) => {
    console.log('message: ' + msg);
    io.emit('chat message', msg); // Envía el mensaje a todos los clientes conectados
  });

  // Evento para desconexión del cliente
  socket.on('disconnect', () => {
    console.log('A user disconnected');
  });
});

// Levantar el servidor en el puerto 3000
const PORT = 3000;
server.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
