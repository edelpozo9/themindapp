// public/app.js
const socket = io();


socket.on('connect', () => {
    console.log('Conectado al servidor');
});

// Espera a que el DOM esté completamente cargado antes de agregar event listeners
document.addEventListener('DOMContentLoaded', () => {
    const startGameButton = document.getElementById('startGame');

    if (startGameButton) {
        startGameButton.addEventListener('click', () => {
            const nombrePartida = document.getElementById('nombrePartida').value.trim();
            const numJugadores = document.getElementById('numJugadores').value;

            if (nombrePartida && numJugadores) {
                console.log(`Intentando crear la partida: ${nombrePartida} con ${numJugadores} jugadores.`);
                socket.emit('crearPartida', nombrePartida, parseInt(numJugadores));
            } else {
                alert("Error", "Por favor, ingresa un nombre de partida y el número de jugadores.", "error");
            }
        });
    } else {
        console.error('Elemento con ID "startGame" no encontrado');
    }
});
// Manejar el evento de error errorPartidaExistente
socket.on('errorPartidaExistente', (message) => {
    console.log('Ya existe una partida con ese nombre'); // Esto debería aparecer si la partida ya existe
    alert("Error", message, "error");
});

// Manejar el evento de éxito de la creación de la partida
socket.on('partidaCreada', ({ nombre, numJugadores }) => {
    console.log(`Partida ${nombre} creada con ${numJugadores} jugadores.`);
    // Aquí puedes redirigir al usuario a la sala de juego o realizar alguna otra acción
});

// Manejar otros eventos y lógica del juego aquí
