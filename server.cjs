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

// Настройки базы данных
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

// Инициализация бота
const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);

// Генерация уникального токена сессии
function generateSessionToken(telegramId) {
    return crypto.randomBytes(64).toString('hex');
}

// Сохранение токена сессии в базе данных
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

// Валидация токена сессии
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

// Обработка команды /start
bot.start(async (ctx) => {
    const telegramId = ctx.message.from.id;
    const username = ctx.message.from.username || `user_${telegramId}`;

    // Проверка и создание аккаунта, если его нет
    db.query(
        'INSERT INTO user (telegram_id, username) VALUES (?, ?) ON DUPLICATE KEY UPDATE username = IFNULL(?, username), auth_date = NOW()', 
        [telegramId, username, username], 
        async (err) => {
            if (err) {
                console.error('Database error:', err);
                return ctx.reply('Произошла ошибка, попробуйте позже.');
            }

            // Генерация уникального токена
            const sessionToken = generateSessionToken(telegramId);

            // Сохранение токена в базе данных
            await saveSessionToken(telegramId, sessionToken);

            // Генерация ссылки
            const appUrl = `https://yourapp.com/app?token=${sessionToken}`;

            // Отправка ссылки пользователю
            ctx.reply(
                'Добро пожаловать! Нажмите на кнопку ниже, чтобы открыть приложение:',
                Markup.inlineKeyboard([
                    Markup.button.url('Открыть приложение', appUrl)
                ])
            );
        }
    );
});

// Обработка команд и запросов от пользователя
app.get('/app', async (req, res) => {
    const token = req.query.token;

    // Проверка токена на сервере
    const userData = await validateSessionToken(token);
    if (!userData) {
        return res.status(403).send('Неверный или истекший токен.');
    }

    // Авторизация и загрузка данных пользователя
    res.send(`Добро пожаловать, ${userData.username}!`);
});

// Вебхук для Telegram
app.post('/webhook', (req, res) => {
    bot.handleUpdate(req.body, res);
});

// Запуск сервера
const startServer = async () => {
    try {
        await bot.telegram.deleteWebhook({ drop_pending_updates: true });

        // Получаем вебхук URL из переменной окружения
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

// Проверка вебхука
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
