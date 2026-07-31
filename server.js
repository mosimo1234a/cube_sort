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

const rooms = {}; // 방별 플레이어 및 퍼즐 상태 관리

io.on('connection', (socket) => {
    console.log(`플레이어 연결됨: ${socket.id}`);

    socket.on('joinRoom', (data) => {
        const { nickname, color, roomId } = data;
        socket.roomId = roomId || 'default-room';
        socket.join(socket.roomId);

        if (!rooms[socket.roomId]) {
            rooms[socket.roomId] = {
                players: {},
                isSolved: false
            };
        }

        rooms[socket.roomId].players[socket.id] = {
            id: socket.id,
            nickname: nickname || '네모',
            color: color || '#ffd700',
            x: 0, y: 0, z: 0, rotationY: 0
        };

        // 현재 방의 플레이어 정보 및 퍼즐 상태 전송
        socket.emit('currentPlayers', rooms[socket.roomId].players);
        socket.emit('roomState', { isSolved: rooms[socket.roomId].isSolved });
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

    socket.on('submitPuzzle', (sequence) => {
        const roomId = socket.roomId;
        // 정답 순서: 빨강(Red) -> 초록(Green) -> 파랑(Blue) -> 노랑(Yellow)
        const correctSequence = ['red', 'green', 'blue', 'yellow'];
        
        if (roomId && rooms[roomId]) {
            const isCorrect = sequence.every((val, index) => val === correctSequence[index]);
            if (isCorrect) {
                rooms[roomId].isSolved = true;
                io.to(roomId).emit('puzzleSolved');
            } else {
                socket.emit('puzzleFailed');
            }
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
    console.log(`서버 실행 중... 포트: ${PORT}`);
});
