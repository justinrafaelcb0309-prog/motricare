const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);

// Configuración del Socket
const io = new Server(server, {
    cors: {
        origin: "*", // Permite que tu celular se conecte sin bloqueos
    }
});

io.on('connection', (socket) => {
    console.log('✅ Un usuario se conectó: ' + socket.id);

    // Escucha el evento 'mensaje' que viene de tu App
    socket.on('mensaje', (data) => {
        console.log('📩 Mensaje recibido de ' + data.usuario.nombre + ': ' + data.texto);
        
        // Reenvía el mensaje a TODOS los demás conectados (el Fisio)
        socket.broadcast.emit('mensaje', data);
    });

    socket.on('disconnect', () => {
        console.log('❌ Usuario desconectado');
    });
});

// Arranca el servidor en el puerto 3000
server.listen(3000, '0.0.0.0', () => {
    console.log('🚀 Servidor de MotriCare corriendo en el puerto 3000');
});