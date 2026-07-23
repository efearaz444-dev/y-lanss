const socket = io();
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

let myId = null;
let roomCode = 'GLOBAL';
let players = {};
let foods = [];
let powerups = [];
const WORLD_SIZE = 3000;

let isPlaying = false;
let isDead = false;
let screenShake = 0;
let userXP = 0;
let userLevel = 1;

let selectedColor = '#00ffcc';
let selectedHat = 'none';
let selectedFlag = '🇹🇷';

const activePowerups = { magnet: 0, shield: 0, double: 0 };
const mouse = { x: 0, y: 0 };
let isBoosting = false;

// --- SES EFEKTLERİ ---
let audioCtx = null;
function initAudio() {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
}

function playEatSound() {
    initAudio(); if (!audioCtx) return;
    const osc = audioCtx.createOscillator(); const gain = audioCtx.createGain();
    osc.type = 'sine'; osc.frequency.setValueAtTime(600, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(1100, audioCtx.currentTime + 0.08);
    gain.gain.setValueAtTime(0.12, audioCtx.currentTime); gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.08);
    osc.connect(gain); gain.connect(audioCtx.destination);
    osc.start(); osc.stop(audioCtx.currentTime + 0.08);
}

function playExplodeSound() {
    initAudio(); if (!audioCtx) return;
    const osc = audioCtx.createOscillator(); const gain = audioCtx.createGain();
    osc.type = 'sawtooth'; osc.frequency.setValueAtTime(180, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(30, audioCtx.currentTime + 0.35);
    gain.gain.setValueAtTime(0.3, audioCtx.currentTime); gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.35);
    osc.connect(gain); gain.connect(audioCtx.destination);
    osc.start(); osc.stop(audioCtx.currentTime + 0.35);
}

function playPowerupSound() {
    initAudio(); if (!audioCtx) return;
    const osc = audioCtx.createOscillator(); const gain = audioCtx.createGain();
    osc.type = 'triangle'; osc.frequency.setValueAtTime(400, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(800, audioCtx.currentTime + 0.2);
    gain.gain.setValueAtTime(0.2, audioCtx.currentTime); gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.2);
    osc.connect(gain); gain.connect(audioCtx.destination);
    osc.start(); osc.stop(audioCtx.currentTime + 0.2);
}

function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

window.sendEmote = function(msg) {
    if (typeof socket !== 'undefined' && socket) {
        socket.emit('sendEmote', msg);
    }
};

// --- MENÜYE DÖN FONKSİYONU ---
function goToMainMenu() {
    initAudio();
    window.location.reload();
}

// --- UI VE BUTON OLAYLARI ---
document.addEventListener('DOMContentLoaded', () => {
    const colors = ['#00ffcc', '#ff3366', '#ffcc00', '#33ff33', '#9933ff', '#ff9900'];
    const colorPicker = document.getElementById('color-picker');
    if(colorPicker) {
        colors.forEach((c, i) => {
            const btn = document.createElement('div');
            btn.className = 'color-btn' + (i === 0 ? ' selected' : '');
            btn.style.backgroundColor = c;
            btn.addEventListener('click', () => {
                initAudio();
                document.querySelectorAll('.color-btn').forEach(b => b.classList.remove('selected'));
                btn.classList.add('selected');
                selectedColor = c;
            });
            colorPicker.appendChild(btn);
        });
    }

    document.querySelectorAll('.hat-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            initAudio();
            document.querySelectorAll('.hat-btn').forEach(b => b.classList.remove('selected'));
            btn.classList.add('selected');
            selectedHat = btn.dataset.hat;
        });
    });

    document.querySelectorAll('.flag-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.flag-btn').forEach(b => b.classList.remove('selected'));
            e.currentTarget.classList.add('selected');
            selectedFlag = e.currentTarget.getAttribute('data-flag');
        });
    });

    const startBtn = document.getElementById('start-btn');
    if (startBtn) {
        startBtn.addEventListener('click', () => {
            startGame();
        });
    }

    // Menüye Dön Buton Dinleyicileri (Farklı ID ihtimallerine karşı garanti çözüm)
    ['menu-btn', 'main-menu-btn', 'home-btn', 'back-btn'].forEach(id => {
        const btn = document.getElementById(id);
        if (btn) {
            btn.addEventListener('click', () => {
                goToMainMenu();
            });
        }
    });

    const restartBtn = document.getElementById('restart-btn');
    if (restartBtn) {
        restartBtn.addEventListener('click', () => {
            initAudio();
            const gameOverScreen = document.getElementById('game-over-screen');
            if (gameOverScreen) gameOverScreen.style.display = 'none';
            startGame();
        });
    }

    document.querySelectorAll('.chat-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const msg = btn.getAttribute('data-msg');
            window.sendEmote(msg);
        });
    });
});

function safeSetStyle(id, property, value) {
    const el = document.getElementById(id);
    if (el) el.style[property] = value;
}

function safeSetText(id, text) {
    const el = document.getElementById(id);
    if (el) el.innerText = text;
}

function startGame() {
    const usernameEl = document.getElementById('username');
    const roomInputEl = document.getElementById('room-input');

    const username = (usernameEl && usernameEl.value.trim()) ? usernameEl.value.trim() : 'Oyuncu';
    const roomVal = (roomInputEl && roomInputEl.value.trim()) ? roomInputEl.value.trim().toUpperCase() : 'GLOBAL';
    roomCode = roomVal !== '' ? roomVal : 'GLOBAL';
    
    socket.emit('joinRoom', { 
        username: username, 
        color: selectedColor, 
        hat: selectedHat,
        roomCode: roomCode,
        flag: selectedFlag 
    });

    safeSetStyle('start-screen', 'display', 'none');
    safeSetStyle('game-over-screen', 'display', 'none');
    safeSetStyle('hud', 'display', 'block');
    safeSetStyle('room-tag', 'display', 'block'); 
    safeSetStyle('chat-menu', 'display', 'flex');
    safeSetText('current-room-code', roomCode);
    
    isDead = false;
    isPlaying = true;
}

function getCurrentTitle() {
    if (userLevel >= 15) return "🐉 Ejderha Solucan";
    if (userLevel >= 10) return "👑 Solucan Kralı";
    if (userLevel >= 5) return "🐍 Piton Solucan";
    return "🌱 Çaylak Solucan";
}

function addXP(amount) {
    if(amount <= 0) return;
    userXP += amount;
    const nextLevelXP = userLevel * 200;
    if (userXP >= nextLevelXP) {
        userXP -= nextLevelXP;
        userLevel++;
    }
    safeSetText('level-val', userLevel);
    safeSetText('title-val', getCurrentTitle());
}

window.addEventListener('mousemove', (e) => {
    mouse.x = e.clientX - canvas.width / 2;
    mouse.y = e.clientY - canvas.height / 2;
});

canvas.addEventListener('mousedown', () => { initAudio(); isBoosting = true; });
window.addEventListener('mouseup', () => { isBoosting = false; });

socket.on('initGame', (data) => {
    myId = data.id;
    roomCode = data.roomCode || roomCode;
    safeSetText('current-room-code', roomCode);
    foods = data.foods || [];
    powerups = data.powerups || [];
});

socket.on('youDied', () => {
    // Oyuncu öldüğünde frontend nesnelerini tamamen temizle
    if (typeof mySnake !== 'undefined') mySnake = null;
    isAlive = false;
    
    // Oyun bitti menüsünü ekrana getir
    const gameOverScreen = document.getElementById('gameOverScreen');
    if (gameOverScreen) gameOverScreen.style.display = 'block';
});

socket.on('updatePlayers', (serverPlayers) => {
    Object.keys(serverPlayers).forEach(id => {
        if (!players[id]) {
            players[id] = serverPlayers[id];
        } else {
            if (id !== myId) {
                players[id].x += (serverPlayers[id].x - players[id].x) * 0.4;
                players[id].y += (serverPlayers[id].y - players[id].y) * 0.4;
                players[id].angle = serverPlayers[id].angle;
                players[id].body = serverPlayers[id].body;
                players[id].score = serverPlayers[id].score;
                players[id].length = serverPlayers[id].length;
                players[id].emote = serverPlayers[id].emote;
            }
        }
    });
    Object.keys(players).forEach(id => {
        if (!serverPlayers[id]) delete players[id];
    });
});

socket.on('playerEmote', (data) => {
    if (players[data.id]) {
        players[data.id].emote = data.emote;
        setTimeout(() => {
            if (players[data.id]) players[data.id].emote = null;
        }, 2500);
    }
});

socket.on('updateFoods', (serverFoods) => { foods = serverFoods; });
socket.on('updatePowerups', (serverPowerups) => { powerups = serverPowerups; });

function drawGrid(camera) {
    ctx.strokeStyle = '#121220'; ctx.lineWidth = 1;
    const gridSize = 40;
    const startX = Math.floor(camera.x / gridSize) * gridSize;
    const startY = Math.floor(camera.y / gridSize) * gridSize;
    
    for (let x = startX; x < startX + canvas.width + gridSize; x += gridSize) {
        ctx.beginPath(); ctx.moveTo(x - camera.x, 0); ctx.lineTo(x - camera.x, canvas.height); ctx.stroke();
    }
    for (let y = startY; y < startY + canvas.height + gridSize; y += gridSize) {
        ctx.beginPath(); ctx.moveTo(0, y - camera.y); ctx.lineTo(canvas.width, y - camera.y); ctx.stroke();
    }
    ctx.strokeStyle = '#ff3366'; ctx.lineWidth = 5;
    ctx.strokeRect(-camera.x, -camera.y, WORLD_SIZE, WORLD_SIZE);
}

// --- HARİTA (MINIMAP) ÇİZİMİ ---
function drawMinimap() {
    const mapSize = 120;
    const mapX = canvas.width - mapSize - 20;
    const mapY = canvas.height - mapSize - 70;

    ctx.save();
    ctx.fillStyle = 'rgba(5, 5, 12, 0.85)';
    ctx.fillRect(mapX, mapY, mapSize, mapSize);
    ctx.strokeStyle = '#00ffcc';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(mapX, mapY, mapSize, mapSize);

    Object.values(players).forEach(p => {
        if (!p) return;
        const miniX = mapX + (p.x / WORLD_SIZE) * mapSize;
        const miniY = mapY + (p.y / WORLD_SIZE) * mapSize;

        ctx.beginPath();
        if (p.id === myId) {
            ctx.arc(miniX, miniY, 3.5, 0, Math.PI * 2);
            ctx.fillStyle = '#00ffcc';
            ctx.shadowBlur = 8;
            ctx.shadowColor = '#00ffcc';
        } else {
            ctx.arc(miniX, miniY, 2, 0, Math.PI * 2);
            ctx.fillStyle = '#ff3366';
            ctx.shadowBlur = 0;
        }
        ctx.fill();
    });

    ctx.restore();
}

function drawHat(ctx, hat, x, y, angle) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle + Math.PI/2);
    ctx.font = "18px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    let hatIcon = "";
    if(hat === 'crown') hatIcon = "👑";
    if(hat === 'headphones') hatIcon = "🎧";
    if(hat === 'cap') hatIcon = "🧢";
    if(hat === 'horns') hatIcon = "😈";
    ctx.fillText(hatIcon, 0, -12);
    ctx.restore();
}

// --- OYUN RENDER DÖNGÜSÜ ---
function loop() {
    ctx.fillStyle = '#050508'; 
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (isPlaying && players[myId] && !isDead) {
        const me = players[myId];
        const zoom = Math.max(0.6, 1 - ((me.length || 20) * 0.001));
        ctx.save();
        
        if (screenShake > 0) {
            ctx.translate((Math.random()-0.5)*screenShake, (Math.random()-0.5)*screenShake);
            screenShake *= 0.9;
        }

        const camera = { x: me.x - (canvas.width / 2) / zoom, y: me.y - (canvas.height / 2) / zoom };
        ctx.scale(zoom, zoom);

        drawGrid(camera);

        if(activePowerups.shield > 0) activePowerups.shield--;
        if(activePowerups.magnet > 0) activePowerups.magnet--;
        if(activePowerups.double > 0) activePowerups.double--;

        const speed = (isBoosting && me.length > 15) ? 6.5 : 3.5;
        const angle = Math.atan2(mouse.y, mouse.x);
        me.x += Math.cos(angle) * speed; 
        me.y += Math.sin(angle) * speed;
        me.x = Math.max(15, Math.min(WORLD_SIZE-15, me.x)); 
        me.y = Math.max(15, Math.min(WORLD_SIZE-15, me.y));
        
        me.body = me.body || [];
        me.body.unshift({ x: me.x, y: me.y });
        
        if (isBoosting && me.length > 15 && Math.random() < 0.2) {
            me.length -= 0.3; me.score = Math.max(0, me.score - 1);
            socket.emit('dropFood', { x: me.x - Math.cos(angle)*30, y: me.y - Math.sin(angle)*30, color: me.color });
        }
        while (me.body.length > me.length) me.body.pop();
        
        socket.emit('playerUpdate', { x: me.x, y: me.y, body: me.body, angle, length: me.length, score: me.score });

        // Çarpışmalar
        if (activePowerups.shield <= 0) {
            Object.values(players).forEach(p => {
                if (p.id !== myId && p.body) {
                    for (let i = 3; i < p.body.length; i += 2) {
                        if (p.body[i] && Math.hypot(me.x - p.body[i].x, me.y - p.body[i].y) < 14) {
                            isDead = true; isPlaying = false;
                            screenShake = 20;
                            playExplodeSound();
                            socket.emit('imDead', p.id);
                            addXP(Math.floor(me.score));

                            safeSetStyle('hud', 'display', 'none');
                            safeSetStyle('room-tag', 'display', 'none');
                            safeSetStyle('chat-menu', 'display', 'none');
                            
                            safeSetText('final-score', Math.floor(me.score));
                            safeSetText('final-kills', me.kills || 0);
                            safeSetText('final-food', me.eatenFoods || 0);
                            safeSetText('final-gold', Math.floor(me.score * 1.5));
                            
                            safeSetStyle('game-over-screen', 'display', 'flex');
                        }
                    }
                }
            });
        }

        // Powerup
        powerups.forEach(p => {
            ctx.beginPath(); ctx.arc(p.x - camera.x, p.y - camera.y, 12, 0, Math.PI*2);
            ctx.fillStyle = p.type==='shield'?'#00ffcc':p.type==='magnet'?'#ffcc00':'#ff3366';
            ctx.shadowBlur = 15; ctx.shadowColor = ctx.fillStyle; ctx.fill(); ctx.shadowBlur = 0;
            ctx.fillStyle = '#000'; ctx.font="10px Arial"; ctx.textAlign="center";
            ctx.fillText(p.type==='shield'?'🛡️':p.type==='magnet'?'🧲':'2X', p.x - camera.x, p.y - camera.y + 3);

            if(Math.hypot(me.x - p.x, me.y - p.y) < 20) {
                activePowerups[p.type === '2x' ? 'double' : p.type] = 300;
                playPowerupSound();
                socket.emit('powerupEaten', p.id);
            }
        });

        // Yemler
        foods.forEach(f => {
            if (activePowerups.magnet > 0 && Math.hypot(me.x - f.x, me.y - f.y) < 180) {
                f.x += (me.x - f.x) * 0.1; f.y += (me.y - f.y) * 0.1;
            }
            ctx.beginPath(); ctx.arc(f.x - camera.x, f.y - camera.y, f.radius, 0, Math.PI * 2);
            ctx.fillStyle = f.color; ctx.shadowBlur = 8; ctx.shadowColor = f.color; ctx.fill(); ctx.shadowBlur = 0;

            if (!isDead && Math.hypot(me.x - f.x, me.y - f.y) < f.radius + 14) {
                const gain = (activePowerups.double > 0 ? 2 : 1);
                me.length += f.radius * 0.1 * gain; 
                me.score += Math.max(1, Math.round(f.radius)) * gain;
                playEatSound();
                socket.emit('foodEaten', f.id);
            }
        });

        // Oyuncuları Çiz
        Object.values(players).forEach(p => {
            if (!p || !p.body || p.body.length === 0) return;
            const thickness = Math.min(22, 14 + p.length * 0.02);

            for (let i = p.body.length - 1; i >= 0; i--) {
                const seg = p.body[i];
                if(!seg) continue;
                ctx.beginPath(); ctx.arc(seg.x - camera.x, seg.y - camera.y, Math.max(2, thickness - (i*0.03)), 0, Math.PI * 2);
                ctx.fillStyle = i === 0 ? '#fff' : p.color;
                ctx.shadowBlur = i===0 ? 12 : 0; ctx.shadowColor = p.color;
                ctx.fill(); ctx.shadowBlur = 0;
            }
            
            if(p.body[0]) {
                const headX = p.body[0].x - camera.x, headY = p.body[0].y - camera.y, pAngle = p.angle || 0;
                ctx.fillStyle = '#000';
                ctx.beginPath(); ctx.arc(headX + Math.cos(pAngle - 0.5) * 7, headY + Math.sin(pAngle - 0.5) * 7, 3, 0, Math.PI*2); ctx.fill();
                ctx.beginPath(); ctx.arc(headX + Math.cos(pAngle + 0.5) * 7, headY + Math.sin(pAngle + 0.5) * 7, 3, 0, Math.PI*2); ctx.fill();
                if(p.hat && p.hat !== 'none') drawHat(ctx, p.hat, headX, headY, pAngle);
            }

            const flagText = (p.flag && p.flag !== 'none') ? p.flag + ' ' : '';
            const playerName = p.name || 'Oyuncu';
            ctx.fillStyle = '#ffffff'; 
            ctx.font = "bold 13px Arial"; 
            ctx.textAlign = "center";
            ctx.fillText(flagText + playerName, p.x - camera.x, p.y - camera.y - 28);

            // Emote Bulutu
            if (p.emote) {
                ctx.font = "bold 20px Arial";
                ctx.fillStyle = "#00ffcc";
                ctx.fillText(p.emote, p.x - camera.x, p.y - camera.y - 50);
            }
        });

        ctx.restore();

        // LİDERLİK TABLOSU
        const lbX = canvas.width - 220;
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(lbX, 20, 200, 180);
        ctx.strokeStyle = '#00ffcc'; ctx.strokeRect(lbX, 20, 200, 180);
        
        ctx.fillStyle = '#00ffcc'; 
        ctx.font = "bold 13px Arial"; 
        ctx.textAlign = "center";
        ctx.fillText("LİDERLİK TABLOSU", lbX + 100, 42);
        
        const sorted = Object.values(players).sort((a,b) => b.score - a.score).slice(0, 5);
        ctx.textAlign = "left";
        sorted.forEach((p, idx) => {
            ctx.fillStyle = p.id === myId ? '#ffcc00' : '#fff';
            ctx.font = "12px Arial";
            ctx.fillText(`${idx+1}. ${p.name || 'Oyuncu'}: ${Math.floor(p.score)}`, lbX + 15, 75 + (idx * 24));
        });

        // HARİTAYI ÇİZİCİ ÇAĞRILDI
        drawMinimap();

        safeSetText('score-val', Math.floor(me.score || 0));
    }
    requestAnimationFrame(loop);
}

loop();