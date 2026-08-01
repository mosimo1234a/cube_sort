const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// public 폴더의 정적 파일(index.html 등) 서비스
app.use(express.static('public'));

const players = {}; // 접속한 플레이어들의 정보 저장

io.on('connection', (socket) => {
    console.log(`플레이어 접속: ${socket.id}`);

    // 방 입장 처리
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

        // 해당 방의 기존 플레이어 목록 전송
        const roomPlayers = {};
        Object.keys(players).forEach(id => {
            if (players[id].roomId === roomId) {
                roomPlayers[id] = players[id];
            }
        });
        socket.emit('currentPlayers', roomPlayers);

        // 다른 방원들에게 새 플레이어 입장 알림
        socket.to(roomId).emit('newPlayer', players[socket.id]);
    });

    // 위치 및 회전 동기화
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

    // 총알 발사 브로드캐스트
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

    // 피격 판정 및 점수 처리
    socket.on('hitPlayer', (targetId) => {
        if (players[targetId] && players[socket.id]) {
            players[targetId].hp -= 25; // 총알 당 25 데미지

            if (players[targetId].hp <= 0) {
                players[targetId].hp = 100; // 부활
                players[targetId].x = (Math.random() - 0.5) * 20;
                players[targetId].z = (Math.random() - 0.5) * 20;
                players[socket.id].score += 1; // 맞춘 사람 점수 획득
            }

            // 방 안의 모든 사람에게 체력/점수 업데이트 전송
            const roomPlayers = {};
            Object.keys(players).forEach(id => {
                if (players[id].roomId === socket.roomId) {
                    roomPlayers[id] = players[id];
                }
            });
            io.to(socket.roomId).emit('updateStats', roomPlayers);
        }
    });

    // 접속 종료 처리
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
