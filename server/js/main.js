// server/js/main.js

// Минимальный, упрощённый запуск сервера BrowserQuest без config.json и metrics

var ws          = require("./ws");
var WorldServer = require("./worldserver");
var Player      = require("./player").Player;

// Простой логгер вместо пакета "log"
var log = {
    info: function () {
        console.log.apply(console, arguments);
    },
    error: function () {
        console.error.apply(console, arguments);
    },
    debug: function () {
        console.log.apply(console, arguments);
    }
};

function getWorldDistribution(worlds) {
    var distribution = [];
    for (var i = 0; i < worlds.length; i++) {
        distribution.push(worlds[i].playerCount);
    }
    return distribution;
}

function main() {
    // Порт, который даёт Render (если нет — 10000 по умолчанию)
    var port = process.env.PORT || 10000;

    // Сколько миров и сколько игроков на мир
    var nbWorlds           = 1;      // тебе хватит одного мира
    var nbPlayersPerWorld  = 200;    // максимум игроков в мире
    var mapFile            = "./server/maps/world_server.json"; // стандартная карта

    log.info("Starting BrowserQuest game server...");

    // Создаём WebSocket-сервер
    var server = new ws.MultiVersionWebsocketServer(port);

    // Создаём миры
    var worlds = [];
    for (var i = 0; i < nbWorlds; i++) {
        var worldName = "world" + (i + 1);
        var world = new WorldServer(worldName, nbPlayersPerWorld, server);
        world.run(mapFile);
        worlds.push(world);
        log.info(worldName + " created (capacity: " + nbPlayersPerWorld + " players).");
    }

    // Когда подключается новый игрок
    server.onConnect(function (connection) {
        var world = null;

        // Выбираем мир с наименьшим количеством игроков
        for (var i = 0; i < worlds.length; i++) {
            if (!world || worlds[i].playerCount < world.playerCount) {
                world = worlds[i];
            }
        }

        if (!world) {
            log.error("No world available in onConnect. worlds.length=" + worlds.length);
            try {
                connection.close();
            } catch (e) {}
            return;
        }

        if (typeof world.connect_callback === "function") {
            world.connect_callback(new Player(connection, world));
        } else {
            log.error("world.connect_callback is not a function");
            try {
                connection.close();
            } catch (e) {}
        }
    });

    // Логи ошибок сервера
    server.onError(function () {
        log.error(Array.prototype.join.call(arguments, ", "));
    });

    // Эндпоинт статуса (не обязателен, но пусть будет)
    server.onRequestStatus(function () {
        return JSON.stringify(getWorldDistribution(worlds));
    });

    // Ловим необработанные исключения, чтобы сервер не падал без лога
    process.on("uncaughtException", function (e) {
        log.error("uncaughtException: " + e);
    });

    log.info("Server (everything) is listening on port " + port);
}

// Стартуем сразу
main();
