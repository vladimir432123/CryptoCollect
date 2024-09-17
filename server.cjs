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

// Use body-parser to handle JSON requests
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
    console.error('Error connecting to database:', err);
    return;
  }
  console.log('Successfully connected to database');
});

// Create/update 'user' table in the database
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
      entryTime DATETIME NULL DEFAULT NULL,
      exitTime DATETIME NULL DEFAULT NULL
  )
`,
  (err) => {
    if (err) {
      console.error('Error creating table:', err);
    } else {
      console.log('Table "user" checked/created');
    }
  }
);

// Check and add missing columns
const addColumnIfNotExists = (columnName, columnDefinition) => {
  db.query(`SHOW COLUMNS FROM user LIKE '${columnName}'`, (err, results) => {
    if (err) {
      console.error(`Error checking column ${columnName}:`, err);
      return;
    }
    if (results.length === 0) {
      db.query(`ALTER TABLE user ADD COLUMN ${columnName} ${columnDefinition}`, (err) => {
        if (err) {
          console.error(`Error adding column ${columnName}:`, err);
        } else {
          console.log(`Column ${columnName} added to table "user"`);
        }
      });
    }
  });
};

// Add missing columns
addColumnIfNotExists('incomePerHour', 'DOUBLE DEFAULT 0');
addColumnIfNotExists('entryTime', 'DATETIME NULL DEFAULT NULL');
addColumnIfNotExists('exitTime', 'DATETIME NULL DEFAULT NULL');

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
          console.error('Error saving session token to database:', err);
          return reject(err);
        }
        resolve();
      }
    );
  });
}

function validateSessionToken(token) {
  return new Promise((resolve, reject) => {
    db.query('SELECT * FROM user WHERE session_token = ?', [token], (err, results) => {
      if (err) {
        console.error('Error validating session token:', err);
        return reject(err);
      }
      if (results.length > 0) {
        resolve(results[0]);
      } else {
        resolve(null);
      }
    });
  });
}

bot.start(async (ctx) => {
  const telegramId = ctx.message.from.id;
  const username = ctx.message.from.username || `user_${telegramId}`;

  const sessionToken = generateSessionToken(telegramId);

  db.query('SELECT points FROM user WHERE telegram_id = ?', [telegramId], (err, results) => {
    if (err) {
      return ctx.reply('An error occurred, please try again later.');
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

    const miniAppUrl = `https://t.me/your_bot_username?startapp=${telegramId}&tgWebApp=true&token=${sessionToken}`;

    ctx.reply(
      'Welcome! Click the button below to open the app:',
      Markup.inlineKeyboard([Markup.button.url('Open App', miniAppUrl)])
    );
  });
});

// Save entry and exit time
app.post('/save-entry-exit-time', (req, res) => {
  const { userId, action, time } = req.body;

  if (!userId || !action || !time) {
    console.log('Error: Insufficient data to save entry/exit time');
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const field = action === 'enter' ? 'entryTime' : 'exitTime';
  const query = `
        UPDATE user 
        SET ${field} = ?
        WHERE telegram_id = ?
    `;

  db.query(query, [time, userId], (err) => {
    if (err) {
      console.error('Error saving time:', err);
      return res.status(500).json({ error: 'Server error' });
    }

    console.log(
      `Time of ${action === 'enter' ? 'entry' : 'exit'} saved for user ID:`,
      userId
    );
    res.json({ success: true });
  });
});

app.get('/get-entry-exit-time', (req, res) => {
  const userId = req.query.userId;

  if (!userId) {
    console.error('User ID not provided in request');
    return res.status(400).json({ error: 'User ID is required' });
  }

  const query = 'SELECT entryTime, exitTime FROM user WHERE telegram_id = ?';

  db.query(query, [userId], (err, results) => {
    if (err) {
      console.error('Error fetching entry/exit time:', err);
      return res.status(500).json({ error: 'Server error' });
    }
    if (results.length > 0) {
      res.json(results[0]);
    } else {
      res.status(404).json({ error: 'User not found' });
    }
  });
});

app.post('/update-points', (req, res) => {
  const { userId, points } = req.body;

  if (!userId || points === undefined) {
    return res.status(400).json({ error: 'Missing parameters' });
  }

  const query = `UPDATE user SET points = ? WHERE telegram_id = ?`;

  db.query(query, [points, userId], (err, results) => {
    if (err) {
      console.error('Error updating points:', err);
      res.status(500).json({ error: 'Server error' });
      return;
    }
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
      console.error('Error updating logout time:', err);
      return res.status(500).json({ error: 'Server error' });
    }
    res.json({ success: true });
  });
});

app.get('/app', async (req, res) => {
  const userId = req.query.userId;

  if (!userId) {
    console.error('User ID not provided in request');
    return res.status(400).json({ error: 'User ID is required' });
  }

  console.log('Request from Mini App with User ID:', userId);

  try {
    const query = 'SELECT * FROM user WHERE telegram_id = ?';
    db.query(query, [userId], (err, results) => {
      if (err) {
        console.error('Error checking User ID:', err);
        return res.status(500).json({ error: 'Server error' });
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
          incomePerHour: parseFloat(userData.incomePerHour),
          entryTime: userData.entryTime,
          exitTime: userData.exitTime,
        });
      } else {
        console.error('User not found with User ID:', userId);
        return res.status(404).json({ error: 'User not found' });
      }
    });
  } catch (error) {
    console.error('Error checking User ID:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Save user data (upgrades, clicks, etc.)
app.post('/save-data', (req, res) => {
  const { userId, ...dataToUpdate } = req.body;

  if (!userId) {
    console.log('Error: Insufficient data to save');
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

  db.query(query, [...values, userId], (err, results) => {
    if (err) {
      console.error('Error saving data:', err);
      return res.status(500).json({ error: 'Server error' });
    }

    console.log('Data saved for user ID:', userId);

    res.json({
      success: true,
      ...fieldsToUpdate,
    });
  });
});

app.post('/update-clicks', (req, res) => {
  const { userId, remainingClicks } = req.body;

  if (!userId || remainingClicks === undefined) {
    console.log('Error: Insufficient data to update clicks');
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const query = `
        UPDATE user 
        SET remainingClicks = ?
        WHERE telegram_id = ?
    `;

  db.query(query, [remainingClicks, userId], (err) => {
    if (err) {
      console.error('Error updating clicks:', err);
      return res.status(500).json({ error: 'Server error' });
    }

    console.log('Clicks updated for user ID:', userId);

    res.json({
      success: true,
      remainingClicks,
    });
  });
});

app.post('/webhook', (req, res) => {
  console.log('Received request on /webhook:', req.body);
  bot
    .handleUpdate(req.body)
    .then(() => {
      res.sendStatus(200);
    })
    .catch((err) => {
      console.error('Error handling request:', err);
      res.sendStatus(500);
    });
});

const startServer = async () => {
  try {
    await bot.telegram.deleteWebhook({ drop_pending_updates: true });

    const webhookUrl = process.env.WEBHOOK_URL;
    await bot.telegram.setWebhook(webhookUrl);
    console.log('Webhook set:', webhookUrl);

    app.listen(port, () => {
      console.log(`Server running on port ${port}`);
    });
  } catch (err) {
    console.error('Error setting webhook:', err);
  }
};

startServer();
