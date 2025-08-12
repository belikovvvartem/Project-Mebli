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
if (!process.env.TELEGRAM_BOT_TOKEN || !process.env.TELEGRAM_CHAT_IDS) {
    console.error('Error: TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_IDS is not set');
    process.exit(1);
}

const token = process.env.TELEGRAM_BOT_TOKEN;
const chatIds = process.env.TELEGRAM_CHAT_IDS.split(',').map(id => id.trim());
let bot;

try {
    bot = new TelegramBot(token, { polling: false });
    console.log('Telegram bot initialized successfully');
    console.log('Chat IDs:', chatIds);
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

        // Перевірка товарів і формування списку з гіперпосиланням на фото
        const productList = products.map(p => {
            if (!p.name || !p.size || !p.price || !p.photo) {
                throw new Error('Invalid product data');
            }
            // Перевірка, що p.photo є дійсним URL
            const photoLink = p.photo.match(/^https?:\/\/[^\s]+$/) ? `[Фото](${p.photo})` : 'Фото недоступне';
            return `
- 🪑 ${p.name}
  📏 Розмір: ${p.size}
  💵 Ціна: ${p.price}
  🖼 ${photoLink}
`;
        }).join('');

        // Формування повідомлення в Markdown
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

        // Відправка повідомлення з урахуванням обмеження в 4000 символів
        if (message.length > 4000) {
            const messages = message.match(/.{1,4000}/g); // Розбиваємо на частини
            for (const chatId of chatIds) {
                for (const msgPart of messages) {
                    try {
                        console.log(`Sending order part to chat ${chatId}`);
                        await bot.sendMessage(chatId, msgPart, { parse_mode: 'Markdown' });
                        console.log(`Order part successfully sent to chat ${chatId}`);
                        await new Promise(resolve => setTimeout(resolve, 100)); // Затримка 100 мс
                    } catch (err) {
                        console.error(`Failed to send order part to chat ${chatId}:`, err.message);
                    }
                }
            }
        } else {
            for (const chatId of chatIds) {
                try {
                    console.log(`Sending order to chat ${chatId}`);
                    await bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
                    console.log(`Order successfully sent to chat ${chatId}`);
                    await new Promise(resolve => setTimeout(resolve, 100)); // Затримка 100 мс
                } catch (err) {
                    console.error(`Failed to send order to chat ${chatId}:`, err.message);
                }
            }
        }

        console.log('Order processing completed for all chat IDs:', chatIds);
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