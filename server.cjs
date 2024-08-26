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

bot.start((ctx) => {
    const telegramId = ctx.message.from.id;
    const username = ctx.message.from.username || `user_${telegramId}`;

    console.log(`Received /start command from ${username}`);

    db.query(
        'INSERT INTO user (telegram_id, username) VALUES (?, ?) ON DUPLICATE KEY UPDATE auth_date = NOW()', 
        [telegramId, username], 
        (err) => {
            if (err) {
                console.error('Database error:', err);
            } else {
                console.log(`User ${username} inserted/updated in database.`);
            }
        }
    );

    const miniAppUrl = `https://t.me/cryptocollect_bot?startapp=${username}&tgWebApp=true`;

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

function checkTelegramAuth(data) {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (!token) {
        console.error('TELEGRAM_BOT_TOKEN не установлен');
        return false;
    }

    const secretKey = crypto.createHash('sha256').update(token).digest();
    console.log('Secret Key:', secretKey.toString('hex'));

    const sortedData = `auth_date=${data.auth_date}\ntelegram_id=${data.telegram_id}`;
    console.log('Formatted Data:', sortedData); // Печать строки перед хешированием
    
    const generatedHash = crypto.createHmac('sha256', secretKey).update(sortedData).digest('hex');
    console.log('Generated Hash:', generatedHash);
    console.log('Received Hash:', data.hash);
    
    // Сравнение длины хэшей
    console.log('Generated Hash Length:', generatedHash.length);
    console.log('Received Hash Length:', data.hash.length);
    
    // Если хэши не совпадают, сравнить их посимвольно
    if (generatedHash !== data.hash) {
        for (let i = 0; i < generatedHash.length; i++) {
            if (generatedHash[i] !== data.hash[i]) {
                console.log(`Mismatch at position ${i}: generated = ${generatedHash[i]}, received = ${data.hash[i]}`);
            }
        }
    }
}

app.post('/api/user', (req, res) => {
    const data = {
        telegram_id: String(req.body.telegram_id),
        auth_date: String(req.body.authDate),
        hash: req.body.hash,
    };

    console.log('Received Data:', data);

    if (!checkTelegramAuth(data)) {
        console.log('Telegram auth failed');
        return res.status(403).send('Forbidden');
    }

    const query = 'SELECT * FROM user WHERE telegram_id = ?';

    db.query(query, [data.telegram_id], (err, results) => {
        if (err) {
            console.error('Error fetching user data:', err);
            return res.status(500).send('Server error');
        }

        if (results.length > 0) {
            const user = results[0];
            console.log(`User ${user.username} found in database`);
            res.json({ username: user.username });
        } else {
            console.log('User not found in database');
            res.status(404).send('User not found');
        }
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
