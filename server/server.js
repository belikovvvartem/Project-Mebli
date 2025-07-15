const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const TelegramBot = require('node-telegram-bot-api');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000; // Використовуємо PORT із змінних оточення Render

app.use(cors());
app.use(bodyParser.json());

const token = process.env.TELEGRAM_BOT_TOKEN;
const chatId = process.env.TELEGRAM_CHAT_ID;
const bot = new TelegramBot(token, { polling: true });

app.post('/sendOrder', (req, res) => {
    console.log('Received order:', JSON.stringify(req.body, null, 2)); // Розширене логування
    const { name, phone, country, region, city, comment, products } = req.body;
    if (!name || !phone || !country || !region || !city || !products) {
        console.error('Invalid order data:', req.body);
        return res.status(400).send('Invalid order data');
    }
    const productList = products.map(p => `
- 🪑 ${p.name}
  📏 Розмір: ${p.size}
  💵 Ціна: ${p.price}
  🖼 Фото: ${p.photo}
`).join('');
    const message = `
🆕 НОВЕ ЗАМОВЛЕННЯ
👤 Ім'я: ${name}
📞 Телефон: ${phone}
📍 Країна: ${country}
📍 Область: ${region}
📍 Місто/Село: ${city}
📝 Коментар: ${comment || 'Немає'}
🛒 Товари:
${productList}
    `;
    bot.sendMessage(chatId, message)
        .then(() => {
            console.log('Order sent to Telegram:', message);
            res.status(200).send('Order sent');
        })
        .catch(err => {
            console.error('Telegram error:', err);
            res.status(500).send('Error sending order');
        });
});

app.listen(port, () => {
    console.log(`Server running at port ${port}`);
});