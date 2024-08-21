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
                // Handle duplicate entry error if needed
                ctx.reply('Norm.');
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
    console.log(`Received request for user ID: ${userId}`); // Логирование ID пользователя
    const query = 'SELECT username FROM user WHERE id = ?';

    db.query(query, [userId], (err, results) => {
        if (err) {
            console.error('Error fetching user data:', err);
            res.status(500).send('Server error');
            return;
        }

        if (results.length > 0) {
            console.log(`User data found: ${results[0].username}`); // Логирование данных пользователя
            res.json({ username: results[0].username });
        } else {
            console.log('User not found'); // Логирование отсутствия пользователя
            res.status(404).send('User not found');
        }
    });
});

// Маршрут для обработки данных авторизации
app.get('/webapp', (req, res) => {
    const { username, user_id } = req.query;
    console.log(`Received request with username: ${username}, user_id: ${user_id}`); // Логирование данных

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

// Маршрут для обработки POST-запроса с данными пользователя
app.post('/api/user', (req, res) => {
    const { username } = req.body;

    if (!username) {
        res.status(400).send('Invalid request');
        return;
    }

    // Сохранение данных пользователя в базе данных
    db.query('INSERT INTO user (username) VALUES (?) ON DUPLICATE KEY UPDATE last_seen = NOW()', [username], (err) => {
        if (err) {
            console.error('Database error:', err);
            res.status(500).send('Server error');
            return;
        }
        res.send('User data saved successfully');
    });
});

const startServer = async () => {
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

const handleStartCommand = async (username) => {
    try {
        // Your logic here
    } catch (err) {
        console.error('Error handling start command:', err);
    }
};


bot.command('openapp', (ctx) => {
    const username = ctx.message.from.username;
    const userId = ctx.message.from.id; // Получаем ID пользователя

    // Кодируем параметры в Base64
    const startParam = Buffer.from(`username=${username}&userId=${userId}`).toString('base64');
    const miniAppUrl = `https://t.me/cryptocollect_bot?start=${startParam}`;

    ctx.reply(
        'Нажмите на кнопку ниже, чтобы открыть мини-приложение в Telegram:',
        Markup.inlineKeyboard([
            Markup.button.url('Open Mini App', miniAppUrl)
        ])
    );
});
startServer();
checkWebhook();
bot.launch();
