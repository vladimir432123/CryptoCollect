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

app.get('/api/user/:id', (req, res) => {
    const userId = req.params.id;
    console.log(`Получен запрос для пользователя с ID: ${userId}`); // Логирование ID пользователя
    db.query('SELECT username FROM user WHERE id = ?', [userId], (err, results) => {
        if (err) {
            console.error('Ошибка выполнения запроса:', err);
            res.status(500).send('Ошибка сервера');
            return;
        }
        if (results.length > 0) {
            console.log(`Найдено имя пользователя: ${results[0].username}`); // Логирование имени пользователя
            res.json({ username: results[0].username });
        } else {
            console.log('Пользователь не найден');
            res.status(404).send('Пользователь не найден');
        }
    });
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
    console.log(`Received start command from ${username}`);
    db.query('INSERT INTO user (username) VALUES (?)', [username], (err) => {
        if (err) {
            console.error('Database error:', err);
            if (err.code === 'ER_DUP_ENTRY') {
                ctx.reply(
                    `Привет, ${username}! Добро пожаловать в Crypto Collect. Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.`,
                    Markup.inlineKeyboard([
                        Markup.button.url('Play', 'https://t.me/cryptocollect_bot?start=miniapp')
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
                Markup.button.url('Play', 'https://t.me/cryptocollect_bot?start=miniapp')
            ])
        );
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
