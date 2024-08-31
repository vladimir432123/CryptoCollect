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

db.query(`
    CREATE TABLE IF NOT EXISTS user (
        id INT AUTO_INCREMENT PRIMARY KEY,
        telegram_id BIGINT UNIQUE,
        username VARCHAR(255) UNIQUE,
        auth_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        session_token VARCHAR(255)
    )
`, (err) => {
    if (err) {
        console.error('Ошибка создания таблицы:', err);
    } else {
        console.log('Таблица user проверена/создана');
    }
});

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);

function generateSessionToken(telegramId) {
    return crypto.randomBytes(64).toString('hex');
}

function saveSessionToken(telegramId, sessionToken) {
    return new Promise((resolve, reject) => {
        db.query(
            'UPDATE user SET session_token = ? WHERE telegram_id = ?',
            [sessionToken, telegramId],
            (err, results) => {
                if (err) {
                    console.error('Ошибка сохранения токена сессии в базе данных:', err);
                    return reject(err);
                }
                resolve();
            }
        );
    });
}

function validateSessionToken(token) {
    return new Promise((resolve, reject) => {
        db.query(
            'SELECT * FROM user WHERE session_token = ?',
            [token],
            (err, results) => {
                if (err) {
                    console.error('Ошибка проверки токена сессии:', err);
                    return reject(err);
                }
                if (results.length > 0) {
                    resolve(results[0]);
                } else {
                    resolve(null);
                }
            }
        );
    });
}

bot.start(async (ctx) => {
    const telegramId = ctx.message.from.id;
    const username = ctx.message.from.username || `user_${telegramId}`;

    console.log('Обработка команды /start для пользователя:', telegramId);

    db.query(
        'INSERT INTO user (telegram_id, username, session_token) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE username = IFNULL(VALUES(username), username), auth_date = NOW(), session_token = VALUES(session_token)', 
        [telegramId, username, sessionToken], 
        async (err, results) => {
            if (err) {
                console.error('Ошибка базы данных при обработке команды /start:', err);
                return ctx.reply('Произошла ошибка, попробуйте позже.');
            }

            const sessionToken = generateSessionToken(telegramId);
            await saveSessionToken(telegramId, sessionToken);

            console.log('Сгенерирован токен сессии:', sessionToken);

            const miniAppUrl = `https://t.me/cryptocollect_bot?startapp=${telegramId}&tgWebApp=true&token=${sessionToken}`;

            ctx.reply(
                'Добро пожаловать! Нажмите на кнопку ниже, чтобы открыть приложение:',
                Markup.inlineKeyboard([
                    Markup.button.url('Открыть приложение', miniAppUrl)
                ])
            );
        }
    );
});


app.get('/app', async (req, res) => {
    const token = req.query.token;
    console.log('Запрос от Mini App с токеном:', token);

    try {
        const userData = await validateSessionToken(token);
        if (!userData) {
            console.error('Недействительный или истекший токен:', token);
            return res.status(403).send('Неверный или истекший токен.');
        }

        console.log('Пользователь найден:', JSON.stringify(userData, null, 2));
        res.json({ username: userData.username });
    } catch (error) {
        console.error('Ошибка при обработке запроса:', error);
        res.status(500).send('Ошибка сервера.');
    }
});


const startServer = async () => {
    try {
        await bot.telegram.deleteWebhook({ drop_pending_updates: true });

        const webhookUrl = process.env.WEBHOOK_URL;
        await bot.telegram.setWebhook(webhookUrl);
        console.log('Webhook успешно установлен:', webhookUrl);
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
