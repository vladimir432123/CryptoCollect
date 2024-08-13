const mysql = require('mysql2');
const express = require('express');
const bodyParser = require('body-parser');

const app = express();
const port = 3002; // Установите порт для Node.js сервера

app.use(bodyParser.json());

// Настройка соединения с базой данных
const db = mysql.createConnection({
    host: '127.0.0.1', // Установите внешний хост базы данных
    user: 'cj00508_tgapp', // Установите пользователя базы данных
    password: 'sjY3z5GE', // Установите пароль базы данных
    database: 'cj00508_tgapp', // Установите имя базы данных
    port: 3306, // Установите порт для подключения к базе данных
});

db.connect((err) => {
    if (err) {
        console.error('Ошибка подключения к базе данных:', err);
        return;
    }
    console.log('Подключено к базе данных MySQL');
  
    // Выполнение простого запроса для проверки подключения
    db.query('SELECT 1', (err, results) => {
        if (err) {
            console.error('Ошибка выполнения тестового запроса:', err);
            return;
        }
        console.log('Тестовый запрос выполнен успешно:', results);
    });
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
