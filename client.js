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

// для поворота
let mouseWorldX = 0;
let mouseWorldY = 0;
const prevPositions = {};

// ====== СТИЛИ СКИНОВ (fallback, если картинка не загрузится) ======

const SKIN_STYLES = {
    body42: { body: "#7f8c8d", head: "#f1c40f", outline: "#2c3e50" },
    body85: { body: "#e74c3c", head: "#f1c40f", outline: "#c0392b" },
    body11: { body: "#3498db", head: "#f1c40f", outline: "#2980b9" },
    body12: { body: "#2ecc71", head: "#f1c40f", outline: "#27ae60" },
    body13: { body: "#9b59b6", head: "#f1c40f", outline: "#8e44ad" }
};

// ====== КАРТИНКИ СКИНОВ (BODY) ======

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
    img.src = src; // грузим с удалённого сайта
    skinImages[key] = img;
}

// ====== КАРТИНКА РУК (arm42 – используем для всех скинов) ======

const ARM_SOURCES = {
    body42: "https://sploop.io/img/skins/arm42.png"
};

const armImages = {};
for (const [key, src] of Object.entries(ARM_SOURCES)) {
    const img = new Image();
    img.src = src;
    armImages[key] = img;
}

// ====== МЕНЮ: ВЫБОР СКИНА И СТАРТ ======

skinOptions.forEach(opt => {
    opt.addEventListener("click", () => {
        skinOptions.forEach(o => o.classList.remove("selected"));
        opt.classList.add("selected");
        selectedSkin = opt.dataset.skin || DEFAULT_SKIN;
    });
});

// Enter в поле ника = нажать кнопку Play
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

// ====== ФУНКЦИИ СЕТИ ======

function connect() {
    socket = new WebSocket(WS_URL);

    socket.addEventListener("open", () => {
        console.log("[NET] connected");
        info.textContent = "Подключено. WASD/стрелки — движение, Enter — чат, ЛКМ — атака, ПКМ — стена, F — меч";

        // отправляем профиль (ник + скин)
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
    socket.send(JSON.stringify({
        type: "input",
        keys
    }));
}

function sendAttack() {
    if (!socket || socket.readyState !== WebSocket.OPEN) return;
    socket.send(JSON.stringify({ type: "attack" }));
}

function sendChatMessage(text) {
    if (!socket || socket.readyState !== WebSocket.OPEN) return;
    text = (text || "").toString().trim();
    if (!text) return;

    socket.send(JSON.stringify({
        type: "chat",
        text
    }));
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
    socket.send(JSON.stringify({
        type: "craft",
        recipe
    }));
}

function sendProfile(name, skin) {
    if (!socket || socket.readyState !== WebSocket.OPEN) return;
    socket.send(JSON.stringify({
        type: "profile",
        name,
        skin
    }));
}

// ====== УПРАВЛЕНИЕ КЛАВИАТУРОЙ ======

window.addEventListener("keydown", (e) => {
    // пока открыто меню — игнорим управление
    if (inMenu) return;

    // если чат активен — обрабатываем только чат
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

    // чат НЕ активен
    if (e.key === "Enter") {
        chatActive = true;
        chatBox.style.display = "block";
        chatInput.value = "";
        chatInput.focus();
        e.preventDefault();
        e.stopPropagation();
        return;
    }

    // крафт
    if (e.code === "KeyF") {
        // крафт деревянного меча
        sendCraft("wood_sword");
        e.preventDefault();
    }

    // движение
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

// ====== МЫШЬ: АТАКА + СТРОЙКА + ОБНОВЛЕНИЕ КУРСОРА ======

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
        // ЛКМ — атака
        sendAttack();
    } else if (e.button === 2) {
        // ПКМ — стена в точке курсора
        const pos = screenToWorld(e.clientX, e.clientY);
        sendBuildWall(pos.x, pos.y);
    }
});

canvas.addEventListener("contextmenu", (e) => {
    e.preventDefault();
});

// если кликаем по канвасу — убираем фокус с чата, если он закрыт
canvas.addEventListener("mousedown", () => {
    if (!chatActive) {
        chatInput.blur();
        window.focus();
    }
});

// ====== РЕНДЕР ======

function drawGrid(camX, camY) {
    const gridSize = 100;
    ctx.strokeStyle = "rgba(255,255,255,0.05)";
    ctx.lineWidth = 1;

    const startX = -((camX % gridSize) + gridSize) % gridSize;
    const startY = -((camY % gridSize) + gridSize) % gridSize;

    for (let x = startX; x < canvas.width; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height);
        ctx.stroke();
    }
    for (let y = startY; y < canvas.height; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
        ctx.stroke();
    }
}

// аккуратный человечек/скин с поворотом и руками
function drawHuman(p, sx, sy, isMe, angleRad) {
    const skinKey = p.skin || DEFAULT_SKIN;
    const bodyImg = skinImages[skinKey];
    // используем arm42 для всех, если нет своего
    const armImg = armImages[skinKey] || armImages["body42"];
    const style = SKIN_STYLES[skinKey] || SKIN_STYLES[DEFAULT_SKIN];

    const size = 64;

    ctx.save();
    ctx.translate(sx, sy);

    // спрайты Sploop ориентированы вверх, а Math.atan2 — 0 вправо
    const drawAngle = angleRad - Math.PI / 2;
    ctx.rotate(drawAngle);

    // тело
    if (bodyImg && bodyImg.complete) {
        ctx.drawImage(bodyImg, -size / 2, -size / 2, size, size);
    } else {
        // fallback – рисованный человечек
        ctx.fillStyle = style.body;
        ctx.fillRect(-12, -6, 24, 26);

        ctx.beginPath();
        ctx.arc(0, -18, 10, 0, Math.PI * 2);
        ctx.fillStyle = style.head;
        ctx.fill();

        ctx.beginPath();
        ctx.arc(0, -18, 11, 0, Math.PI * 2);
        ctx.strokeStyle = style.outline;
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.fillStyle = style.body;
        ctx.fillRect(-18, -4, 6, 18);
        ctx.fillRect(12, -4, 6, 18);

        ctx.fillRect(-10, 20, 8, 14);
        ctx.fillRect(2, 20, 8, 14);
    }

    // 💪 две руки поверх тела
    if (armImg && armImg.complete) {
        const armSize = size;

        // правая (справа)
        ctx.save();
        ctx.translate(10, 0);
        ctx.drawImage(armImg, -armSize / 2, -armSize / 2, armSize, armSize);
        ctx.restore();

        // левая (слева, зеркально)
        ctx.save();
        ctx.translate(-10, 0);
        ctx.scale(-1, 1); // отзеркаливаем по X
        ctx.drawImage(armImg, -armSize / 2, -armSize / 2, armSize, armSize);
        ctx.restore();
    }

    ctx.restore();

    // подсветка "это ты" — кольцо под персонажем (если хочешь, можно убрать)
    if (isMe) {
        ctx.beginPath();
        ctx.arc(sx, sy + size / 2, size * 0.5, 0, Math.PI * 2);
        ctx.strokeStyle = "rgba(255,255,255,0.6)";
        ctx.lineWidth = 2;
        ctx.stroke();
    }
}

function render() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // фон
    ctx.fillStyle = "#222";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // находим себя
    const me = players.find(p => p.id === myId);

    // камера за игроком
    if (me) {
        cameraX = me.x - canvas.width / 2;
        cameraY = me.y - canvas.height / 2;
    }

    // сетка
    drawGrid(cameraX, cameraY);

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

    // строения (стены)
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

        // полоска хп
        const hpRatio = m.hp / m.maxHp;
        const barW = 30;
        const barH = 4;
        ctx.fillStyle = "#000";
        ctx.fillRect(sx - barW / 2, sy - 28, barW, barH);
        ctx.fillStyle = "#e74c3c";
        ctx.fillRect(sx - barW / 2, sy - 28, barW * hpRatio, barH);
    }

    // игроки (скины, повернутые)
    for (const p of players) {
        const sx = p.x - cameraX;
        const sy = p.y - cameraY;
        if (sx < -60 || sy < -60 || sx > canvas.width + 60 || sy > canvas.height + 60) continue;

        const isMe = p.id === myId;

        // угол поворота
        let angle = 0;

        if (isMe) {
            // смотрим на курсор мыши
            const dx = mouseWorldX - p.x;
            const dy = mouseWorldY - p.y;
            angle = Math.atan2(dy, dx);
        } else {
            // для чужих ориентируем по направлению движения (по позиции между кадрами)
            const prev = prevPositions[p.id];
            if (prev) {
                const dx = p.x - prev.x;
                const dy = p.y - prev.y;
                if (dx !== 0 || dy !== 0) {
                    angle = Math.atan2(dy, dx);
                }
            }
        }

        drawHuman(p, sx, sy, isMe, angle);

        // чат над головой
        if (p.chatText) {
            const chatY = sy - 44;

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

        // ник
        ctx.font = "12px sans-serif";
        ctx.textAlign = "center";
        ctx.fillStyle = "#fff";
        ctx.fillText(p.name, sx, sy - 22);

        // сохраняем позицию для следующего кадра (для направления чужих)
        prevPositions[p.id] = { x: p.x, y: p.y };
    }

    // ====== HUD ======

    if (me) {
        ctx.textAlign = "left";
        ctx.font = "14px sans-serif";
        ctx.fillStyle = "#fff";

        ctx.fillText(`HP: ${me.hp}/${me.maxHp}`, 10, 20);

        const inv = me.inventory || { wood: 0, stone: 0, food: 0 };
        ctx.fillText(`Wood: ${inv.wood}  Stone: ${inv.stone}  Food: ${inv.food}`, 10, 40);

        ctx.fillText(`Weapon: ${me.weapon}`, 10, 60);

        ctx.fillText(`[WASD / стрелки] движение`, 10, 90);
        ctx.fillText(`[ЛКМ] атака (по ближайшей цели)`, 10, 110);
        ctx.fillText(`[ПКМ] поставить стену (10 wood)`, 10, 130);
        ctx.fillText(`[F] крафт деревянного меча (20 wood)`, 10, 150);
        ctx.fillText(`[Enter] чат, [Esc] закрыть чат`, 10, 170);
    }

    requestAnimationFrame(render);
}

render();
