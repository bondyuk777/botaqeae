const { Client, GatewayIntentBits } = require("discord.js");
const { Pool } = require("pg");

// Подключаемся к базе PostgreSQL через переменную окружения
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// Создаём таблицу, если её нет
async function initDB() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS my_table (
      id SERIAL PRIMARY KEY,
      user_id TEXT UNIQUE NOT NULL,
      token TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
  console.log("Database initialized.");
}

// Инициализируем Discord-бота
const bot = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] });

bot.once("ready", async () => {
  console.log(`Logged in as ${bot.user.tag}!`);
  await initDB();
});

// Обработчик сообщений
bot.on("messageCreate", async message => {
  if (message.author.bot) return;

  const args = message.content.trim().split(/\s+/);
  const command = args[0].toLowerCase();

  // !settoken <токен>
  if (command === "!settoken") {
    const token = args[1];
    if (!token) return message.reply("Please provide a token.");
    try {
      await pool.query(`
        INSERT INTO my_table (user_id, token) 
        VALUES ($1, $2)
        ON CONFLICT (user_id) 
        DO UPDATE SET token = EXCLUDED.token, created_at = CURRENT_TIMESTAMP
      `, [message.author.id, token]);
      message.reply("Token saved successfully!");
    } catch (err) {
      console.error(err);
      message.reply("Error saving token.");
    }
  }

  // !deltoken
  else if (command === "!deltoken") {
    try {
      await pool.query(`DELETE FROM my_table WHERE user_id = $1`, [message.author.id]);
      message.reply("Token deleted successfully!");
    } catch (err) {
      console.error(err);
      message.reply("Error deleting token.");
    }
  }

  // !mytoken
  else if (command === "!mytoken") {
    try {
      const res = await pool.query(`SELECT token FROM my_table WHERE user_id = $1`, [message.author.id]);
      if (res.rows.length === 0) return message.reply("You don't have a token saved.");
      message.reply(`Your token: ${res.rows[0].token}`);
    } catch (err) {
      console.error(err);
      message.reply("Error fetching token.");
    }
  }
});

// Запуск бота
bot.login(process.env.BOT_TOKEN);
