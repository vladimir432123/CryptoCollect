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

// Обслуживаем статические файлы из папки 'dist' и 'public/images'
app.use(express.static(path.join(__dirname, 'dist')));
app.use('/images', express.static(path.join(__dirname, 'public/images'))); // Добавлено для изображений

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
          clickRecoveryLevel INT DEFAULT 1, -- Добавлено новое поле для Click Recovery
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
          avatar_file_id VARCHAR(255) DEFAULT NULL -- Добавлено поле для хранения file_id аватарки
      )
    `);
    console.log('Таблица user проверена/создана');

    // Добавляем недостающие столбцы, если они отсутствуют
    await addColumnIfNotExists('clickRecoveryLevel', 'INT DEFAULT 1'); // Добавляем столбец для Click Recovery
    await addColumnIfNotExists('tasks_current_day', 'INT DEFAULT 1');
    await addColumnIfNotExists('tasks_last_collected', 'DATETIME NULL DEFAULT NULL');
    await addColumnIfNotExists('lastResetTime', 'BIGINT DEFAULT 0');
    await addColumnIfNotExists('farmEntryTime', 'TIMESTAMP NULL DEFAULT NULL');
    await addColumnIfNotExists('farmExitTime', 'TIMESTAMP NULL DEFAULT NULL');
    await addColumnIfNotExists('referrer_id', 'BIGINT DEFAULT NULL');
    await addColumnIfNotExists('invite_count', 'INT DEFAULT 0');
    await addColumnIfNotExists('task1_collected', 'BOOLEAN DEFAULT FALSE');
    await addColumnIfNotExists('task2_collected', 'BOOLEAN DEFAULT FALSE');
    await addColumnIfNotExists('task3_collected', 'BOOLEAN DEFAULT FALSE');
    await addColumnIfNotExists('task4_collected', 'BOOLEAN DEFAULT FALSE');
    await addColumnIfNotExists('task5_collected', 'BOOLEAN DEFAULT FALSE');
    await addColumnIfNotExists('avatar_file_id', 'VARCHAR(255) DEFAULT NULL'); // Добавлено для avatar_file_id
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
    const [rows] = await pool.query('SELECT * FROM user WHERE telegram_id = ?', [telegramId]);

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
        await pool.query('UPDATE user SET points = points + 20000 WHERE telegram_id = ?', [
          telegramId,
        ]);

        // Рефереру
        const [referrerRows] = await pool.query('SELECT * FROM user WHERE telegram_id = ?', [
          referrerId,
        ]);

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

    // Получение аватарки пользователя
    try {
      const photos = await ctx.telegram.getUserProfilePhotos(telegramId, 0, 1);
      if (photos.total_count > 0 && photos.photos.length > 0) {
        const photo = photos.photos[0][0]; // Берем самую маленькую версию
        const fileId = photo.file_id;
        // Сохраняем fileId в базе данных
        await pool.query('UPDATE user SET avatar_file_id = ? WHERE telegram_id = ?', [fileId, telegramId]);
      }
    } catch (err) {
      console.error('Ошибка при получении аватарки пользователя:', err);
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

// Получение аватарки пользователя
app.get('/user-avatar', async (req, res) => {
  const userId = req.query.userId;

  if (!userId) {
    return res.status(400).json({ error: 'User ID обязателен' });
  }

  try {
    const [rows] = await pool.query('SELECT avatar_file_id FROM user WHERE telegram_id = ?', [userId]);

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }

    const avatarFileId = rows[0].avatar_file_id;

    if (!avatarFileId) {
      return res.status(404).json({ error: 'Аватарка не найдена' });
    }

    // Получаем путь к файлу аватарки
    const file = await bot.telegram.getFile(avatarFileId);
    const fileUrl = `https://api.telegram.org/file/bot${process.env.TELEGRAM_BOT_TOKEN}/${file.file_path}`;

    // Перенаправляем на URL файла
    res.redirect(fileUrl);
  } catch (err) {
    console.error('Ошибка при получении аватарки пользователя:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Остальные маршруты и обработчики...

// Получение списка приглашенных друзей
app.get('/invited-friends', async (req, res) => {
  const userId = req.query.userId;

  if (!userId) {
    return res.status(400).json({ error: 'User ID обязателен' });
  }

  try {
    const [rows] = await pool.query('SELECT username FROM user WHERE referrer_id = ?', [userId]);
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
    console.log('Ошибка: Недостаточно данных для сохранения времени входа/выхода');
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
    await pool.query(`UPDATE user SET ${field} = ? WHERE telegram_id = ?`, [value, userId]);
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
    const [rows] = await pool.query('SELECT * FROM user WHERE telegram_id = ?', [userId]);
    if (rows.length > 0) {
      const userData = rows[0];
      let {
        remainingClicks,
        last_logout,
        tapIncreaseLevel,
        clickRecoveryLevel, // Добавлено
        farmExitTime,
      } = userData;

      // Определяем maxClicks на основе tapIncreaseLevel
      const maxClicks = 1000 + (tapIncreaseLevel - 1) * 500; // Пример: каждый уровень увеличивает maxClicks на 500

      let restoredClicks = 0;

      // Определяем currentRecoveryAmount на основе clickRecoveryLevel
      const clickRecoveryLevels = [
        { level: 1, recoveryAmount: 1 },
        { level: 2, recoveryAmount: 2 },
        { level: 3, recoveryAmount: 3 },
        { level: 4, recoveryAmount: 4 },
        { level: 5, recoveryAmount: 5 },
        { level: 6, recoveryAmount: 6 },
        { level: 7, recoveryAmount: 7 },
        { level: 8, recoveryAmount: 8 },
        { level: 9, recoveryAmount: 9 },
        { level: 10, recoveryAmount: 10 },
      ];

      const currentRecoveryAmount = clickRecoveryLevels[clickRecoveryLevel - 1]?.recoveryAmount || 1;

      const BASE_RECOVERY_RATE = 1000; // 1 секунда

      // Восстановление кликов на основе farmExitTime
      if (farmExitTime) {
        const farmExit = new Date(farmExitTime);
        const now = new Date();
        const diffMilliseconds = now - farmExit;
        const recoveredClicks = Math.floor(diffMilliseconds / BASE_RECOVERY_RATE) * currentRecoveryAmount;

        restoredClicks += recoveredClicks;
      }

      // Обновляем remainingClicks
      if (restoredClicks > 0) {
        remainingClicks = Math.min(remainingClicks + restoredClicks, maxClicks);
        console.log(`Восстановлено ${restoredClicks} кликов для пользователя с ID: ${userId}`);

        // Обновляем remainingClicks и сбрасываем farmExitTime
        await pool.query(
          'UPDATE user SET remainingClicks = ?, farmExitTime = NULL WHERE telegram_id = ?',
          [remainingClicks, userId]
        );
      }

      res.json({
        username: userData.username,
        points: userData.points,
        tapProfitLevel: userData.tapProfitLevel,
        tapIncreaseLevel: userData.tapIncreaseLevel,
        clickRecoveryLevel: userData.clickRecoveryLevel, // Возвращаем clickRecoveryLevel
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
        farmExitTime: userData.farmExitTime, // Возвращаем farmExitTime
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
    'clickRecoveryLevel', // Добавлено
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

// Обработка ежедневных наград

// Получение состояния задач пользователя
app.get('/tasks', async (req, res) => {
  const userId = req.query.userId;

  if (!userId) {
    return res.status(400).json({ error: 'User ID обязателен' });
  }

  try {
    const [rows] = await pool.query(
      'SELECT tasks_current_day, tasks_last_collected FROM user WHERE telegram_id = ?',
      [userId]
    );

    if (rows.length > 0) {
      const userData = rows[0];
      const currentDay = userData.tasks_current_day;
      const lastCollected = userData.tasks_last_collected
        ? new Date(userData.tasks_last_collected)
        : null;
      const now = new Date();

      let canCollect = false;

      if (lastCollected) {
        const diffTime = now.getTime() - lastCollected.getTime();
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays >= 1) {
          canCollect = true;
        } else {
          canCollect = false;
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
    const [rows] = await pool.query(
      'SELECT tasks_current_day, tasks_last_collected, points FROM user WHERE telegram_id = ?',
      [userId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }

    const userData = rows[0];
    const { tasks_current_day, tasks_last_collected, points } = userData;

    const now = new Date();
    const lastCollected = tasks_last_collected ? new Date(userData.tasks_last_collected) : null;

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
        await pool.query(
          'UPDATE user SET tasks_current_day = 1, tasks_last_collected = NULL WHERE telegram_id = ?',
          [userId]
        );
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

// Эндпоинт для получения статуса заданий пользователя
app.get('/user-tasks', async (req, res) => {
  const userId = req.query.userId;

  if (!userId) {
    return res.status(400).json({ error: 'User ID обязателен' });
  }

  try {
    const [rows] = await pool.query('SELECT * FROM user WHERE telegram_id = ?', [userId]);

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }

    const user = rows[0];

    // Определяем статус заданий
    const tasks = [];

    // Получаем количество приглашенных пользователей
    const [invitedRows] = await pool.query(
      'SELECT COUNT(*) as count FROM user WHERE referrer_id = ?',
      [userId]
    );
    const invitedCount = invitedRows[0].count;

    // Задание 1: Пригласите 1 человека в игру
    tasks.push({
      id: 1,
      description: 'Пригласите 1 человека в игру',
      reward: 10000,
      collected: user.task1_collected,
      canCollect: !user.task1_collected && invitedCount >= 1,
    });

    // Задание 2: Пригласите 5 пользователей
    tasks.push({
      id: 2,
      description: 'Пригласите 5 пользователей',
      reward: 100000,
      collected: user.task2_collected,
      canCollect: !user.task2_collected && invitedCount >= 5,
    });

    // Задание 3: Пригласите 10 пользователей
    tasks.push({
      id: 3,
      description: 'Пригласите 10 пользователей',
      reward: 300000,
      collected: user.task3_collected,
      canCollect: !user.task3_collected && invitedCount >= 10,
    });

    // Задание 4: Накопите 100000 монет
    tasks.push({
      id: 4,
      description: 'Накопите ваши первые 100000 монет',
      reward: 50000,
      collected: user.task4_collected,
      canCollect: !user.task4_collected && user.points >= 100000,
    });

    // Задание 5: Улучшите ваше первое улучшение
    tasks.push({
      id: 5,
      description: 'Улучшите ваше первое улучшение',
      reward: 20000,
      collected: user.task5_collected,
      canCollect: !user.task5_collected && user.incomePerHour > 0,
    });

    res.json({ tasks });
  } catch (err) {
    console.error('Ошибка при получении заданий пользователя:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Эндпоинт для сбора награды за задание
app.post('/collect-user-task', async (req, res) => {
  const { userId, taskId } = req.body;

  if (!userId || !taskId) {
    return res.status(400).json({ error: 'Недостаточно данных для сбора награды' });
  }

  try {
    const [rows] = await pool.query('SELECT * FROM user WHERE telegram_id = ?', [userId]);

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }

    const user = rows[0];
    let canCollect = false;
    let reward = 0;
    let taskDescription = '';

    // Проверяем, какое задание пользователь пытается собрать
    switch (taskId) {
      case 1:
        taskDescription = 'Пригласите 1 человека в игру';
        reward = 10000;
        if (!user.task1_collected) {
          const [invitedRows] = await pool.query(
            'SELECT COUNT(*) as count FROM user WHERE referrer_id = ?',
            [userId]
          );
          const invitedCount = invitedRows[0].count;
          if (invitedCount >= 1) {
            canCollect = true;
            await pool.query(
              'UPDATE user SET points = points + ?, task1_collected = TRUE WHERE telegram_id = ?',
              [reward, userId]
            );
          }
        }
        break;
      case 2:
        taskDescription = 'Пригласите 5 пользователей';
        reward = 100000;
        if (!user.task2_collected) {
          const [invitedRows] = await pool.query(
            'SELECT COUNT(*) as count FROM user WHERE referrer_id = ?',
            [userId]
          );
          const invitedCount = invitedRows[0].count;
          if (invitedCount >= 5) {
            canCollect = true;
            await pool.query(
              'UPDATE user SET points = points + ?, task2_collected = TRUE WHERE telegram_id = ?',
              [reward, userId]
            );
          }
        }
        break;
      case 3:
        taskDescription = 'Пригласите 10 пользователей';
        reward = 300000;
        if (!user.task3_collected) {
          const [invitedRows] = await pool.query(
            'SELECT COUNT(*) as count FROM user WHERE referrer_id = ?',
            [userId]
          );
          const invitedCount = invitedRows[0].count;
          if (invitedCount >= 10) {
            canCollect = true;
            await pool.query(
              'UPDATE user SET points = points + ?, task3_collected = TRUE WHERE telegram_id = ?',
              [reward, userId]
            );
          }
        }
        break;
      case 4:
        taskDescription = 'Накопите ваши первые 100000 монет';
        reward = 50000;
        if (!user.task4_collected && user.points >= 100000) {
          canCollect = true;
          await pool.query(
            'UPDATE user SET points = points + ?, task4_collected = TRUE WHERE telegram_id = ?',
            [reward, userId]
          );
        }
        break;
      case 5:
        taskDescription = 'Улучшите ваше первое улучшение';
        reward = 20000;
        if (!user.task5_collected && user.incomePerHour > 0) {
          canCollect = true;
          await pool.query(
            'UPDATE user SET points = points + ?, task5_collected = TRUE WHERE telegram_id = ?',
            [reward, userId]
          );
        }
        break;
      default:
        return res.status(400).json({ error: 'Некорректный идентификатор задания' });
    }

    if (canCollect) {
      const [updatedRows] = await pool.query('SELECT points FROM user WHERE telegram_id = ?', [
        userId,
      ]);
      const newPoints = updatedRows[0].points;
      res.json({
        success: true,
        newPoints,
        taskDescription,
      });
    } else {
      res.json({ success: false, error: 'Нельзя собрать награду за это задание' });
    }
  } catch (err) {
    console.error('Ошибка при сборе награды за задание:', err);
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
