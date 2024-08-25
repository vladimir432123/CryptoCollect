const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');
const mysql = require('mysql2');
const { Telegraf, Markup } = require('telegraf');
const crypto = require('crypto');
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

// Создание таблицы users, если она не существует
db.query(`
    CREATE TABLE IF NOT EXISTS user (
        id INT AUTO_INCREMENT PRIMARY KEY,
        telegram_id BIGINT UNIQUE,
        username VARCHAR(255) UNIQUE,
        last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
`, (err) => {
    if (err) {
        console.error('Ошибка создания таблицы:', err);
    } else {
        console.log('Таблица user проверена/создана');
    }
});

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);

// Обработка команды /start в боте
bot.start((ctx) => {
    const telegramId = ctx.message.from.id;
    const username = ctx.message.from.username;
    console.log(`Received /start command from ${username}`);

    db.query('INSERT INTO user (telegram_id, username) VALUES (?, ?) ON DUPLICATE KEY UPDATE last_seen = NOW()', [telegramId, username], (err) => {
        if (err) {
            console.error('Database error:', err);
        } else {
            console.log(`User ${username} inserted/updated in database.`);
        }
    });

    const miniAppUrl = `https://t.me/cryptocollect_bot?startapp=${username}&tgWebApp=true`;

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

    const miniAppUrl = `https://t.me/cryptocollect_bot?startapp=${username}&tgWebApp=true`;
    console.log('URL для мини-приложения:', miniAppUrl);

    ctx.reply(
        'Нажмите на кнопку ниже, чтобы открыть мини-приложение:',
        Markup.inlineKeyboard([
            Markup.button.url('Открыть мини-приложение', miniAppUrl)
        ])
    );
});

app.post('/api/user', (req, res) => {
    // Переименовываем ключи для соответствия документам Telegram
    const initData = {
        user_id: req.body.userId,
        auth_date: req.body.authDate,
        hash: req.body.hash,
    };

    console.log('Received initData:', initData);

    const checkString = Object.keys(initData)
        .filter(key => key !== 'hash')  // Исключаем хеш из строки
        .sort()  // Сортируем параметры по алфавиту
        .map(key => `${key}=${initData[key]}`)  // Создаем пару ключ-значение
        .join('\n');  // Соединяем их в одну строку

    console.log('Check String:', checkString);

    if (!checkTelegramAuth(initData)) {
        console.log('Telegram auth failed');
        return res.status(403).send('Forbidden');
    }

    const query = 'SELECT * FROM user WHERE telegram_id = ?';

    db.query(query, [initData.user_id], (err, results) => {
        if (err) {
            console.error('Error fetching user data:', err);
            return res.status(500).send('Server error');
        }

        if (results.length > 0) {
            const user = results[0];
            console.log(`User ${user.username} found in database`);
            res.json({ username: user.username });
        } else {
            console.log('User not found in database');
            res.status(404).send('User not found');
        }
    });
});

function checkTelegramAuth(initData) {
    const token = process.env.TELEGRAM_BOT_TOKEN;

    if (!token) {
        console.error('TELEGRAM_BOT_TOKEN не установлен');
        return false;
    }

    const secretKey = crypto.createHash('sha256').update(token).digest();

    const checkString = Object.keys(initData)
        .filter(key => key !== 'hash')
        .sort()
        .map(key => `${key}=${initData[key]}`)
        .join('\n');

    console.log('Check String:', checkString);

    const calculatedHash = crypto.createHmac('sha256', secretKey).update(checkString).digest('hex');

    console.log('Calculated Hash:', calculatedHash);
    console.log('Received Hash:', initData.hash);

    return calculatedHash === initData.hash;
}




app.post('/webhook', (req, res) => {
    bot.handleUpdate(req.body, res);
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

const checkWebhook = async () => {
    try {
        const webhookInfo = await bot.telegram.getWebhookInfo();
        console.log('Информация о вебхуке:', webhookInfo);
    } catch (err) {
        console.error('Ошибка получения информации о вебхуке:', err);
    }
};

startServer();
checkWebhook();
