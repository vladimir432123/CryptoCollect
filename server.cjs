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

bot.start((ctx) => {
    const username = ctx.message.from.username;
    console.log(`Received start command from ${username}`);
    db.query('INSERT INTO user (username) VALUES (?)', [username], (err) => {
        if (err) {
            console.error('Database error:', err);
            if (err.code === 'ER_DUP_ENTRY') {
                // Handle duplicate entry error
            } else {
                ctx.reply('Произошла ошибка при создании вашего аккаунта. Пожалуйста, попробуйте позже.');
            }
            return;
        }
        // Additional logic if needed
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

// Маршрут для обработки данных авторизации
app.get('/webapp', (req, res) => {
    const { username, user_id } = req.query;
    if (!username || !user_id) {
        res.status(400).send('Invalid request');
        return;
    }

    // Сохранение данных пользователя в базе данных
    db.query('INSERT INTO user (username, telegram_id) VALUES (?, ?) ON DUPLICATE KEY UPDATE last_seen = NOW()', [username, user_id], (err) => {
        if (err) {
            console.error('Database error:', err);
            res.status(500).send('Server error');
            return;
        }
        res.send('User data saved successfully');
    });
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

startServer();

const checkWebhook = async () => {
    try {
        const webhookInfo = await bot.telegram.getWebhookInfo();
        console.log('Информация о вебхуке:', webhookInfo);
    } catch (err) {
        console.error('Ошибка получения информации о вебхуке:', err);
    }
};

checkWebhook();

const handleStartCommand = async (username) => {
    try {
        // Вставляем нового пользователя или обновляем данные, если пользователь уже существует
        await db.query('INSERT INTO user (username) VALUES (?) ON DUPLICATE KEY UPDATE last_seen = NOW()', [username]);
        console.log(`User ${username} inserted or updated successfully.`);
    } catch (error) {
        console.error('Database error:', error);
    }
};

// Обработчик команды /openapp
bot.command('openapp', (ctx) => {
    const username = ctx.message.from.username;
    const miniAppUrl = `https://t.me/cryptocollect_bot?startapp=${username}&tgWebApp=true`;
    
    ctx.reply(
        'Нажмите на кнопку ниже, чтобы открыть мини-приложение в Telegram:',
        Markup.inlineKeyboard([
            Markup.button.url('Open Mini App', miniAppUrl)
        ])
    );
});

bot.launch();
