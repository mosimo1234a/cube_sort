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

// 알고리즘 퍼즐 생성 (버블, 선택, 삽입 중 랜덤)
function generatePuzzle() {
    const types = ['bubble', 'selection', 'insertion'];
    const type = types[Math.floor(Math.random() * types.length)];
    
    let numbers = [
        Math.floor(Math.random() * 9) + 1,
        Math.floor(Math.random() * 9) + 1,
        Math.floor(Math.random() * 9) + 1,
        Math.floor(Math.random() * 9) + 1
    ];
    
    let answer = [...numbers].sort((a, b) => a - b);
    return { type, numbers, answer };
}

io.on('connection', (socket) => {
    console.log(`플레이어 연결: ${socket.id}`);

    socket.on('joinRoom', (data) => {
        const { nickname, color, roomId } = data;
        socket.roomId = roomId || 'default-room';
        socket.join(socket.roomId);

        if (!rooms[socket.roomId]) {
            rooms[socket.roomId] = {
                players: {},
                switches: { 1: false, 2: false },
                puzzle: generatePuzzle(),
                isSolved: false
            };
        }

        rooms[socket.roomId].players[socket.id] = {
            id: socket.id,
            nickname: nickname || '모험가',
            color: color || '#e67e22',
            x: 0, y: 0, z: 0, rotationY: 0
        };

        socket.emit('currentPlayers', rooms[socket.roomId].players);
        socket.emit('roomState', {
            isSolved: rooms[socket.roomId].isSolved,
            puzzleType: rooms[socket.roomId].puzzle.type,
            numbers: rooms[socket.roomId].puzzle.numbers,
            switches: rooms[socket.roomId].switches
        });

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

    socket.on('updateSwitch', (data) => {
        const roomId = socket.roomId;
        if (roomId && rooms[roomId]) {
            rooms[roomId].switches[data.switchId] = data.pressed;
            io.to(roomId).emit('switchStateUpdate', rooms[roomId].switches);
        }
    });

    socket.on('submitPuzzle', (userAnswer) => {
        const roomId = socket.roomId;
        if (roomId && rooms[roomId]) {
            const correctAns = rooms[roomId].puzzle.answer;
            const isCorrect = userAnswer.length === correctAns.length && userAnswer.every((val, idx) => val === correctAns[idx]);

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
