const express = require('express');
const bodyParser = require('body-parser');
const { Telegraf } = require('telegraf');

const app = express();
const bot = new Telegraf('YOUR_BOT_TOKEN'); // Замените 'YOUR_BOT_TOKEN' на ваш токен

app.use(bodyParser.json());

async function setupWebhook() {
  try {
    // Удаляем существующий webhook
    await bot.telegram.deleteWebhook();
    
    // Устанавливаем новый webhook
    await bot.telegram.setWebhook('https://your-server.com/your-webhook-path'); // Замените на ваш URL

    // Устанавливаем обработчик для запросов от Telegram
    app.use(bot.webhookCallback('/your-webhook-path')); // Замените на ваш путь

    console.log('Webhook установлен успешно');
  } catch (error) {
    console.error('Ошибка при установке webhook:', error);
  }
}

setupWebhook();

app.listen(3000, () => {
  console.log('Сервер запущен на порту 3000');
});
