const http = require("http");
const WebSocket = require("ws");
const url = require("url");

const ALLOWED_HOST = "sploop.io";

// HTTP сервер (для Render health-check)
const server = http.createServer((req, res) => {
  res.writeHead(200, {"Content-Type": "text/plain"});
  res.end("Sploop proxy running\n");
});

const wss = new WebSocket.Server({ server });

wss.on("connection", (client, req) => {
  console.log("New client:", req.url);

  const parsed = url.parse(req.url, true);
  const target = parsed.query.target;

  if (!target) {
    console.log("No target, closing");
    client.close();
    return;
  }

  let upstreamUrl = target;
  console.log("Target:", upstreamUrl);

  try {
    const parsedUp = new URL(upstreamUrl);
    if (!parsedUp.host.includes(ALLOWED_HOST)) {
      console.log("Rejected:", parsedUp.host);
      client.close();
      return;
    }
  } catch (e) {
    console.log("Invalid URL:", upstreamUrl, e);
    client.close();
    return;
  }

  const upstream = new WebSocket(upstreamUrl, {
    perMessageDeflate: false // Disable compression (игры часто не любят)
  });

  upstream.on("open", () => {
    console.log("Connected to upstream");

    // ping/pong keep-alive
    setInterval(() => {
      if (upstream.readyState === WebSocket.OPEN) {
        upstream.ping();
      }
      if (client.readyState === WebSocket.OPEN) {
        client.ping();
      }
    }, 5000);
  });

  // Клиент → Сервер игры
  client.on("message", (data) => {
    if (upstream.readyState === WebSocket.OPEN) {
      upstream.send(data);
    }
  });

  // Сервер игры → Клиент
  upstream.on("message", (data) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(data);
    }
  });

  upstream.on("pong", () => {});
  client.on("pong", () => {});

  upstream.on("close", () => {
    console.log("Upstream closed");
    client.close();
  });

  client.on("close", () => {
    console.log("Client closed");
    upstream.close();
  });

  upstream.on("error", (err) => {
    console.log("Upstream error:", err.message);
    client.close();
  });

  client.on("error", (err) => {
    console.log("Client error:", err.message);
    upstream.close();
  });
});

const PORT = process.env.PORT || 10000;
server.listen(PORT, () => {
  console.log("Sploop proxy listening on", PORT);
});
