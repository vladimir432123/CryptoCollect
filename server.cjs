require('dotenv').config();
const express = require('express');
const mysql = require('mysql2');
const bodyParser = require('body-parser');
const { Telegraf } = require('telegraf');

const app = express();
const port = process.env.PORT || 3002;

app.use(bodyParser.json());

console.log('Инициализация сервера...');

const db = mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT || 3306,
});

db.connect((err) => {
    if (err) {
        console.error('Ошибка подключения к базе данных:', err);
    } else {
        console.log('Подключено к базе данных MySQL');
    }
});

console.log('Настройка Telegram бота...');

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);

bot.start((ctx) => {
    const username = ctx.message.from.username;
    console.log(`Получена команда /start от пользователя: ${username}`);

    db.query('SELECT * FROM user WHERE username = ?', [username], (err, results) => {
        if (err) {
            console.error('Ошибка выполнения запроса:', err);
            return;
        }

        console.log('Результаты запроса:', results);

        if (results.length === 0) {
            db.query('INSERT INTO user (username) VALUES (?)', [username], (err) => {
                if (err) {
                    console.error('Ошибка вставки данных:', err);
                    return;
                }
                console.log(`Аккаунт для пользователя ${username} был создан.`);
                ctx.reply(`Привет, ${username}! Твой аккаунт был создан.`);
            });
        } else {
            ctx.reply(`Привет, ${username}! Твой аккаунт уже существует.`);
        }
    });
});

app.post('/webhook', (req, res) => {
    console.log('Получен запрос от Telegram:', JSON.stringify(req.body, null, 2));
    const { message } = req.body;

    if (!message || !message.from || !message.from.username) {
        console.error('Неверный запрос:', req.body);
        return res.status(400).send('Invalid request');
    }

    const username = message.from.username;
    console.log('Имя пользователя:', username);

    const query = 'INSERT INTO user (username) VALUES (?) ON DUPLICATE KEY UPDATE username = VALUES(username)';
    db.query(query, [username], (err, result) => {
        if (err) {
            console.error('Ошибка при сохранении пользователя:', err);
            return res.status(500).send('Ошибка при сохранении пользователя');
        }
        console.log(`Пользователь ${username} успешно сохранен`);
        res.send('OK');
    });
});

const startServer = async () => {
    try {
        // Замените URL на ваш публичный URL от ngrok или Vercel
        const webhookUrl = 'https://crypto-collect.vercel.app/webhook';
        await bot.telegram.setWebhook(webhookUrl);
        console.log('Вебхук установлен на URL:', webhookUrl);
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
