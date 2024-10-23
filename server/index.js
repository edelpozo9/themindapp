//v0.1
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
    // Verificar si el usuario ya está en alguna partida
    const partidaExistente = Object.entries(partidas).find(
      (partida) => partida[1].jugadores[userId] // Verifica si el userId está en la lista de jugadores de la partida
    );

    if (partidaExistente) {
      const nombrePartidaExistente = partidaExistente[0]; // Obtiene el nombre de la partida en la que está el usuario
      socket.emit(
        "error",
        `Error al crear la partida. Ya estás en la partida: ${nombrePartidaExistente}. `
      );
      console.log(
        `Error: El usuario ${nombreUsuario} intentó crear una partida mientras está en la partida: ${nombrePartidaExistente}.`
      );
    } else if (partidas[nombrePartida]) {
      socket.emit("error", "Ya existe una partida con ese nombre.");
      console.log(
        `Error: Intento de crear una partida ya existente: ${nombrePartida}`
      );
    } else {
      partidas[nombrePartida] = {
        numJugadores,
        jugadores: {},
        estadoJuego: {
          ronda: 0,
          cartasJugadas: [],
          siguienteRonda: false,
          reiniciarRonda: false,
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

    // Verificar si el jugador ya está en una partida
    const partidaActual = Object.values(partidas).find(
      (partida) => partida.jugadores[userId]
    );
    if (partidaActual) {
      // Si el jugador ya está en una partida
      const nombrePartidaActual = Object.keys(partidas).find(
        (partidaName) => partidas[partidaName].jugadores[userId]
      );

      if (nombrePartidaActual !== nombrePartida) {
        // Si el nombre de la partida actual es diferente de la que se intenta unir
        socket.emit(
          "errorPartida",
          `Ya estás en la partida: ${nombrePartidaActual}. No puedes unirte a otra.`
        );
        console.log(
          `Jugador ${userId} (${nombreUsuario}) ya está en la partida: ${nombrePartidaActual}`
        );
        return; // Salir de la función si ya está en una partida diferente
      }
    }

    if (partida) {
      // Verificar si el usuario ya está en la partida
      if (partida.jugadores[userId]) {
        console.log(
          `El jugador ${userId} (${nombreUsuario}) ya está en la partida: ${nombrePartida}`
        );
        // Emitir 'partidaUnida' al jugador que se acaba de unir para redirigirlo a la sala
        socket.emit("partidaUnida", { nombrePartida, nombreUsuario });

        // Unir al jugador a una sala con su userId
        socket.join(userId);
        socket.join(nombrePartida);

        // Emitir el estado de la partida, incluyendo la ronda actual
        io.to(nombrePartida).emit("estadoPartida", {
          nombrePartida: nombrePartida,
          rondaActual: partida.estadoJuego.ronda,
          siguienteRonda: partida.estadoJuego.siguienteRonda,
          reiniciarRonda: partida.estadoJuego.reiniciarRonda,
        });
        // Emitir el estado actualizado de 'cartasJugadas' a todos los jugadores de la partida
        io.to(nombrePartida).emit(
          "actualizarCartasJugadas",
          partida.estadoJuego.cartasJugadas
        );

        // Emitir la lista actualizada de jugadores y el nombre de la partida
        const jugadores = Object.values(partida.jugadores).map((jugador) => ({
          userId: jugador.userId,
          nombreUsuario: jugador.nombreUsuario,
          vidas: jugador.vida,
        }));

        // Emitir la lista actualizada de jugadores a todos los jugadores de la partida
        io.emit("actualizarJugadores", {
          jugadores,
          nombrePartida,
          numJugadores: partida.numJugadores,
          reiniciarRonda: partida.estadoJuego.reiniciarRonda,
        });
        // Emitir las cartas que ya tiene el jugador
        const cartasJugador = partida.jugadores[userId].cartasDelJugador;
        socket.emit("asignarCartas", cartasJugador);
        console.log(
          `Cartas emitidas para el jugador ${userId} (${nombreUsuario}) en la partida ${nombrePartida}.`
        );
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
            cartasDelJugador: [],
            cartasJugadas: [], // Cartas que han jugado
          };

          // Unir al jugador a una sala con su userId
          socket.join(userId);
          socket.join(nombrePartida);

          // Emitir el estado de la partida, incluyendo la ronda actual
          io.to(nombrePartida).emit("estadoPartida", {
            nombrePartida: nombrePartida,
            rondaActual: partida.estadoJuego.ronda,
            siguienteRonda: partida.estadoJuego.siguienteRonda,
            reiniciarRonda: partida.estadoJuego.reiniciarRonda,
          });
          // Emitir el estado actualizado de 'cartasJugadas' a todos los jugadores de la partida
          io.to(nombrePartida).emit(
            "actualizarCartasJugadas",
            partida.estadoJuego.cartasJugadas
          );
          // Emitir 'partidaUnida' al jugador que se acaba de unir para redirigirlo a la sala
          socket.emit("partidaUnida", { nombrePartida, nombreUsuario });

          // Emitir la lista actualizada de jugadores y el nombre de la partida
          const jugadores = Object.values(partida.jugadores).map((jugador) => ({
            userId: jugador.userId,
            nombreUsuario: jugador.nombreUsuario,
            vidas: jugador.vida,
          }));

          // Emitir la lista actualizada de jugadores a todos los jugadores de la partida
          io.emit("actualizarJugadores", {
            jugadores,
            nombrePartida,
            numJugadores: partida.numJugadores,
            reiniciarRonda: partida.estadoJuego.reiniciarRonda,
          });
          // Emitir las cartas que ya tiene el jugador
          const cartasJugador = partida.jugadores[userId].cartasDelJugador;
          socket.emit("asignarCartas", cartasJugador);
          console.log(
            `Cartas emitidas para el jugador ${userId} (${nombreUsuario}) en la partida ${nombrePartida}.`
          );
          console.log(
            `Jugador ${userId} (${nombreUsuario}) se unió a la partida: ${nombrePartida}`
          );
        }
      }
    } else {
      socket.emit("errorPartida", "La partida no existe.");
    }
  });

  // Evento para verificar si el usuario ya está en una partida
  socket.on("verificarPartida", () => {
    let enPartida = false;
    let nombrePartida = "";

    // Buscar en todas las partidas si el usuario está
    for (const partidaNombre in partidas) {
      const partida = partidas[partidaNombre];
      if (partida.jugadores[userId]) {
        enPartida = true;
        nombrePartida = partidaNombre;
        break;
      }
    }

    if (enPartida) {
      // Emitir evento que indica que ya está en una partida
      socket.emit("yaEnPartida", nombrePartida);
    } else {
      // Emitir evento que indica que no está en ninguna partida
      socket.emit("noEnPartida");
    }
  });

  // Escuchar el evento 'jugarCarta'
  socket.on("jugarCarta", ({ nombrePartida, cartaJugada }) => {
    const partida = partidas[nombrePartida];
    const jugador = partida.jugadores[userId];

    if (!partida || !jugador) {
      socket.emit("errorJugarCarta", { mensaje: "Error: Partida o jugador no encontrado." });
      return;
    }
    // Verificar que la carta jugada sea válida (es mayor que las ya jugadas)
  const cartasJugadas = partida.estadoJuego.cartasJugadas;
  const ultimaCartaJugada = cartasJugadas.length > 0 ? Math.max(...cartasJugadas.map(c => c.carta)) : -Infinity;

  if (cartaJugada <= ultimaCartaJugada) {
    // Emitir un error a todos los jugadores si la carta no es válida
    io.to(nombrePartida).emit("errorJugarCarta", {
      mensaje: `La carta ${cartaJugada} jugada por ${jugador.nombreUsuario} no es válida. Debe ser mayor que ${ultimaCartaJugada}.`,
    });
    partida.estadoJuego.reiniciarRonda = true;
    //Emitir el estado de la partida
    io.to(nombrePartida).emit("estadoPartida", {
      nombrePartida: nombrePartida,
      rondaActual: partida.estadoJuego.ronda,
      siguienteRonda: partida.estadoJuego.siguienteRonda,
      reiniciarRonda:  partida.estadoJuego.reiniciarRonda,
    });
     // Emitir la lista actualizada de jugadores y el nombre de la partida
     const jugadores = Object.values(partida.jugadores).map((jugador) => ({
      userId: jugador.userId,
      nombreUsuario: jugador.nombreUsuario,
      vidas: jugador.vida,
    }));

    // Emitir la lista actualizada de jugadores a todos los jugadores de la partida
    io.emit("actualizarJugadores", {
      jugadores,
      nombrePartida,
      numJugadores: partida.numJugadores,
      reiniciarRonda: partida.estadoJuego.reiniciarRonda,
    });
    return;
  }

    // Remover la carta jugada del jugador
    const cartaIndex = jugador.cartasDelJugador.indexOf(cartaJugada);
    if (cartaIndex !== -1) {
      jugador.cartasDelJugador.splice(cartaIndex, 1); // Eliminar la carta de las cartas del jugador
    }

    // Almacenar la carta jugada en el array 'estadoJuego.cartasJugadas'
    partida.estadoJuego.cartasJugadas.push({
      userId: jugador.userId,
      nombreUsuario: jugador.nombreUsuario,
      carta: cartaJugada,
    });

    // Emitir 'cartasJugadas' a todos los jugadores de la partida
    io.to(nombrePartida).emit(
      "actualizarCartasJugadas",
      partida.estadoJuego.cartasJugadas
    );

    // Verificar si se han jugado todas las cartas necesarias para la ronda actual
    const numJugadores = partida.numJugadores;
    const rondaActual = partida.estadoJuego.ronda;
    const cartasRequeridas = numJugadores * rondaActual;
    if (partida.estadoJuego.cartasJugadas.length === cartasRequeridas) {
      // Si se han jugado todas las cartas, permitir la siguiente ronda
      partida.estadoJuego.siguienteRonda = true;

      // Emitir el estado de la partida actualizado a todos los jugadores
      io.to(nombrePartida).emit("estadoPartida", {
        nombrePartida: nombrePartida,
        rondaActual: rondaActual,
        siguienteRonda: partida.estadoJuego.siguienteRonda,
        reiniciarRonda: partida.estadoJuego.reiniciarRonda,
      });

      console.log(
        `Todos los jugadores han jugado sus cartas en la ronda ${rondaActual} de la partida: ${nombrePartida}. Se habilita la siguiente ronda.`
      );
    }

    console.log(
      `El jugador ${jugador.nombreUsuario} jugó la carta ${cartaJugada} en la partida: ${nombrePartida}`
    );
  });

  // Evento que se ejecuta cuando un cliente se desconecta
  socket.on("disconnect", (reason) => {
    //manejarDesconexion(userId, reason);
  });

  // Evento para iniciar la partida
  socket.on("iniciarPartida", (nombrePartida) => {
    const partida = partidas[nombrePartida];
    if (!partida) {
      // Si la partida no existe, emitir un evento para redirigir al index
      console.log(`La partida "${nombrePartida}" no existe.`);
      return; // Detener la ejecución para que no se intente iniciar la partida
    }

    // Aumentar la ronda después de repartir las cartas
    partida.estadoJuego.ronda += 1; // Aumentar la ronda en uno
    // Llamar a la función repartirCartas con el nombre de la partida y la ronda actual
    repartirCartas(nombrePartida, partida.estadoJuego.ronda);

    // Emitir el estado de la partida, incluyendo la ronda actual
    io.to(nombrePartida).emit("estadoPartida", {
      nombrePartida: nombrePartida,
      rondaActual: partida.estadoJuego.ronda,
      siguienteRonda: partida.estadoJuego.siguienteRonda,
      reiniciarRonda: partida.estadoJuego.reiniciarRonda,
    });

    // Notificar que la partida ha iniciado
    console.log(`Partida iniciada: ${nombrePartida}.`);
  });

  // Evento para iniciar la partida
  socket.on("iniciarNuevaRonda", (nombrePartida) => {
    const partida = partidas[nombrePartida];
    if (!partida) {
      // Si la partida no existe, emitir un evento para redirigir al index
      console.log(`La partida "${nombrePartida}" no existe.`);
      return; // Detener la ejecución para que no se intente iniciar la partida
    }

    // Aumentar la ronda después de repartir las cartas
    partida.estadoJuego.ronda += 1; // Aumentar la ronda en uno

    // Eliminar las cartas jugadas de la partida
    partida.estadoJuego.cartasJugadas = [];

    // Emitir el estado actualizado de 'cartasJugadas' a todos los jugadores de la partida
    io.to(nombrePartida).emit(
      "actualizarCartasJugadas",
      partida.estadoJuego.cartasJugadas
    );
    // Llamar a la función repartirCartas con el nombre de la partida y la ronda actual
    repartirCartas(nombrePartida, partida.estadoJuego.ronda);

    // Emitir el estado de la partida, incluyendo la ronda actual
    io.to(nombrePartida).emit("estadoPartida", {
      nombrePartida: nombrePartida,
      rondaActual: partida.estadoJuego.ronda,
      siguienteRonda: partida.estadoJuego.siguienteRonda,
      reiniciarRonda: partida.estadoJuego.reiniciarRonda,
    });

    // Notificar que la partida ha iniciado
    console.log(`Partida iniciada: ${nombrePartida}.`);
  });

  // Evento para iniciar la partida
  socket.on("reiniciarRonda", (nombrePartida) => {
    const partida = partidas[nombrePartida];
    if (!partida) {
      // Si la partida no existe, emitir un evento para redirigir al index
      console.log(`La partida "${nombrePartida}" no existe.`);
      return; // Detener la ejecución para que no se intente iniciar la partida
    }
    partida.estadoJuego.reiniciarRonda = false;

    // Emitir la lista actualizada de jugadores y el nombre de la partida
    const jugadores = Object.values(partida.jugadores).map((jugador) => ({
      userId: jugador.userId,
      nombreUsuario: jugador.nombreUsuario,
      vidas: jugador.vida,
    }));

    // Emitir la lista actualizada de jugadores a todos los jugadores de la partida
    io.emit("actualizarJugadores", {
      jugadores,
      nombrePartida,
      numJugadores: partida.numJugadores,
      reiniciarRonda: partida.estadoJuego.reiniciarRonda,
    });
    // Eliminar las cartas jugadas de la partida
    partida.estadoJuego.cartasJugadas = [];

    // Emitir el estado actualizado de 'cartasJugadas' a todos los jugadores de la partida
    io.to(nombrePartida).emit(
      "actualizarCartasJugadas",
      partida.estadoJuego.cartasJugadas
    );
    // Llamar a la función repartirCartas con el nombre de la partida y la ronda actual
    repartirCartas(nombrePartida, partida.estadoJuego.ronda);

    // Emitir el estado de la partida, incluyendo la ronda actual
    io.to(nombrePartida).emit("estadoPartida", {
      nombrePartida: nombrePartida,
      rondaActual: partida.estadoJuego.ronda,
      siguienteRonda: partida.estadoJuego.siguienteRonda,
      reiniciarRonda: partida.estadoJuego.reiniciarRonda,
    });

    // Notificar que la partida ha iniciado
    console.log(`Partida iniciada: ${nombrePartida}.`);
  });

  // Función repartir cartas
  function repartirCartas(nombrePartida, ronda) {
    const partida = partidas[nombrePartida];
    const jugadores = Object.values(partida.jugadores);
    const cartasDisponibles = [...CARTAS]; // Hacer una copia del array de cartas
    const cartasAsignadas = {};

    jugadores.forEach((jugador) => {
      // Eliminar las cartas previas del jugador
      partida.jugadores[jugador.userId].cartasDelJugador = [];

      const cartasJugador = [];
      for (let i = 0; i < ronda; i++) {
        if (cartasDisponibles.length === 0) break; // Si no hay más cartas, salir del bucle
        const cartaAleatoria = Math.floor(
          Math.random() * cartasDisponibles.length
        );
        const carta = cartasDisponibles[cartaAleatoria];

        cartasJugador.push(carta); // Almacenar la carta en un array temporal
        cartasDisponibles.splice(cartaAleatoria, 1); // Eliminar la carta de las disponibles
      }

      // Ordenar las cartas de menor a mayor antes de asignarlas al jugador
      cartasJugador.sort((a, b) => a - b);

      cartasAsignadas[jugador.userId] = cartasJugador;
      partida.jugadores[jugador.userId].cartasDelJugador.push(...cartasJugador); // Agregar las cartas al jugador
    });

    partida.estadoJuego.siguienteRonda = false;

    // Emitir las cartas asignadas a cada jugador
    Object.keys(cartasAsignadas).forEach((userId) => {
      io.to(userId).emit("asignarCartas", cartasAsignadas[userId]);
    });

    console.log(
      `Cartas repartidas para la ronda ${ronda} en la partida ${nombrePartida}.`
    );
  }

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
        io.emit("actualizarJugadores", {
          jugadores,
          nombrePartida,
          numJugadores: partida.numJugadores,
          reiniciarRonda: partida.estadoJuego.reiniciarRonda,
        });

        // Modificar el valor de reiniciarRonda en el estado de la partida
        partida.estadoJuego.reiniciarRonda = true;

        // Emitir el evento de estado de la partida con reiniciarRonda = true
        io.to(nombrePartida).emit("estadoPartida", {
          nombrePartida,
          rondaActual: partida.rondaActual,
          siguienteRonda: false, // Esto puede depender de tu lógica específica
          reiniciarRonda: true
        });

        // Si ya no hay jugadores en la partida, puedes eliminar la partida opcionalmente
        if (Object.keys(partida.jugadores).length === 0) {
          delete partidas[nombrePartida];
          console.log(
            `Partida ${nombrePartida} eliminada porque no quedaron jugadores.`
          );
        }

        break; // Rompemos el bucle porque ya encontramos y eliminamos al jugador
      }
    }
  }
});

// Levantar el servidor en el puerto 3000
const PORT = 3000;
server.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
