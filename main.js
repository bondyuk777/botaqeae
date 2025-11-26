const http = require("http");
const WebSocket = require("ws");
const url = require("url");

const ALLOWED_HOST = "sploop.io"; // чтобы через прокси не ходили куда угодно

// Обычный HTTP-сервер (Render любит, чтобы что-то отвечало по HTTP)
const server = http.createServer((req, res) => {
  res.writeHead(200, { "Content-Type": "text/plain" });
  res.end("Sploop proxy is running\n");
});

// WebSocket-сервер поверх HTTP-сервера
const wss = new WebSocket.Server({ server });

wss.on("connection", (client, req) => {
  console.log("New client:", req.url);

  const parsed = url.parse(req.url, true);
  const target = parsed.query.target;

  if (!target) {
    console.log("No target provided, closing");
    client.close();
    return;
  }

  let upstreamUrl = target;
  console.log("Requested upstream:", upstreamUrl);

  // Немного безопасности: разрешаем только sploop.io
  try {
    const parsedUp = new URL(upstreamUrl);
    if (!parsedUp.host.includes(ALLOWED_HOST)) {
      console.log("Blocked upstream host:", parsedUp.host);
      client.close();
      return;
    }
  } catch (e) {
    console.log("Bad upstream URL:", upstreamUrl, e);
    client.close();
    return;
  }

  // Подключаемся к реальному WebSocket игры
  const upstream = new WebSocket(upstreamUrl);

  upstream.on("open", () => {
    console.log("Connected to upstream:", upstreamUrl);
  });

  upstream.on("message", (msg) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(msg);
    }
  });

  upstream.on("close", () => {
    console.log("Upstream closed");
    if (client.readyState === WebSocket.OPEN) {
      client.close();
    }
  });

  upstream.on("error", (err) => {
    console.log("Upstream error:", err.message);
    if (client.readyState === WebSocket.OPEN) {
      client.close();
    }
  });

  client.on("message", (msg) => {
    if (upstream.readyState === WebSocket.OPEN) {
      upstream.send(msg);
    }
  });

  client.on("close", () => {
    console.log("Client closed");
    if (upstream.readyState === WebSocket.OPEN) {
      upstream.close();
    }
  });

  client.on("error", (err) => {
    console.log("Client error:", err.message);
    if (upstream.readyState === WebSocket.OPEN) {
      upstream.close();
    }
  });
});

const PORT = process.env.PORT || 10000;
server.listen(PORT, () => {
  console.log("Sploop proxy listening on port", PORT);
});
