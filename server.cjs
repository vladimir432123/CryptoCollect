const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');
const mysql = require('mysql2');
const { Telegraf, Markup } = require('telegraf');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 8080;

app.use(bodyParser.json());

// Обслуживание статических файлов из папки dist
app.use(express.static(path.join(__dirname, 'dist')));

// Обслуживание index.html для всех маршрутов
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.post('/webhook', (req, res) => {
    console.log('Received webhook request:', req.body);
    bot.handleUpdate(req.body);
    res.sendStatus(200);
});

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
    db.query('INSERT INTO user (username) VALUES (?)', [username], (err) => {
        if (err) {
            if (err.code === 'ER_DUP_ENTRY') {
                ctx.reply(
                    `Привет, ${username}! Добро пожаловать в Crypto Collect. Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.`,
                    Markup.inlineKeyboard([
                        Markup.button.url('Play', 'https://t.me/your_bot?start=miniapp')
                    ])
                );
            } else {
                ctx.reply('Произошла ошибка при создании вашего аккаунта. Пожалуйста, попробуйте позже.');
            }
            return;
        }
        ctx.reply(
            `Привет, ${username}! Добро пожаловать в Crypto Collect. Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.`,
            Markup.inlineKeyboard([
                Markup.button.url('Play', 'https://t.me/your_bot?start=miniapp')
            ])
        );
    });
});

app.post('/webhook', (req, res) => {
    const { message } = req.body;

    if (!message || !message.from || !message.from.username) {
        return res.status(400).send('Invalid request');
    }

    const username = message.from.username;

    const query = 'INSERT INTO user (username) VALUES (?) ON DUPLICATE KEY UPDATE username = VALUES(username)';
    db.query(query, [username], (err) => {
        if (err) {
            return res.status(500).send('Ошибка при сохранении пользователя');
        }
        res.send('OK');
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
