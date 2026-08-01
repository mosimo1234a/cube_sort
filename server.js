const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public'));

const rooms = {};

io.on('connection', (socket) => {
    console.log('유저 접속:', socket.id);
    let currentRoom = null;

    socket.on('joinRoom', (data) => {
        currentRoom = data.roomId;
        socket.join(currentRoom);

        if (!rooms[currentRoom]) {
            rooms[currentRoom] = { players: {} };
        }

        rooms[currentRoom].players[socket.id] = {
            id: socket.id,
            nickname: data.nickname || '초코총잡이',
            color: data.color || '#d4a373',
            x: 0,
            y: 0,
            z: 0,
            rotationY: 0,
            hp: 100,
            score: 0
        };

        socket.emit('currentPlayers', rooms[currentRoom].players);
        socket.to(currentRoom).emit('newPlayer', rooms[currentRoom].players[socket.id]);
    });

    socket.on('playerUpdate', (data) => {
        if (!currentRoom || !rooms[currentRoom] || !rooms[currentRoom].players[socket.id]) return;
        const p = rooms[currentRoom].players[socket.id];
        p.x = data.x;
        p.y = data.y;
        p.z = data.z;
        p.rotationY = data.rotationY;

        socket.to(currentRoom).emit('playerMoved', {
            id: socket.id,
            x: p.x,
            y: p.y,
            z: p.z,
            rotationY: p.rotationY
        });
    });

    socket.on('shoot', (data) => {
        if (!currentRoom) return;
        socket.to(currentRoom).emit('playerShooting', {
            id: socket.id,
            x: data.x,
            y: data.y,
            z: data.z,
            dirX: data.dirX,
            dirY: data.dirY,
            dirZ: data.dirZ
        });
    });

    // 🔥 총에 맞았을 때 체력 감소 및 사망/리스폰 처리
    socket.on('hitPlayer', (targetId) => {
        if (!currentRoom || !rooms[currentRoom]) return;
        const roomPlayers = rooms[currentRoom].players;
        const target = roomPlayers[targetId];
        const shooter = roomPlayers[socket.id];

        if (target) {
            target.hp -= 25; // 4발 맞으면 사망
            io.to(targetId).emit('damaged');

            if (target.hp <= 0) {
                target.hp = 100;
                target.x = (Math.random() - 0.5) * 16;
                target.z = (Math.random() - 0.5) * 16;
                target.y = 0;

                if (shooter && socket.id !== targetId) {
                    shooter.score += 1; // 킬 점수 획득
                }
            }

            io.to(currentRoom).emit('updateStats', roomPlayers);
        }
    });

    socket.on('disconnect', () => {
        console.log('유저 퇴장:', socket.id);
        if (currentRoom && rooms[currentRoom] && rooms[currentRoom].players[socket.id]) {
            delete rooms[currentRoom].players[socket.id];
            io.to(currentRoom).emit('playerDisconnected', socket.id);
            
            if (Object.keys(rooms[currentRoom].players).length === 0) {
                delete rooms[currentRoom];
            }
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`서버 실행 중: 포트 ${PORT}`);
});
