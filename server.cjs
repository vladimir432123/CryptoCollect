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
        points INT DEFAULT 10000,
        tapProfitLevel INT DEFAULT 1,
        tapIncreaseLevel INT DEFAULT 1,
        remainingClicks INT DEFAULT 1000,
        last_logout TIMESTAMP NULL DEFAULT NULL
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

    const sessionToken = generateSessionToken(telegramId);

    db.query('SELECT points FROM user WHERE telegram_id = ?', [telegramId], (err, results) => {
        if (err) {
            return ctx.reply('Произошла ошибка, попробуйте позже.');
        }

        if (results.length > 0) {
            db.query(
                'UPDATE user SET session_token = ?, auth_date = NOW() WHERE telegram_id = ?',
                [sessionToken, telegramId]
            );
        } else {
            db.query(
                'INSERT INTO user (telegram_id, username, session_token, points, remainingClicks) VALUES (?, ?, ?, 10000, 1000)',
                [telegramId, username, sessionToken]
            );
        }

        const miniAppUrl = `https://t.me/cryptocollect_bot?startapp=${telegramId}&tgWebApp=true&token=${sessionToken}`;

        ctx.reply(
            'Добро пожаловать! Нажмите на кнопку ниже, чтобы открыть приложение:',
            Markup.inlineKeyboard([
                Markup.button.url('Открыть приложение', miniAppUrl)
            ])
        );
    });
});

app.post('/logout', (req, res) => {
    const { userId, remainingClicks, lastLogout } = req.body;
    
    if (!userId) {
        return res.status(400).json({ error: 'Missing userId' });
    }

    const query = `
        UPDATE user
        SET last_logout = ?, remainingClicks = ?
        WHERE telegram_id = ?
    `;

    db.query(query, [lastLogout, remainingClicks, userId], (err) => {
        if (err) {
            console.error('Ошибка при обновлении времени выхода:', err);
            return res.status(500).json({ error: 'Server error' });
        }
        res.json({ success: true });
    });
});

// Обработка входа в приложение и восстановление кликов
app.get('/app', async (req, res) => {
    const userId = req.query.userId;

    if (!userId) {
        console.error('User ID не передан в запросе');
        return res.status(400).json({ error: 'User ID обязателен' });
    }

    console.log('Запрос от Mini App с User ID:', userId);

    try {
        const query = 'SELECT * FROM user WHERE telegram_id = ?';
        db.query(query, [userId], (err, results) => {
            if (err) {
                console.error('Ошибка проверки User ID:', err);
                return res.status(500).json({ error: 'Ошибка сервера' });
            }
            if (results.length > 0) {
                const userData = results[0];
                const now = new Date().getTime();
                const lastLogout = new Date(userData.last_logout).getTime();
                const timeDifferenceInSeconds = Math.floor((now - lastLogout) / 1000);

                const clicksToRestore = Math.min(
                    Math.floor(timeDifferenceInSeconds), 
                    userData.tapIncreaseLevel * 500 // Задайте ваш лимит восстановления
                );

                const updatedClicks = Math.min(
                    userData.remainingClicks + clicksToRestore,
                    userData.tapIncreaseLevel * 500 // Максимум кликов
                );

                return res.json({
                    username: userData.username,
                    points: userData.points,
                    tapProfitLevel: userData.tapProfitLevel,
                    tapIncreaseLevel: userData.tapIncreaseLevel,
                    remainingClicks: updatedClicks, // Отправляем обновленное значение кликов
                    lastLogout: userData.last_logout
                });

            } else {
                console.error('Пользователь не найден с User ID:', userId);
                return res.status(404).json({ error: 'Пользователь не найден' });
            }
        });
    } catch (error) {
        console.error('Ошибка при проверке User ID:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});


app.post('/save-data', (req, res) => {
    const { userId, points, tapProfitLevel, tapIncreaseLevel, remainingClicks } = req.body;

    if (!userId || points === undefined || tapProfitLevel === undefined || tapIncreaseLevel === undefined || remainingClicks === undefined) {
        console.log('Ошибка: Недостаточно данных для сохранения');
        return res.status(400).json({ error: 'Missing required fields' });
    }

    console.log(`Получен POST-запрос для userId: ${userId}, points: ${points}, tapProfitLevel: ${tapProfitLevel}, tapIncreaseLevel: ${tapIncreaseLevel}, remainingClicks: ${remainingClicks}`);

    const query = `
        UPDATE user 
        SET points = ?, tapProfitLevel = ?, tapIncreaseLevel = ?, remainingClicks = ?
        WHERE telegram_id = ?
    `;

    db.query(query, [points, tapProfitLevel, tapIncreaseLevel, remainingClicks, userId], (err, results) => {
        if (err) {
            console.error('Ошибка при сохранении данных:', err);
            return res.status(500).json({ error: 'Server error' });
        }

        console.log('Данные успешно сохранены для пользователя с ID:', userId);

        res.json({
            success: true,
            points,
            tapProfitLevel,
            tapIncreaseLevel,
            remainingClicks,
        });
    });
});

// Новый маршрут для обновления количества кликов
app.post('/update-clicks', (req, res) => {
    const { userId, remainingClicks } = req.body;

    if (!userId || remainingClicks === undefined) {
        console.log('Ошибка: Недостаточно данных для обновления кликов');
        return res.status(400).json({ error: 'Missing required fields' });
    }

    const query = `
        UPDATE user 
        SET remainingClicks = ?
        WHERE telegram_id = ?
    `;

    db.query(query, [remainingClicks, userId], (err) => {
        if (err) {
            console.error('Ошибка при обновлении кликов:', err);
            return res.status(500).json({ error: 'Server error' });
        }

        console.log('Клики успешно обновлены для пользователя с ID:', userId);

        res.json({
            success: true,
            remainingClicks,
        });
    });
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

        const webhookUrl = process.env.WEBHOOK_URL;
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
