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
  console.log(`A user connected: ${socket.id}`);

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
          cartas: [], // Aquí puedes definir las cartas que usarás en el juego
        },
      };
      socket.emit("partidaCreada", { nombre, numJugadores });
      console.log(`Partida creada: ${nombre} con ${numJugadores} jugadores.`);
    }
  });

  // Unirse a la partida
  socket.on("unirsePartida", (nombrePartida) => {
    const partida = partidas[nombrePartida];
    if (partida) {
      const jugadorID = socket.id;

      // Verificar si la partida ya está llena
      if (Object.keys(partida.jugadores).length >= partida.numJugadores) {
        socket.emit("errorPartida", "La partida ya está llena.");
        console.log(
          `Jugador ${jugadorID} intentó unirse a una partida llena: ${nombrePartida}`
        );
      } else {
        partida.jugadores[jugadorID] = {
          nombre: jugadorID, // Puedes cambiarlo a un nombre más amigable
          vida: 3, // Cada jugador comienza con 3 vidas
          cartasJugadas: [], // Cartas que han jugado
        };

        const jugadores = Object.keys(partida.jugadores).map(
          (id) => `Jugador ${id}`
        );
        io.emit("actualizarJugadores", jugadores);
        console.log(
          `Jugador ${socket.id} se unió a la partida: ${nombrePartida}`
        );

        // Emitir 'partidaUnida' al jugador que se acaba de unir para redirigirlo a la sala
        socket.emit("partidaUnida", { nombre: nombrePartida });
      }
    } else {
      socket.emit("errorPartida", "La partida no existe.");
    }
  });

  // Evento para desconexión del cliente
  // Evento que se ejecuta cuando un cliente se desconecta
  socket.on("disconnect", (reason) => {
    console.log(`A user disconnected: ${socket.id}, Reason: ${reason}`);

    // Buscar y eliminar al jugador de la partida correspondiente
    for (const partidaNombre in partidas) {
      const partida = partidas[partidaNombre];

      // Si el jugador está en esta partida, lo eliminamos
      if (partida.jugadores[socket.id]) {
        delete partida.jugadores[socket.id];
        console.log(
          `Jugador ${socket.id} eliminado de la partida ${partidaNombre}`
        );

        // Actualizar la lista de jugadores en la partida
        const jugadores = Object.keys(partida.jugadores).map(
          (id) => `Jugador ${id}`
        );
        io.emit("actualizarJugadores", jugadores);

        // Si ya no hay jugadores en la partida, puedes eliminar la partida opcionalmente
        if (Object.keys(partida.jugadores).length === 0) {
          // Guardamos el timeout en la partida para poder cancelarlo si un jugador se reconecta
          partida.eliminarTimeout = setTimeout(() => {
            // Verificar nuevamente si la partida sigue vacía después de 2 segundos
            if (Object.keys(partida.jugadores).length === 0) {
              delete partidas[partidaNombre];
              console.log(
                `Partida ${partidaNombre} eliminada porque no quedaron jugadores después de 1 segundo.`
              );
            } else {
              console.log(
                `Partida ${partidaNombre} no se eliminó porque hubo reconexión de jugadores.`
              );
            }
          }, 1000); // Esperar 1 segundos antes de eliminar la partida
        }

        break; // Rompemos el bucle porque ya encontramos y eliminamos al jugador
      }
    }
  });

  // Evento para salir de la partida explícitamente (si se implementa en el cliente)
  socket.on("salirPartida", (nombrePartida) => {
    dejarPartida(socket, nombrePartida);
  });
});

// Función para gestionar la salida de un jugador de una partida
function dejarPartida(socket, nombrePartida) {
  const partida = partidas[nombrePartida];
  if (partida && partida.jugadores[socket.id]) {
    delete partida.jugadores[socket.id];
    console.log(`Jugador ${socket.id} ha dejado la partida: ${nombrePartida}`);

    // Emitir una actualización a todos los jugadores para que sepan que un jugador ha salido
    const jugadores = Object.keys(partida.jugadores).map(
      (id) => `Jugador ${id}`
    );
    io.emit("actualizarJugadores", jugadores);

    // Eliminar la partida si ya no hay jugadores en ella
    if (Object.keys(partida.jugadores).length === 0) {
      delete partidas[nombrePartida];
      console.log(
        `La partida ${nombrePartida} ha sido eliminada porque no tiene jugadores.`
      );
    }
  }
}

// Levantar el servidor en el puerto 3000
const PORT = 3000;
server.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
