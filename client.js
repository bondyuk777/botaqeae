const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const info = document.getElementById("info");
const chatInput = document.getElementById("chat-input");

// ====== СЕТЬ ======

let socket;
let myId = null;
let players = [];

const keys = { up: false, down: false, left: false, right: false };

const protocol = (location.protocol === "https:") ? "wss" : "ws";
const WS_URL = `${protocol}://${location.host}`;

function connect() {
    socket = new WebSocket(WS_URL);

    socket.addEventListener("open", () => {
        console.log("[NET] connected");
        info.textContent = "Подключено. WASD / стрелки для движения, чат внизу";
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
            players = data.players;
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

// ====== УПРАВЛЕНИЕ ДВИЖЕНИЕМ ======

window.addEventListener("keydown", (e) => {
    // если фокус в чате – не двигаем
    if (document.activeElement === chatInput) return;

    let changed = false;
    if (e.code === "KeyW" || e.code === "ArrowUp")  { if (!keys.up)    { keys.up = true; changed = true; } }
    if (e.code === "KeyS" || e.code === "ArrowDown"){ if (!keys.down)  { keys.down = true; changed = true; } }
    if (e.code === "KeyA" || e.code === "ArrowLeft"){ if (!keys.left)  { keys.left = true; changed = true; } }
    if (e.code === "KeyD" || e.code === "ArrowRight"){ if (!keys.right){ keys.right = true; changed = true; } }

    if (changed) sendInput();
});

window.addEventListener("keyup", (e) => {
    // если фокус в чате – не трогаем
    if (document.activeElement === chatInput) return;

    let changed = false;
    if (e.code === "KeyW" || e.code === "ArrowUp")  { if (keys.up)    { keys.up = false; changed = true; } }
    if (e.code === "KeyS" || e.code === "ArrowDown"){ if (keys.down)  { keys.down = false; changed = true; } }
    if (e.code === "KeyA" || e.code === "ArrowLeft"){ if (keys.left)  { keys.left = false; changed = true; } }
    if (e.code === "KeyD" || e.code === "ArrowRight"){ if (keys.right){ keys.right = false; changed = true; } }

    if (changed) sendInput();
});

// ====== ОТПРАВКА ЧАТА ======

function sendChatMessage(text) {
    if (!socket || socket.readyState !== WebSocket.OPEN) return;
    text = (text || "").toString().trim();
    if (!text) return;

    socket.send(JSON.stringify({
        type: "chat",
        text
    }));
}

// Enter в инпуте чата отправляет сообщение
chatInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
        const text = chatInput.value;
        chatInput.value = "";
        sendChatMessage(text);
        e.preventDefault();
        e.stopPropagation();
    }
});

// по клику на игру убираем фокус с чата (чтобы снова двигаться)
canvas.addEventListener("mousedown", () => {
    canvas.focus?.();
    window.focus();
});

// ====== РЕНДЕР ======

function render() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // фон
    ctx.fillStyle = "#222";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    for (const p of players) {
        const isMe = p.id === myId;

        // игрок
        ctx.beginPath();
        ctx.arc(p.x, p.y, isMe ? 16 : 12, 0, Math.PI * 2);
        ctx.fillStyle = p.color || "#0f0";
        ctx.fill();

        if (isMe) {
            ctx.lineWidth = 3;
            ctx.strokeStyle = "#fff";
            ctx.stroke();
        }

        // 💬 чат над головой, если есть текст
        if (p.chatText) {
            const chatY = p.y - 40;

            ctx.font = "14px sans-serif";
            ctx.textAlign = "center";

            const padding = 4;
            const textWidth = ctx.measureText(p.chatText).width;
            const boxWidth = textWidth + padding * 2;
            const boxHeight = 18;

            // фон пузыря
            ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
            ctx.fillRect(
                p.x - boxWidth / 2,
                chatY - boxHeight + 3,
                boxWidth,
                boxHeight
            );

            // рамка
            ctx.strokeStyle = "rgba(255,255,255,0.6)";
            ctx.strokeRect(
                p.x - boxWidth / 2,
                chatY - boxHeight + 3,
                boxWidth,
                boxHeight
            );

            // текст
            ctx.fillStyle = "#fff";
            ctx.fillText(p.chatText, p.x, chatY);
        }

        // имя игрока
        ctx.font = "12px sans-serif";
        ctx.textAlign = "center";
        ctx.fillStyle = "#fff";
        ctx.fillText(p.name, p.x, p.y - 20);
    }

    requestAnimationFrame(render);
}

render();
