// server.cjs

const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');
const mysql = require('mysql2/promise'); // Используем promise-версию mysql2
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
    const [rows] = await pool.query(`SHOW COLUMNS FROM user LIKE ?`, [columnName]);
    if (rows.length === 0) {
      await pool.query(`ALTER TABLE user ADD COLUMN ${columnName} ${columnDefinition}`);
      console.log(`Столбец ${columnName} успешно добавлен в таблицу user`);
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
          farmExitTime TIMESTAMP NULL DEFAULT NULL  -- Время выхода из Farm
      )
    `);
    console.log('Таблица user проверена/создана');

    // Добавляем недостающие столбцы, если они отсутствуют
    await addColumnIfNotExists('tasks_current_day', 'INT DEFAULT 1');
    await addColumnIfNotExists('tasks_last_collected', 'DATETIME NULL DEFAULT NULL');
    await addColumnIfNotExists('lastResetTime', 'BIGINT DEFAULT 0');
    await addColumnIfNotExists('farmEntryTime', 'TIMESTAMP NULL DEFAULT NULL');
    await addColumnIfNotExists('farmExitTime', 'TIMESTAMP NULL DEFAULT NULL');
    // Предполагается, что поля entryTime и exitTime уже существуют для MineContent
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

// Функция для валидации session token
async function validateSessionToken(token) {
  try {
    const [rows] = await pool.query('SELECT * FROM user WHERE session_token = ?', [token]);
    return rows.length > 0 ? rows[0] : null;
  } catch (err) {
    console.error('Ошибка проверки session token:', err);
    throw err;
  }
}

// Обработка команды /start для бота
bot.start(async (ctx) => {
  const telegramId = ctx.message.from.id;
  const username = ctx.message.from.username || `user_${telegramId}`;

  const sessionToken = generateSessionToken();

  try {
    const [rows] = await pool.query('SELECT points FROM user WHERE telegram_id = ?', [telegramId]);

    if (rows.length > 0) {
      await saveSessionToken(telegramId, sessionToken);
    } else {
      await pool.query(
        'INSERT INTO user (telegram_id, username, session_token, points, remainingClicks) VALUES (?, ?, ?, 10000, 1000)',
        [telegramId, username, sessionToken]
      );
    }

    const miniAppUrl = `https://t.me/cryptocollect_bot?startapp=${telegramId}&tgWebApp=true&token=${sessionToken}`;

    await ctx.reply(
      'Добро пожаловать! Нажмите на кнопку ниже, чтобы открыть приложение:',
      Markup.inlineKeyboard([Markup.button.url('Открыть приложение', miniAppUrl)])
    );
  } catch (err) {
    console.error('Ошибка при обработке команды /start:', err);
    await ctx.reply('Произошла ошибка, попробуйте позже.');
  }
});

// Сохранение времени входа и выхода с вкладки
app.post('/save-entry-exit-time', async (req, res) => {
  const { userId, action } = req.body;

  if (!userId || !action) {
    console.log('Ошибка: Недостаточно данных для сохранения времени входа/выхода');
    return res.status(400).json({ error: 'Missing required fields' });
  }

  let field;
  switch(action) {
    case 'enter_farm':
      field = 'farmEntryTime';
      break;
    case 'exit_farm':
      field = 'farmExitTime';
      break;
    case 'enter_mine':
      field = 'entryTime'; // Используем существующее поле для MineContent
      break;
    case 'exit_mine':
      field = 'exitTime';  // Используем существующее поле для MineContent
      break;
    default:
      return res.status(400).json({ error: 'Invalid action' });
  }

  try {
    await pool.query(`UPDATE user SET ${field} = NOW() WHERE telegram_id = ?`, [userId]);
    console.log(`Время ${action} успешно сохранено для пользователя с ID:`, userId);
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

  const query = `
        UPDATE user
        SET last_logout = ?, remainingClicks = ?
        WHERE telegram_id = ?
    `;

  try {
    await pool.query(query, [lastLogout, remainingClicks, userId]);
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
    const [rows] = await pool.query('SELECT * FROM user WHERE telegram_id = ?', [userId]);
    if (rows.length > 0) {
      const userData = rows[0];

      let { remainingClicks, last_logout, tapIncreaseLevel, tapProfitLevel } = userData;

      // Определяем maxClicks на основе tapIncreaseLevel
      const maxClicks = 1000 + (tapIncreaseLevel - 1) * 500; // Пример: каждый уровень увеличивает maxClicks на 500

      // Восстановление кликов на основе разницы во времени
      if (last_logout) {
        const lastLogoutTime = new Date(userData.last_logout);
        const now = new Date();
        const diffSeconds = Math.floor((now - lastLogoutTime) / 1000); // Разница в секундах

        const restoredClicks = diffSeconds; // 1 клик в секунду

        remainingClicks = Math.min(remainingClicks + restoredClicks, maxClicks);

        // Обновляем remainingClicks и сбрасываем last_logout
        await pool.query(
          'UPDATE user SET remainingClicks = ?, last_logout = NULL WHERE telegram_id = ?',
          [remainingClicks, userId]
        );

        console.log(`Восстановлено ${restoredClicks} кликов для пользователя с ID: ${userId}`);
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
        incomePerHour: parseFloat(userData.incomePerHour), // Добавлено parseFloat для точности
        entryTime: userData.entryTime,
        exitTime: userData.exitTime,
        tasks_current_day: userData.tasks_current_day,
        tasks_last_collected: userData.tasks_last_collected,
        lastResetTime: userData.lastResetTime, // Возвращаем lastResetTime
        farmEntryTime: userData.farmEntryTime, // Возвращаем farmEntryTime
        farmExitTime: userData.farmExitTime,   // Возвращаем farmExitTime
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
    'lastResetTime', // Разрешаем обновление lastResetTime
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
    console.log('Данные успешно сохранены для пользователя с ID:', userId);

    res.json({
      success: true,
      ...fieldsToUpdate,
    });
  } catch (err) {
    console.error('Ошибка при сохранении данных:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Обработка ежедневных наград

// Получение состояния задач пользователя
app.get('/tasks', async (req, res) => {
  const userId = req.query.userId;

  if (!userId) {
    return res.status(400).json({ error: 'User ID обязателен' });
  }

  try {
    const [rows] = await pool.query('SELECT tasks_current_day, tasks_last_collected FROM user WHERE telegram_id = ?', [userId]);

    if (rows.length > 0) {
      const userData = rows[0];
      const currentDay = userData.tasks_current_day;
      const lastCollected = userData.tasks_last_collected ? new Date(userData.tasks_last_collected) : null;
      const now = new Date();

      let canCollect = false;

      if (lastCollected) {
        const diffTime = now.getTime() - lastCollected.getTime();
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays === 1) {
          canCollect = true;
        } else if (diffDays > 1) {
          // Пользователь пропустил день, сбрасываем задачи
          await pool.query('UPDATE user SET tasks_current_day = 1, tasks_last_collected = NULL WHERE telegram_id = ?', [userId]);
          res.json({
            currentDay: 1,
            canCollect: true,
          });
          return;
        }
      } else {
        canCollect = true; // Пользователь еще не собирал награды
      }

      res.json({
        currentDay,
        canCollect,
      });
    } else {
      res.status(404).json({ error: 'Пользователь не найден' });
    }
  } catch (err) {
    console.error('Ошибка при получении данных задач:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Сбор награды за день
app.post('/collect-task', async (req, res) => {
  const { userId, day } = req.body;

  if (!userId || !day) {
    return res.status(400).json({ error: 'Недостаточно данных для сбора награды' });
  }

  // Определение наград за каждый день
  const rewards = {
    1: 10000,
    2: 15000,
    3: 20000,
    4: 25000,
    5: 30000,
    6: 35000,
    7: 40000,
  };

  if (!rewards[day]) {
    return res.status(400).json({ error: 'Некорректный день' });
  }

  try {
    // Получение текущих данных пользователя
    const [rows] = await pool.query('SELECT tasks_current_day, tasks_last_collected, points, tapIncreaseLevel FROM user WHERE telegram_id = ?', [userId]);

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }

    const userData = rows[0];
    const { tasks_current_day, tasks_last_collected, points, tapIncreaseLevel } = userData;

    const now = new Date();
    const lastCollected = tasks_last_collected ? new Date(userData.tasks_last_collected) : null;

    // Определяем maxClicks на основе tapIncreaseLevel
    const maxClicks = 1000 + (tapIncreaseLevel - 1) * 500; // Пример: каждый уровень увеличивает maxClicks на 500

    // Проверка, можно ли собрать награду
    if (day !== tasks_current_day) {
      return res.status(400).json({ error: 'Вы можете собрать только награду за текущий день' });
    }

    if (lastCollected) {
      const diffTime = now.getTime() - lastCollected.getTime();
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

      if (diffDays < 1) {
        return res.status(400).json({ error: 'Награду можно собрать только раз в день' });
      } else if (diffDays > 1) {
        // Пользователь пропустил день, сбрасываем задачи
        await pool.query('UPDATE user SET tasks_current_day = 1, tasks_last_collected = NULL WHERE telegram_id = ?', [userId]);
        return res.status(400).json({ error: 'Вы пропустили день. Задачи сброшены.' });
      }
    }

    // Обновление данных пользователя
    const newPoints = points + rewards[day];
    const newDay = day < 7 ? day + 1 : 1;
    const newLastCollected = now;

    await pool.query(
      'UPDATE user SET points = ?, tasks_current_day = ?, tasks_last_collected = ? WHERE telegram_id = ?',
      [newPoints, newDay, newLastCollected, userId]
    );

    res.json({
      success: true,
      newPoints,
      newDay,
    });
  } catch (err) {
    console.error('Ошибка при сборе награды:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

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
