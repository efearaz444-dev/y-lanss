const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// --- GENEL AYARLAR ---
const WORLD_SIZE = 3000;
const BOT_COLORS = ['#00ffcc', '#ff3366', '#ffcc00', '#33ff33', '#9933ff', '#ff9900'];
const POWERUP_TYPES = ['magnet', 'shield', '2x'];
const rooms = {};

// Statik dosyaları sun (HTML, CSS, JS) ve Ana Sayfa Yönlendirmesi
app.use(express.static(__dirname));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// --- YARDIMCI FONKSİYONLAR ---

function spawnPowerUp(roomCode) {
    if (!rooms[roomCode]) return;
    
    rooms[roomCode].powerups.push({
        id: Math.random(),
        type: POWERUP_TYPES[Math.floor(Math.random() * POWERUP_TYPES.length)],
        x: Math.random() * 2800 + 100,
        y: Math.random() * 2800 + 100
    });
    
    io.to(roomCode).emit('updatePowerups', rooms[roomCode].powerups);
}

function spawnBot(roomCode) {
    if (!rooms[roomCode]) return;
    
    const botId = 'bot_' + Math.random().toString(36).substr(2, 9);
    
    rooms[roomCode].players[botId] = {
        id: botId, 
        name: `Bot ${Math.floor(Math.random() * 90 + 10)}`,
        color: BOT_COLORS[Math.floor(Math.random() * BOT_COLORS.length)],
        hat: ['crown', 'headphones', 'cap', 'horns', 'none'][Math.floor(Math.random() * 5)],
        flag: 'none',
        x: Math.random() * 2600 + 200, 
        y: Math.random() * 2600 + 200,
        angle: Math.random() * Math.PI * 2, 
        score: 30, 
        length: 25, 
        body: [],
        isBot: true, 
        targetAngle: Math.random() * Math.PI * 2, 
        changeDirTimer: 0,
        kills: 0, 
        eatenFoods: 0, 
        emote: null, 
        emoteTimer: 0
    };
}

// --- SOKET (SOCKET.IO) BAĞLANTILARI ---

io.on('connection', (socket) => {
    
// Odaya Katılma İşlemi
    socket.on('joinRoom', ({ username, color, hat, roomCode, flag }) => {
        // Eğer oda kodu boşsa varsayılan 'main' yap
        const currentRoom = roomCode || 'main'; 
        
        socket.join(currentRoom);
        socket.roomCode = currentRoom;

        // Oda yoksa ilk defa oluştur
        if (!rooms[currentRoom]) {
            rooms[currentRoom] = { players: {}, foods: [], powerups: [] };
            
            // Başlangıç yemlerini oluştur (Lag'ı önlemek için 150 ideal)
            for (let i = 0; i < 150; i++) {
                rooms[currentRoom].foods.push({ 
                    id: Math.random(), 
                    x: Math.random() * 3000, 
                    y: Math.random() * 3000, 
                    radius: Math.random() * 3 + 3, 
                    color: `hsl(${Math.random() * 360}, 100%, 60%)` 
                });
            }

            // BOTLAR TAMAMEN KALDIRILDI! (Artık hiç bot doğmayacak)

            // Sadece güçlendirmeleri oluştur
            for (let i = 0; i < 3; i++) spawnPowerUp(currentRoom);
        }

        // Oyuncuyu odaya kaydet
        rooms[currentRoom].players[socket.id] = {
            id: socket.id, 
            name: username || 'Oyuncu', 
            color: color || '#00ffcc', 
            hat: hat || 'none',
            flag: flag || 'none',
            x: Math.random() * 2000 + 500, 
            y: Math.random() * 2000 + 500,
            angle: 0, 
            score: 20, 
            length: 20, 
            body: [], 
            isBot: false,
            kills: 0, 
            eatenFoods: 0, 
            emote: null, 
            emoteTimer: 0
        };

        // Oyuncuya oyun verilerini gönder
        socket.emit('initGame', { 
            id: socket.id, 
            roomCode: currentRoom, 
            foods: rooms[currentRoom].foods, 
            powerups: rooms[currentRoom].powerups 
        });
    });

    // Oyuncu Hareketi ve Güncelleme
    socket.on('playerUpdate', (data) => {
        if (rooms[socket.roomCode] && rooms[socket.roomCode].players[socket.id]) {
            Object.assign(rooms[socket.roomCode].players[socket.id], data);
        }
    });

    // Emote (Mesaj/Emoji) Gönderimi
    socket.on('sendEmote', (emote) => {
        const room = rooms[socket.roomCode];
        if (room && room.players[socket.id]) {
            room.players[socket.id].emote = emote;
            room.players[socket.id].emoteTimer = 60; // ~3 saniye

            io.to(socket.roomCode).emit('playerEmote', {
                id: socket.id,
                emote: emote
            });
        }
    });

    // Ölüm Sistemi (Sıfırlanmama & Kendi Yemini Yeme Bug'ı Çözüldü)
    socket.on('imDead', (killerId) => {
        const room = rooms[socket.roomCode];
        if (room && room.players[socket.id]) {
            const p = room.players[socket.id];
            
            // Katilin öldürme sayısını artır
            if (killerId && room.players[killerId]) {
                room.players[killerId].kills = (room.players[killerId].kills || 0) + 1;
            }

            // Ölen yılanı yeme çevir
            if (p.body && p.body.length > 0) {
                p.body.forEach((seg, i) => {
                    if (i % 2 === 0) {
                        room.foods.push({ 
                            id: Math.random(), 
                            x: seg.x + (Math.random() * 10 - 5), 
                            y: seg.y + (Math.random() * 10 - 5), 
                            radius: 6, 
                            color: p.color 
                        });
                    }
                });
            }
            
            // 1. Önce oyuncuyu sunucu hafızasından SIL
            delete room.players[socket.id]; 

            // 2. Haritadaki yeni yemleri HERKESE duyur
            io.to(socket.roomCode).emit('updateFoods', room.foods);

            // 3. Ölen oyuncuya Özel Ölüm Sinyali Yolla (Frontend sıfırlasın)
            socket.emit('youDied'); 
        }
    });

    // Hızlanınca (Boost) Yem Bırakma
    socket.on('dropFood', (f) => {
        if(rooms[socket.roomCode]) {
            rooms[socket.roomCode].foods.push({ 
                id: Math.random(), 
                x: f.x, 
                y: f.y, 
                radius: 4, 
                color: f.color 
            });
            io.to(socket.roomCode).emit('updateFoods', rooms[socket.roomCode].foods);
        }
    });

    // Yem Yeme Olayı
    socket.on('foodEaten', (foodId) => {
        const room = rooms[socket.roomCode];
        if (room) {
            const idx = room.foods.findIndex(f => f.id === foodId);
            if (idx !== -1) {
                if (room.players[socket.id]) {
                    room.players[socket.id].eatenFoods = (room.players[socket.id].eatenFoods || 0) + 1;
                }
                
                // Yenilen yemin yerine yenisini oluştur
                room.foods[idx] = { 
                    id: Math.random(), 
                    x: Math.random() * 3000, 
                    y: Math.random() * 3000, 
                    radius: Math.random() * 3 + 3, 
                    color: `hsl(${Math.random() * 360}, 100%, 60%)` 
                };
                io.to(socket.roomCode).emit('updateFoods', room.foods);
            }
        }
    });

    // Güçlendirme (Powerup) Yeme Olayı
    socket.on('powerupEaten', (pId) => {
        const room = rooms[socket.roomCode];
        if (room) {
            room.powerups = room.powerups.filter(p => p.id !== pId);
            io.to(socket.roomCode).emit('updatePowerups', room.powerups);
            
            setTimeout(() => spawnPowerUp(socket.roomCode), 10000);
        }
    });

    // Oyuncu Bağlantıyı Kestiğinde
    socket.on('disconnect', () => {
        if (rooms[socket.roomCode] && rooms[socket.roomCode].players[socket.id]) {
            delete rooms[socket.roomCode].players[socket.id];
        }
    });
});

// --- OYUN DÖNGÜSÜ VE BOT MANTIĞI (20 FPS - AKICI & SIFIR LAG) ---

setInterval(() => {
    Object.keys(rooms).forEach(roomCode => {
        const room = rooms[roomCode];
        const playersList = Object.values(room.players);
        
        playersList.forEach(p => {
            // Emote Silinme Kontrolü
            if (p.emoteTimer > 0) {
                p.emoteTimer--;
                if (p.emoteTimer <= 0) p.emote = null;
            }

            // Sadece Botlar İçin Geçerli Mekanikler
            if (p.isBot) {
                p.angle += (Math.random() - 0.5) * 0.3;
                p.x += Math.cos(p.angle) * 3.5;
                p.y += Math.sin(p.angle) * 3.5;

                // Bot Duvara Çarparsa Sekme
                if (p.x < 50 || p.x > WORLD_SIZE - 50) p.angle = Math.PI - p.angle;
                if (p.y < 50 || p.y > WORLD_SIZE - 50) p.angle = -p.angle;

                p.body = p.body || [];
                p.body.unshift({ x: p.x, y: p.y });
                while (p.body.length > p.length) p.body.pop();

                // Botların Çarpışma Kontrolü
                playersList.forEach(otherPlayer => {
                    if (otherPlayer.id !== p.id && otherPlayer.body && otherPlayer.body.length > 0) {
                        for (let i = 3; i < otherPlayer.body.length; i += 2) {
                            const seg = otherPlayer.body[i];
                            if (Math.hypot(p.x - seg.x, p.y - seg.y) < 16) {
                                otherPlayer.kills = (otherPlayer.kills || 0) + 1;
                                
                                p.body.forEach((bSeg, idx) => {
                                    if (idx % 2 === 0) {
                                        room.foods.push({
                                            id: Math.random(),
                                            x: bSeg.x + (Math.random() * 10 - 5),
                                            y: bSeg.y + (Math.random() * 10 - 5),
                                            radius: 6, color: p.color
                                        });
                                    }
                                });
                                
                                delete room.players[p.id];
                                spawnBot(roomCode);
                                io.to(roomCode).emit('updateFoods', room.foods);
                                return;
                            }
                        }
                    }
                });

                // Botların Yem Yemesi
                if (room.foods) {
                    room.foods.forEach((f, index) => {
                        const dist = Math.hypot(p.x - f.x, p.y - f.y);
                        if (dist < f.radius + 14) {
                            p.score += Math.max(1, Math.round(f.radius));
                            p.length += f.radius * 0.1;
                            room.foods.splice(index, 1);
                            
                            room.foods.push({
                                id: Math.random(),
                                x: Math.random() * 2900 + 50,
                                y: Math.random() * 2900 + 50,
                                radius: Math.random() * 4 + 3,
                                color: ['#00ffcc', '#ff3366', '#ffcc00', '#33ff33'][Math.floor(Math.random() * 4)]
                            });
                        }
                    });
                }
            }
        });
        
        // Her karede oyuncu verilerini odaya yayınla
        io.to(roomCode).emit('updatePlayers', room.players);
    });
}, 1000 / 20);

// --- SUNUCUYU BAŞLAT ---
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`🚀 ULTRA Sunucu devrede! PORT: ${PORT}`));