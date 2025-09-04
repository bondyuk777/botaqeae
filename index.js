const { Client, GatewayIntentBits } = require("discord.js");
const { Pool } = require("pg");

// ---------- ПЕРЕМЕННЫЕ ОКРУЖЕНИЯ ----------
const BOT_TOKEN = process.env.BOT_TOKEN;
const DATABASE_URL = process.env.DATABASE_URL;
const ADMIN_ID = process.env.ADMIN_ID; // твой Discord ID (админ)

// ---------- ПОДКЛЮЧЕНИЕ К БАЗЕ ----------
const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// ---------- ИНИЦИАЛИЗАЦИЯ ТАБЛИЦЫ ----------
async function initDB() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS my_table (
      id SERIAL PRIMARY KEY,
      user_id TEXT NOT NULL,
      token TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
  console.log("Database initialized.");
}

// ---------- ИНИЦИАЛИЗАЦИЯ БОТА ----------
const bot = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] });

bot.once("ready", async () => {
  console.log(`Logged in as ${bot.user.tag}!`);
  await initDB();
});

// ---------- ОБРАБОТКА СООБЩЕНИЙ ----------
bot.on("messageCreate", async message => {
  if (message.author.bot) return;

  const args = message.content.trim().split(/\s+/);
  const command = args[0].toLowerCase();

  // ---------- ПРОВЕРКА АДМИНА ----------
  if (message.author.id !== ADMIN_ID) {
    return message.reply("You are not admin!");
  }

  // ---------- !settoken <токен> ----------
  if (command === "!settoken") {
    const token = args[1];
    if (!token) return message.reply("Please provide a token.");
    try {
      await pool.query(`
        INSERT INTO my_table (user_id, token) 
        VALUES ($1, $2)
        ON CONFLICT (user_id, token) 
        DO NOTHING
      `, [message.author.id, token]);
      return message.reply("Token saved successfully!");
    } catch (err) {
      console.error(err);
      return message.reply("Error saving token.");
    }
  }

  // ---------- !deltoken <токен> ----------
  else if (command === "!deltoken") {
    const tokenToDelete = args[1];
    if (!tokenToDelete) return message.reply("Please provide the token to delete.");
    try {
      const res = await pool.query(
        `DELETE FROM my_table WHERE user_id = $1 AND token = $2 RETURNING *`,
        [message.author.id, tokenToDelete]
      );
      if (res.rowCount === 0) return message.reply("Token not found or does not belong to you.");
      return message.reply("Token deleted successfully!");
    } catch (err) {
      console.error(err);
      return message.reply("Error deleting token.");
    }
  }

  // ---------- !mytoken ----------
  else if (command === "!mytoken") {
    try {
      const res = await pool.query(`SELECT token FROM my_table WHERE user_id = $1`, [message.author.id]);
      if (res.rows.length === 0) return message.reply("You don't have a token saved.");
      const tokens = res.rows.map(r => r.token).join(", ");
      return message.reply(`Your token(s): ${tokens}`);
    } catch (err) {
      console.error(err);
      return message.reply("Error fetching token.");
    }
  }

  // ---------- !deltokenall ----------
  else if (command === "!deltokenall") {
    try {
      await pool.query(`DELETE FROM my_table`);
      return message.reply("All tokens deleted successfully!");
    } catch (err) {
      console.error(err);
      return message.reply("Error deleting all tokens.");
    }
  }
});

// ---------- ЗАПУСК БОТА ----------
bot.login(BOT_TOKEN);
