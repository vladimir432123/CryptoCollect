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
    console.log(`Received start command from ${username}`);
    db.query('INSERT INTO user (username) VALUES (?) ON DUPLICATE KEY UPDATE last_seen = NOW()', [username], (err) => {
        if (err) {
            console.error('Database error:', err);
            if (err.code === 'ER_DUP_ENTRY') {
                // Обработка ошибки дублирующегося имени пользователя, если нужно
            } else {
                ctx.reply('Произошла ошибка при создании вашего аккаунта. Пожалуйста, попробуйте позже.');
            }
            return;
        }
    });
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

    db.query('INSERT INTO user (username) VALUES (?) ON DUPLICATE KEY UPDATE last_seen = NOW()', [username], (err, results) => {
        if (err) {
            console.error('Database error:', err);
            return res.status(500).send('Server error');
        }

        console.log(`User ${username} logged in via mini-app`);
        res.send('User data saved successfully');
    });
});

const startServer = async () => {
    try {
        await bot.telegram.deleteWebhook({ drop_pending_updates: true });
        const webhookUrl = 'https://your-server-url.com/webhook'; // Обнови на свой URL
        await bot.telegram.setWebhook(webhookUrl);
        console.log('Webhook set successfully:', webhookUrl);
    } catch (err) {
        console.error('Ошибка установки вебхука:', err);
    }

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
bot.launch().then(() => console.log('Bot launched successfully')).catch((err) => console.error('Ошибка запуска бота:', err));

