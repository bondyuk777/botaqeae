// network.js
export class NetworkClient {
    constructor({ url, onInit, onState, onDisconnect }) {
        this.url = url || `ws://${location.hostname}:3000`;
        this.onInit = onInit;
        this.onState = onState;
        this.onDisconnect = onDisconnect;

        this.socket = null;
        this.keys = { up: false, down: false, left: false, right: false };
        this.myId = null;
    }

    connect() {
        this.socket = new WebSocket(this.url);

        this.socket.addEventListener("open", () => {
            console.log("[NET] connected");
        });

        this.socket.addEventListener("message", (event) => {
            let data;
            try {
                data = JSON.parse(event.data);
            } catch {
                return;
            }

            if (data.type === "init") {
                this.myId = data.id;
                this.onInit && this.onInit(data.id);
            } else if (data.type === "state") {
                // data.players — массив объектов {id,x,y,vx,vy,name,color}
                this.onState && this.onState(data.players, this.myId);
            }
        });

        this.socket.addEventListener("close", () => {
            console.log("[NET] disconnected");
            this.onDisconnect && this.onDisconnect();
        });
    }

    setKeys(partial) {
        // partial: { up?:bool, down?:bool, ... }
        Object.assign(this.keys, partial);
        this.sendInput();
    }

    sendInput() {
        if (!this.socket || this.socket.readyState !== WebSocket.OPEN) return;
        this.socket.send(JSON.stringify({
            type: "input",
            keys: this.keys,
        }));
    }
}
