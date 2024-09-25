// server.cjs

const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');
const mysql = require('mysql2/promise');
const { Telegraf, Markup } = require('telegraf');
const crypto = require('crypto');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 8080;

// Используем body-parser для обработки JSON-запросов
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'dist')));

// Конфигурация базы данных
const dbConfig = {
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT || 3306,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
};

// Создаем пул соединений
const pool = mysql.createPool(dbConfig);

// Функция для добавления столбца, если он не существует
const addColumnIfNotExists = async (columnName, columnDefinition) => {
  try {
    const [rows] = await pool.query(
      `SHOW COLUMNS FROM user LIKE ?`,
      [columnName]
    );
    if (rows.length === 0) {
      await pool.query(
        `ALTER TABLE user ADD COLUMN ${columnName} ${columnDefinition}`
      );
      console.log(
        `Столбец ${columnName} успешно добавлен в таблицу user`
      );
    }
  } catch (err) {
    console.error(`Ошибка при добавлении столбца ${columnName}:`, err);
  }
};

// Создание/обновление таблицы 'user' в базе данных
const initializeDatabase = async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS user (
          id INT AUTO_INCREMENT PRIMARY KEY,
          telegram_id BIGINT UNIQUE,
          username VARCHAR(255) UNIQUE,
          auth_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          session_token VARCHAR(255),
          points INT DEFAULT 10000,
          tapProfitLevel INT DEFAULT 1,
          tapIncreaseLevel INT DEFAULT 1,
          remainingClicks INT DEFAULT 1000,
          last_logout TIMESTAMP NULL DEFAULT NULL,
          upgrade1 INT DEFAULT 1,
          upgrade2 INT DEFAULT 1,
          upgrade3 INT DEFAULT 1,
          upgrade4 INT DEFAULT 1,
          upgrade5 INT DEFAULT 1,
          upgrade6 INT DEFAULT 1,
          upgrade7 INT DEFAULT 1,
          upgrade8 INT DEFAULT 1,
          farmLevel INT DEFAULT 1,
          incomePerHour DOUBLE DEFAULT 0,
          entryTime TIMESTAMP NULL DEFAULT NULL, -- Для MineContent
          exitTime TIMESTAMP NULL DEFAULT NULL,  -- Для MineContent
          tasks_current_day INT DEFAULT 1,
          tasks_last_collected DATETIME NULL DEFAULT NULL,
          lastResetTime BIGINT DEFAULT 0, -- Для хранения времени последнего сброса таймера
          farmEntryTime TIMESTAMP NULL DEFAULT NULL, -- Время входа в Farm
          farmExitTime TIMESTAMP NULL DEFAULT NULL,  -- Время выхода из Farm
          referrer_id BIGINT DEFAULT NULL, -- ID реферера
          invite_count INT DEFAULT 0,      -- Количество приглашенных
          task1_collected BOOLEAN DEFAULT FALSE, -- Статусы выполнения заданий
          task2_collected BOOLEAN DEFAULT FALSE,
          task3_collected BOOLEAN DEFAULT FALSE,
          task4_collected BOOLEAN DEFAULT FALSE,
          task5_collected BOOLEAN DEFAULT FALSE,
          lastCollectTime DATETIME NULL DEFAULT NULL, -- Время последнего сбора монет
          earnedCoins INT DEFAULT 0 -- Накопленные монеты
      )
    `);
    console.log('Таблица user проверена/создана');

    // Добавляем недостающие столбцы, если они отсутствуют
    await addColumnIfNotExists('lastCollectTime', 'DATETIME NULL DEFAULT NULL');
    await addColumnIfNotExists('earnedCoins', 'INT DEFAULT 0');
    // Добавьте остальные недостающие столбцы по аналогии
  } catch (err) {
    console.error('Ошибка при инициализации базы данных:', err);
  }
};

// Инициализируем базу данных
initializeDatabase();

// Инициализация Telegram бота
const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);

// Функция для генерации session token
function generateSessionToken() {
  return crypto.randomBytes(64).toString('hex');
}

// Функция для сохранения session token
async function saveSessionToken(telegramId, sessionToken) {
  try {
    const [result] = await pool.query(
      'UPDATE user SET session_token = ?, auth_date = NOW() WHERE telegram_id = ?',
      [sessionToken, telegramId]
    );
    return result;
  } catch (err) {
    console.error('Ошибка сохранения session token:', err);
    throw err;
  }
}

// Обработка команды /start для бота
bot.start(async (ctx) => {
  const telegramId = ctx.message.from.id;
  const username = ctx.message.from.username || `user_${telegramId}`;
  const args = ctx.message.text.split(' ');

  // Проверяем наличие реферального ID
  let referrerId = null;
  if (args.length > 1) {
    referrerId = parseInt(args[1]); // Telegram ID реферера
    if (referrerId === telegramId) {
      referrerId = null; // Пользователь не может пригласить сам себя
    }
  }

  const sessionToken = generateSessionToken();

  try {
    const [rows] = await pool.query(
      'SELECT * FROM user WHERE telegram_id = ?',
      [telegramId]
    );

    if (rows.length > 0) {
      // Пользователь уже существует
      await saveSessionToken(telegramId, sessionToken);
    } else {
      // Новый пользователь
      await pool.query(
        'INSERT INTO user (telegram_id, username, session_token, points, remainingClicks, referrer_id) VALUES (?, ?, ?, 10000, 1000, ?)',
        [telegramId, username, sessionToken, referrerId]
      );

      // Начисляем бонусы за реферала
      if (referrerId) {
        // Новому пользователю
        await pool.query(
          'UPDATE user SET points = points + 20000 WHERE telegram_id = ?',
          [telegramId]
        );

        // Рефереру
        const [referrerRows] = await pool.query(
          'SELECT * FROM user WHERE telegram_id = ?',
          [referrerId]
        );

        if (referrerRows.length > 0) {
          const referrerData = referrerRows[0];
          const inviteCount = referrerData.invite_count || 0;
          const bonusPoints = 20000 + inviteCount * 15000;

          await pool.query(
            'UPDATE user SET points = points + ?, invite_count = invite_count + 1 WHERE telegram_id = ?',
            [bonusPoints, referrerId]
          );

          // Отправляем сообщение рефереру
          bot.telegram.sendMessage(
            referrerId,
            `Ваш друг ${username} присоединился к игре! Вы получили ${bonusPoints} монет.`
          );
        }
      }
    }

    const miniAppUrl = `https://t.me/cryptocollect_bot?startapp=${telegramId}&tgWebApp=true&token=${sessionToken}`;

    await ctx.reply(
      'Добро пожаловать! Нажмите на кнопку ниже, чтобы открыть приложение:',
      Markup.inlineKeyboard([
        Markup.button.url('Открыть приложение', miniAppUrl),
      ])
    );
  } catch (err) {
    console.error('Ошибка при обработке команды /start:', err);
    await ctx.reply('Произошла ошибка, попробуйте позже.');
  }
});

// Получение списка приглашенных друзей
app.get('/invited-friends', async (req, res) => {
  const userId = req.query.userId;

  if (!userId) {
    return res.status(400).json({ error: 'User ID обязателен' });
  }

  try {
    const [rows] = await pool.query(
      'SELECT username FROM user WHERE referrer_id = ?',
      [userId]
    );
    res.json({ friends: rows });
  } catch (err) {
    console.error('Ошибка при получении списка приглашенных друзей:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Сохранение времени входа и выхода с вкладки
app.post('/save-entry-exit-time', async (req, res) => {
  const { userId, action } = req.body;

  if (!userId || !action) {
    console.log(
      'Ошибка: Недостаточно данных для сохранения времени входа/выхода'
    );
    return res.status(400).json({ error: 'Missing required fields' });
  }

  let field;
  let value;

  switch (action) {
    case 'enter_farm':
      field = 'farmEntryTime';
      value = new Date();
      break;
    case 'exit_farm':
      field = 'farmExitTime';
      value = new Date();
      break;
    case 'clear_farm_exit_time':
      field = 'farmExitTime';
      value = null;
      break;
    case 'enter_mine':
      field = 'entryTime';
      value = new Date();
      break;
    case 'exit_mine':
      field = 'exitTime';
      value = new Date();
      break;
    default:
      return res.status(400).json({ error: 'Invalid action' });
  }

  try {
    await pool.query(
      `UPDATE user SET ${field} = ? WHERE telegram_id = ?`,
      [value, userId]
    );
    console.log(
      `Время ${action} успешно сохранено для пользователя с ID:`,
      userId
    );
    res.json({ success: true });
  } catch (err) {
    console.error('Ошибка при сохранении времени:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Обработка выхода пользователя
app.post('/logout', async (req, res) => {
  const { userId, remainingClicks, lastLogout } = req.body;

  if (!userId) {
    return res.status(400).json({ error: 'Missing userId' });
  }

  try {
    await pool.query(
      'UPDATE user SET last_logout = ?, remainingClicks = ? WHERE telegram_id = ?',
      [lastLogout, remainingClicks, userId]
    );
    res.json({ success: true });
  } catch (err) {
    console.error('Ошибка при обновлении времени выхода:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Получение данных пользователя с восстановлением кликов
app.get('/app', async (req, res) => {
  const userId = req.query.userId;

  if (!userId) {
    console.error('User ID не передан в запросе');
    return res.status(400).json({ error: 'User ID обязателен' });
  }

  console.log('Запрос от Mini App с User ID:', userId);

  try {
    const [rows] = await pool.query(
      'SELECT * FROM user WHERE telegram_id = ?',
      [userId]
    );
    if (rows.length > 0) {
      const userData = rows[0];
      let {
        remainingClicks,
        last_logout,
        tapIncreaseLevel,
        farmExitTime,
      } = userData;

      // Определяем maxClicks на основе tapIncreaseLevel
      const maxClicks = 1000 + (tapIncreaseLevel - 1) * 500;

      let restoredClicks = 0;

      // Восстановление кликов на основе last_logout
      if (last_logout) {
        const lastLogoutTime = new Date(last_logout);
        const now = new Date();
        const diffSeconds = Math.floor(
          (now - lastLogoutTime) / 1000
        );

        restoredClicks += diffSeconds * 1; // 1 клик в секунду
      }

      // Восстановление кликов на основе farmExitTime
      if (farmExitTime) {
        const farmExit = new Date(farmExitTime);
        const now = new Date();
        const diffSecondsFarm = Math.floor(
          (now - farmExit) / 1000
        );

        restoredClicks += diffSecondsFarm * 1; // 1 клик в секунду
      }

      if (restoredClicks > 0) {
        remainingClicks = Math.min(
          remainingClicks + restoredClicks,
          maxClicks
        );
        console.log(
          `Восстановлено ${restoredClicks} кликов для пользователя с ID: ${userId}`
        );

        // Обновляем remainingClicks и сбрасываем farmExitTime и last_logout
        await pool.query(
          'UPDATE user SET remainingClicks = ?, farmExitTime = NULL, last_logout = NULL WHERE telegram_id = ?',
          [remainingClicks, userId]
        );
      }

      res.json({
        username: userData.username,
        points: userData.points,
        tapProfitLevel: userData.tapProfitLevel,
        tapIncreaseLevel: userData.tapIncreaseLevel,
        remainingClicks: remainingClicks,
        lastLogout: userData.last_logout,
        upgrade1: userData.upgrade1,
        upgrade2: userData.upgrade2,
        upgrade3: userData.upgrade3,
        upgrade4: userData.upgrade4,
        upgrade5: userData.upgrade5,
        upgrade6: userData.upgrade6,
        upgrade7: userData.upgrade7,
        upgrade8: userData.upgrade8,
        farmLevel: userData.farmLevel,
        incomePerHour: parseFloat(userData.incomePerHour),
        entryTime: userData.entryTime,
        exitTime: userData.exitTime,
        tasks_current_day: userData.tasks_current_day,
        tasks_last_collected: userData.tasks_last_collected,
        lastResetTime: userData.lastResetTime,
        farmEntryTime: userData.farmEntryTime,
        farmExitTime: userData.farmExitTime,
        lastCollectTime: userData.lastCollectTime,
        earnedCoins: userData.earnedCoins,
      });
    } else {
      console.error('Пользователь не найден с User ID:', userId);
      res.status(404).json({ error: 'Пользователь не найден' });
    }
  } catch (err) {
    console.error('Ошибка при проверке User ID:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Сохранение данных пользователя (улучшения, клики и т.д.)
app.post('/save-data', async (req, res) => {
  const { userId, ...dataToUpdate } = req.body;

  if (!userId) {
    console.log('Ошибка: Недостаточно данных для сохранения');
    return res.status(400).json({ error: 'Missing userId' });
  }

  const allowedFields = [
    'points',
    'tapProfitLevel',
    'tapIncreaseLevel',
    'remainingClicks',
    'upgrade1',
    'upgrade2',
    'upgrade3',
    'upgrade4',
    'upgrade5',
    'upgrade6',
    'upgrade7',
    'upgrade8',
    'farmLevel',
    'incomePerHour',
    'lastResetTime',
    'lastCollectTime',
    'earnedCoins',
  ];

  const fieldsToUpdate = {};
  allowedFields.forEach((field) => {
    if (dataToUpdate[field] !== undefined) {
      fieldsToUpdate[field] = dataToUpdate[field];
    }
  });

  if (Object.keys(fieldsToUpdate).length === 0) {
    return res.status(400).json({ error: 'No fields to update' });
  }

  const setClause = Object.keys(fieldsToUpdate)
    .map((field) => `${field} = ?`)
    .join(', ');
  const values = Object.values(fieldsToUpdate);

  const query = `
    UPDATE user
    SET ${setClause}
    WHERE telegram_id = ?
  `;

  try {
    await pool.query(query, [...values, userId]);
    console.log(`Данные успешно сохранены для пользователя с ID: ${userId}`);

    res.json({
      success: true,
      ...fieldsToUpdate,
    });
  } catch (err) {
    console.error('Ошибка при сохранении данных:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Эндпоинт для получения данных накопления
app.get('/get-accumulation-data', async (req, res) => {
  const userId = req.query.userId;

  if (!userId) {
    return res.status(400).json({ error: 'User ID обязателен' });
  }

  try {
    const [rows] = await pool.query(
      'SELECT lastCollectTime, earnedCoins FROM user WHERE telegram_id = ?',
      [userId]
    );

    if (rows.length > 0) {
      res.json({
        lastCollectTime: rows[0].lastCollectTime,
        earnedCoins: rows[0].earnedCoins,
      });
    } else {
      res.status(404).json({ error: 'Пользователь не найден.' });
    }
  } catch (error) {
    console.error('Ошибка при получении данных накопления:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера.' });
  }
});

// Эндпоинт для сбора монет
app.post('/collect-coins', async (req, res) => {
  const { userId, points, lastCollectTime, earnedCoins } = req.body;

  if (!userId) {
    return res.status(400).json({ error: 'Missing userId' });
  }

  try {
    const [result] = await pool.query(
      'UPDATE user SET points = ?, lastCollectTime = ?, earnedCoins = ? WHERE telegram_id = ?',
      [points, lastCollectTime, earnedCoins, userId]
    );

    if (result.affectedRows > 0) {
      res.json({ success: true, newPoints: points });
    } else {
      res.status(404).json({ error: 'Пользователь не найден.' });
    }
  } catch (error) {
    console.error('Ошибка при сборе монет:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера.' });
  }
});

// Эндпоинт для обновления данных накопления при выходе
app.post('/update-accumulation-data', async (req, res) => {
  const { userId, lastCollectTime, earnedCoins } = req.body;

  if (!userId) {
    return res.status(400).json({ error: 'Missing userId' });
  }

  try {
    await pool.query(
      'UPDATE user SET lastCollectTime = ?, earnedCoins = ? WHERE telegram_id = ?',
      [lastCollectTime, earnedCoins, userId]
    );

    res.json({ success: true });
  } catch (error) {
    console.error('Ошибка при обновлении данных накопления:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера.' });
  }
});

// Остальные существующие эндпоинты остаются без изменений...

// Обработка вебхука Telegram
app.post('/webhook', async (req, res) => {
  console.log('Получен запрос на /webhook:', req.body);
  try {
    await bot.handleUpdate(req.body);
    res.sendStatus(200);
  } catch (err) {
    console.error('Ошибка при обработке запроса:', err);
    res.sendStatus(500);
  }
});

// Запуск Telegram бота и установка вебхука
const startServer = async () => {
  try {
    await bot.telegram.deleteWebhook({ drop_pending_updates: true });

    const webhookUrl = process.env.WEBHOOK_URL;
    await bot.telegram.setWebhook(webhookUrl);
    console.log('Webhook успешно установлен:', webhookUrl);

    app.listen(port, () => {
      console.log(`Сервер запущен на порту ${port}`);
    });
  } catch (err) {
    console.error('Ошибка установки вебхука:', err);
  }
};

startServer();
