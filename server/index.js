const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Sirve archivos estáticos
app.use(express.static("public"));

const partidas = {}; // Objeto para guardar las partidas y jugadores

// Definir cartas del 1 al 100
const CARTAS = Array.from({ length: 100 }, (_, i) => i + 1); // Crea un array de [1, 2, ..., 100]

// Evento que se ejecuta cuando un cliente se conecta
io.on("connection", (socket) => {
  console.log("A user connected");

  // Manejar la creación de una nueva partida
  socket.on("crearPartida", (nombre, numJugadores) => {
    if (partidas[nombre]) {
      socket.emit("error", "Ya existe una partida con ese nombre.");
      console.log(
        `Error: Intento de crear una partida ya existente: ${nombre}`
      );
    } else {
        partidas[nombre] = {
            nombre,
            numJugadores,
            jugadores: {},
            estadoJuego: {
                ronda: 1,
                cartasJugadas: [],
                vidas: numJugadores * 3, // Total de vidas basado en el número de jugadores
                cartas: [] // Aquí puedes definir las cartas que usarás en el juego
            }
        };
      socket.emit("partidaCreada", { nombre, numJugadores });
      console.log(`Partida creada: ${nombre} con ${numJugadores} jugadores.`);
    }
  });

  // Unirse a la partida
  socket.on("unirsePartida", (nombrePartida) => {
    if (partidas[nombrePartida]) {
        const jugadorID = socket.id;
        partidas[nombrePartida].jugadores[jugadorID] = {
            nombre: jugadorID, // Puedes cambiarlo a un nombre más amigable
            vida: 3, // Cada jugador comienza con 3 vidas
            cartasJugadas: [] // Cartas que han jugado
        };
        const jugadores = Object.keys(partidas[nombrePartida].jugadores).map(id => `Jugador ${id}`);
        io.emit('actualizarJugadores', jugadores);
        console.log(`Jugador ${socket.id} se unió a la partida: ${nombrePartida}`);
    } else {
        socket.emit('errorPartida', 'La partida no existe.');
    }
  });
});

// Levantar el servidor en el puerto 3000
const PORT = 3000;
server.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
