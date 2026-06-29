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
    return text.replace(/([_*`[\]])/g, '\\$1');
}

function formatUah(value) {
    return `${Number(value).toLocaleString('uk-UA')} ₴`;
}

function formatItemPrice(uahPrice, currency, rate, rateDate) {
    if (currency === 'USD' && rate) {
        const usd = Math.round(Number(uahPrice) / rate);
        return `≈ $${usd.toLocaleString('uk-UA')} (${Number(uahPrice).toLocaleString('uk-UA')}грн)${rateDate ? `(${rateDate})` : ''}`;
    }
    return formatUah(uahPrice);
}

function formatOrderTotalBlock(totalUah, currency, rate) {
    if (currency === 'USD' && rate) {
        const usd = Math.round(totalUah / rate);
        return `≈ $${usd.toLocaleString('uk-UA')} (${formatUah(totalUah)})`;
    }
    return formatUah(totalUah);
}

function formatRateInfoMessage(currency, rate, rateDate) {
    if (currency !== 'USD' || !rate) return null;
    const rateStr = Number(rate).toLocaleString('uk-UA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return [
        `💱 Розраховано за курсом НБУ`,
        ``,
        `1 USD = ${rateStr} грн`,
        `Дата курсу: ${rateDate || 'невідома'}`
    ].join('\n');
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
        const { name, phone, country, region, city, comment, products, currency, rate, rateDate } = req.body;

        if (!name || !phone || !country || !region || !city || !products || !Array.isArray(products)) {
            console.error('Invalid order data:', req.body);
            return res.status(400).json({ error: 'Invalid order data' });
        }

        const orderCurrency = currency === 'USD' && rate ? 'USD' : 'UAH';

        const escapedName = escapeMarkdown(name);
        const escapedPhone = escapeMarkdown(phone);
        const escapedCountry = escapeMarkdown(country);
        const escapedRegion = escapeMarkdown(region);
        const escapedCity = escapeMarkdown(city);
        const escapedComment = comment ? escapeMarkdown(comment) : 'Немає';

        let totalUah = 0;

        const productList = products.map(p => {
            if (!p.name || !p.size || !p.price || !p.photo) {
                throw new Error('Invalid product data');
            }
            totalUah += Number(p.price) || 0;
            const escapedProductName = escapeMarkdown(p.name);
            const escapedSize = escapeMarkdown(p.size);
            const escapedPrice = escapeMarkdown(formatItemPrice(p.price, orderCurrency, rate, rateDate));
            const sanitizedPhoto = sanitizeUrl(p.photo);
            const photoLink = sanitizedPhoto ? `[Фото](${sanitizedPhoto})` : 'Фото недоступне';
            return `
- 🪑 ${escapedProductName}
  📏 Розмір: ${escapedSize}
  💵 Ціна: ${escapedPrice}
  🖼 ${photoLink}
`;
        }).join('');

        const escapedTotalBlock = escapeMarkdown(formatOrderTotalBlock(totalUah, orderCurrency, rate));

        const orderMessage = `
🆕 НОВЕ ЗАМОВЛЕННЯ
👤 Ім'я: ${escapedName}
📞 Телефон: ${escapedPhone}
📍 Країна: ${escapedCountry}
📍 Область: ${escapedRegion}
📍 Місто/Село: ${escapedCity}
📝 Коментар: ${escapedComment}
🛒 Товари:
${productList}
💰 Ціна:
${escapedTotalBlock}
        `;

        const rateMessageRaw = formatRateInfoMessage(orderCurrency, rate, rateDate);
        const rateMessage = rateMessageRaw ? escapeMarkdown(rateMessageRaw) : null;

        console.log('Order message to send:', orderMessage);
        if (rateMessage) console.log('Rate message to send:', rateMessage);

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

        const orderParts = orderMessage.length > 4000 ? splitMessage(orderMessage, 4000) : [orderMessage];
        const allParts = rateMessage ? [...orderParts, rateMessage] : orderParts;

        for (const chatId of chatIds) {
            for (let i = 0; i < allParts.length; i++) {
                const msgPart = allParts[i];
                try {
                    console.log(`Sending message part ${i + 1} to chat ${chatId}`);
                    await bot.sendMessage(chatId, msgPart, { parse_mode: 'Markdown' });
                    console.log(`Message part ${i + 1} successfully sent to chat ${chatId}`);
                    await new Promise(resolve => setTimeout(resolve, 100)); 
                } catch (err) {
                    console.error(`Failed to send message part ${i + 1} to chat ${chatId}:`, err.message);
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

app.get('/health', (req, res) => {
    res.status(200).json({ status: 'OK', message: 'Server is running' });
});

app.listen(port, () => {
    console.log(`Сервер запущено на порту ${port}`);
});