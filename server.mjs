import http from "http";
import path from "path";
import express from "express";
import { WebSocketServer } from "ws";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

const PORT = process.env.PORT || 3000;

// Раздаём всё из текущей папки (index.html, client.js, и т.п.)
app.use(express.static(__dirname));

// ====== ЛОГИКА ИГРЫ ======

let nextPlayerId = 1;
const players = new Map(); // id -> player

const SPEED = 220;
const TICK_RATE = 60;
const TICK_INTERVAL = 1000 / TICK_RATE;

// структура игрока:
// { id, x, y, vx, vy, name, color, chatText, chatUntil }

wss.on("connection", (ws) => {
    const id = nextPlayerId++;

    const spawnX = 400 + Math.random() * 200 - 100;
    const spawnY = 300 + Math.random() * 200 - 100;

    const player = {
        id,
        x: spawnX,
        y: spawnY,
        vx: 0,
        vy: 0,
        name: "Player " + id,
        color: "#" + Math.floor(Math.random() * 0xffffff)
            .toString(16)
            .padStart(6, "0"),
        chatText: "",
        chatUntil: 0
    };

    players.set(id, player);
    console.log(`Player ${id} connected`);

    // отправляем игроку его id
    ws.send(JSON.stringify({ type: "init", id }));

    ws.on("message", (raw) => {
        let data;
        try {
            data = JSON.parse(raw);
        } catch {
            return;
        }

        // движение
        if (data.type === "input") {
            const p = players.get(id);
            if (!p) return;

            let vx = 0, vy = 0;
            if (data.keys?.up) vy -= 1;
            if (data.keys?.down) vy += 1;
            if (data.keys?.left) vx -= 1;
            if (data.keys?.right) vx += 1;

            if (vx || vy) {
                const len = Math.hypot(vx, vy);
                vx /= len;
                vy /= len;
            }

            p.vx = vx * SPEED;
            p.vy = vy * SPEED;
        }

        // 💬 чат
        if (data.type === "chat") {
            const p = players.get(id);
            if (!p) return;

            let text = (data.text || "").toString().trim();

            // ограничиваем длину, без переносов строк
            text = text.replace(/\r?\n/g, " ").slice(0, 60);

            if (!text) return;

            p.chatText = text;
            p.chatUntil = Date.now() + 3000; // 3 секунды
        }
    });

    ws.on("close", () => {
        console.log(`Player ${id} disconnected`);
        players.delete(id);
    });
});

// игровой цикл сервера
let lastTime = Date.now();

setInterval(() => {
    const now = Date.now();
    const dt = (now - lastTime) / 1000;
    lastTime = now;

    for (const p of players.values()) {
        // позиция
        p.x += p.vx * dt;
        p.y += p.vy * dt;

        // убираем чат, если время вышло
        if (p.chatText && p.chatUntil && now > p.chatUntil) {
            p.chatText = "";
            p.chatUntil = 0;
        }
    }

    // рассылаем состояние всем
    const snapshot = {
        type: "state",
        players: Array.from(players.values()),
    };

    const payload = JSON.stringify(snapshot);

    for (const client of wss.clients) {
        if (client.readyState === 1) {
            client.send(payload);
        }
    }
}, TICK_INTERVAL);

server.listen(PORT, () => {
    console.log(`Server listening on http://localhost:${PORT}`);
});
