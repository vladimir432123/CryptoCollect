const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');
const mysql = require('mysql2');
const { Telegraf, Markup } = require('telegraf');
const crypto = require('crypto');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 8080;

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

db.query(`
    CREATE TABLE IF NOT EXISTS user (
        id INT AUTO_INCREMENT PRIMARY KEY,
        telegram_id BIGINT UNIQUE,
        username VARCHAR(255) UNIQUE,
        auth_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
`, (err) => {
    if (err) {
        console.error('Ошибка создания таблицы:', err);
    } else {
        console.log('Таблица user проверена/создана');
    }
});

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);

bot.command('openapp', (ctx) => {
    const telegramId = ctx.message.from.id;
    console.log(`Received /openapp command from ${telegramId}`);

    const miniAppUrl = `https://t.me/cryptocollect_bot?startapp=${telegramId}&tgWebApp=true`;
    console.log('URL для мини-приложения:', miniAppUrl);

    ctx.reply(
        'Нажмите на кнопку ниже, чтобы открыть мини-приложение:',
        Markup.inlineKeyboard([
            Markup.button.url('Открыть мини-приложение', miniAppUrl)
        ])
    );
});

const MAX_AUTH_DATE_AGE = 86400;

function isAuthDateValid(authDate) {
    const now = Math.floor(Date.now() / 1000);
    return (now - authDate) < MAX_AUTH_DATE_AGE;
}

function checkTelegramAuth(telegramData) {
    const { hash, ...data } = telegramData;

    const dataCheckString = Object.keys(data)
        .filter(key => data[key] !== null)
        .sort()
        .map(key => `${key}=${data[key]}`)
        .join('\n');

    console.log('Data check string:', dataCheckString);

    const secret = crypto.createHash('sha256').update(process.env.TELEGRAM_BOT_TOKEN, 'utf8').digest();
    console.log('Secret key (hashed token):', secret.toString('hex'));

    const expectedHash = crypto.createHmac('sha256', secret)
        .update(dataCheckString, 'utf8')
        .digest('hex');

    console.log('Expected hash:', expectedHash);
    console.log('Received hash:', hash);

    return expectedHash === hash;
}

// Маршрут для аутентификации
app.post('/api/auth', (req, res) => {
    const data = {
        telegram_id: req.body.telegram_id,
        username: req.body.username,
        auth_date: parseInt(req.body.auth_date, 10),
        hash: req.body.hash,
    };

    console.log('Received POST body:', data);

    if (!isAuthDateValid(data.auth_date)) {
        console.log('Authentication failed due to expired auth_date');
        return res.status(403).json({ message: 'Authentication failed: expired auth_date' });
    }

    const authResult = checkTelegramAuth(data);

    if (authResult) {
        console.log('Authentication successful');

        const query = 'INSERT INTO user (telegram_id, username) VALUES (?, ?) ON DUPLICATE KEY UPDATE username = IFNULL(?, username), auth_date = NOW()';

        db.query(query, [data.telegram_id, data.username, data.username], (err) => {
            if (err) {
                console.error('Database error:', err);
                return res.status(500).send('Server error');
            }

            console.log(`User ${data.username} inserted/updated in database.`);
            return res.json({ username: data.username });
        });
    } else {
        console.log('Authentication failed');
        return res.status(403).json({ message: 'Authentication failed' });
    }
});

// Маршрут для обработки обновлений Telegram
app.post('/webhook', (req, res) => {
    bot.handleUpdate(req.body, res);
});

const startServer = async () => {
    try {
        await bot.telegram.deleteWebhook({ drop_pending_updates: true });

        const webhookUrl = process.env.WEBHOOK_URL;

        await bot.telegram.setWebhook(webhookUrl);
        console.log('Webhook set successfully:', webhookUrl);
    } catch (err) {
        console.error('Ошибка установки вебхука:', err);
    }

    app.listen(port, () => {
        console.log(`Сервер запущен на порту ${port}`);
    });
};

const checkWebhook = async () => {
    try {
        const webhookInfo = await bot.telegram.getWebhookInfo();
        console.log('Информация о вебхуке:', webhookInfo);
    } catch (err) {
        console.error('Ошибка получения информации о вебхуке:', err);
    }
};

startServer();
checkWebhook();
