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

// Обслуживание статических файлов из папки dist
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

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);

// Обработка команды /start в боте
bot.start((ctx) => {
    const username = ctx.message.from.username;
    console.log(`Received /start command from ${username}`);

    // Сохраняем или обновляем пользователя в базе данных
    db.query('INSERT INTO user (username) VALUES (?) ON DUPLICATE KEY UPDATE last_seen = NOW()', [username], (err) => {
        if (err) {
            console.error('Database error:', err);
        } else {
            console.log(`User ${username} inserted/updated in database.`);
        }
    });

    const miniAppUrl = `https://app-21c4d0cd-2996-4394-bf8a-a453b9f7e396.cleverapps.io`;

    ctx.reply(
        'Добро пожаловать! Нажмите на кнопку ниже, чтобы открыть мини-приложение:',
        Markup.inlineKeyboard([
            Markup.button.url('Открыть мини-приложение', miniAppUrl)
        ])
    );
});

bot.command('openapp', (ctx) => {
    const username = ctx.message.from.username;
    console.log(`Received /openapp command from ${username}`);

    const miniAppUrl = `https://t.me/cryptocollect_bot?startapp=${username}&tgWebApp=true`;
    console.log('URL для мини-приложения:', miniAppUrl);

    ctx.reply(
        'Нажмите на кнопку ниже, чтобы открыть мини-приложение:',
        Markup.inlineKeyboard([
            Markup.button.url('Открыть мини-приложение', miniAppUrl)
        ])
    );
});

function checkTelegramAuth({ authDate, hash, ...userData }) {
    const secret = crypto.createHash('sha256').update(process.env.TELEGRAM_BOT_TOKEN).digest();
    const checkString = Object.keys(userData)
        .map(key => `${key}=${userData[key]}`)
        .sort()
        .join('\n');
    const hmac = crypto.createHmac('sha256', secret).update(checkString).digest('hex');

    return hmac === hash;
}

app.post('/api/user', (req, res) => {
    const { userId, authDate, hash } = req.body;

    console.log(`User ID: ${userId}, Auth Date: ${authDate}, Hash: ${hash}`);

    if (!checkTelegramAuth({ userId, authDate, hash })) {
        return res.status(403).send('Forbidden');
    }

    const query = 'SELECT * FROM user WHERE id = ?';

    db.query(query, [userId], (err, results) => {
        if (err) {
            console.error('Error fetching user data:', err);
            return res.status(500).send('Server error');
        }

        if (results.length > 0) {
            const user = results[0];
            console.log(`User ${user.username} found in database`);
            res.json({ username: user.username });
        } else {
            res.status(404).send('User not found');
        }
    });
});

app.get('/api/user/current', (req, res) => {
    const query = 'SELECT username FROM user ORDER BY last_seen DESC LIMIT 1';

    db.query(query, (err, results) => {
        if (err) {
            console.error('Error fetching user data:', err);
            res.status(500).send('Server error');
            return;
        }

        if (results.length > 0) {
            res.json({ username: results[0].username });
        } else {
            res.status(404).send('User not found');
        }
    });
});

app.post('/api/user', (req, res) => {
    const { username } = req.body;
    console.log('Полученные данные:', req.body);

    if (!username) {
        return res.status(400).send('Username is required');
    }

    db.query('INSERT INTO user (username) VALUES (?) ON DUPLICATE KEY UPDATE last_seen = NOW()', [username], (err) => {
        if (err) {
            console.error('Database error:', err);
            return res.status(500).send('Server error');
        }

        console.log(`User ${username} logged in via mini-app`);
        res.send('User data saved successfully');
    });
});

app.post('/webhook', (req, res) => {
    bot.handleUpdate(req.body, res);
});

const startServer = async () => {
    try {
        await bot.telegram.deleteWebhook({ drop_pending_updates: true });

        const webhookUrl = 'https://app-21c4d0cd-2996-4394-bf8a-a453b9f7e396.cleverapps.io/webhook';

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
