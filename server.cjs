// server.cjs

const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');
const mysql = require('mysql2');
const { Telegraf, Markup } = require('telegraf');
const crypto = require('crypto');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 8080;

// Используем body-parser для обработки JSON-запросов
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'dist')));

const dbConfig = {
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT || 3306,
};

const db = mysql.createConnection(dbConfig);

db.connect((err) => {
  if (err) {
    console.error('Ошибка подключения к базе данных:', err);
    return;
  }
  console.log('Успешное подключение к базе данных');
});

// Функция для добавления столбца, если он не существует
const addColumnIfNotExists = (columnName, columnDefinition) => {
  db.query(`SHOW COLUMNS FROM user LIKE '${columnName}'`, (err, results) => {
    if (err) {
      console.error(`Ошибка при проверке наличия столбца ${columnName}:`, err);
      return;
    }
    if (results.length === 0) {
      db.query(`ALTER TABLE user ADD COLUMN ${columnName} ${columnDefinition}`, (err) => {
        if (err) {
          console.error(`Ошибка при добавлении столбца ${columnName}:`, err);
        } else {
          console.log(`Столбец ${columnName} успешно добавлен в таблицу user`);
        }
      });
    }
  });
};

// Создание/обновление таблицы 'user' в базе данных
db.query(
  `
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
      entryTime TIMESTAMP NULL DEFAULT NULL,
      exitTime TIMESTAMP NULL DEFAULT NULL,
      tasks_current_day INT DEFAULT 1,
      tasks_last_collected DATETIME NULL DEFAULT NULL
  )
`,
  (err) => {
    if (err) {
      console.error('Ошибка создания таблицы:', err);
    } else {
      console.log('Таблица user проверена/создана');
      // Добавляем недостающие столбцы
      addColumnIfNotExists('tasks_current_day', 'INT DEFAULT 1');
      addColumnIfNotExists('tasks_last_collected', 'DATETIME NULL DEFAULT NULL');
    }
  }
);

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);

function generateSessionToken(telegramId) {
  return crypto.randomBytes(64).toString('hex');
}

function saveSessionToken(telegramId, sessionToken) {
  return new Promise((resolve, reject) => {
    db.query(
      'UPDATE user SET session_token = ? WHERE telegram_id = ?',
      [sessionToken, telegramId],
      (err, results) => {
        if (err) {
          console.error('Ошибка сохранения токена сессии в базе данных:', err);
          return reject(err);
        }
        resolve();
      }
    );
  });
}

function validateSessionToken(token) {
  return new Promise((resolve, reject) => {
    db.query(
      'SELECT * FROM user WHERE session_token = ?',
      [token],
      (err, results) => {
        if (err) {
          console.error('Ошибка проверки токена сессии:', err);
          return reject(err);
        }
        if (results.length > 0) {
          resolve(results[0]);
        } else {
          resolve(null);
        }
      }
    );
  });
}

bot.start(async (ctx) => {
  const telegramId = ctx.message.from.id;
  const username = ctx.message.from.username || `user_${telegramId}`;

  const sessionToken = generateSessionToken(telegramId);

  db.query('SELECT points FROM user WHERE telegram_id = ?', [telegramId], (err, results) => {
    if (err) {
      return ctx.reply('Произошла ошибка, попробуйте позже.');
    }

    if (results.length > 0) {
      db.query('UPDATE user SET session_token = ?, auth_date = NOW() WHERE telegram_id = ?', [
        sessionToken,
        telegramId,
      ]);
    } else {
      db.query(
        'INSERT INTO user (telegram_id, username, session_token, points, remainingClicks) VALUES (?, ?, ?, 10000, 1000)',
        [telegramId, username, sessionToken]
      );
    }

    const miniAppUrl = `https://t.me/cryptocollect_bot?startapp=${telegramId}&tgWebApp=true&token=${sessionToken}`;

    ctx.reply(
      'Добро пожаловать! Нажмите на кнопку ниже, чтобы открыть приложение:',
      Markup.inlineKeyboard([Markup.button.url('Открыть приложение', miniAppUrl)])
    );
  });
});

// Сохранение времени входа и выхода с вкладки
app.post('/save-entry-exit-time', (req, res) => {
  const { userId, action } = req.body;

  if (!userId || !action) {
    console.log('Ошибка: Недостаточно данных для сохранения времени входа/выхода');
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const field = action === 'enter' ? 'entryTime' : 'exitTime';
  const query = `
        UPDATE user 
        SET ${field} = NOW()
        WHERE telegram_id = ?
    `;

  db.query(query, [userId], (err) => {
    if (err) {
      console.error('Ошибка при сохранении времени:', err);
      return res.status(500).json({ error: 'Server error' });
    }

    console.log(
      `Время ${action === 'enter' ? 'входа' : 'выхода'} успешно сохранено для пользователя с ID:`,
      userId
    );
    res.json({ success: true });
  });
});

app.post('/logout', (req, res) => {
  const { userId, remainingClicks, lastLogout } = req.body;

  if (!userId) {
    return res.status(400).json({ error: 'Missing userId' });
  }

  const query = `
        UPDATE user
        SET last_logout = ?, remainingClicks = ?
        WHERE telegram_id = ?
    `;

  db.query(query, [lastLogout, remainingClicks, userId], (err) => {
    if (err) {
      console.error('Ошибка при обновлении времени выхода:', err);
      return res.status(500).json({ error: 'Server error' });
    }
    res.json({ success: true });
  });
});

app.get('/app', async (req, res) => {
  const userId = req.query.userId;

  if (!userId) {
    console.error('User ID не передан в запросе');
    return res.status(400).json({ error: 'User ID обязателен' });
  }

  console.log('Запрос от Mini App с User ID:', userId);

  try {
    const query = 'SELECT * FROM user WHERE telegram_id = ?';
    db.query(query, [userId], (err, results) => {
      if (err) {
        console.error('Ошибка проверки User ID:', err);
        return res.status(500).json({ error: 'Ошибка сервера' });
      }
      if (results.length > 0) {
        const userData = results[0];
        return res.json({
          username: userData.username,
          points: userData.points,
          tapProfitLevel: userData.tapProfitLevel,
          tapIncreaseLevel: userData.tapIncreaseLevel,
          remainingClicks: userData.remainingClicks,
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
        });
      } else {
        console.error('Пользователь не найден с User ID:', userId);
        return res.status(404).json({ error: 'Пользователь не найден' });
      }
    });
  } catch (error) {
    console.error('Ошибка при проверке User ID:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Сохранение данных пользователя (улучшения, клики и т.д.)
app.post('/save-data', (req, res) => {
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

  db.query(query, [...values, userId], (err) => {
    if (err) {
      console.error('Ошибка при сохранении данных:', err);
      return res.status(500).json({ error: 'Server error' });
    }

    console.log('Данные успешно сохранены для пользователя с ID:', userId);

    res.json({
      success: true,
      ...fieldsToUpdate,
    });
  });
});

// Обработка ежедневных наград

// Получение состояния задач пользователя
app.get('/tasks', (req, res) => {
  const userId = req.query.userId;

  if (!userId) {
    return res.status(400).json({ error: 'User ID обязателен' });
  }

  const query = 'SELECT tasks_current_day, tasks_last_collected FROM user WHERE telegram_id = ?';
  db.query(query, [userId], (err, results) => {
    if (err) {
      console.error('Ошибка при получении данных задач:', err);
      return res.status(500).json({ error: 'Ошибка сервера' });
    }

    if (results.length > 0) {
      const userData = results[0];
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
          const resetQuery = 'UPDATE user SET tasks_current_day = 1, tasks_last_collected = NULL WHERE telegram_id = ?';
          db.query(resetQuery, [userId], (resetErr) => {
            if (resetErr) {
              console.error('Ошибка при сбросе задач:', resetErr);
              return res.status(500).json({ error: 'Ошибка сервера' });
            }
            res.json({
              currentDay: 1,
              canCollect: true,
            });
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
  });
});

// Сбор награды за день
app.post('/collect-task', (req, res) => {
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

  // Получение текущих данных пользователя
  const query = 'SELECT tasks_current_day, tasks_last_collected, points FROM user WHERE telegram_id = ?';
  db.query(query, [userId], (err, results) => {
    if (err) {
      console.error('Ошибка при получении данных пользователя:', err);
      return res.status(500).json({ error: 'Ошибка сервера' });
    }

    if (results.length === 0) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }

    const userData = results[0];
    const { tasks_current_day, tasks_last_collected, points } = userData;

    const now = new Date();
    const lastCollected = tasks_last_collected ? new Date(tasks_last_collected) : null;

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
        const resetQuery = 'UPDATE user SET tasks_current_day = 1, tasks_last_collected = NULL WHERE telegram_id = ?';
        db.query(resetQuery, [userId], (resetErr) => {
          if (resetErr) {
            console.error('Ошибка при сбросе задач:', resetErr);
            return res.status(500).json({ error: 'Ошибка сервера' });
          }
          res.status(400).json({ error: 'Вы пропустили день. Задачи сброшены.' });
        });
        return;
      }
    }

    // Обновление данных пользователя
    const newPoints = points + rewards[day];
    const newDay = day < 7 ? day + 1 : 1;
    const newLastCollected = now;

    const updateQuery = `
      UPDATE user 
      SET points = ?, tasks_current_day = ?, tasks_last_collected = ?
      WHERE telegram_id = ?
    `;

    db.query(updateQuery, [newPoints, newDay, newLastCollected, userId], (err) => {
      if (err) {
        console.error('Ошибка при обновлении данных пользователя:', err);
        return res.status(500).json({ error: 'Ошибка сервера' });
      }

      res.json({
        success: true,
        newPoints,
        newDay,
      });
    });
  });
});

// Обработка вебхука Telegram
app.post('/webhook', (req, res) => {
  console.log('Получен запрос на /webhook:', req.body);
  bot
    .handleUpdate(req.body)
    .then(() => {
      res.sendStatus(200);
    })
    .catch((err) => {
      console.error('Ошибка при обработке запроса:', err);
      res.sendStatus(500);
    });
});

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
