require('dotenv').config();
const mysql = require('mysql2');
const express = require('express');
const bodyParser = require('body-parser');
const { Telegraf } = require('telegraf');

const app = express();
const port = process.env.PORT || 3002; // Используем переменную окружения для порта

app.use(bodyParser.json());

console.log('Инициализация сервера...');

// Настройка соединения с базой данных
const db = mysql.createConnection({
    host: process.env.DB_HOST, // Используем переменную окружения для хоста
    user: process.env.DB_USER, // Используем переменную окружения для пользователя
    password: process.env.DB_PASSWORD, // Используем переменную окружения для пароля
    database: process.env.DB_NAME, // Используем переменную окружения для имени базы данных
    port: process.env.DB_PORT || 3306, // Используем переменную окружения для порта
});

const connectToDatabase = async () => {
    try {
        await db.promise().connect();
        console.log('Подключено к базе данных MySQL');
    } catch (err) {
        console.error('Ошибка подключения к базе данных:', err);
    }
};

connectToDatabase();

console.log('Настройка Telegram бота...');

// Настройка Telegram бота
const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);

// Обработка команды /start
bot.start((ctx) => {
    const username = ctx.message.from.username;
    console.log(`Получена команда /start от пользователя: ${username}`);

    // Проверка, существует ли пользователь в базе данных
    db.query('SELECT * FROM user WHERE username = ?', [username], (err, results) => {
        if (err) {
            console.error('Ошибка выполнения запроса:', err);
            return;
        }

        console.log('Результаты запроса:', results);

        if (results.length === 0) {
            // Если пользователь не существует, создаем новый аккаунт
            db.query('INSERT INTO user (username) VALUES (?)', [username], (err) => {
                if (err) {
                    console.error('Ошибка вставки данных:', err);
                    return;
                }
                console.log(`Аккаунт для пользователя ${username} был создан.`);
                ctx.reply(`Привет, ${username}! Твой аккаунт был создан.`);
            });
        } else {
            // Если пользователь уже существует
            console.log(`Пользователь ${username} уже существует.`);
            ctx.reply(`Привет снова, ${username}!`);
        }
    });
});

// Запуск бота
bot.launch();

console.log('Бот запущен...');

// Установка вебхука
const webhookUrl = `https://crypto-collect.vercel.app/`;

bot.telegram.setWebhook(webhookUrl).then(() => {
    console.log(`Вебхук установлен на ${webhookUrl}`);
}).catch((err) => {
    console.error('Ошибка установки вебхука:', err);
});

// Маршрут для обработки запросов от Telegram
app.post('/webhook', async (req, res) => {
    console.log('Получен запрос от Telegram:', JSON.stringify(req.body, null, 2));
    const { message } = req.body;

    if (!message || !message.from || !message.from.username) {
        console.error('Неверный запрос:', req.body);
        return res.status(400).send('Invalid request');
    }

    const username = message.from.username;
    console.log('Имя пользователя:', username);

    // Создание учетной записи при любом взаимодействии с ботом
    const query = 'INSERT INTO user (username) VALUES (?) ON DUPLICATE KEY UPDATE username = VALUES(username)';
    try {
        const [result] = await db.promise().execute(query, [username]);
        console.log(`Пользователь ${username} успешно сохранен`);
        res.send('OK');
    } catch (err) {
        console.error('Ошибка при сохранении пользователя:', err);
        res.status(500).send('Ошибка при сохранении пользователя');
    }
});

app.listen(port, () => {
    console.log(`Сервер запущен на порту ${port}`);
});

app.get('/', (req, res) => {
    res.send('Hello World!');
});
