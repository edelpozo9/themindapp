// public/app.js
const socket = io();

socket.on('connect', () => {
    console.log('Conectado al servidor');
});

// Manejar otros eventos y lógica del juego aquí

// Event listener para el botón de iniciar juego
document.getElementById('startGame').addEventListener('click', () => {
    // Aquí puedes agregar la lógica para unirte a una partida
    console.log('Intentando unirme a una partida...');
});