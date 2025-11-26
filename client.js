const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const info = document.getElementById("info");

// ====== СЕТЬ ======

let socket;
let myId = null;
let players = [];

const keys = { up: false, down: false, left: false, right: false };

// ws или wss в зависимости от http/https
const protocol = (location.protocol === "https:") ? "wss" : "ws";
const WS_URL = `${protocol}://${location.host}`; // то же домен+порт, что и сайт

function connect() {
    socket = new WebSocket(WS_URL);

    socket.addEventListener("open", () => {
        console.log("[NET] connected");
        info.textContent = "Подключено. WASD / стрелки для движения";
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

// управление
window.addEventListener("keydown", (e) => {
    let changed = false;
    if (e.code === "KeyW" || e.code === "ArrowUp")  { if (!keys.up)    { keys.up = true; changed = true; } }
    if (e.code === "KeyS" || e.code === "ArrowDown"){ if (!keys.down)  { keys.down = true; changed = true; } }
    if (e.code === "KeyA" || e.code === "ArrowLeft"){ if (!keys.left)  { keys.left = true; changed = true; } }
    if (e.code === "KeyD" || e.code === "ArrowRight"){ if (!keys.right){ keys.right = true; changed = true; } }

    if (changed) sendInput();
});

window.addEventListener("keyup", (e) => {
    let changed = false;
    if (e.code === "KeyW" || e.code === "ArrowUp")  { if (keys.up)    { keys.up = false; changed = true; } }
    if (e.code === "KeyS" || e.code === "ArrowDown"){ if (keys.down)  { keys.down = false; changed = true; } }
    if (e.code === "KeyA" || e.code === "ArrowLeft"){ if (keys.left)  { keys.left = false; changed = true; } }
    if (e.code === "KeyD" || e.code === "ArrowRight"){ if (keys.right){ keys.right = false; changed = true; } }

    if (changed) sendInput();
});

// ====== РЕНДЕР (сюда можешь вставить СВОЙ рендер) ======

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

        // имя
        ctx.fillStyle = "#fff";
        ctx.font = "12px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(p.name, p.x, p.y - 20);
    }

    requestAnimationFrame(render);
}

render();
