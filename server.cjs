const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');
const mysql = require('mysql2');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 8080;

app.use(bodyParser.json());

// Настройка подключения к базе данных
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

// Обслуживание статических файлов
app.use(express.static(path.join(__dirname, 'public')));

// Обработка всех маршрутов и отправка основного HTML-файла
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(port, () => {
    console.log(`Сервер запущен на порту ${port}`);
});

console.log('Настройка Telegram бота...');

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);

bot.start((ctx) => {
    const username = ctx.message.from.username;
    console.log(`Получена команда /start от пользователя: ${username}`);

    db.query('INSERT INTO user (username) VALUES (?)', [username], (err) => {
        if (err) {
            if (err.code === 'ER_DUP_ENTRY') {
                console.log(`Пользователь ${username} уже существует.`);
                ctx.reply(`Привет, ${username}! Твой аккаунт уже существует.`);
            } else {
                console.error('Ошибка вставки данных:', err);
                ctx.reply('Произошла ошибка при создании вашего аккаунта. Пожалуйста, попробуйте позже.');
            }
            return;
        }
        console.log(`Аккаунт для пользователя ${username} был создан.`);
        ctx.reply(`Привет, ${username}! Твой аккаунт был создан.`);
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
        // Очистка отложенных обновлений
        await bot.telegram.deleteWebhook({ drop_pending_updates: true });

        // Замените URL на ваш публичный URL от Vercel
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

// Указываем Express обслуживать статические файлы из директории 'public'
app.use(express.static(path.join(__dirname, 'public')));

// Обслуживаем index.html для всех маршрутов
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html')); // Измените путь здесь, если файл в корне
});

checkWebhook();
