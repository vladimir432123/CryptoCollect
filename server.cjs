const express = require('express');
const crypto = require('crypto');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 8080;

app.use(express.json());

// Простая проверка на аутентификацию
app.post('/auth', (req, res) => {
    const { hash, ...data } = req.body;

    // Формируем строку проверки данных
    const dataCheckString = Object.keys(data)
        .sort()
        .map(key => `${key}=${data[key]}`)
        .join('\n');

    // Создаем секретный ключ
    const secret = crypto.createHash('sha256').update(process.env.TELEGRAM_BOT_TOKEN).digest();

    // Вычисляем хэш
    const hmac = crypto.createHmac('sha256', secret)
        .update(dataCheckString)
        .digest('hex');

    console.log('Data Check String:', dataCheckString);
    console.log('Expected hash:', hmac);
    console.log('Received hash:', hash);

    if (hmac === hash) {
        res.json({ message: 'Authentication successful' });
    } else {
        res.status(403).json({ message: 'Authentication failed' });
    }
});

app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});
