const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const TelegramBot = require('node-telegram-bot-api');
require('dotenv').config();

const app = express();
const port = 3000;

app.use(cors());
app.use(bodyParser.json());

const token = process.env.TELEGRAM_BOT_TOKEN;
const chatId = process.env.TELEGRAM_CHAT_ID;
const bot = new TelegramBot(token, { polling: true });

app.post('/sendOrder', (req, res) => {
    const { name, phone, country, region, city, comment, products } = req.body;
    const productList = products.map(p => `${p.name} - ${p.size} - ${p.price} грн`).join('\n');
    const message = `
Нове замовлення:
Ім'я: ${name}
Телефон: ${phone}
Країна: ${country}
Область: ${region}
Місто/Село: ${city}
Коментар: ${comment || 'Немає'}
Товари:
${productList}
    `;
    bot.sendMessage(chatId, message)
        .then(() => res.status(200).send('Order sent'))
        .catch(err => {
            console.error('Telegram error:', err);
            res.status(500).send('Error sending order');
        });
});

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});