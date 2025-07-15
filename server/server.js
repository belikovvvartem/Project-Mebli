const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const TelegramBot = require('node-telegram-bot-api');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true }));

// Перевірка змінних оточення
if (!process.env.TELEGRAM_BOT_TOKEN || !process.env.TELEGRAM_CHAT_ID) {
    console.error('Error: TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID is not set');
    process.exit(1);
}

const token = process.env.TELEGRAM_BOT_TOKEN;
const chatId = process.env.TELEGRAM_CHAT_ID;
let bot;

try {
    bot = new TelegramBot(token, { polling: false }); // Вимкнено polling для уникнення повторних помилок
    console.log('Telegram bot initialized successfully');
    // Тестове повідомлення для перевірки підключення
    bot.sendMessage(chatId, 'Server started successfully').catch(err => {
        console.error('Test message failed:', err.message);
    });
} catch (error) {
    console.error('Failed to initialize Telegram bot:', error.message);
    process.exit(1);
}

app.post('/sendOrder', async (req, res) => {
    try {
        console.log('Received order:', JSON.stringify(req.body, null, 2));
        const { name, phone, country, region, city, comment, products } = req.body;

        // Перевірка валідності даних
        if (!name || !phone || !country || !region || !city || !products || !Array.isArray(products)) {
            console.error('Invalid order data:', req.body);
            return res.status(400).json({ error: 'Invalid order data' });
        }

        // Перевірка товарів
        const productList = products.map(p => {
            if (!p.name || !p.size || !p.price || !p.photo) {
                throw new Error('Invalid product data');
            }
            return `
- 🪑 ${p.name}
  📏 Розмір: ${p.size}
  💵 Ціна: ${p.price}
  🖼 Фото: ${p.photo}
`;
        }).join('');

        // Формування повідомлення
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

        // Відправка повідомлення в Telegram
        await bot.sendMessage(chatId, message);
        console.log('Order sent to Telegram:', message);
        res.status(200).json({ message: 'Order sent successfully' });
    } catch (error) {
        console.error('Error processing order:', error.message, error.stack);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Тестовий ендпоінт
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'Server is running' });
});

app.listen(port, () => {
    console.log(`Server running at port ${port}`);
});