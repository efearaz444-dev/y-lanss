// OYUN EK ÖZELLİKLERİ VE GÖRSEL EFEKTLER MODÜLÜ

class GameFeatures {
    constructor() {
        // Ses Efektleri (Web Audio API - Dışarıdan dosya indirmeden ses üretir)
        this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }

    // 1. Yem Yeme Sesi
    playEatSound() {
        if (this.audioCtx.state === 'suspended') this.audioCtx.resume();
        const osc = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(600, this.audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(800, this.audioCtx.currentTime + 0.08);
        gain.gain.setValueAtTime(0.1, this.audioCtx.currentTime);
        gain.gain.linearRampToValueAtTime(0, this.audioCtx.currentTime + 0.08);
        osc.connect(gain);
        gain.connect(this.audioCtx.destination);
        osc.start();
        osc.stop(this.audioCtx.currentTime + 0.08);
    }

    // 2. Mini-Map (Küçük Radar Haritası) Çizimi
    drawMiniMap(ctx, canvasWidth, canvasHeight, worldSize, players, myId) {
        const mapSize = 120;
        const padding = 20;
        const mapX = canvasWidth - mapSize - padding;
        const mapY = canvasHeight - mapSize - padding;

        // Arka Plan
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.strokeStyle = 'rgba(0, 255, 200, 0.4)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(mapX + mapSize / 2, mapY + mapSize / 2, mapSize / 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Oyuncuları Nokta Olarak Çiz
        Object.values(players).forEach(p => {
            if (!p.x || !p.y) return;
            const pointX = mapX + (p.x / worldSize) * mapSize;
            const pointY = mapY + (p.y / worldSize) * mapSize;

            ctx.beginPath();
            ctx.arc(pointX, pointY, p.id === myId ? 3 : 2, 0, Math.PI * 2);
            ctx.fillStyle = p.id === myId ? '#00ffcc' : '#ff3366';
            ctx.fill();
        });
    }

    // 3. Canlı Skor Tablosu
    updateLeaderboard(players) {
        let leaderboardDiv = document.getElementById('leaderboard-box');
        if (!leaderboardDiv) {
            leaderboardDiv = document.createElement('div');
            leaderboardDiv.id = 'leaderboard-box';
            leaderboardDiv.style.cssText = `
                position: absolute; top: 20px; right: 20px;
                background: rgba(0,0,0,0.6); color: #fff;
                padding: 12px 18px; border-radius: 10px;
                font-family: sans-serif; font-size: 13px;
                border: 1px solid rgba(0,255,200,0.3); pointer-events: none;
            `;
            document.body.appendChild(leaderboardDiv);
        }

        const sorted = Object.values(players).sort((a, b) => (b.score || 0) - (a.score || 0)).slice(0, 5);
        let html = '<b style="color:#00ffcc;">LİDERLİK TABLOSU</b><ol style="margin-left:15px; margin-top:5px;">';
        sorted.forEach(p => {
            html += `<li>${p.name || 'Oyuncu'}: ${Math.floor(p.score || 0)}</li>`;
        });
        html += '</ol>';
        leaderboardDiv.innerHTML = html;
    }
}

const gameFeatures = new GameFeatures();