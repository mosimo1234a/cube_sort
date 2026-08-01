const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public'));

const players = {};

io.on('connection', (socket) => {
    console.log(`플레이어 접속: ${socket.id}`);

    socket.on('joinRoom', (data) => {
        const { roomId, nickname, color } = data;
        socket.join(roomId);
        socket.roomId = roomId;

        players[socket.id] = {
            id: socket.id,
            roomId: roomId,
            nickname: nickname || '초코총잡이',
            color: color || '#d4a373',
            x: (Math.random() - 0.5) * 20,
            y: 0,
            z: (Math.random() - 0.5) * 20,
            rotationY: 0,
            hp: 100,
            score: 0
        };

        const roomPlayers = {};
        Object.keys(players).forEach(id => {
            if (players[id].roomId === roomId) {
                roomPlayers[id] = players[id];
            }
        });
        socket.emit('currentPlayers', roomPlayers);
        socket.to(roomId).emit('newPlayer', players[socket.id]);
    });

    socket.on('playerUpdate', (data) => {
        if (players[socket.id]) {
            players[socket.id].x = data.x;
            players[socket.id].y = data.y;
            players[socket.id].z = data.z;
            players[socket.id].rotationY = data.rotationY;

            socket.to(socket.roomId).emit('playerMoved', {
                id: socket.id,
                x: data.x,
                y: data.y,
                z: data.z,
                rotationY: data.rotationY
            });
        }
    });

    socket.on('shoot', (data) => {
        if (players[socket.id]) {
            socket.to(socket.roomId).emit('playerShooting', {
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
        if (players[targetId] && players[socket.id]) {
            players[targetId].hp -= 25; // 4발 맞으면 사망

            if (players[targetId].hp <= 0) {
                players[targetId].hp = 100; // 부활
                players[targetId].x = (Math.random() - 0.5) * 20;
                players[targetId].z = (Math.random() - 0.5) * 20;
                players[socket.id].score += 1; // 맞춘 사람 점수 획득
            }

            const roomPlayers = {};
            Object.keys(players).forEach(id => {
                if (players[id].roomId === socket.roomId) {
                    roomPlayers[id] = players[id];
                }
            });
            io.to(socket.roomId).emit('updateStats', roomPlayers);
            
            // 맞은 플레이어에게 피격 신호 전송
            io.to(targetId).emit('damaged');
        }
    });

    socket.on('disconnect', () => {
        console.log(`플레이어 퇴장: ${socket.id}`);
        if (players[socket.id]) {
            const roomId = players[socket.id].roomId;
            delete players[socket.id];
            io.to(roomId).emit('playerDisconnected', socket.id);
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`🍫 밀크초코 아레나 서버 실행 중: http://localhost:${PORT}`);
});
