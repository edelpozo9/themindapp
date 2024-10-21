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
  const userId = socket.handshake.query.playerId; // Obtener playerId del handshake
  console.log(`A user connected: ${userId}`);

  // Manejar la creación de una nueva partida
  socket.on("crearPartida", (nombrePartida, numJugadores, nombreUsuario) => {
    if (partidas[nombrePartida]) {
      socket.emit("error", "Ya existe una partida con ese nombre.");
      console.log(
        `Error: Intento de crear una partida ya existente: ${nombrePartida}`
      );
    } else {
      partidas[nombrePartida] = {
        numJugadores,
        jugadores: {},
        estadoJuego: {
          ronda: 1,
          cartasJugadas: [],
        },
      };
      // Llamar al socket para unirse a la partida inmediatamente después de crearla
      socket.emit("unirsePartida", nombrePartida, nombreUsuario);

      socket.emit("partidaCreada", {
        nombrePartida,
        numJugadores,
        nombreUsuario,
      });
      console.log(
        `Partida creada: ${nombrePartida} con ${numJugadores} jugadores.`
      );
    }
  });

  // Unirse a la partida
  socket.on("unirsePartida", (nombrePartida, nombreUsuario) => {
    const partida = partidas[nombrePartida];
    if (partida) {
      // Verificar si el usuario ya está en la partida
      if (partida.jugadores[userId]) {
        console.log(
          `El jugador ${userId} (${nombreUsuario}) ya está en la partida: ${nombrePartida}`
        );

        // Emitir la lista actualizada de jugadores y el nombre de la partida
        const jugadores = Object.values(partida.jugadores).map((jugador) => ({
          userId: jugador.userId,
          nombreUsuario: jugador.nombreUsuario,
          vidas: jugador.vida,
        }));

        // Emitir la lista actualizada de jugadores a todos los jugadores de la partida
        io.emit("actualizarJugadores", { jugadores, nombrePartida });
      } else {
        // Verificar si la partida ya está llena
        if (Object.keys(partida.jugadores).length >= partida.numJugadores) {
          socket.emit("errorPartida", "La partida ya está llena.");
          console.log(
            `Jugador ${userId} intentó unirse a una partida llena: ${nombrePartida}`
          );
        } else {
          partida.jugadores[userId] = {
            userId: userId,
            nombreUsuario: nombreUsuario, // Guardar el nombre del usuario
            vida: 3, // Cada jugador comienza con 3 vidas
            cartasJugadas: [], // Cartas que han jugado
          };

          // Emitir 'partidaUnida' al jugador que se acaba de unir para redirigirlo a la sala
          socket.emit("partidaUnida", { nombrePartida, nombreUsuario });

          // Emitir la lista actualizada de jugadores y el nombre de la partida
          const jugadores = Object.values(partida.jugadores).map((jugador) => ({
            userId: jugador.userId,
            nombreUsuario: jugador.nombreUsuario,
            vidas: jugador.vida,
          }));

          // Emitir la lista actualizada de jugadores a todos los jugadores de la partida
          io.emit("actualizarJugadores", { jugadores, nombrePartida });
          console.log(
            `Jugador ${userId} (${nombreUsuario}) se unió a la partida: ${nombrePartida}`
          );
        }
      }
    } else {
      socket.emit("errorPartida", "La partida no existe.");
    }
  });

  // Evento que se ejecuta cuando un cliente se desconecta
  socket.on("disconnect", (reason) => {
    //manejarDesconexion(userId, reason);
  });

  // Manejar el evento de dejar la partida
  socket.on("dejarPartida", (nombrePartida) => {
    manejarDesconexion(userId, "Usuario dejó la partida"); // Llama a la función de desconexión
  });

  // Función para manejar la desconexión de un jugador
  function manejarDesconexion(userId, reason) {
    // console.log(`A user disconnected: ${userId}, Reason: ${reason}`);

    // Buscar y eliminar al jugador de la partida correspondiente
    for (const nombrePartida in partidas) {
      const partida = partidas[nombrePartida];

      // Si el jugador está en esta partida, lo eliminamos
      if (partida.jugadores[userId]) {
        delete partida.jugadores[userId];
        console.log(
          `Jugador ${userId} eliminado de la partida ${nombrePartida}`
        );

        // Emitir la lista actualizada de jugadores y el nombre de la partida
        const jugadores = Object.values(partida.jugadores).map((jugador) => ({
          userId: jugador.userId,
          nombreUsuario: jugador.nombreUsuario,
          vidas: jugador.vida,
        }));

        // Emitir la lista actualizada de jugadores a todos los jugadores de la partida
        io.emit("actualizarJugadores", { jugadores, nombrePartida });      

        // Si ya no hay jugadores en la partida, puedes eliminar la partida opcionalmente
        if (Object.keys(partida.jugadores).length === 0) {
          // Verificar nuevamente si la partida sigue vacía después de 2 segundos
          if (Object.keys(partida.jugadores).length === 0) {
            delete partidas[nombrePartida];
            console.log(
              `Partida ${nombrePartida} eliminada porque no quedaron jugadores después de 1 segundo.`
            );
          } else {
            console.log(
              `Partida ${nombrePartida} no se eliminó porque hubo reconexión de jugadores.`
            );
          }
        }

        break; // Rompemos el bucle porque ya encontramos y eliminamos al jugador
      }
    }
  }

  // Evento para salir de la partida explícitamente (si se implementa en el cliente)
  socket.on("salirPartida", (nombrePartida) => {
    dejarPartida(socket, nombrePartida);
  });
});

// Función para gestionar la salida de un jugador de una partida
function dejarPartida(socket, nombrePartida) {
  const partida = partidas[nombrePartida];
  if (partida && partida.jugadores[userId]) {
    delete partida.jugadores[userId];
    console.log(`Jugador ${userId} ha dejado la partida: ${nombrePartida}`);

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
