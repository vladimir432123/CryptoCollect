const express = require('express');
const crypto = require('crypto');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 8080;

app.use(express.json());

app.post('/webhook', (req, res) => {
    const { hash, ...data } = req.body;

    // Формируем строку проверки данных
    const dataCheckString = Object.keys(data)
        .sort()
        .map(key => `${key}=${data[key]}`)
        .join('\n');

    // Создаем секретный ключ на основе вашего TELEGRAM_BOT_TOKEN
    const secret = crypto.createHash('sha256').update(process.env.TELEGRAM_BOT_TOKEN, 'utf8').digest();

    // Вычисляем хэш на сервере
    const calculatedHash = crypto.createHmac('sha256', secret)
        .update(dataCheckString, 'utf8')
        .digest('hex');

    console.log('Data Check String:', dataCheckString);
    console.log('Expected hash:', calculatedHash);
    console.log('Received hash:', hash);

    if (calculatedHash === hash) {
        res.json({ message: 'Authentication successful' });
    } else {
        res.status(403).json({ message: 'Authentication failed' });
    }
});

// Запуск сервера
app.listen(port, async () => {
    console.log(`Server is running on port ${port}`);

    try {
        // Устанавливаем вебхук при старте сервера
        const webhookUrl = `${process.env.WEBHOOK_URL}/webhook`;
        const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);
        await bot.telegram.setWebhook(webhookUrl);
        console.log('Webhook set successfully:', webhookUrl);
    } catch (err) {
        console.error('Error setting webhook:', err);
    }
});
