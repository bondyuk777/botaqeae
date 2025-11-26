const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const info = document.getElementById("info");
const chatBox = document.getElementById("chat-box");
const chatInput = document.getElementById("chat-input");

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

let chatActive = false;

let cameraX = 0;
let cameraY = 0;

const protocol = (location.protocol === "https:") ? "wss" : "ws";
const WS_URL = `${protocol}://${location.host}`;

function connect() {
    socket = new WebSocket(WS_URL);

    socket.addEventListener("open", () => {
        console.log("[NET] connected");
        info.textContent = "Подключено. WASD/стрелки — движение, Enter — чат, ЛКМ — атака, ПКМ — стена, F — меч";
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

connect();

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

// ====== УПРАВЛЕНИЕ КЛАВИАТУРОЙ ======

window.addEventListener("keydown", (e) => {
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

// ====== МЫШЬ: АТАКА + СТРОЙКА ======

function screenToWorld(sx, sy) {
    const rect = canvas.getBoundingClientRect();
    const x = sx - rect.left;
    const y = sy - rect.top;
    return {
        x: cameraX + x,
        y: cameraY + y
    };
}

canvas.addEventListener("mousedown", (e) => {
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

    // игроки
    for (const p of players) {
        const sx = p.x - cameraX;
        const sy = p.y - cameraY;
        if (sx < -50 || sy < -50 || sx > canvas.width + 50 || sy > canvas.height + 50) continue;

        const isMe = p.id === myId;

        ctx.beginPath();
        ctx.arc(sx, sy, isMe ? 18 : 14, 0, Math.PI * 2);
        ctx.fillStyle = p.color || "#0f0";
        ctx.fill();

        if (isMe) {
            ctx.lineWidth = 3;
            ctx.strokeStyle = "#fff";
            ctx.stroke();
        }

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

        // ник
        ctx.font = "12px sans-serif";
        ctx.textAlign = "center";
        ctx.fillStyle = "#fff";
        ctx.fillText(p.name, sx, sy - 20);
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
