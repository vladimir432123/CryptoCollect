const express = require('express');
const bodyParser = require('body-parser');
const mysql = require('mysql2');
const { Telegraf, Markup } = require('telegraf');

const app = express();
const port = process.env.PORT || 3000;
const bot = new Telegraf(process.env.BOT_TOKEN);

app.use(bodyParser.json());

// Настройка подключения к базе данных
const db = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'password',
    database: 'telegram_app'
});

db.connect((err) => {
    if (err) {
        console.error('Ошибка подключения к базе данных:', err);
        return;
    }
    console.log('Подключение к базе данных успешно установлено');
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

bot.command('openapp', (ctx) => {
    const username = ctx.message.from.username;
    const userId = ctx.message.from.id; // Получаем ID пользователя
    const miniAppUrl = `https://t.me/cryptocollect_bot?startapp=${username}&userId=${userId}&tgWebApp=true`;

    console.log(`Open app command received from ${username} with userId ${userId}`); // Логирование команды

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
