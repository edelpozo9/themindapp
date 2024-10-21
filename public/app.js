// public/app.js


// Almacenar o recuperar el playerId del localStorage
let playerId = localStorage.getItem('playerId');
if (!playerId) {
    playerId = generatePlayerId();
    localStorage.setItem('playerId', playerId);
}

function generatePlayerId() {
    // Generar un identificador único para el jugador
    return Math.random().toString(36).substr(2, 9);
}

// Conectar al servidor de Socket.IO y enviar el playerId como parámetro de consulta
const socket = io({
    query: {
        playerId: playerId // Enviar el playerId al servidor
    }
});

socket.on('connect', () => {
    console.log(`Conectado al servidor: ${playerId}`);
});



// Manejar el evento de éxito de la creación de la partida
socket.on('partidaCreada', ({ nombre, numJugadores }) => {
    console.log(`Partida ${nombre} creada con ${numJugadores} jugadores.`);
    // Aquí puedes redirigir al usuario a la sala de juego o realizar alguna otra acción
});

// Manejar otros eventos y lógica del juego aquí
