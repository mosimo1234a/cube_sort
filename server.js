const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: "*" }
});

// public 폴더의 정적 파일 제공
app.use(express.static(path.join(__dirname, 'public')));

// 접속한 플레이어 목록 관리
const players = {};

io.on('connection', (socket) => {
    console.log(`플레이어 접속: ${socket.id}`);

    // 게임 입장 처리
    socket.on('joinGame', (data) => {
        players[socket.id] = {
            id: socket.id,
            nickname: data.nickname || '네모',
            x: 0,
            y: 0,
            z: 0,
            rotationY: 0
        };

        // 기존 플레이어 목록 전송
        socket.emit('currentPlayers', players);

        // 다른 플레이어들에게 새 플레이어 알림
        socket.broadcast.emit('newPlayer', players[socket.id]);
    });

    // 위치 업데이트 처리
    socket.on('playerUpdate', (data) => {
        if (players[socket.id]) {
            players[socket.id].x = data.x;
            players[socket.id].y = data.y;
            players[socket.id].z = data.z;
            players[socket.id].rotationY = data.rotationY;

            // 위치 변경 사항 동기화
            socket.broadcast.emit('playerMoved', players[socket.id]);
        }
    });

    // 퇴장 처리
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