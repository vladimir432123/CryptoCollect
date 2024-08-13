require('dotenv').config();
const mysql = require('mysql2');
const express = require('express');
const bodyParser = require('body-parser');

const app = express();
const port = process.env.PORT || 3002; // Используем переменную окружения для порта

app.use(bodyParser.json());

// Настройка соединения с базой данных
const db = mysql.createConnection({
    host: process.env.DB_HOST, // Используем переменную окружения для хоста
    user: process.env.DB_USER, // Используем переменную окружения для пользователя
    password: process.env.DB_PASSWORD, // Используем переменную окружения для пароля
    database: process.env.DB_NAME, // Используем переменную окружения для имени базы данных
    port: process.env.DB_PORT || 3306, // Используем переменную окружения для порта
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

app.get('/', (req, res) => {
    res.send('Hello World!');
});
