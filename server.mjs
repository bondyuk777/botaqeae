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

// Раздаём index.html, client.js и т.п. из текущей папки
app.use(express.static(__dirname));

// ====== КОНСТАНТЫ И МИР ======

const MAP_SIZE = 3000;
const HALF_MAP = MAP_SIZE / 2;

const TICK_RATE = 60;
const TICK_INTERVAL = 1000 / TICK_RATE;

const PLAYER_MAX_HP = 100;
const PLAYER_SPEED = 260;

const ATTACK_RANGE = 80;
const ATTACK_COOLDOWN = 400; // мс

let nextPlayerId = 1;
let nextResourceId = 1;
let nextMobId = 1;
let nextStructureId = 1;

const players = new Map();   // id -> player
const resources = [];        // [{id,type,x,y,hp,maxHp}]
const mobs = [];             // [{id,type,x,y,hp,maxHp,speed,targetId,vx,vy,attackCooldown}]
const structures = [];       // [{id,type,x,y,hp,maxHp,ownerId}]

const WEAPONS = {
    fist: { damage: 10 },
    wood_sword: { damage: 25 },
};

function randRange(min, max) {
    return Math.random() * (max - min) + min;
}

function clamp(v, min, max) {
    return v < min ? min : (v > max ? max : v);
}

// ====== РЕСУРСЫ ======

function createResource(type, x, y) {
    let maxHp = 50;
    if (type === "tree") maxHp = 60;
    if (type === "rock") maxHp = 80;
    if (type === "bush") maxHp = 40;

    const res = {
        id: nextResourceId++,
        type,
        x,
        y,
        hp: maxHp,
        maxHp
    };
    resources.push(res);
}

function spawnInitialResources() {
    for (let i = 0; i < 80; i++) {
        createResource("tree", randRange(-HALF_MAP, HALF_MAP), randRange(-HALF_MAP, HALF_MAP));
    }
    for (let i = 0; i < 50; i++) {
        createResource("rock", randRange(-HALF_MAP, HALF_MAP), randRange(-HALF_MAP, HALF_MAP));
    }
    for (let i = 0; i < 40; i++) {
        createResource("bush", randRange(-HALF_MAP, HALF_MAP), randRange(-HALF_MAP, HALF_MAP));
    }
}

// ====== МОБЫ ======

function spawnMob() {
    const mob = {
        id: nextMobId++,
        type: "wolf",
        x: randRange(-HALF_MAP, HALF_MAP),
        y: randRange(-HALF_MAP, HALF_MAP),
        hp: 80,
        maxHp: 80,
        speed: 180,
        targetId: null,
        vx: 0,
        vy: 0,
        attackCooldown: 0
    };
    mobs.push(mob);
}

function spawnInitialMobs() {
    for (let i = 0; i < 15; i++) {
        spawnMob();
    }
}

// ====== СТРУКТУРЫ ======

function createStructure(type, x, y, ownerId) {
    let maxHp = 200;
    if (type === "wall") maxHp = 200;

    const s = {
        id: nextStructureId++,
        type,
        x,
        y,
        hp: maxHp,
        maxHp,
        ownerId
    };
    structures.push(s);
}

// ====== ИНИЦИАЛИЗАЦИЯ МИРА ======

spawnInitialResources();
spawnInitialMobs();

// ====== СЕТЬ: ПОДКЛЮЧЕНИЯ ======

wss.on("connection", (ws) => {
    const id = nextPlayerId++;
    ws.playerId = id;

    const player = {
        id,
        x: randRange(-200, 200),
        y: randRange(-200, 200),
        vx: 0,
        vy: 0,
        hp: PLAYER_MAX_HP,
        maxHp: PLAYER_MAX_HP,
        inventory: {
            wood: 0,
            stone: 0,
            food: 0
        },
        weapon: "fist",
        lastAttack: 0,
        name: "Player " + id,
        color: "#" + Math.floor(Math.random() * 0xffffff).toString(16).padStart(6, "0"),
        chatText: "",
        chatUntil: 0
    };

    players.set(id, player);
    console.log(`Player ${id} connected`);

    // отправляем клиенту его id
    ws.send(JSON.stringify({ type: "init", id }));

    ws.on("message", (raw) => {
        let data;
        try {
            data = JSON.parse(raw);
        } catch {
            return;
        }

        const pid = ws.playerId;
        const p = players.get(pid);
        if (!p) return;

        if (data.type === "input") {
            handleMoveInput(p, data.keys || {});
        } else if (data.type === "attack") {
            handleAttack(p);
        } else if (data.type === "chat") {
            handleChat(p, data.text);
        } else if (data.type === "build") {
            handleBuild(p, data);
        } else if (data.type === "craft") {
            handleCraft(p, data.recipe);
        }
    });

    ws.on("close", () => {
        const pid = ws.playerId;
        players.delete(pid);
        console.log(`Player ${pid} disconnected`);
    });
});

// ====== ОБРАБОТКА ВВОДА ======

function handleMoveInput(p, keys) {
    let vx = 0, vy = 0;
    if (keys.up) vy -= 1;
    if (keys.down) vy += 1;
    if (keys.left) vx -= 1;
    if (keys.right) vx += 1;

    if (vx || vy) {
        const len = Math.hypot(vx, vy);
        vx /= len;
        vy /= len;
    }

    p.vx = vx * PLAYER_SPEED;
    p.vy = vy * PLAYER_SPEED;
}

function handleChat(p, text) {
    text = (text || "").toString().trim();
    if (!text) return;

    text = text.replace(/\r?\n/g, " ").slice(0, 60);
    p.chatText = text;
    p.chatUntil = Date.now() + 3000; // 3 сек
}

function handleCraft(p, recipe) {
    if (recipe === "wood_sword") {
        if (p.inventory.wood >= 20) {
            p.inventory.wood -= 20;
            p.weapon = "wood_sword";
        }
    }
}

function handleBuild(p, data) {
    const type = data.structureType;
    const x = Number(data.x);
    const y = Number(data.y);

    if (!type || isNaN(x) || isNaN(y)) return;

    // Строить можно только рядом с собой
    const dist2 = (x - p.x) ** 2 + (y - p.y) ** 2;
    if (dist2 > 200 * 200) return;

    if (type === "wall") {
        if (p.inventory.wood >= 10) {
            p.inventory.wood -= 10;
            createStructure("wall", clamp(x, -HALF_MAP, HALF_MAP), clamp(y, -HALF_MAP, HALF_MAP), p.id);
        }
    }
}

function handleAttack(p) {
    const now = Date.now();
    if (now - p.lastAttack < ATTACK_COOLDOWN) return;
    p.lastAttack = now;

    const dmg = (WEAPONS[p.weapon]?.damage) || 10;
    const range2 = ATTACK_RANGE * ATTACK_RANGE;

    let best = null;
    let bestType = null;
    let bestDist2 = range2;

    // мобы
    for (const m of mobs) {
        const dx = m.x - p.x;
        const dy = m.y - p.y;
        const d2 = dx * dx + dy * dy;
        if (d2 < bestDist2) {
            bestDist2 = d2;
            best = m;
            bestType = "mob";
        }
    }

    // другие игроки
    for (const [id, other] of players) {
        if (id === p.id) continue;
        const dx = other.x - p.x;
        const dy = other.y - p.y;
        const d2 = dx * dx + dy * dy;
        if (d2 < bestDist2) {
            bestDist2 = d2;
            best = other;
            bestType = "player";
        }
    }

    // ресурсы
    for (const r of resources) {
        const dx = r.x - p.x;
        const dy = r.y - p.y;
        const d2 = dx * dx + dy * dy;
        if (d2 < bestDist2) {
            bestDist2 = d2;
            best = r;
            bestType = "resource";
        }
    }

    // строения
    for (const s of structures) {
        const dx = s.x - p.x;
        const dy = s.y - p.y;
        const d2 = dx * dx + dy * dy;
        if (d2 < bestDist2) {
            bestDist2 = d2;
            best = s;
            bestType = "structure";
        }
    }

    if (!best) return;

    if (bestType === "mob") {
        best.hp -= dmg;
        if (best.hp <= 0) {
            // лут с моба
            p.inventory.food += 3;
            // удалить моба
            const idx = mobs.indexOf(best);
            if (idx >= 0) mobs.splice(idx, 1);
            // заспавнить нового где-то ещё
            spawnMob();
        }
    } else if (bestType === "player") {
        best.hp -= dmg;
        if (best.hp <= 0) {
            respawnPlayer(best);
        }
    } else if (bestType === "resource") {
        best.hp -= dmg;
        if (best.hp <= 0) {
            if (best.type === "tree") p.inventory.wood += 5;
            if (best.type === "rock") p.inventory.stone += 5;
            if (best.type === "bush") p.inventory.food += 2;

            const idx = resources.indexOf(best);
            if (idx >= 0) resources.splice(idx, 1);

            // шанс заспавнить новый ресурс где-то
            if (Math.random() < 0.7) {
                createResource(best.type, randRange(-HALF_MAP, HALF_MAP), randRange(-HALF_MAP, HALF_MAP));
            }
        }
    } else if (bestType === "structure") {
        best.hp -= dmg;
        if (best.hp <= 0) {
            const idx = structures.indexOf(best);
            if (idx >= 0) structures.splice(idx, 1);
        }
    }
}

function respawnPlayer(p) {
    p.hp = p.maxHp;
    p.x = randRange(-200, 200);
    p.y = randRange(-200, 200);
    p.vx = 0;
    p.vy = 0;
    p.inventory.wood = 0;
    p.inventory.stone = 0;
    p.inventory.food = 0;
    p.weapon = "fist";
}

// ====== ГЛАВНЫЙ ИГРОВОЙ ЦИКЛ ======

let lastTime = Date.now();

setInterval(() => {
    const now = Date.now();
    const dt = (now - lastTime) / 1000;
    lastTime = now;

    // Обновляем игроков
    for (const p of players.values()) {
        p.x += p.vx * dt;
        p.y += p.vy * dt;

        p.x = clamp(p.x, -HALF_MAP, HALF_MAP);
        p.y = clamp(p.y, -HALF_MAP, HALF_MAP);

        // таймер чата
        if (p.chatText && p.chatUntil && now > p.chatUntil) {
            p.chatText = "";
            p.chatUntil = 0;
        }
    }

    // Обновляем мобов
    for (const m of mobs) {
        m.attackCooldown = Math.max(0, m.attackCooldown - (dt * 1000));

        // ищем ближайшего игрока
        let target = null;
        let bestD2 = 500 * 500;

        for (const p of players.values()) {
            const dx = p.x - m.x;
            const dy = p.y - m.y;
            const d2 = dx * dx + dy * dy;
            if (d2 < bestD2) {
                bestD2 = d2;
                target = p;
            }
        }

        if (target) {
            const dx = target.x - m.x;
            const dy = target.y - m.y;
            const len = Math.hypot(dx, dy) || 1;
            const dirX = dx / len;
            const dirY = dy / len;

            m.x += dirX * m.speed * dt;
            m.y += dirY * m.speed * dt;

            // атака, если рядом
            if (bestD2 < 60 * 60 && m.attackCooldown <= 0) {
                target.hp -= 15;
                m.attackCooldown = 700;
                if (target.hp <= 0) {
                    respawnPlayer(target);
                }
            }
        } else {
            // рандомно шаримся
            if (Math.random() < 0.01) {
                const angle = Math.random() * Math.PI * 2;
                m.vx = Math.cos(angle) * m.speed;
                m.vy = Math.sin(angle) * m.speed;
            }
            m.x += m.vx * dt;
            m.y += m.vy * dt;
        }

        m.x = clamp(m.x, -HALF_MAP, HALF_MAP);
        m.y = clamp(m.y, -HALF_MAP, HALF_MAP);
    }

    // Подспавниваем ресурсы, если их стало мало
    if (resources.length < 100) {
        const types = ["tree", "rock", "bush"];
        const t = types[Math.floor(Math.random() * types.length)];
        createResource(t, randRange(-HALF_MAP, HALF_MAP), randRange(-HALF_MAP, HALF_MAP));
    }

    // Рассылаем состояние мира
    const statePlayers = [];
    for (const p of players.values()) {
        statePlayers.push({
            id: p.id,
            x: p.x,
            y: p.y,
            hp: p.hp,
            maxHp: p.maxHp,
            name: p.name,
            color: p.color,
            chatText: p.chatText || "",
            inventory: p.inventory,
            weapon: p.weapon
        });
    }

    const snapshot = {
        type: "state",
        players: statePlayers,
        resources,
        mobs,
        structures
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
