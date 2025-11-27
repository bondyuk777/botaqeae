const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const info = document.getElementById("info");

const chatBox = document.getElementById("chat-box");
const chatInput = document.getElementById("chat-input");

const menu = document.getElementById("menu");
const playBtn = document.getElementById("play-btn");
const nameInput = document.getElementById("name-input");
const skinOptions = document.querySelectorAll(".skin-option");

// ====== ФЛАГИ ======
let inMenu = true;
let chatActive = false;

// ====== ФУЛЛСКРИН КАНВАС ======

function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}
window.addEventListener("resize", resizeCanvas);
resizeCanvas();

// ====== СЕТЬ ======

let socket;
let myId = null;

let players = [];
let resources = [];
let mobs = [];
let structures = [];

const keys = { up: false, down: false, left: false, right: false };

let cameraX = 0;
let cameraY = 0;

const protocol = (location.protocol === "https:") ? "wss" : "ws";
const WS_URL = `${protocol}://${location.host}`;

const DEFAULT_SKIN = "body42";
let selectedSkin = DEFAULT_SKIN;
let profileToSend = null;

// для поворота к мышке
let mouseWorldX = 0;
let mouseWorldY = 0;
// для ориентации чужих игроков
const prevPositions = {};

// ====== СПРАЙТЫ ТЕЛА (BODY) ======

const SKIN_SOURCES = {
    body42: "https://sploop.io/img/skins/body42.png",
    body85: "https://sploop.io/img/skins/body85.png",
    body11: "https://sploop.io/img/skins/body11.png",
    body12: "https://sploop.io/img/skins/body12.png",
    body13: "https://sploop.io/img/skins/body13.png"
};

const skinImages = {};
for (const [key, src] of Object.entries(SKIN_SOURCES)) {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = src;
    skinImages[key] = img;
}

// ====== МЕНЮ: ВЫБОР СКИНА И СТАРТ ======

skinOptions.forEach(opt => {
    opt.addEventListener("click", () => {
        skinOptions.forEach(o => o.classList.remove("selected"));
        opt.classList.add("selected");
        selectedSkin = opt.dataset.skin || DEFAULT_SKIN;
    });
});

nameInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
        playBtn.click();
    }
});

playBtn.addEventListener("click", () => {
    if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) {
        return;
    }

    const name = nameInput.value.trim().slice(0, 16);
    profileToSend = { name, skin: selectedSkin };

    inMenu = false;
    menu.style.display = "none";

    connect();
});

// ====== СЕТЕВЫЕ ФУНКЦИИ ======

function connect() {
    socket = new WebSocket(WS_URL);

    socket.addEventListener("open", () => {
        console.log("[NET] connected");
        info.textContent =
            "Подключено. WASD/стрелки — движение, Enter — чат, ЛКМ — атака, ПКМ — стена, F — меч";

        if (profileToSend) {
            sendProfile(profileToSend.name, profileToSend.skin);
        }
    });

    socket.addEventListener("message", (event) => {
        let data;
        try {
            data = JSON.parse(event.data);
        } catch {
            return;
        }

        if (data.type === "init") {
            myId = data.id;
            console.log("My ID:", myId);
        } else if (data.type === "state") {
            players = data.players || [];
            resources = data.resources || [];
            mobs = data.mobs || [];
            structures = data.structures || [];
        }
    });

    socket.addEventListener("close", () => {
        console.log("[NET] disconnected");
        info.textContent = "Отключено от сервера.";
    });
}

function sendInput() {
    if (!socket || socket.readyState !== WebSocket.OPEN) return;
    socket.send(JSON.stringify({ type: "input", keys }));
}

function sendAttack() {
    if (!socket || socket.readyState !== WebSocket.OPEN) return;
    socket.send(JSON.stringify({ type: "attack" }));
}

function sendChatMessage(text) {
    if (!socket || socket.readyState !== WebSocket.OPEN) return;
    text = (text || "").toString().trim();
    if (!text) return;
    socket.send(JSON.stringify({ type: "chat", text }));
}

function sendBuildWall(worldX, worldY) {
    if (!socket || socket.readyState !== WebSocket.OPEN) return;
    socket.send(JSON.stringify({
        type: "build",
        structureType: "wall",
        x: worldX,
        y: worldY
    }));
}

function sendCraft(recipe) {
    if (!socket || socket.readyState !== WebSocket.OPEN) return;
    socket.send(JSON.stringify({ type: "craft", recipe }));
}

function sendProfile(name, skin) {
    if (!socket || socket.readyState !== WebSocket.OPEN) return;
    socket.send(JSON.stringify({ type: "profile", name, skin }));
}

// ====== КЛАВИАТУРА ======

window.addEventListener("keydown", (e) => {
    if (inMenu) return;

    // чат открыт
    if (chatActive && document.activeElement === chatInput) {
        if (e.key === "Enter") {
            const text = chatInput.value;
            chatInput.value = "";
            sendChatMessage(text);
            chatActive = false;
            chatBox.style.display = "none";
            chatInput.blur();
            e.preventDefault();
            e.stopPropagation();
            return;
        }
        if (e.key === "Escape") {
            chatInput.value = "";
            chatActive = false;
            chatBox.style.display = "none";
            chatInput.blur();
            e.preventDefault();
            e.stopPropagation();
            return;
        }
        return;
    }

    // открыть чат
    if (e.key === "Enter") {
        chatActive = true;
        chatBox.style.display = "block";
        chatInput.value = "";
        chatInput.focus();
        e.preventDefault();
        e.stopPropagation();
        return;
    }

    // крафт меча
    if (e.code === "KeyF") {
        sendCraft("wood_sword");
        e.preventDefault();
    }

    let changed = false;
    if (e.code === "KeyW" || e.code === "ArrowUp") {
        if (!keys.up) { keys.up = true; changed = true; }
    }
    if (e.code === "KeyS" || e.code === "ArrowDown") {
        if (!keys.down) { keys.down = true; changed = true; }
    }
    if (e.code === "KeyA" || e.code === "ArrowLeft") {
        if (!keys.left) { keys.left = true; changed = true; }
    }
    if (e.code === "KeyD" || e.code === "ArrowRight") {
        if (!keys.right) { keys.right = true; changed = true; }
    }

    if (changed) {
        sendInput();
        e.preventDefault();
    }
});

window.addEventListener("keyup", (e) => {
    if (inMenu) return;
    if (chatActive && document.activeElement === chatInput) return;

    let changed = false;
    if (e.code === "KeyW" || e.code === "ArrowUp") {
        if (keys.up) { keys.up = false; changed = true; }
    }
    if (e.code === "KeyS" || e.code === "ArrowDown") {
        if (keys.down) { keys.down = false; changed = true; }
    }
    if (e.code === "KeyA" || e.code === "ArrowLeft") {
        if (keys.left) { keys.left = false; changed = true; }
    }
    if (e.code === "KeyD" || e.code === "ArrowRight") {
        if (keys.right) { keys.right = false; changed = true; }
    }

    if (changed) {
        sendInput();
        e.preventDefault();
    }
});

// ====== МЫШЬ (для поворота и постройки) ======

function screenToWorld(sx, sy) {
    const rect = canvas.getBoundingClientRect();
    const x = sx - rect.left;
    const y = sy - rect.top;
    return {
        x: cameraX + x,
        y: cameraY + y
    };
}

canvas.addEventListener("mousemove", (e) => {
    const pos = screenToWorld(e.clientX, e.clientY);
    mouseWorldX = pos.x;
    mouseWorldY = pos.y;
});

canvas.addEventListener("mousedown", (e) => {
    if (inMenu) return;
    if (chatActive) return;

    if (e.button === 0) {
        sendAttack();
    } else if (e.button === 2) {
        const pos = screenToWorld(e.clientX, e.clientY);
        sendBuildWall(pos.x, pos.y);
    }
});

canvas.addEventListener("contextmenu", (e) => e.preventDefault());

canvas.addEventListener("mousedown", () => {
    if (!chatActive) {
        chatInput.blur();
        window.focus();
    }
});

// ====== РИСОВАНИЕ ПЕРСОНАЖА (только bodyXX, без armXX, с поворотом к мышке) ======

function drawHuman(p, sx, sy, isMe, angleRad) {
    const skinKey = p.skin || DEFAULT_SKIN;
    const bodyImg = skinImages[skinKey];
    const size = 64;

    ctx.save();
    ctx.translate(sx, sy);

    // спрайт по дефолту смотрит вверх, а atan2 даёт 0 вправо → поворачиваем на -PI/2
    const drawAngle = angleRad - Math.PI / 2;
    ctx.rotate(drawAngle);

    if (bodyImg && bodyImg.complete) {
        ctx.drawImage(bodyImg, -size / 2, -size / 2, size, size);
    } else {
        // простая заглушка, если спрайт не загрузился
        ctx.fillStyle = "#333";
        ctx.beginPath();
        ctx.arc(0, 0, size / 2, 0, Math.PI * 2);
        ctx.fill();
    }

    ctx.restore();

    // полоска HP под персонажем
    const barWidth = 60;
    const barHeight = 6;
    const hpRatio = Math.max(0, Math.min(1, p.hp / p.maxHp || 0));

    const barX = sx - barWidth / 2;
    const barY = sy + size / 2 + 4;

    ctx.fillStyle = "rgba(0,0,0,0.4)";
    ctx.fillRect(barX, barY, barWidth, barHeight);

    ctx.fillStyle = "#3cb4ff";
    ctx.fillRect(barX + 1, barY + 1, (barWidth - 2) * hpRatio, barHeight - 2);

    ctx.strokeStyle = "rgba(255,255,255,0.5)";
    ctx.strokeRect(barX, barY, barWidth, barHeight);
}

// ====== РЕНДЕР ======

function render() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // фон как трава
    ctx.fillStyle = "#769a3b";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const me = players.find(p => p.id === myId);

    // камера за своим игроком
    if (me) {
        cameraX = me.x - canvas.width / 2;
        cameraY = me.y - canvas.height / 2;
    }

    // ресурсы
    for (const r of resources) {
        const sx = r.x - cameraX;
        const sy = r.y - cameraY;
        if (sx < -50 || sy < -50 || sx > canvas.width + 50 || sy > canvas.height + 50) continue;

        if (r.type === "tree") ctx.fillStyle = "#2ecc71";
        else if (r.type === "rock") ctx.fillStyle = "#bdc3c7";
        else if (r.type === "bush") ctx.fillStyle = "#e74c3c";
        else ctx.fillStyle = "#ffffff";

        ctx.beginPath();
        ctx.arc(sx, sy, 18, 0, Math.PI * 2);
        ctx.fill();
    }

    // строения
    for (const s of structures) {
        const sx = s.x - cameraX;
        const sy = s.y - cameraY;
        if (sx < -50 || sy < -50 || sx > canvas.width + 50 || sy > canvas.height + 50) continue;

        if (s.type === "wall") {
            ctx.fillStyle = "#7f8c8d";
            ctx.fillRect(sx - 20, sy - 20, 40, 40);
            ctx.strokeStyle = "#95a5a6";
            ctx.strokeRect(sx - 20, sy - 20, 40, 40);
        }
    }

    // мобы
    for (const m of mobs) {
        const sx = m.x - cameraX;
        const sy = m.y - cameraY;
        if (sx < -50 || sy < -50 || sx > canvas.width + 50 || sy > canvas.height + 50) continue;

        ctx.beginPath();
        ctx.arc(sx, sy, 18, 0, Math.PI * 2);
        ctx.fillStyle = "#c0392b";
        ctx.fill();

        const hpRatio = m.hp / m.maxHp;
        const barW = 30;
        const barH = 4;
        ctx.fillStyle = "#000";
        ctx.fillRect(sx - barW / 2, sy - 28, barW, barH);
        ctx.fillStyle = "#e74c3c";
        ctx.fillRect(sx - barW / 2, sy - 28, barW * hpRatio, barH);
    }

    // игроки
    for (const p of players) {
        const sx = p.x - cameraX;
        const sy = p.y - cameraY;
        if (sx < -80 || sy < -80 || sx > canvas.width + 80 || sy > canvas.height + 80) continue;

        const isMe = p.id === myId;

        // угол поворота
        let angle = 0;
        if (isMe) {
            const dx = mouseWorldX - p.x;
            const dy = mouseWorldY - p.y;
            angle = Math.atan2(dy, dx);          // мой смотрит на курсор
        } else {
            const prev = prevPositions[p.id];
            if (prev) {
                const dx = p.x - prev.x;
                const dy = p.y - prev.y;
                if (dx !== 0 || dy !== 0) {
                    angle = Math.atan2(dy, dx);  // чужие по направлению движения
                }
            }
        }

        drawHuman(p, sx, sy, isMe, angle);

        // чат над головой
        if (p.chatText) {
            const chatY = sy - 40;

            ctx.font = "14px sans-serif";
            ctx.textAlign = "center";

            const padding = 4;
            const textWidth = ctx.measureText(p.chatText).width;
            const boxWidth = textWidth + padding * 2;
            const boxHeight = 18;

            ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
            ctx.fillRect(
                sx - boxWidth / 2,
                chatY - boxHeight + 3,
                boxWidth,
                boxHeight
            );

            ctx.strokeStyle = "rgba(255,255,255,0.6)";
            ctx.strokeRect(
                sx - boxWidth / 2,
                chatY - boxHeight + 3,
                boxWidth,
                boxHeight
            );

            ctx.fillStyle = "#fff";
            ctx.fillText(p.chatText, sx, chatY);
        }

        // ник (красный, как на скрине)
        ctx.font = "14px sans-serif";
        ctx.textAlign = "center";
        ctx.fillStyle = "#ff4c4c";
        ctx.fillText(p.name, sx, sy - 32);

        // запоминаем позицию для направления движения
        prevPositions[p.id] = { x: p.x, y: p.y };
    }

    // HUD
    if (me) {
        ctx.textAlign = "left";
        ctx.font = "14px sans-serif";
        ctx.fillStyle = "#fff";

        ctx.fillText(`HP: ${me.hp}/${me.maxHp}`, 10, 20);

        const inv = me.inventory || { wood: 0, stone: 0, food: 0 };
        ctx.fillText(`Wood: ${inv.wood}  Stone: ${inv.stone}  Food: ${inv.food}`, 10, 40);

        ctx.fillText(`Weapon: ${me.weapon}`, 10, 60);

        ctx.fillText(`[WASD / стрелки] движение`, 10, 90);
        ctx.fillText(`[ЛКМ] атака`, 10, 110);
        ctx.fillText(`[ПКМ] стена (10 wood)`, 10, 130);
        ctx.fillText(`[F] деревянный меч (20 wood)`, 10, 150);
        ctx.fillText(`[Enter] чат, [Esc] закрыть чат`, 10, 170);
    }

    requestAnimationFrame(render);
}

render();
