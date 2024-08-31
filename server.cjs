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
        session_token VARCHAR(255),
        points INT DEFAULT 10000
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

function saveUserPoints(telegramId, points) {
    return new Promise((resolve, reject) => {
        db.query(
            'UPDATE user SET points = ? WHERE telegram_id = ?',
            [points, telegramId],
            (err, results) => {
                if (err) {
                    console.error('Ошибка сохранения очков в базе данных:', err);
                    return reject(err);
                }
                resolve();
            }
        );
    });
}

function getUserData(userId) {
    return new Promise((resolve, reject) => {
        db.query(
            'SELECT * FROM user WHERE telegram_id = ?',
            [userId],
            (err, results) => {
                if (err) {
                    console.error('Ошибка проверки User ID:', err);
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
    await ctx.reply(
        'Привет! Используя этого бота, вы соглашаетесь на обработку ваших данных, таких как ваше имя пользователя и ID. Продолжая, вы подтверждаете свое согласие.',
        Markup.inlineKeyboard([
            Markup.button.callback('Я согласен', 'CONSENT_GIVEN')
        ])
    );
});

bot.action('CONSENT_GIVEN', async (ctx) => {
    const telegramId = ctx.message.from.id;
    const username = ctx.message.from.username || `user_${telegramId}`;

    console.log('Обработка команды /start для пользователя:', telegramId);

    const sessionToken = generateSessionToken(telegramId);

    db.query(
        'INSERT INTO user (telegram_id, username, session_token) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE username = IFNULL(VALUES(username), username), auth_date = NOW(), session_token = VALUES(session_token)', 
        [telegramId, username, sessionToken], 
        (err, results) => {
            if (err) {
                console.error('Ошибка базы данных при обработке команды /start:', err);
                return ctx.reply('Произошла ошибка, попробуйте позже.');
            }

            console.log('Данные успешно сохранены в базе данных для пользователя:', telegramId);

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
    const userId = req.query.userId;

    if (!userId) {
        console.error('User ID не передан в запросе');
        return res.status(400).json({ error: 'User ID обязателен' });
    }

    console.log('Запрос от Mini App с User ID:', userId);

    try {
        const userData = await getUserData(userId);
        if (userData) {
            console.log('Пользователь найден:', JSON.stringify(userData, null, 2));
            return res.json({ username: userData.username, points: userData.points });
        } else {
            console.error('Пользователь не найден с User ID:', userId);
            return res.status(404).json({ error: 'Пользователь не найден' });
        }
    } catch (error) {
        console.error('Ошибка при проверке User ID:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

app.post('/save-points', async (req, res) => {
    const { userId, points } = req.body;

    if (!userId || points === undefined) {
        console.error('User ID или points не переданы в запросе');
        return res.status(400).json({ error: 'User ID и points обязательны' });
    }

    try {
        await saveUserPoints(userId, points);
        console.log('Очки пользователя сохранены:', userId, points);
        res.status(200).json({ message: 'Очки успешно сохранены' });
    } catch (error) {
        console.error('Ошибка при сохранении очков:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

app.post('/webhook', (req, res) => {
    console.log('Получен запрос на /webhook:', req.body);
    bot.handleUpdate(req.body)
        .then(() => {
            res.sendStatus(200);
        })
        .catch((err) => {
            console.error('Ошибка при обработке запроса:', err);
            res.sendStatus(500);
        });
});

const startServer = async () => {
    try {
        await bot.telegram.deleteWebhook({ drop_pending_updates: true });

        const webhookUrl = process.env.WEBHOOK_URL; // Используем URL из переменной среды
        await bot.telegram.setWebhook(webhookUrl);
        console.log('Webhook успешно установлен:', webhookUrl);

        app.listen(port, () => {
            console.log(`Сервер запущен на порту ${port}`);
        });
    } catch (err) {
        console.error('Ошибка установки вебхука:', err);
    }
};

startServer();
