const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: "*" }
});

app.use(express.static(path.join(__dirname, 'public')));

const players = {};

io.on('connection', (socket) => {
    console.log(`플레이어 접속: ${socket.id}`);

    socket.on('joinGame', (data) => {
        players[socket.id] = {
            id: socket.id,
            nickname: data.nickname || '네모',
            color: data.color || '#ffd700', // 선택한 색상 저장
            x: 0,
            y: 0,
            z: 0,
            rotationY: 0
        };

        socket.emit('currentPlayers', players);
        socket.broadcast.emit('newPlayer', players[socket.id]);
    });

    socket.on('playerUpdate', (data) => {
        if (players[socket.id]) {
            players[socket.id].x = data.x;
            players[socket.id].y = data.y;
            players[socket.id].z = data.z;
            players[socket.id].rotationY = data.rotationY;

            socket.broadcast.emit('playerMoved', players[socket.id]);
        }
    });

    socket.on('disconnect', () => {
        console.log(`플레이어 퇴장: ${socket.id}`);
        delete players[socket.id];
        io.emit('playerDisconnected', socket.id);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`서버 실행 중... 포트: ${PORT}`);
});
