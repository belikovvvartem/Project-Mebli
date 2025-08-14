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

function escapeMarkdown(text) {
    return text.replace(/([_*[\]()~`>#+\-=|{}.!])/g, '\\$1');
}

function sanitizeUrl(url) {
    try {
        new URL(url);
        return encodeURI(url.replace(/\s/g, '%20'));
    } catch (e) {
        console.error(`Invalid URL: ${url}`);
        return null;
    }
}

app.post('/sendOrder', async (req, res) => {
    try {
        console.log('Received order:', JSON.stringify(req.body, null, 2));
        const { name, phone, country, region, city, comment, products } = req.body;

        if (!name || !phone || !country || !region || !city || !products || !Array.isArray(products)) {
            console.error('Invalid order data:', req.body);
            return res.status(400).json({ error: 'Invalid order data' });
        }

        const escapedName = escapeMarkdown(name);
        const escapedPhone = escapeMarkdown(phone);
        const escapedCountry = escapeMarkdown(country);
        const escapedRegion = escapeMarkdown(region);
        const escapedCity = escapeMarkdown(city);
        const escapedComment = comment ? escapeMarkdown(comment) : 'Немає';

        const productList = products.map(p => {
            if (!p.name || !p.size || !p.price || !p.photo) {
                throw new Error('Invalid product data');
            }
            const escapedProductName = escapeMarkdown(p.name);
            const escapedSize = escapeMarkdown(p.size);
            const escapedPrice = escapeMarkdown(p.price.toString());
            const sanitizedPhoto = sanitizeUrl(p.photo);
            const photoLink = sanitizedPhoto ? `[Фото](${sanitizedPhoto})` : 'Фото недоступне';
            return `
- 🪑 ${escapedProductName}
  📏 Розмір: ${escapedSize}
  💵 Ціна: ${escapedPrice}
  🖼 ${photoLink}
`;
        }).join('');

        const message = `
🆕 НОВЕ ЗАМОВЛЕННЯ
👤 Ім'я: ${escapedName}
📞 Телефон: ${escapedPhone}
📍 Країна: ${escapedCountry}
📍 Область: ${escapedRegion}
📍 Місто/Село: ${escapedCity}
📝 Коментар: ${escapedComment}
🛒 Товари:
${productList}
        `;

        console.log('Message to send:', message);

        function splitMessage(message, maxLength = 4000) {
            const parts = [];
            let currentPart = '';
            const lines = message.split('\n');

            for (const line of lines) {
                if (currentPart.length + line.length + 1 > maxLength) {
                    if (currentPart) parts.push(currentPart);
                    currentPart = line + '\n';
                } else {
                    currentPart += line + '\n';
                }
            }
            if (currentPart) parts.push(currentPart);
            return parts;
        }

        const messages = message.length > 4000 ? splitMessage(message, 4000) : [message];
        for (const chatId of chatIds) {
            for (let i = 0; i < messages.length; i++) {
                const msgPart = messages[i];
                try {
                    console.log(`Sending order part ${i + 1} to chat ${chatId}`);
                    await bot.sendMessage(chatId, msgPart, { parse_mode: 'Markdown' });
                    console.log(`Order part ${i + 1} successfully sent to chat ${chatId}`);
                    await new Promise(resolve => setTimeout(resolve, 100)); 
                } catch (err) {
                    console.error(`Failed to send order part ${i + 1} to chat ${chatId}:`, err.message);
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

