const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');
const mysql = require('mysql2');
const { Telegraf, Markup } = require('telegraf');
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

    // Формируем URL с параметром username
    const miniAppUrl = `https://app-21c4d0cd-2996-4394-bf8a-a453b9f7e396.cleverapps.io/?username=${encodeURIComponent(username)}`;

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

    const miniAppUrl = `https://app-21c4d0cd-2996-4394-bf8a-a453b9f7e396.cleverapps.io/?username=${encodeURIComponent(username)}`;

    ctx.reply(
        'Нажмите на кнопку ниже, чтобы открыть мини-приложение:',
        Markup.inlineKeyboard([
            Markup.button.url('Открыть мини-приложение', miniAppUrl)
        ])
    );
});

// Маршрут для получения данных пользователя по его ID
app.get('/api/user/:userId', (req, res) => {
    const userId = req.params.userId;
    const query = 'SELECT username FROM user WHERE id = ?';

    db.query(query, [userId], (err, results) => {
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

// Маршрут для сохранения данных пользователя при запуске мини-приложения
app.post('/api/user', (req, res) => {
    const { username } = req.body;

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

// Обработка запросов, поступающих на вебхук
app.post('/webhook', (req, res) => {
    bot.handleUpdate(req.body, res);
});

const startServer = async () => {
    try {
        // Удаляем существующий вебхук перед запуском
        await bot.telegram.deleteWebhook({ drop_pending_updates: true });

        const webhookUrl = 'https://app-21c4d0cd-2996-4394-bf8a-a453b9f7e396.cleverapps.io/webhook'; // Обновите на ваш URL

        // Устанавливаем новый вебхук
        await bot.telegram.setWebhook(webhookUrl);
        console.log('Webhook set successfully:', webhookUrl);
    } catch (err) {
        console.error('Ошибка установки вебхука:', err);
    }

    // Запускаем сервер
    app.listen(port, () => {
        console.log(`Сервер запущен на порту ${port}`);
    });
};

// Дополнительные функции
const checkWebhook = async () => {
    try {
        const webhookInfo = await bot.telegram.getWebhookInfo();
        console.log('Информация о вебхуке:', webhookInfo);
    } catch (err) {
        console.error('Ошибка получения информации о вебхуке:', err);
    }
};

// Запуск сервера и бота
startServer();
checkWebhook();
