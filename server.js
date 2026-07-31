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

const rooms = {};

io.on('connection', (socket) => {
    console.log(`플레이어 연결: ${socket.id}`);

    socket.on('joinRoom', (data) => {
        const { nickname, color, roomId } = data;
        socket.roomId = roomId || 'tps-room';
        socket.join(socket.roomId);

        if (!rooms[socket.roomId]) {
            rooms[socket.roomId] = { players: {} };
        }

        rooms[socket.roomId].players[socket.id] = {
            id: socket.id,
            nickname: nickname || '용사',
            color: color || '#e67e22',
            x: (Math.random() - 0.5) * 10,
            y: 0,
            z: (Math.random() - 0.5) * 10,
            rotationY: 0,
            hp: 100,
            score: 0
        };

        socket.emit('currentPlayers', rooms[socket.roomId].players);
        socket.broadcast.to(socket.roomId).emit('newPlayer', rooms[socket.roomId].players[socket.id]);
    });

    socket.on('playerUpdate', (data) => {
        const roomId = socket.roomId;
        if (roomId && rooms[roomId] && rooms[roomId].players[socket.id]) {
            const p = rooms[roomId].players[socket.id];
            p.x = data.x;
            p.y = data.y;
            p.z = data.z;
            p.rotationY = data.rotationY;
            socket.broadcast.to(roomId).emit('playerMoved', p);
        }
    });

    socket.on('shoot', (data) => {
        const roomId = socket.roomId;
        if (roomId && rooms[roomId]) {
            socket.broadcast.to(roomId).emit('playerShooting', {
                id: socket.id,
                x: data.x,
                y: data.y,
                z: data.z,
                dirX: data.dirX,
                dirY: data.dirY,
                dirZ: data.dirZ
            });
        }
    });

    socket.on('hitPlayer', (targetId) => {
        const roomId = socket.roomId;
        if (roomId && rooms[roomId] && rooms[roomId].players[targetId]) {
            const target = rooms[roomId].players[targetId];
            target.hp -= 25; // 총알 데미지
            
            if (target.hp <= 0) {
                target.hp = 100;
                target.x = (Math.random() - 0.5) * 12;
                target.z = (Math.random() - 0.5) * 12;
                if (rooms[roomId].players[socket.id]) {
                    rooms[roomId].players[socket.id].score += 1;
                }
            }
            io.to(roomId).emit('updateStats', rooms[roomId].players);
        }
    });

    socket.on('disconnect', () => {
        const roomId = socket.roomId;
        if (roomId && rooms[roomId]) {
            delete rooms[roomId].players[socket.id];
            socket.broadcast.to(roomId).emit('playerDisconnected', socket.id);

            if (Object.keys(rooms[roomId].players).length === 0) {
                delete rooms[roomId];
            }
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`TPS 게임 서버 실행 중... 포트: ${PORT}`);
});
