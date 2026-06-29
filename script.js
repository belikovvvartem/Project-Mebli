import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getDatabase, ref, get, onValue, set, push, remove, update } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";
import { firebaseConfig } from './firebaseConfig.js';

(function injectCartCountStyles() {
    const style = document.createElement('style');
    style.textContent = `
        #cartCount {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            min-width: 20px;
            height: 20px;
            padding: 0 5px;
            background: #ef4444;
            color: #fff;
            font-size: 11px;
            font-weight: 700;
            border-radius: 999px;
            line-height: 1;
            margin-left: 4px;
            vertical-align: middle;
            box-shadow: 0 1px 4px rgba(239,68,68,0.45);
            transition: transform 0.2s cubic-bezier(0.34,1.56,0.64,1), opacity 0.2s ease;
            transform: scale(1);
        }
        #cartCount:empty {
            display: none;
        }
        #cartCount.bump {
            transform: scale(1.35);
        }
    `;
    document.head.appendChild(style);
})();


(function injectUnavailableModalStyles() {
    const style = document.createElement('style');
    style.textContent = `
        #unavailableModal .modal-content {
            text-align: center;
            max-width: 460px;
            width: 90%;
            padding: 40px 36px 32px;
            border-radius: 12px;
            box-shadow: 0 8px 20px rgba(0,0,0,0.25);
            animation: scaleIn 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            position: relative;
        }
        .unavail-icon {
            width: 80px;
            height: 80px;
            border-radius: 50%;
            background: #fef2f2;
            display: flex;
            align-items: center;
            justify-content: center;
            margin: 0 auto 20px;
            border: 3px solid #ef4444;
        }
        .unavail-icon .material-icons {
            font-size: 40px;
            color: #ef4444;
        }
        .unavail-title {
            font-family: var(--font-primary);
            font-size: 1.6rem;
            font-weight: 700;
            color: var(--text-dark);
            margin: 0 0 10px;
        }
        .unavail-text {
            font-family: var(--font-primary);
            color: var(--text-gray);
            font-size: 0.95rem;
            line-height: 1.6;
            margin-bottom: 14px;
        }
        .unavail-list {
            list-style: none;
            padding: 0;
            margin: 0 0 14px;
            text-align: left;
        }
        .unavail-list li {
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 8px 14px;
            background: #fef2f2;
            border-left: 3px solid #ef4444;
            border-radius: 6px;
            margin-bottom: 6px;
            font-family: var(--font-primary);
            font-size: 0.9rem;
            font-weight: 600;
            color: var(--text-dark);
        }
        .unavail-list li .material-icons {
            font-size: 16px;
            color: #ef4444;
            flex-shrink: 0;
        }
        .unavail-subtext {
            font-family: var(--font-primary);
            color: var(--text-gray);
            font-size: 0.85rem;
            margin-bottom: 28px;
        }
        .unavail-buttons {
            display: flex;
            gap: 12px;
            justify-content: center;
            flex-wrap: wrap;
        }
        .unavail-btn-catalog {
            display: flex;
            align-items: center;
            gap: 8px;
            background: var(--primary-blue);
            color: #fff;
            border: none;
            border-radius: 10px;
            padding: 13px 24px;
            font-family: var(--font-primary);
            font-size: 0.95rem;
            font-weight: 600;
            text-transform: uppercase;
            cursor: pointer;
            transition: background 0.3s ease, transform 0.2s ease;
        }
        .unavail-btn-catalog:hover {
            background: var(--hover-blue);
            transform: translateY(-2px);
        }
        .unavail-btn-close {
            display: flex;
            align-items: center;
            gap: 8px;
            background: transparent;
            color: var(--text-gray);
            border: 2px solid var(--border-light);
            border-radius: 10px;
            padding: 13px 24px;
            font-family: var(--font-primary);
            font-size: 0.95rem;
            font-weight: 600;
            text-transform: uppercase;
            cursor: pointer;
            transition: border-color 0.3s ease, color 0.3s ease, transform 0.2s ease;
        }
        .unavail-btn-close:hover {
            border-color: var(--error-red);
            color: var(--error-red);
            transform: translateY(-2px);
        }
    `;
    document.head.appendChild(style);
})();

const app = initializeApp(firebaseConfig);
const auth = getAuth();
const database = getDatabase();

const CurrencyManager = (() => {
    const RATE_KEY = 'nbu_usd_rate';
    const RATE_DATE_KEY = 'nbu_usd_rate_date';
    const CURRENCY_KEY = 'selected_currency';
    const RATE_TTL_MS = 24 * 60 * 60 * 1000;

    const SYMBOLS = { UAH: '₴', USD: '$' };

    let state = {
        currency: localStorage.getItem(CURRENCY_KEY) || 'UAH',
        rate: parseFloat(localStorage.getItem(RATE_KEY)) || null,
        rateDate: localStorage.getItem(RATE_DATE_KEY) || null,
    };

    const listeners = [];

    function onChange(cb) { listeners.push(cb); }

    function notify() { listeners.forEach(cb => { try { cb(state.currency); } catch (e) { console.error(e); } }); }

    function isRateFresh() {
        const ts = parseInt(localStorage.getItem(RATE_DATE_KEY + '_ts'), 10);
        return state.rate && ts && (Date.now() - ts) < RATE_TTL_MS;
    }

    async function fetchRate() {
        try {
            const res = await fetch('https://bank.gov.ua/NBUStatService/v1/statdirectory/exchange?valcode=usd&json');
            if (!res.ok) throw new Error('NBU API error: ' + res.status);
            const data = await res.json();
            const entry = Array.isArray(data) ? data[0] : null;
            if (!entry || !entry.rate) throw new Error('NBU API: некоректна відповідь');
            state.rate = entry.rate;
            state.rateDate = new Date().toLocaleDateString('uk-UA');
            localStorage.setItem(RATE_KEY, String(state.rate));
            localStorage.setItem(RATE_DATE_KEY, state.rateDate);
            localStorage.setItem(RATE_DATE_KEY + '_ts', String(Date.now()));
            return true;
        } catch (e) {
            console.warn('Не вдалося отримати курс НБУ, використовуємо кеш:', e.message);
            return false;
        }
    }

    async function init() {
        if (!isRateFresh()) {
            await fetchRate();
            if (!state.rate) state.currency = 'UAH';
        }
        renderSwitcher();
        updateSwitcherUI();
    }

    function getCurrency() { return state.currency; }

    function setCurrency(currency) {
        if (currency === state.currency) return;
        if (currency === 'USD' && !state.rate) {
            console.warn('Курс USD недоступний, перемикання неможливе');
            return;
        }
        state.currency = currency;
        localStorage.setItem(CURRENCY_KEY, currency);
        updateSwitcherUI();
        notify();
    }

    function convert(uah) {
        const value = Number(uah) || 0;
        if (state.currency === 'USD' && state.rate) {
            const usd = value / state.rate;
            return usd < 1 ? Math.round(usd * 100) / 100 : Math.round(usd);
        }
        return Math.round(value);
    }

    function format(uah) {
        const value = Number(uah) || 0;
        if (state.currency === 'USD' && state.rate) {
            const usd = value / state.rate;
            if (usd < 1) {
                return '$' + usd.toFixed(2);
            }
            return '$' + Math.round(usd).toLocaleString('uk-UA');
        }
        return Math.round(value).toLocaleString('uk-UA') + ' ' + SYMBOLS.UAH;
    }

    function formatNumber(uah) {
        const value = Number(uah) || 0;
        if (state.currency === 'USD' && state.rate) {
            const usd = value / state.rate;
            if (usd < 1) return usd.toFixed(2);
            return Math.round(usd).toLocaleString('uk-UA');
        }
        return Math.round(value).toLocaleString('uk-UA');
    }

    function getRateInfo() {
        return { currency: state.currency, rate: state.rate, rateDate: state.rateDate };
    }

    function makeSwitcherWrap(className) {
        const wrap = document.createElement('div');
        wrap.className = 'currency-switcher' + (className ? ' ' + className : '');
        wrap.innerHTML = `
            <button type="button" class="currency-option" data-currency="UAH">₴ UAH</button>
            <button type="button" class="currency-option" data-currency="USD">$ USD</button>
        `;
        wrap.querySelectorAll('.currency-option').forEach(btn => {
            btn.addEventListener('click', () => setCurrency(btn.dataset.currency));
        });
        return wrap;
    }

    function renderSwitcher() {
        document.querySelectorAll('.currency-switcher').forEach(el => el.remove());
        document.querySelectorAll('.cart-currency-wrap').forEach(el => {
            const parent = el.parentNode;
            while (el.firstChild) parent.insertBefore(el.firstChild, el);
            el.remove();
        });

        const cartBtn = document.querySelector('#cartBtn');
        if (cartBtn) {
            const wrap = document.createElement('div');
            wrap.className = 'cart-currency-wrap';
            cartBtn.parentNode.insertBefore(wrap, cartBtn);
            wrap.appendChild(cartBtn);
            wrap.appendChild(makeSwitcherWrap('currency-switcher--desktop'));
        }

        const sideMenu = document.querySelector('#sideMenu');
        if (sideMenu) {
            const mobileWrap = makeSwitcherWrap('currency-switcher--mobile');
            const contacts = sideMenu.querySelector('.contacts');
            if (contacts) {
                contacts.after(mobileWrap);
            } else {
                sideMenu.appendChild(mobileWrap);
            }
        }
    }

    function updateSwitcherUI() {
        document.querySelectorAll('.currency-switcher').forEach(wrap => {
            wrap.classList.toggle('usd-active', state.currency === 'USD');
            wrap.querySelectorAll('.currency-option').forEach(btn => {
                btn.classList.toggle('active', btn.dataset.currency === state.currency);
                if (btn.dataset.currency === 'USD') btn.disabled = !state.rate;
            });
        });
    }

    (function injectSwitcherStyles() {
        const style = document.createElement('style');
        style.textContent = `
            .currency-switcher {
                display: inline-flex;
                align-items: center;
                background: #eaf1fd;
                border: 1px solid #dbe7fb;
                border-radius: 999px;
                padding: 4px;
                position: relative;
                gap: 0;
                margin: 0 14px;
                flex-shrink: 0;
                box-shadow: inset 0 1px 2px rgba(30, 58, 138, 0.06);
            }
            .currency-switcher .currency-option {
                position: relative;
                z-index: 2;
                flex: 1;
                text-align: center;
                border: none;
                background: transparent;
                font-family: var(--font-primary, inherit);
                font-size: 13px;
                font-weight: 700;
                letter-spacing: 0.2px;
                padding: 7px 16px;
                border-radius: 999px;
                cursor: pointer;
                color: var(--dark-blue, #1e3a8a);
                opacity: 0.55;
                transition: color 0.25s ease, opacity 0.25s ease;
                white-space: nowrap;
            }
            .currency-switcher .currency-option.active {
                color: #fff;
                opacity: 1;
            }
            .currency-switcher::before {
                content: '';
                position: absolute;
                top: 4px;
                left: 4px;
                width: calc(50% - 4px);
                height: calc(100% - 8px);
                background: linear-gradient(135deg, var(--primary-blue, #3b82f6), var(--dark-blue, #1e3a8a));
                border-radius: 999px;
                box-shadow: 0 2px 6px rgba(37, 99, 235, 0.35);
                transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                z-index: 1;
            }
            .currency-switcher.usd-active::before {
                transform: translateX(100%);
            }
            .currency-switcher .currency-option:disabled {
                opacity: 0.25;
                cursor: not-allowed;
            }
            .currency-switcher .currency-option:not(:disabled):hover {
                opacity: 0.85;
            }
            .currency-switcher .currency-option.active:hover {
                opacity: 1;
            }
            /* Обгортка кошик + перемикач на десктопі */
            .cart-currency-wrap {
                display: flex;
                flex-direction: column;
                align-items: center;
                gap: 6px;
            }
            /* Desktop: під кошиком */
            .currency-switcher--desktop {
                display: inline-flex;
                margin: 0;
            }
            /* Mobile: у боковому меню */
            .currency-switcher--mobile {
                display: none;
                margin: 16px auto 8px;
                justify-content: center;
            }
            @media (max-width: 900px) {
                .currency-switcher--desktop { display: none !important; }
                .currency-switcher--mobile  { display: inline-flex; }
                .cart-currency-wrap { flex-direction: row; gap: 0; }
            }
        `;
        document.head.appendChild(style);
    })();

    return { init, getCurrency, setCurrency, convert, format, formatNumber, getRateInfo, onChange };
})();
window.CurrencyManager = CurrencyManager;

let products = {}, banners = {}, promos = {}, colors = [], materials = [], subcategories = {};
let currentProductId = null; 
const _urlParams = new URLSearchParams(window.location.search);
let currentFilters = {
    category:       _urlParams.get('category') || 'all',
    subcategory:    _urlParams.get('subcategory') || null,
    subSubcategory: _urlParams.get('subSubcategory') || null,
    priceMin:       null,
    priceMax:       null,
    availability:   null,
    color:          null,
    material:       null,
    room:           _urlParams.get('room') || null,
    sale:           _urlParams.get('sale') === 'true' || null,
    clearance:      _urlParams.get('clearance') === 'true' || null,
    search:         _urlParams.get('search') ? _urlParams.get('search').toLowerCase() : null,
};
let isInitialLoad = true;

const ROOM_PAGE_SIZE = 10;
let roomProductsAll = [];
let roomProductsOffset = 0;

const ADMIN_PAGE_SIZE = 15;
let adminProductsAll = [];
let adminProductsOffset = 0;

const categoryTranslations = {
    beds: 'Ліжка', sofas: 'Дивани', wardrobes: 'Шафи', tables: 'Столи', chairs: 'Стільці', mattresses: 'Матраци'
};

const subcategoryTranslations = {
    all: 'Всі товари', soft_beds: 'Мʼякі ліжка', wooden_beds: 'Деревʼяні ліжка', bedroom_sets: 'Спальні комплекти', dressers: 'Комоди', nightstands: 'Тумби',
    corner: 'Кутові дивани', straight: 'Прямі дивани', armchairs: 'Крісла',
    sliding_wardrobes: 'Шафи-купе', sliding_wardrobes_with_carving: 'Шафи-купе з карнизами', art_matting: 'Художнє матування', tv_wardrobes: 'Шафи під телевізор',
    wooden: 'Деревʼяні', metal: 'Металеві', coffee: 'Журнальні столики',
    soft: 'Мʼякі', standard: 'Стандартні матраци',
    '2door': '2-х дверна', '3door': '3-х дверна', '4door': '4-х дверна'
};

const roomTranslations = {
    living_room: 'Вітальня',
    bedroom: 'Спальна кімната',
    nursery: 'Дитяча',
    hallway: 'Прихожа',
    kitchen: 'Кухня',
    office: 'Офіс'
};

const CACHE_TTL = {
    products:           30 * 60 * 1000, 
    banners:            60 * 60 * 1000,  
    colors:             24 * 60 * 60 * 1000,  
    materials:          24 * 60 * 60 * 1000,  
    subcategories:      24 * 60 * 60 * 1000,  
    promos:             30 * 60 * 1000,  
    featured_sale:      30 * 60 * 1000,  
    featured_clearance: 30 * 60 * 1000, 
};

function getCached(key) {
    try {
        const raw = localStorage.getItem(`fbcache_${key}`);
        if (!raw) return null;
        const { data, ts } = JSON.parse(raw);
        const ttl = CACHE_TTL[key] ?? (5 * 60 * 1000);
        if (Date.now() - ts > ttl) {
            localStorage.removeItem(`fbcache_${key}`);
            return null;
        }
        return data;
    } catch { return null; }
}

function setCache(key, data) {
    try {
        localStorage.setItem(`fbcache_${key}`, JSON.stringify({ data, ts: Date.now() }));
    } catch (e) {
        console.warn('Cache write failed:', e);
    }
}

function invalidateCache(key) {
    try { localStorage.removeItem(`fbcache_${key}`); } catch {}
}

async function fetchOrCache(key, dbRef) {
    const cached = getCached(key);
    if (cached !== null) return cached;
    const snapshot = await get(dbRef);
    const data = snapshot.val() || (key === 'colors' || key === 'materials' ? {} : {});
    setCache(key, data);
    return data;
}
function syncFeatured(productId, productData) {
    const preview = {
        name: productData.name,
        photo: (productData.photos || [])[0] || productData.photo || '',
        category: productData.category,
        sizes: productData.sizes,
        discountPrices: productData.discountPrices || {},
        onSale: productData.onSale || false,
        onClearance: productData.onClearance || false,
        availability: productData.availability || false,
        createdAt: productData.createdAt || Date.now()
    };
    const updates = {};
    updates[`featured/sale/${productId}`] = productData.onSale ? preview : null;
    updates[`featured/clearance/${productId}`] = productData.onClearance ? preview : null;
    return update(ref(database), updates);
}
let lazyObserver = null;

function initLazyObserver() {
    if (!('IntersectionObserver' in window)) return;
    lazyObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const img = entry.target;
                const src = img.dataset.src;
                if (src) {
                    img.src = src;
                    img.removeAttribute('data-src');
                    img.classList.remove('lazy');
                }
                lazyObserver.unobserve(img);
            }
        });
    }, { rootMargin: '150px 0px' });
}

function lazyLoadImages() {
    if (!lazyObserver) return;
    document.querySelectorAll('img[data-src]').forEach(img => lazyObserver.observe(img));
}

initLazyObserver();
(function updateFooterYear() {
    const currentYear = new Date().getFullYear();
    document.querySelectorAll('.rights').forEach(el => {
        el.textContent = el.textContent.replace(/\b\d{4}\b/, currentYear);
    });
})();
function refreshCurrencyDisplay() {
    const cartModal = document.getElementById('cartModal');
    const orderModal = document.getElementById('orderModal');

    if (document.getElementById('mainProducts') || document.getElementById('roomProducts') ||
        document.getElementById('saleProducts') || document.getElementById('clearanceProducts')) {
        renderContent(currentFilters);
    }
    if (document.getElementById('productDetails') && currentProductId) {
        renderSingleProduct(currentProductId);
    }
    if (cartModal && cartModal.style.display === 'flex') {
        renderCart();
    }
    if (orderModal && orderModal.style.display === 'flex') {
        const orderItems = Array.from(document.querySelectorAll('#orderItems .product')).map(product => ({
            id: product.dataset.productId,
            size: product.querySelector('.size-select')?.value
        })).filter(item => item.id && item.size);
        if (orderItems.length) renderOrderItems(orderItems);
    }
}

CurrencyManager.onChange(() => refreshCurrencyDisplay());
CurrencyManager.init();
async function initializeData() {
    const path = window.location.pathname;
    const isAdmin   = path.includes('admin.html');
    const isProduct = path.includes('product.html');
    const isRoom    = path.includes('room.html');
    const isLogin   = path.includes('login.html');

    if (isLogin) return; 

    if (isAdmin) {
        onValue(ref(database, 'products'), (snap) => {
            products = snap.val() || {};
            setCache('products', products);
            renderContent(currentFilters);
            renderAdminProducts('all', '');
        });
        onValue(ref(database, 'banners'), (snap) => {
            banners = snap.val() || {};
            updateBannerSlider();
            const bannerList = document.getElementById('bannerList');
            if (bannerList) {
                bannerList.innerHTML = '';
                Object.entries(banners).forEach(([key, banner]) => {
                    const li = document.createElement('li');
                    li.innerHTML = `<img src="${banner.url}" alt="Banner"><button onclick="removeBanner('${key}')"><i class="material-icons">delete</i></button>`;
                    bannerList.appendChild(li);
                });
            }
        });
        onValue(ref(database, 'promos'), (snap) => {
            promos = snap.val() || {};
            applyPromos();
            const promoList = document.getElementById('promoList');
            if (promoList) {
                promoList.innerHTML = '';
                Object.entries(promos).forEach(([key, promo]) => {
                    const li = document.createElement('li');
                    li.textContent = `${promo.name}`;
                    const deleteBtn = document.createElement('button');
                    deleteBtn.textContent = 'Видалити';
                    deleteBtn.onclick = () => remove(ref(database, 'promos/' + key)).then(() => showNotification('Акцію видалено', 'success'));
                    li.appendChild(deleteBtn);
                    promoList.appendChild(li);
                });
            }
        });
        get(ref(database, 'colors')).then(snap => {
            colors = Object.values(snap.val() || []);
            updateColorSelects();
        });
        get(ref(database, 'materials')).then(snap => {
            materials = Object.values(snap.val() || []);
            updateMaterialSelects();
        });
        get(ref(database, 'subcategories')).then(snap => {
            subcategories = snap.val() || {};
            updateSubcategorySelects();
        });
        return;
    }

    if (isProduct) {
        const urlParams = new URLSearchParams(window.location.search);
        const productId = urlParams.get('id');
        if (!productId) { showNotification('ID продукту не вказано', 'error'); return; }

        const cachedProducts = getCached('products');
        if (cachedProducts && cachedProducts[productId]) {
            products = cachedProducts;
            renderSingleProduct(productId);
            return;
        }

        try {
            const snap = await get(ref(database, `products/${productId}`));
            if (snap.exists()) {
                products = { [productId]: snap.val() };
                renderSingleProduct(productId);
            } else {
                showNotification('Продукт не знайдено', 'error');
            }
        } catch (e) {
            showNotification('Помилка завантаження продукту', 'error');
        }
        return;
    }

    if (!isRoom) {
        banners = await fetchOrCache('banners', ref(database, 'banners'));
        updateBannerSlider();

        promos = await fetchOrCache('promos', ref(database, 'promos'));

        const [featuredSale, featuredClearance] = await Promise.all([
            fetchOrCache('featured_sale', ref(database, 'featured/sale')),
            fetchOrCache('featured_clearance', ref(database, 'featured/clearance'))
        ]);

        const saleContainer = document.getElementById('saleProducts');
        const clearanceContainer = document.getElementById('clearanceProducts');

        if (saleContainer) {
            saleContainer.innerHTML = '';
            const saleItems = Object.entries(featuredSale || {})
                .sort((a, b) => (b[1].createdAt || 0) - (a[1].createdAt || 0))
                .slice(0, 4);
            if (saleItems.length === 0) {
                saleContainer.innerHTML = '<p style="grid-column:1/-1;text-align:center;color:#888;">Немає акційних товарів</p>';
            } else {
                saleItems.forEach(([key, product]) => renderProductCard(saleContainer, key, product, 'saleProducts'));
            }
            saleContainer.classList.add('loaded');
        }

        if (clearanceContainer) {
            clearanceContainer.innerHTML = '';
            const clearanceItems = Object.entries(featuredClearance || {})
                .sort((a, b) => (b[1].createdAt || 0) - (a[1].createdAt || 0))
                .slice(0, 4);
            if (clearanceItems.length === 0) {
                clearanceContainer.innerHTML = '<p style="grid-column:1/-1;text-align:center;color:#888;">Немає хітів продажів</p>';
            } else {
                clearanceItems.forEach(([key, product]) => renderProductCard(clearanceContainer, key, product, 'clearanceProducts'));
            }
            clearanceContainer.classList.add('loaded');
        }

        lazyLoadImages();
        Object.assign(products, featuredSale || {}, featuredClearance || {});
        return; 
    }

    products = await fetchOrCache('products', ref(database, 'products'));
    renderContent(currentFilters);

    if (isRoom) {
        promos = await fetchOrCache('promos', ref(database, 'promos'));
        applyPromos();

        const rawColors = await fetchOrCache('colors', ref(database, 'colors'));
        colors = Object.values(rawColors || {});
        updateColorSelects();

        const rawMaterials = await fetchOrCache('materials', ref(database, 'materials'));
        materials = Object.values(rawMaterials || {});
        updateMaterialSelects();

        subcategories = await fetchOrCache('subcategories', ref(database, 'subcategories'));
        updateSubcategorySelects();

        if (isInitialLoad) {
            renderSubcategories(currentFilters.category, currentFilters.subcategory);
            isInitialLoad = false;
        }
    }
}

initializeData();
document.addEventListener('DOMContentLoaded', updateCartCount);

function showNotification(message, type = 'success') {
    const notification = document.getElementById('notification');
    if (!notification) return;
    const messageDiv = document.createElement('div');
    messageDiv.className = `notification-message ${type}`;
    messageDiv.textContent = message;
    notification.appendChild(messageDiv);
    setTimeout(() => { messageDiv.style.animation = 'slideOut 0.5s ease-in forwards'; setTimeout(() => messageDiv.remove(), 500); }, 3000);
}

function validatePhoneNumber(phone) {
    const phoneRegex = /^\+[0-9]{1,3}[0-9]{9,12}$/;
    return phoneRegex.test(phone) && ['+1', '+44', '+380', '+48', '+33', '+49', '+7', '+81', '+86'].includes(phone.match(/^\+\d{1,3}/)?.[0]);
}

function validateName(name) {
    return /^[A-Za-zА-Яа-яЁёІіЇїЄєҐґ ]{1,50}$/.test(name);
}

function loadUserData() {
    const userData = JSON.parse(localStorage.getItem('userData') || '{}');
    ['orderName', 'orderPhone', 'orderCountry', 'orderRegion', 'orderCity', 'orderComment'].forEach(id => {
        const element = document.getElementById(id);
        if (element) element.value = userData[id] || (id === 'orderPhone' ? '+380' : id === 'orderCountry' ? 'Україна' : '');
    });
}

let currentSlide = 0;
function updateBannerSlider() {
    const slides = document.querySelector('.slides');
    const dots = document.querySelector('.dots');
    if (!slides || !dots) return;
    slides.innerHTML = '';
    dots.innerHTML = '';
    Object.entries(banners).forEach(([key, banner], index) => {
        const img = document.createElement('img');
        img.src = banner.url;
        img.classList.add('slide');
        img.dataset.key = key;
        slides.appendChild(img);

        const dot = document.createElement('div');
        dot.classList.add('dot');
        if (index === 0) dot.classList.add('active');
        dot.addEventListener('click', () => showSlide(index));
        dots.appendChild(dot);
    });
    showSlide(0);
}

document.addEventListener('DOMContentLoaded', () => {
    const slides = document.querySelector('.slides');
    if (slides && Object.keys(banners).length === 0) {
        slides.innerHTML = '<div class="banner-spinner"></div>';
    }
});

function showSlide(index) {
    const slides = document.querySelector('.slides');
    const dots = document.querySelectorAll('.dot');
    if (!slides || !slides.children.length) return;
    currentSlide = (index % slides.children.length + slides.children.length) % slides.children.length;
    slides.style.transform = `translateX(-${currentSlide * 100}%)`;
    dots.forEach((dot, i) => dot.classList.toggle('active', i === currentSlide));
}

let autoSlideInterval;
function startAutoSlide() {
    autoSlideInterval = setInterval(() => showSlide(currentSlide + 1), 3000);
}
function stopAutoSlide() {
    clearInterval(autoSlideInterval);
}

updateBannerSlider();
startAutoSlide();

document.querySelector('.prev')?.addEventListener('click', () => { stopAutoSlide(); showSlide(currentSlide - 1); });
document.querySelector('.next')?.addEventListener('click', () => { stopAutoSlide(); showSlide(currentSlide + 1); });
document.querySelector('.slides')?.addEventListener('touchstart', stopAutoSlide);

let touchStartX = 0, touchEndX = 0;
document.querySelector('.slides')?.addEventListener('touchstart', e => touchStartX = e.changedTouches[0].screenX);
document.querySelector('.slides')?.addEventListener('touchend', e => {
    touchEndX = e.changedTouches[0].screenX;
    if (touchStartX - touchEndX > 50) showSlide(currentSlide + 1);
    else if (touchEndX - touchStartX > 50) showSlide(currentSlide - 1);
});

function getCategoryIcon(category) {
    const iconMap = {
        all: './img/icons/all.png',
        beds: './img/icons/bed.png',
        sofas: './img/icons/sofa.png',
        wardrobes: './img/icons/cabinet.png',
        tables: './img/icons/table.png',
        chairs: './img/icons/chair.png',
        mattresses: './img/icons/mattress.png',
        sale: './img/icons/percentage.png',
        clearance: './img/icons/sale.png'
    };
    return iconMap[category] || '';
}

function renderCategories() {
    const mainCategories = document.getElementById('mainCategories');
    if (!mainCategories) return;
    mainCategories.innerHTML = '';
    ['all', 'beds', 'sofas', 'wardrobes', 'tables', 'chairs', 'mattresses'].forEach(category => {
        const li = document.createElement('li');
        li.textContent = category === 'all' ? 'Всі товари' : categoryTranslations[category];
        li.dataset.category = category;
        li.style.backgroundImage = `url('${getCategoryIcon(category)}')`;
        li.style.backgroundRepeat = 'no-repeat';
        li.style.backgroundPosition = '10px center';
        li.style.backgroundSize = '30px 30px';
        li.style.paddingLeft = '55px';
        li.style.display = 'flex';
        li.style.alignItems = 'center';
        li.addEventListener('click', () => window.location.href = `room.html?category=${category}`);

        if (window.location.pathname.includes('room.html')) {
            const urlParams = new URLSearchParams(window.location.search);
            const selectedCategory = urlParams.get('category');
            if (selectedCategory === category) li.classList.add('selected');
        }

        mainCategories.appendChild(li);
    });
    const saleLi = document.createElement('li');
    saleLi.textContent = 'Акційні';
    saleLi.dataset.category = 'sale';
    saleLi.style.backgroundImage = `url('${getCategoryIcon('sale')}')`;
    saleLi.style.backgroundRepeat = 'no-repeat';
    saleLi.style.backgroundPosition = '10px center';
    saleLi.style.backgroundSize = '30px 30px';
    saleLi.style.paddingLeft = '55px';
    saleLi.style.display = 'flex';
    saleLi.style.alignItems = 'center';
    saleLi.addEventListener('click', () => window.location.href = 'room.html?sale=true');
    if (window.location.pathname.includes('room.html')) {
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('sale') === 'true') saleLi.classList.add('selected');
    }
    mainCategories.appendChild(saleLi);

    const clearanceLi = document.createElement('li');
    clearanceLi.textContent = 'Хіти продажів';
    clearanceLi.dataset.category = 'clearance';
    clearanceLi.style.backgroundImage = `url('${getCategoryIcon('clearance')}')`;
    clearanceLi.style.backgroundRepeat = 'no-repeat';
    clearanceLi.style.backgroundPosition = '10px center';
    clearanceLi.style.backgroundSize = '35px 35px';
    clearanceLi.style.paddingLeft = '55px';
    clearanceLi.style.display = 'flex';
    clearanceLi.style.alignItems = 'center';
    clearanceLi.addEventListener('click', () => window.location.href = 'room.html?clearance=true');
    if (window.location.pathname.includes('room.html')) {
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('clearance') === 'true') clearanceLi.classList.add('selected');
    }
    mainCategories.appendChild(clearanceLi);
}

document.addEventListener('DOMContentLoaded', () => {
    renderCategories();

});

document.querySelectorAll('#roomCategories li').forEach(li =>
    li.addEventListener('click', () => window.location.href = `room.html?room=${li.dataset.tag}`)
);
document.querySelectorAll('.category-menu ul li[data-filter]').forEach(li =>
    li.addEventListener('click', () => window.location.href = `room.html?${li.dataset.filter}=true`)
);

function filterProducts(filters) {
    return Object.entries(products).filter(([key, product]) => {
        const effectivePrice = product.onSale && product.discountPrices && product.discountPrices[product.sizes[0].size]
            ? product.discountPrices[product.sizes[0].size]
            : product.sizes[0].price;
        const subSubcategoryMatch = !filters.subSubcategory || product.subSubcategory === filters.subSubcategory;
        return (filters.category === 'all' || product.category === filters.category) &&
            (!filters.subcategory || product.subcategory === filters.subcategory) &&
            subSubcategoryMatch &&
            (!filters.priceMin || effectivePrice >= filters.priceMin) &&
            (!filters.priceMax || effectivePrice <= filters.priceMax) &&
            (filters.availability === null || product.availability === filters.availability) &&
            (!filters.color || (product.colors && product.colors.includes(filters.color))) &&
            (!filters.material || (product.materials && product.materials.includes(filters.material))) &&
            (!filters.room || (product.rooms && product.rooms.includes(filters.room))) &&
            (!filters.sale || product.onSale) &&
            (!filters.clearance || product.onClearance) &&
            (!filters.search || (
                product.name.toLowerCase().includes(filters.search.toLowerCase()) ||
                (product.description && product.description.toLowerCase().includes(filters.search.toLowerCase())) ||
                (product.category && product.category.toLowerCase().includes(filters.search.toLowerCase())) ||
                (product.subcategory && product.subcategory.toLowerCase().includes(filters.search.toLowerCase())) ||
                (product.subSubcategory && product.subSubcategory.toLowerCase().includes(filters.search.toLowerCase())) ||
                (product.colors && product.colors.some(color => color.toLowerCase().includes(filters.search.toLowerCase()))) ||
                (product.materials && product.materials.some(material => material.toLowerCase().includes(filters.search.toLowerCase()))) ||
                (product.rooms && product.rooms.some(room => room.toLowerCase().includes(filters.search.toLowerCase()))) ||
                (product.sizes && product.sizes.some(size =>
                    size.size.toLowerCase().includes(filters.search.toLowerCase()) ||
                    size.price.toString().includes(filters.search.toLowerCase())
                ))
            ));
    });
}

function renderLoadMoreButton(container, total) {
    let btn = document.getElementById('loadMoreBtn');
    if (!btn) {
        btn = document.createElement('button');
        btn.id = 'loadMoreBtn';
        btn.className = 'load-more-btn';
        btn.textContent = 'Завантажити ще';
        container.parentNode.insertBefore(btn, container.nextSibling);
        btn.addEventListener('click', () => {
            roomProductsOffset += ROOM_PAGE_SIZE;
            const nextBatch = roomProductsAll.slice(roomProductsOffset, roomProductsOffset + ROOM_PAGE_SIZE);
            nextBatch.forEach(([key, product]) => renderProductCard(container, key, product, 'roomProducts'));
            lazyLoadImages(); 
            if (roomProductsOffset + ROOM_PAGE_SIZE >= total) btn.style.display = 'none';
        });
    }
    btn.style.display = roomProductsOffset + ROOM_PAGE_SIZE < total ? 'block' : 'none';
}

function renderContent(filters) {
    if (Object.keys(products).length === 0) return;
    ['mainProducts', 'roomProducts', 'saleProducts', 'clearanceProducts'].forEach(containerId => {
        const container = document.getElementById(containerId);
        if (!container) return;

        let filteredProducts = filterProducts(filters);

        if (containerId === 'roomProducts' && filters.category === 'all') {
            const categories = ['beds', 'sofas', 'wardrobes', 'tables', 'chairs', 'mattresses'];
            const categoryGroups = {};
            filteredProducts.forEach(([key, product]) => {
                if (!categoryGroups[product.category]) categoryGroups[product.category] = [];
                categoryGroups[product.category].push([key, product]);
            });
            const categoryOrder = categories
                .filter(cat => categoryGroups[cat] && categoryGroups[cat].length > 0)
                .map(cat => ({
                    category: cat,
                    maxCreatedAt: Math.max(...categoryGroups[cat].map(([, p]) => p.createdAt || 0))
                }))
                .sort((a, b) => b.maxCreatedAt - a.maxCreatedAt)
                .map(({ category }) => category);
            let selectedProducts = [];
            categoryOrder.forEach(cat => {
                const sortedCategoryProducts = categoryGroups[cat].sort((a, b) => (b[1].createdAt || 0) - (a[1].createdAt || 0));
                selectedProducts = [...selectedProducts, ...sortedCategoryProducts];
            });
            filteredProducts = selectedProducts;
        } else {
            filteredProducts.sort((a, b) => (b[1].createdAt || 0) - (a[1].createdAt || 0));
            if (containerId === 'saleProducts' || containerId === 'clearanceProducts') {
                filteredProducts = filteredProducts
                    .filter(([_, product]) =>
                        (containerId === 'saleProducts' && product.onSale) ||
                        (containerId === 'clearanceProducts' && product.onClearance)
                    )
                    .slice(0, 4);
            }
        }

        container.innerHTML = '';

        if (containerId === 'roomProducts') {
            roomProductsAll = filteredProducts;
            roomProductsOffset = 0;
            const firstBatch = roomProductsAll.slice(0, ROOM_PAGE_SIZE);
            firstBatch.forEach(([key, product]) => renderProductCard(container, key, product, 'roomProducts'));
            renderLoadMoreButton(container, roomProductsAll.length);
        } else {
            filteredProducts.forEach(([key, product]) => {
                if (containerId === 'mainProducts' ||
                    (containerId === 'saleProducts' && product.onSale) ||
                    (containerId === 'clearanceProducts' && product.onClearance)) {
                    renderProductCard(container, key, product, containerId);
                }
            });
        }

        container.classList.add('loaded');
    });

    lazyLoadImages();
}

function renderSingleProduct(productId) {
    currentProductId = productId;
    let product = null;

    if (products[productId]) {
        product = { key: productId, ...products[productId] };
    } else {
        product = Object.entries(products).flatMap(([cat, prods]) =>
            Object.entries(prods || {}).map(([key, prod]) => ({ key, ...prod }))
        ).find(p => p.key === productId);
    }

    if (!product) {
        showNotification('Продукт не знайдено', 'error');
        return;
    }
    const container = document.getElementById('productDetails');
    if (!container) {
        showNotification('Контейнер для продукту не знайдено', 'error');
        return;
    }

    const discountPrices = product.onSale && product.discountPrices ? product.discountPrices : {};
    const originalPrice = product.sizes[0].price;
    const salePrice = discountPrices[product.sizes[0].size] || originalPrice;
    const formattedSalePrice = CurrencyManager.format(salePrice);
    const formattedOriginalPrice = CurrencyManager.format(originalPrice);
    const subcategoryName = product.subcategory ? subcategoryTranslations[product.subcategory] || product.subcategory : null;
    const subSubcategoryName = product.subSubcategory ? subcategoryTranslations[product.subSubcategory] || product.subSubcategory : null;
    const breadcrumbPath = [];
    breadcrumbPath.push('<a href="' + (document.referrer || 'index.html') + '">Головна</a>');
    if (subcategoryName && subSubcategoryName) {
        breadcrumbPath.push('<a href="room.html?category=' + product.category + '&subcategory=' + product.subcategory + '">' + subcategoryName + '</a>');
        breadcrumbPath.push(subSubcategoryName);
    } else if (subcategoryName) {
        breadcrumbPath.push('<a href="room.html?category=' + product.category + '&subcategory=' + product.subcategory + '">' + subcategoryName + '</a>');
    } else {
        breadcrumbPath.push('<a href="room.html?category=' + product.category + '">' + categoryName + '</a>');
    }
    breadcrumbPath.push(product.name);

    container.innerHTML = `
        <div class="breadcrumb">
            ${breadcrumbPath.join(' > ')}
        </div>
        <div class="product-html-product">
            <div class="product-container-top" style="cursor: pointer;">
                ${product.onClearance ? '<span class="promo clearance">Хіт продажу</span>' : ''}
                ${product.onSale ? '<span class="promo">Акція</span>' : ''}
                <div class="product-image-slider">
                    <div class="swiper-wrapper">
                        ${(product.photos || [product.photo] || []).map(url => `<div class="swiper-slide"><div class="product-image-container"><img src="${url}" alt="${product.name}" class="product-image"></div></div>`).join('')}
                    </div>
                    <div class="swiper-pagination"></div>
                    <div class="swiper-button-prev"></div>
                    <div class="swiper-button-next"></div>
                </div>
            </div>
            <div class="product-container-bottom">
                <h3>${product.name}</h3>
                <p>${product.description}</p>
                <div class="sizes">
                    <select class="size-select" data-product-id="${productId}" onchange="updatePrice('price_${productId}', this.options[this.selectedIndex].dataset.price, this.value, '${productId}')">
                        ${product.sizes.map((size, index) => {
                            const discount = discountPrices[size.size] || null;
                            return `<option value="${size.size}" data-price="${discount || size.price}" data-original-price="${size.price}" ${index === 0 ? 'selected' : ''}>Розмір: ${size.size}</option>`;
                        }).join('')}
                    </select>
                </div>
                <div class="order-items-price">
                    <p class="product-price"><span class="sale-price" id="price_${productId}">${formattedSalePrice}</span>${discountPrices[product.sizes[0].size] ? `<del class="original-price" id="original_price_${productId}">${formattedOriginalPrice}</del>` : ''}</p>
                </div>
                <div class="product-button-order">
                    <button class="addToCart" data-id="${productId}"><i class="material-icons">shopping_cart</i></button>
                    <button class="buyNow" data-id="${productId}">Замовити</button>
                </div>
            </div>
        </div>
    `;

    if (typeof Swiper !== 'undefined') {
        new Swiper('.product-image-slider', {
            loop: true,
            pagination: { el: '.swiper-pagination', clickable: true },
            navigation: { nextEl: '.swiper-button-next', prevEl: '.swiper-button-prev' },
            autoplay: { delay: 5000 },
            slidesPerView: 1,
            spaceBetween: 10
        });
    } else {
        console.warn('Swiper не завантажено');
        showNotification('Не вдалося завантажити слайдер зображень', 'error');
    }
}

function renderProductDetails(product) {
    const container = document.getElementById('productDetails');
    if (!container) {
        showNotification('Контейнер для продукту не знайдено', 'error');
        return;
    }

    const discountPrices = product.onSale && product.discountPrices ? product.discountPrices : {};
    const originalPrice = product.sizes[0].price;
    const salePrice = discountPrices[product.sizes[0].size] || originalPrice;
    const formattedSalePrice = CurrencyManager.format(salePrice);
    const formattedOriginalPrice = CurrencyManager.format(originalPrice);

    container.innerHTML = `
        <div class="product-container-top">
            ${product.onClearance ? '<span class="promo clearance">Хіт продажу</span>' : ''}
            ${product.onSale ? '<span class="promo">Акція</span>' : ''}
            <div class="product-image-slider">
                <div class="swiper-wrapper">
                    ${(product.photos || [product.photo] || []).map(url => `<div class="swiper-slide"><div class="product-image-container"><img src="${url}" alt="${product.name}" class="product-image"></div></div>`).join('')}
                </div>
                <div class="swiper-pagination"></div>
                <div class="swiper-button-prev"></div>
                <div class="swiper-button-next"></div>
            </div>
            <h3>${product.name}</h3>
            <p>${product.description}</p>
        </div>
        <div class="product-container-bottom">
            <div class="sizes">
                <select class="size-select" data-product-id="${product.key}" onchange="updatePrice('price_${product.key}', this.options[this.selectedIndex].dataset.price, this.value, '${product.key}')">
                    ${product.sizes.map((size, index) => {
                        const discount = discountPrices[size.size] || null;
                        return `<option value="${size.size}" data-price="${discount || size.price}" data-original-price="${size.price}" ${index === 0 ? 'selected' : ''}>Розмір: ${size.size}</option>`;
                    }).join('')}
                </select>
            </div>
            <div class="order-items-price">
                <p class="product-price"><span class="sale-price" id="price_${product.key}">${formattedSalePrice}</span>${discountPrices[product.sizes[0].size] ? `<del class="original-price" id="original_price_${product.key}">${formattedOriginalPrice}</del>` : ''}</p>
            </div>
            <div class="product-button-order">
                <button class="addToCart" data-id="${product.key}"><i class="material-icons">shopping_cart</i></button>
                <button class="buyNow" data-id="${product.key}">Замовити</button>
            </div>
        </div>
    `;

    if (typeof Swiper !== 'undefined') {
        new Swiper('.product-image-slider', {
            loop: true,
            pagination: { el: '.swiper-pagination', clickable: true },
            navigation: { nextEl: '.swiper-button-next', prevEl: '.swiper-button-prev' },
            autoplay: { delay: 5000 },
            slidesPerView: 1,
            spaceBetween: 10
        });
    } else {
        console.warn('Swiper не завантажено');
        showNotification('Не вдалося завантажити слайдер зображень', 'error');
    }
}

function renderProductCard(container, key, product, sectionId) {
    const productDiv = document.createElement('div');
    productDiv.classList.add('product');
    const discountPrices = product.onSale && product.discountPrices ? product.discountPrices : {};
    const originalPrice = product.sizes[0].price;
    const salePrice = discountPrices[product.sizes[0].size] || originalPrice;
    const formattedSalePrice = CurrencyManager.format(salePrice);
    const formattedOriginalPrice = CurrencyManager.format(originalPrice);

    const photoUrl = (product.photos || [])[0] || product.photo || '';

    productDiv.innerHTML = `
        <div class="product-container-top" onclick="window.location.href='product.html?id=${key}'" style="cursor: pointer;">
            ${product.onClearance ? '<span class="promo clearance">Хіт продажу</span>' : ''}
            ${product.onSale ? '<span class="promo">Акція</span>' : ''}
            <img data-src="${photoUrl}" alt="${product.name}" class="product-img lazy">
            <h3>${product.name}</h3>
        </div>
        <div class="product-container-bottom">
            <div class="sizes">
                <select class="size-select" data-product-id="${key}" onchange="updatePrice('price_${key}', this.options[this.selectedIndex].dataset.price, this.value, '${key}')">
                    ${product.sizes.map((size, index) => {
                        const discount = discountPrices[size.size] || null;
                        return `<option value="${size.size}" data-price="${discount || size.price}" data-original-price="${size.price}" ${index === 0 ? 'selected' : ''}>Розмір: ${size.size}</option>`;
                    }).join('')}
                </select>
            </div>
            <p class="product-price"><span class="sale-price" id="price_${key}">${formattedSalePrice}</span>${discountPrices[product.sizes[0].size] ? `<del class="original-price" id="original_price_${key}">${formattedOriginalPrice}</del>` : ''}</p>
            <div class="product-button-order">
                <button class="addToCart" data-id="${key}"><i class="material-icons">shopping_cart</i></button>
                <button class="buyNow" data-id="${key}">Замовити</button>
            </div>
        </div>
    `;
    const clickableArea = productDiv.querySelector('.product-container-top');
    clickableArea.addEventListener('click', (e) => {
        if (e.target.tagName !== 'BUTTON' && !e.target.classList.contains('size-select')) {
            window.location.href = `product.html?id=${key}`;
        }
    });
    const sizeSelect = productDiv.querySelector('.size-select');
    sizeSelect.addEventListener('change', (e) => {
        const selectedOption = e.target.options[e.target.selectedIndex];
        const newPrice = selectedOption.dataset.price;
        const origPrice = selectedOption.dataset['original-price'] || selectedOption.dataset.originalPrice;
        const priceElement = productDiv.querySelector(`#price_${key}`);
        const originalPriceElement = productDiv.querySelector(`#original_price_${key}`);
        if (priceElement) priceElement.textContent = CurrencyManager.format(newPrice);
        if (product.onSale && originalPriceElement) {
            originalPriceElement.textContent = CurrencyManager.format(origPrice);
        } else if (!product.onSale && originalPriceElement) {
            originalPriceElement.remove();
        } else if (product.onSale && !originalPriceElement) {
            priceElement.insertAdjacentHTML('afterend', `<del class="original-price" id="original_price_${key}">${CurrencyManager.format(origPrice)}</del>`);
        }
    });
    container.appendChild(productDiv);
}

window.updatePrice = (priceId, newPrice, selectedSize, productId) => {
    const priceElement = document.getElementById(priceId);
    const originalPriceElement = document.getElementById(`original_price_${productId}`);
    if (!priceElement) { console.error('Price element not found:', priceId); return; }

    const rawUah = Number(String(newPrice).replace(/\s/g, ''));
    priceElement.textContent = CurrencyManager.format(rawUah);
    let product = products[productId];
    if (!product) {
        product = Object.entries(products).flatMap(([cat, prods]) =>
            Object.entries(prods || {}).map(([key, prod]) => ({ key, ...prod }))
        ).find(p => p.key === productId);
    }
    if (!product) { console.error('Product not found:', productId); return; }

    const originalPrice = product.sizes.find(s => s.size === selectedSize)?.price || '';
    if (product.onSale && product.discountPrices && product.discountPrices[selectedSize]) {
        if (originalPriceElement) {
            originalPriceElement.textContent = CurrencyManager.format(originalPrice);
        } else {
            priceElement.insertAdjacentHTML('afterend', `<del class="original-price" id="original_price_${productId}">${CurrencyManager.format(originalPrice)}</del>`);
        }
    } else if (originalPriceElement) {
        originalPriceElement.remove();
    }
};

document.getElementById('searchBar')?.addEventListener('input', e => {
    const searchTerm = e.target.value.toLowerCase();
    const container = document.getElementById('mainProducts');
    if (!container) return;
    container.innerHTML = '';
    Object.entries(products).forEach(([key, product]) => {
        if (product.name.toLowerCase().includes(searchTerm) || product.description.toLowerCase().includes(searchTerm))
            renderProductCard(container, key, product, 'mainProducts');
    });
    lazyLoadImages();
});

function showUnavailableModal(removedNames) {
    const existing = document.getElementById('unavailableModal');
    if (existing) existing.remove();

    const modal = document.createElement('div');
    modal.id = 'unavailableModal';
    modal.className = 'modal';
    modal.style.display = 'flex';

    modal.innerHTML = `
        <div class="modal-content">
            <span class="close" id="unavailableClose">&times;</span>
            <div class="unavail-icon">
                <i class="material-icons">remove_shopping_cart</i>
            </div>
            <h2 class="unavail-title">Вибачте!</h2>
            <p class="unavail-text">
                ${removedNames.length === 1
                    ? `Товар <strong>"${removedNames[0]}"</strong> більше недоступний і був видалений з вашого кошика.`
                    : `Наступні товари більше недоступні та були видалені з вашого кошика:`
                }
            </p>
            ${removedNames.length > 1 ? `
            <ul class="unavail-list">
                ${removedNames.map(n => `
                    <li><i class="material-icons">close</i> ${n}</li>
                `).join('')}
            </ul>` : ''}
            <p class="unavail-subtext">Будь ласка, оберіть інший товар із нашого каталогу.</p>
            <div class="unavail-buttons">
                <button class="unavail-btn-catalog" onclick="window.location.href='room.html'">
                    <i class="material-icons">store</i> До каталогу
                </button>
                <button class="unavail-btn-close" id="unavailableCloseBtn">
                    <i class="material-icons">close</i> Закрити
                </button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    const close = () => { modal.style.display = 'none'; modal.remove(); };
    document.getElementById('unavailableClose').addEventListener('click', close);
    document.getElementById('unavailableCloseBtn').addEventListener('click', close);
    modal.addEventListener('click', e => { if (e.target === modal) close(); });
}

function updateCartCount() {
    const cart = JSON.parse(localStorage.getItem('cart') || '[]');
    const cartCountEl = document.getElementById('cartCount') || document.getElementById('cartStatus') || document.querySelector('.cart-count');
    if (cartCountEl) {
        cartCountEl.textContent = cart.length > 0 ? String(cart.length) : '';
        cartCountEl.classList.remove('bump');
        void cartCountEl.offsetWidth; 
        if (cart.length > 0) cartCountEl.classList.add('bump');
        setTimeout(() => cartCountEl.classList.remove('bump'), 300);
    }
}

function renderCart() {
    const cartItems = document.getElementById('cartItems');
    const totalPriceElement = document.getElementById('cartTotalPrice');

    updateCartCount();

    if (!cartItems || !totalPriceElement) return;

    const cart = JSON.parse(localStorage.getItem('cart') || '[]');
    cartItems.innerHTML = '';
    let totalPrice = 0;

    if (cart.length === 0) {
        cartItems.innerHTML = '<p>Кошик порожній</p>';
        totalPriceElement.textContent = '';
        return;
    }

    cart.forEach((item, index) => {
        let product = Object.entries(products).flatMap(([cat, prods]) =>
            Object.entries(prods || {}).map(([key, prod]) => ({ key, ...prod }))
        ).find(p => p.key === item.id) || (products[item.id] ? { key: item.id, ...products[item.id] } : null);
        if (!product) return;
        const size = product.sizes.find(s => s.size === item.size);
        if (!size) return;

        const discountPrice = product.onSale && product.discountPrices ? product.discountPrices[item.size] : null;
        totalPrice += parseFloat(discountPrice || size.price);

        const productDiv = document.createElement('div');
        productDiv.classList.add('product');
        productDiv.dataset.productId = item.id;
        const formattedDiscountPrice = CurrencyManager.format(discountPrice || size.price);
        const formattedOriginalPrice = CurrencyManager.format(size.price);

        productDiv.innerHTML = `
            <img src="${(product.photos || [])[0] || product.photo || ''}" alt="${product.name || ''}">
            <div class="order-items-content">
                <div class="order-items-desc">
                    <h3>${product.name || ''}</h3>
                </div>
                <div class="order-items-bottom">
                    <div class="order-items-price">
                        <p class="product-price">
                            <span class="sale-price" id="price_${index}">${formattedDiscountPrice}</span>
                            ${product.onSale ? `<del class="original-price" id="original_price_${item.id}_${index}">${formattedOriginalPrice}</del>` : ''}
                        </p>
                    </div>
                    <div class="sizes">
                        <select class="size-select" data-product-id="${item.id}"
                                onchange="updatePrice('price_${index}', this.options[this.selectedIndex].dataset.price, this.value, '${item.id}'); updateCartSize(${index}, this.value);">
                            ${product.sizes.map(s => `<option data-price="${s.price}" value="${s.size}" ${s.size === item.size ? 'selected' : ''}>Розмір: ${s.size}</option>`).join('')}
                        </select>
                    </div>
                    <button class="remove-from-cart" onclick="removeFromCart(${index})">Видалити</button>
                </div>
            </div>
        `;
        cartItems.appendChild(productDiv);
    });

    totalPriceElement.textContent = `Загальна ціна: ${CurrencyManager.format(totalPrice)}`;
}

window.removeFromCart = (index) => {
    const cart = JSON.parse(localStorage.getItem('cart') || '[]');
    cart.splice(index, 1);
    localStorage.setItem('cart', JSON.stringify(cart));
    updateCartCount();
    renderCart();
    showNotification('Товар видалено з кошика', 'success');
};

window.updateCartSize = (index, size) => {
    const cart = JSON.parse(localStorage.getItem('cart') || '[]');
    cart[index].size = size;
    localStorage.setItem('cart', JSON.stringify(cart));
    renderCart();
};

document.getElementById('cartBtn')?.addEventListener('click', async () => {
    const modal = document.getElementById('cartModal');
    if (!modal) return;

    const cart = JSON.parse(localStorage.getItem('cart') || '[]');
    if (cart.length > 0) {
        const checks = await Promise.all(
            cart.map(item => get(ref(database, `products/${item.id}`)))
        );

        checks.forEach((snap, i) => {
            if (snap.exists() && !products[cart[i].id]) {
                products[cart[i].id] = snap.val();
            }
        });

        const removedNames = [];
        const validCart = cart.filter((item, i) => {
            if (!checks[i].exists()) {
                const cached = getCached('products');
                const name = (cached && cached[item.id]?.name)
                    || products[item.id]?.name
                    || 'Невідомий товар';
                removedNames.push(name);

                document.querySelectorAll('.product').forEach(card => {
                    if (card.querySelector(`[data-id="${item.id}"]`)) card.remove();
                });

                return false;
            }
            return true;
        });

        if (removedNames.length > 0) {
            localStorage.setItem('cart', JSON.stringify(validCart));
            updateCartCount();
            showUnavailableModal(removedNames);
            return; 
        }
    }

    modal.style.display = 'flex';
    renderCart();
});

document.querySelectorAll('.modal .close').forEach(close =>
    close.addEventListener('click', () => close.closest('.modal').style.display = 'none')
);
document.querySelectorAll('.modal').forEach(modal =>
    modal.addEventListener('click', e => e.target === modal && (modal.style.display = 'none'))
);

document.addEventListener('click', e => {
    if (e.target.classList.contains('addToCart') || e.target.classList.contains('buyNow')) {
        const productId = e.target.dataset.id;
        let product = products[productId] || Object.entries(products).flatMap(([cat, prods]) =>
            Object.entries(prods || {}).map(([key, prod]) => ({ key, ...prod }))
        ).find(p => p.key === productId);
        if (!product) { showNotification('Товар недоступний', 'error'); return; }
        const sizeSelect = document.querySelector(`.size-select[data-product-id="${productId}"]`);
        if (!sizeSelect || !sizeSelect.value) { showNotification('Будь ласка, виберіть розмір', 'warning'); return; }
        const size = sizeSelect.value;
        if (e.target.classList.contains('addToCart')) {
            const cart = JSON.parse(localStorage.getItem('cart') || '[]');
            if (!cart.some(item => item.id === productId && item.size === size)) {
                cart.push({ id: productId, size });
                localStorage.setItem('cart', JSON.stringify(cart));
                updateCartCount();
                renderCart();
                showNotification('Товар додано до кошика', 'success');
            }
        }
        if (e.target.classList.contains('buyNow')) {
            const sizeExists = product.sizes.some(s => s.size === size);
            if (!sizeExists) { showNotification('Вибраний розмір недоступний', 'error'); return; }
            const orderModal = document.getElementById('orderModal');
            if (orderModal) {
                orderModal.style.display = 'flex';
                renderOrderItems([{ id: productId, size }]);
                loadUserData();
            }
        }
    }
});

function renderOrderItems(orderItems) {
    const orderItemsDiv = document.getElementById('orderItems');
    if (!orderItemsDiv) return;
    orderItemsDiv.innerHTML = '';
    if (!orderItems?.length) {
        orderItemsDiv.innerHTML = '<p>Кошик порожній</p>';
        showNotification('Кошик порожній', 'warning');
        return;
    }
    let validItems = 0;
    orderItems.forEach((item, index) => {
        let product = Object.entries(products).flatMap(([cat, prods]) =>
            Object.entries(prods || {}).map(([key, prod]) => ({ key, ...prod }))
        ).find(p => p.key === item.id) || (products[item.id] ? { key: item.id, ...products[item.id] } : null);
        if (!product) { console.error(`Продукт з ID ${item.id} не знайдено`); return; }
        const size = product.sizes.find(s => s.size === item.size);
        if (!size) { console.error(`Розмір ${item.size} для продукту ${item.id} не знайдено`); return; }
        validItems++;
        const discountPrice = product.onSale && product.discountPrices ? product.discountPrices[item.size] : null;
        const formattedDiscountPrice = CurrencyManager.format(discountPrice || size.price);
        const formattedOriginalPrice = CurrencyManager.format(size.price);

        const productDiv = document.createElement('div');
        productDiv.classList.add('product');
        productDiv.dataset.productId = item.id;
        productDiv.innerHTML = `
            <img src="${(product.photos || [])[0] || product.photo || ''}" alt="${product.name}">
            <div class="order-items-content">
                <div class="order-items-desc">
                    <h3>${product.name}</h3>
                    ${product.subSubcategory ? `<p>Кількість дверей: ${subcategoryTranslations[product.subSubcategory] || product.subSubcategory}</p>` : ''}
                </div>
                <div class="order-items-bottom">
                    <div class="order-items-price">
                        <p class="product-price"><span class="sale-price" id="price_${index}">${formattedDiscountPrice}</span>${discountPrice ? `<del class="original-price" id="original_price_${item.id}_${index}">${formattedOriginalPrice}</del>` : ''}</p>
                    </div>
                    <div class="sizes"><select class="size-select" onchange="updateOrderItemSize(${index}, this.value)">
                        ${product.sizes.map(s => `<option value="${s.size}" data-price="${product.onSale && product.discountPrices && product.discountPrices[s.size] ? product.discountPrices[s.size] : s.price}" data-original-price="${s.price}" ${s.size === item.size ? 'selected' : ''}>Розмір: ${s.size}</option>`).join('')}
                    </select></div>
                </div>
            </div>
        `;
        productDiv.querySelector('.size-select')?.addEventListener('change', (e) => {
            updatePrice(`price_${index}`, e.target.options[e.target.selectedIndex].dataset.price, e.target.value, item.id);
        });
        orderItemsDiv.appendChild(productDiv);
    });
    if (validItems === 0) {
        orderItemsDiv.innerHTML = '<p>Немає доступних товарів у замовленні</p>';
        showNotification('Немає доступних товарів у замовлення', 'error');
    } else {
        let totalPrice = 0;
        orderItems.forEach((item) => {
            let product = products[item.id] || Object.entries(products).flatMap(([_, prods]) => Object.values(prods || {})).find(p => p.key === item.id);
            if (product) {
                const size = product.sizes.find(s => s.size === item.size);
                const discountPrice = product.onSale && product.discountPrices ? product.discountPrices[item.size] : null;
                totalPrice += parseFloat(discountPrice || size.price);
            }
        });
        const totalPriceElement = document.getElementById('orderTotalPrice');
        if (totalPriceElement) totalPriceElement.textContent = CurrencyManager.format(totalPrice);
    }
}

window.updateOrderItemSize = (index, size) => {
    const orderItems = Array.from(document.querySelectorAll('#orderItems .product')).map((product, i) => ({
        id: product.dataset.productId,
        size: i === index ? size : product.querySelector('.size-select').value
    }));
    renderOrderItems(orderItems);
};

document.getElementById('checkout')?.addEventListener('click', () => {
    const cart = JSON.parse(localStorage.getItem('cart') || '[]');
    if (!cart.length) { showNotification('Кошик порожній', 'warning'); return; }
    const validCartItems = cart.filter(item => {
        const product = products[item.id] || Object.entries(products).flatMap(([_, prods]) => Object.values(prods || {})).find(p => p.key === item.id);
        return product && product.sizes.some(s => s.size === item.size);
    });
    if (!validCartItems.length) { showNotification('Кошик містить недоступні товари', 'error'); return; }
    const orderModal = document.getElementById('orderModal');
    if (orderModal) { orderModal.style.display = 'flex'; renderOrderItems(validCartItems); loadUserData(); }
});

document.getElementById('orderForm')?.addEventListener('submit', e => {
    e.preventDefault();
    const submitButton = document.querySelector('#orderForm button[type="submit"]');
    if (!submitButton) return;
    submitButton.disabled = true;
    submitButton.textContent = 'Зачекайте...';
    const orderItems = Array.from(document.querySelectorAll('#orderItems .product')).map(product => {
        const id = product.dataset.productId;
        const sizeSelect = product.querySelector('.size-select');
        if (!products[id] || !sizeSelect) return null;
        return { id, size: sizeSelect.value };
    }).filter(item => item && products[item.id] && products[item.id].sizes.some(s => s.size === item.size));
    if (!orderItems.length) {
        showNotification('Кошик містить недоступні товари', 'error');
        submitButton.disabled = false;
        submitButton.textContent = 'Оформити';
        return;
    }
    const { value: name } = document.getElementById('orderName') || { value: '' };
    const { value: phone } = document.getElementById('orderPhone') || { value: '' };
    const { value: country } = document.getElementById('orderCountry') || { value: '' };
    const { value: region } = document.getElementById('orderRegion') || { value: '' };
    const { value: city } = document.getElementById('orderCity') || { value: '' };
    const { value: comment } = document.getElementById('orderComment') || { value: '' };
    if (!validateName(name)) {
        showNotification('Ім\'я може містити лише літери та пробіли, до 50 символів', 'error');
        submitButton.disabled = false; submitButton.textContent = 'Оформити'; return;
    }
    if (!validatePhoneNumber(phone)) {
        showNotification('Номер телефону має починатися з "+" та містити коректний код країни', 'error');
        submitButton.disabled = false; submitButton.textContent = 'Оформити'; return;
    }
    if (!country || !region || !city) {
        showNotification('Заповніть усі поля адреси', 'error');
        submitButton.disabled = false; submitButton.textContent = 'Оформити'; return;
    }
    const rateInfo = CurrencyManager.getRateInfo();
    const order = {
        name, phone, country, region, city, comment,
        currency: rateInfo.currency,
        rate: rateInfo.rate || null,
        rateDate: rateInfo.rateDate || null,
        products: orderItems.map(item => {
            const product = products[item.id];
            const size = product.sizes.find(s => s.size === item.size);
            return {
                name: product.name,
                size: item.size,
                price: product.onSale && product.discountPrices && product.discountPrices[item.size] ? product.discountPrices[item.size] : size.price,
                photo: (product.photos || [])[0] || product.photo || '',
                availability: product.availability,
                rooms: product.rooms || [],
                subSubcategory: product.subSubcategory || null
            };
        })
    };
    fetch('https://project-mebli.onrender.com/sendOrder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(order)
    })
        .then(response => {
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            return response.json();
        })
        .then(() => {
            localStorage.setItem('userData', JSON.stringify({ name, phone, country, region, city, comment }));
            const cartModal = document.getElementById('cartModal');
            const orderModal = document.getElementById('orderModal');
            const successModal = document.getElementById('successModal');
            if (cartModal) cartModal.style.display = 'none';
            if (orderModal) orderModal.style.display = 'none';
            if (successModal) successModal.style.display = 'flex';
            else showNotification('Помилка: модальне вікно успіху не знайдено', 'error');
            localStorage.removeItem('cart');
            showNotification('Замовлення успішно оформлено', 'success');
        })
        .catch(err => {
            let message = 'Помилка при оформленні замовлення';
            if (err.message.includes('NetworkError')) message = 'Проблема з мережею. Перевірте підключення.';
            else if (err.message.includes('HTTP error')) message = `Помилка сервера: ${err.message}`;
            showNotification(message, 'error');
        })
        .finally(() => {
            submitButton.disabled = false;
            submitButton.textContent = 'Оформити';
        });
});

document.getElementById('loginBtn')?.addEventListener('click', () => {
    const email = document.getElementById('email')?.value || '';
    const password = document.getElementById('password')?.value || '';
    signInWithEmailAndPassword(auth, email, password)
        .then(() => window.location.href = 'admin.html')
        .catch(error => showNotification('Помилка входу: ' + error.message, 'error'));
});

document.getElementById('logout')?.addEventListener('click', () =>
    signOut(auth)
        .then(() => window.location.href = 'login.html')
        .catch(error => showNotification('Помилка виходу: ' + error.message, 'error'))
);

onAuthStateChanged(auth, user => {
    if (!user && window.location.pathname.includes('admin.html')) window.location.href = 'login.html';
    else if (user && window.location.pathname.includes('login.html')) window.location.href = 'admin.html';
});

document.addEventListener('DOMContentLoaded', () => {
    ['cartModal', 'orderModal', 'successModal', 'promoModal', 'editModal'].forEach(id => {
        const modal = document.getElementById(id);
        if (modal) modal.style.display = 'none';
    });
    if (document.getElementById('mainCategories')) renderCategories();
    if (window.location.pathname.includes('room.html') && currentFilters.room) {
        const roomSelect = document.getElementById('room');
        if (roomSelect) roomSelect.value = currentFilters.room;
    }
    if (document.getElementById('cartBtn')) {
        document.getElementById('cartBtn').addEventListener('click', () => {
            const modal = document.getElementById('cartModal');
            if (modal) { modal.style.display = 'flex'; renderCart(); }
        });
    }
    if (document.getElementById('filterBtn')) {
        document.getElementById('filterBtn').addEventListener('click', () => {
            const filters = document.getElementById('filters');
            filters.style.display = filters.style.display === 'none' ? 'block' : 'none';
        });
    }
    document.querySelectorAll('.tab-btn').forEach(button => {
        button.addEventListener('click', () => {
            const tabId = button.dataset.tab;
            document.querySelectorAll('.tab-content').forEach(content => {
                content.style.display = 'none';
                content.classList.remove('active');
            });
            document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
            const content = document.getElementById(tabId);
            if (content) { content.style.display = 'block'; content.classList.add('active'); button.classList.add('active'); }
        });
    });
    const welcomeTab = document.getElementById('welcome');
    const welcomeBtn = document.querySelector('.tab-btn[data-tab="welcome"]');
    if (welcomeTab && welcomeBtn) { welcomeTab.style.display = 'block'; welcomeTab.classList.add('active'); welcomeBtn.classList.add('active'); }
    if (document.getElementById('productCategory')) {
        updateSubcategoryOptions();
        document.getElementById('productCategory').addEventListener('change', updateSubcategoryOptions);
        document.getElementById('productSubcategory').addEventListener('change', updateSubSubcategoryOptions);
    }
    if (document.getElementById('editProductCategory')) {
        updateEditSubcategoryOptions();
        document.getElementById('editProductCategory').addEventListener('change', updateEditSubcategoryOptions);
        document.getElementById('editProductSubcategory').addEventListener('change', updateEditSubSubcategoryOptions);
    }
    if (document.getElementById('addProduct')) {
        document.querySelectorAll('#addProduct input, #addProduct textarea, #sizes input').forEach(input => {
            input.addEventListener('keydown', e => { if (e.key === 'Enter') e.preventDefault(); });
        });
    }
});

function renderSubcategories(category, selectedSubcategory) {
    const subcategoryList = document.getElementById('subcategoryList');
    if (!subcategoryList) return;
    subcategoryList.innerHTML = '';

    const defaultSubcategories = {
        beds: ['all', 'soft_beds', 'wooden_beds', 'bedroom_sets', 'dressers', 'nightstands'],
        sofas: ['all', 'corner', 'straight', 'armchairs'],
        wardrobes: ['all', 'sliding_wardrobes', 'sliding_wardrobes_with_carving', 'art_matting', 'tv_wardrobes'],
        tables: ['all', 'wooden', 'metal', 'coffee'],
        chairs: ['all', 'wooden', 'soft'],
        mattresses: ['all', 'standard']
    };

    const subcategoriesForCategory = subcategories[category] && subcategories[category].length
        ? subcategories[category]
        : defaultSubcategories[category] || ['all'];

    const allLi = document.createElement('li');
    allLi.textContent = 'Всі товари';
    allLi.dataset.subcategory = 'all';
    allLi.addEventListener('click', () => {
        currentFilters.subcategory = null;
        currentFilters.subSubcategory = null;
        window.history.pushState({}, '', `room.html?category=${category}`);
        renderContent(currentFilters);
        renderSubcategories(category, null);
    });
    if (!selectedSubcategory) allLi.classList.add('selected');
    subcategoryList.appendChild(allLi);

    subcategoriesForCategory
        .filter(sub => sub !== 'all')
        .forEach(sub => {
            const li = document.createElement('li');
            li.textContent = subcategoryTranslations[sub] || sub;
            li.dataset.subcategory = sub;
            li.addEventListener('click', () => {
                currentFilters.subcategory = sub;
                currentFilters.subSubcategory = null;
                const url = new URL(window.location);
                url.searchParams.set('category', category);
                url.searchParams.set('subcategory', sub);
                url.searchParams.delete('subSubcategory');
                window.history.pushState({}, '', url);
                renderContent(currentFilters);
                renderSubcategories(category, sub);
            });
            if (selectedSubcategory === sub) li.classList.add('selected');
            subcategoryList.appendChild(li);

            if (['sliding_wardrobes', 'sliding_wardrobes_with_carving'].includes(sub) && selectedSubcategory === sub) {
                const doorOptions = ['2door', '3door', '4door'];
                const subSubcategoryList = document.createElement('ul');
                subSubcategoryList.className = 'sub-subcategory-list';

                const allDoorsLi = document.createElement('li');
                allDoorsLi.textContent = 'Всі двері';
                allDoorsLi.dataset.subSubcategory = 'all';
                allDoorsLi.addEventListener('click', () => {
                    currentFilters.subSubcategory = null;
                    const url = new URL(window.location);
                    url.searchParams.delete('subSubcategory');
                    window.history.pushState({}, '', url);
                    renderContent(currentFilters);
                    renderSubcategories(category, selectedSubcategory);
                });
                if (!currentFilters.subSubcategory) allDoorsLi.classList.add('selected');
                subSubcategoryList.appendChild(allDoorsLi);

                doorOptions.forEach(door => {
                    const doorLi = document.createElement('li');
                    doorLi.textContent = subcategoryTranslations[door] || door;
                    doorLi.dataset.subSubcategory = door;
                    doorLi.addEventListener('click', () => {
                        currentFilters.subSubcategory = door;
                        const url = new URL(window.location);
                        url.searchParams.set('subSubcategory', door);
                        window.history.pushState({}, '', url);
                        renderContent(currentFilters);
                    });
                    if (currentFilters.subSubcategory === door) doorLi.classList.add('selected');
                    subSubcategoryList.appendChild(doorLi);
                });

                li.insertAdjacentElement('afterend', subSubcategoryList);
            }
        });
}

window.removeBanner = key => remove(ref(database, 'banners/' + key)).then(() => {
    invalidateCache('banners');
    showNotification('Банер видалено', 'success');
});

window.moveBanner = (key, newIndex) => {
    get(ref(database, 'banners')).then((snapshot) => {
        const currentBanners = snapshot.val() || {};
        const bannerKeys = Object.keys(currentBanners);
        const oldIndex = bannerKeys.indexOf(key);
        if (newIndex >= 0 && newIndex < bannerKeys.length) {
            const reordered = {};
            bannerKeys.filter(k => k !== key).forEach((k, i) => reordered[`banner_${i < oldIndex && i >= newIndex ? i : i + 1}`] = currentBanners[k]);
            reordered[`banner_${newIndex}`] = currentBanners[key];
            update(ref(database, 'banners'), reordered).then(() => {
                invalidateCache('banners');
                showNotification('Банер переміщено', 'success');
            });
        }
    });
};

document.getElementById('addBanner')?.addEventListener('click', () => {
    const url = document.getElementById('bannerUrl')?.value || '';
    if (url) push(ref(database, 'banners'), { url }).then(() => {
        document.getElementById('bannerUrl').value = '';
        invalidateCache('banners');
        showNotification('Банер додано', 'success');
    }).catch(error => showNotification('Помилка додавання банера: ' + error.message, 'error'));
    else showNotification('Введіть URL банера', 'warning');
});

function updateSubcategoryOptions() {
    const category = document.getElementById('productCategory')?.value || 'beds';
    const subcategorySelect = document.getElementById('productSubcategory');
    if (!subcategorySelect) return;
    subcategorySelect.innerHTML = '<option value="">Виберіть підкатегорію</option>';
    const subs = {
        beds: ['soft_beds', 'wooden_beds', 'bedroom_sets', 'dressers', 'nightstands'],
        sofas: ['corner', 'straight', 'armchairs'],
        wardrobes: ['sliding_wardrobes', 'sliding_wardrobes_with_carving', 'art_matting', 'tv_wardrobes'],
        tables: ['wooden', 'metal', 'coffee'],
        chairs: ['wooden', 'soft'],
        mattresses: ['standard']
    }[category] || [];
    subs.forEach(sub => {
        const option = document.createElement('option');
        option.value = sub;
        option.textContent = subcategoryTranslations[sub] || sub;
        subcategorySelect.appendChild(option);
    });
    updateSubSubcategoryOptions();
}

function updateEditSubcategoryOptions() {
    const category = document.getElementById('editProductCategory')?.value || 'beds';
    const subcategorySelect = document.getElementById('editProductSubcategory');
    if (!subcategorySelect) return;
    const currentSubcategory = subcategorySelect.value;
    subcategorySelect.innerHTML = '<option value="">Виберіть підкатегорію</option>';
    const subs = {
        beds: ['soft_beds', 'wooden_beds', 'bedroom_sets', 'dressers', 'nightstands'],
        sofas: ['corner', 'straight', 'armchairs'],
        wardrobes: ['sliding_wardrobes', 'sliding_wardrobes_with_carving', 'art_matting', 'tv_wardrobes'],
        tables: ['wooden', 'metal', 'coffee'],
        chairs: ['wooden', 'soft'],
        mattresses: ['standard']
    }[category] || [];
    subs.forEach(sub => {
        const option = document.createElement('option');
        option.value = sub;
        option.textContent = subcategoryTranslations[sub] || sub;
        subcategorySelect.appendChild(option);
    });
    if (currentSubcategory && subs.includes(currentSubcategory)) subcategorySelect.value = currentSubcategory;
    updateEditSubSubcategoryOptions();
}

function updateSubSubcategoryOptions() {
    const category = document.getElementById('productCategory')?.value || 'beds';
    const subcategory = document.getElementById('productSubcategory')?.value || '';
    const subSubcategorySelect = document.getElementById('productSubSubcategory');
    if (!subSubcategorySelect) return;
    subSubcategorySelect.innerHTML = '<option value="">Виберіть кількість дверей</option>';
    subSubcategorySelect.style.display = (category === 'wardrobes' && (subcategory === 'sliding_wardrobes' || subcategory === 'sliding_wardrobes_with_carving')) ? 'block' : 'none';
    if (category === 'wardrobes' && (subcategory === 'sliding_wardrobes' || subcategory === 'sliding_wardrobes_with_carving')) {
        ['2door', '3door', '4door'].forEach(subSub => {
            const option = document.createElement('option');
            option.value = subSub;
            option.textContent = subcategoryTranslations[subSub] || subSub;
            subSubcategorySelect.appendChild(option);
        });
    } else subSubcategorySelect.value = '';
}

function updateEditSubSubcategoryOptions() {
    const category = document.getElementById('editProductCategory')?.value || 'beds';
    const subcategory = document.getElementById('editProductSubcategory')?.value || '';
    const subSubcategorySelect = document.getElementById('editProductSubSubcategory');
    if (!subSubcategorySelect) return;
    subSubcategorySelect.innerHTML = '<option value="">Виберіть кількість дверей</option>';
    subSubcategorySelect.style.display = (category === 'wardrobes' && (subcategory === 'sliding_wardrobes' || subcategory === 'sliding_wardrobes_with_carving')) ? 'block' : 'none';
    if (category === 'wardrobes' && (subcategory === 'sliding_wardrobes' || subcategory === 'sliding_wardrobes_with_carving')) {
        ['2door', '3door', '4door'].forEach(subSub => {
            const option = document.createElement('option');
            option.value = subSub;
            option.textContent = subcategoryTranslations[subSub] || subSub;
            subSubcategorySelect.appendChild(option);
        });
    } else subSubcategorySelect.value = '';
}

document.getElementById('addProductForm')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const name = document.getElementById('productName')?.value.trim() || '';
    const description = document.getElementById('productDescription')?.value.trim() || '';
    const photos = Array.from(document.querySelectorAll('.productPhotoInput')).map(input => input.value.trim()).filter(url => url);
    if (photos.length === 0) return showNotification('Додайте хоча б одне фото', 'error');
    if (photos.some(url => !isValidUrl(url))) return showNotification('Некоректний URL фото. Використовуйте лише зображення (png, jpg, jpeg, gif, webp)', 'error');
    const category = document.getElementById('productCategory')?.value || 'beds';
    const subcategory = document.getElementById('productSubcategory')?.value || '';
    const subSubcategory = document.getElementById('productSubSubcategory')?.value || '';
    const materialsSelected = Array.from(document.getElementById('productMaterials')?.selectedOptions || []).map(opt => opt.value);
    const colorsSelected = Array.from(document.getElementById('productColors')?.selectedOptions || []).map(opt => opt.value);
    const availability = document.getElementById('availability')?.checked || false;
    const roomsContainer = document.getElementById('rooms');
    const rooms = roomsContainer ? Array.from(roomsContainer.querySelectorAll('input[type="checkbox"]:checked')).map(checkbox => checkbox.value) : [];
    const sizes = Array.from(document.querySelectorAll('#sizes .size-row')).map(row => ({
        size: row.querySelector('.size-input').value.trim(),
        price: parseFloat(row.querySelector('.price-input').value) || 0,
        discountPrice: parseFloat(row.querySelector('.discount-price-input')?.value) || null
    })).filter(s => s.size && s.price > 0);
    if (!name) return showNotification('Введіть назву товару', 'error');
    if (!description) return showNotification('Введіть опис товару', 'error');
    if (!category) return showNotification('Виберіть категорію', 'error');
    if (!subcategory) return showNotification('Виберіть підкатегорію', 'error');
    if (category === 'wardrobes' && (subcategory === 'sliding_wardrobes' || subcategory === 'sliding_wardrobes_with_carving') && !subSubcategory)
        return showNotification('Виберіть кількість дверей', 'error');
    if (!sizes.length) return showNotification('Додайте хоча б один розмір та ціну', 'error');
    if (sizes.some(s => s.discountPrice && s.discountPrice >= s.price))
        return showNotification('Акційна ціна має бути меншою за звичайну ціну', 'error');
    const productData = {
        name, description, photos, category, subcategory,
        subSubcategory: subSubcategory || null,
        materials: materialsSelected, colors: colorsSelected,
        sizes: sizes.map(s => ({ size: s.size, price: s.price })),
        availability, rooms,
        onSale: sizes.some(s => s.discountPrice),
        discountPrices: sizes.reduce((acc, s) => (s.discountPrice ? { ...acc, [s.size]: s.discountPrice } : acc), {}),
        createdAt: Date.now()
    };
    push(ref(database, 'products'), productData)
        .then((newRef) => {
            invalidateCache('products');
            invalidateCache('featured_sale');
            invalidateCache('featured_clearance');
            syncFeatured(newRef.key, productData);
            ['productName', 'productDescription'].forEach(id => {
                const el = document.getElementById(id);
                if (el) el.value = '';
            });
            const productCategory = document.getElementById('productCategory');
            if (productCategory) productCategory.value = '';
            const productSubcategory = document.getElementById('productSubcategory');
            if (productSubcategory) productSubcategory.value = '';
            const productSubSubcategory = document.getElementById('productSubSubcategory');
            if (productSubSubcategory) { productSubSubcategory.value = ''; productSubSubcategory.style.display = 'none'; }
            updateSubcategoryOptions();
            ['productMaterials', 'productColors'].forEach(id => {
                const el = document.getElementById(id);
                if (el) el.selectedIndex = -1;
            });
            ['availability'].forEach(id => {
                const el = document.getElementById(id);
                if (el) el.checked = false;
            });
            document.querySelectorAll('#rooms input[type="checkbox"]').forEach(checkbox => checkbox.checked = false);
            document.getElementById('sizes').innerHTML = '<div class="size-row"><input type="text" class="size-input" placeholder="Розмір"><input type="number" class="price-input" placeholder="Ціна"><input type="number" class="discount-price-input" placeholder="Акційна ціна (опціонально)"><button class="remove-size"><i class="material-icons">delete</i></button></div>';
            const photosContainer = document.getElementById('photosContainer');
            if (photosContainer) {
                photosContainer.innerHTML = '';
                const input = document.createElement('input');
                input.type = 'text'; input.className = 'productPhotoInput'; input.placeholder = 'URL фото (основне)'; input.required = true;
                photosContainer.appendChild(input);
            }
            showNotification('Товар додано успішно', 'success');
            renderAdminProducts('all', '');
        })
        .catch(error => showNotification('Помилка додавання товару: ' + error.message, 'error'));
});

document.getElementById('addPhotoBtn')?.addEventListener('click', () => {
    const photosContainer = document.getElementById('photosContainer');
    const input = document.createElement('input');
    input.type = 'text'; input.className = 'productPhotoInput'; input.placeholder = 'URL фото';
    photosContainer.appendChild(input);
});

document.getElementById('productName')?.addEventListener('focus', () => {
    const photosContainer = document.getElementById('photosContainer');
    if (photosContainer) {
        photosContainer.innerHTML = '';
        const input = document.createElement('input');
        input.type = 'text'; input.className = 'productPhotoInput'; input.placeholder = 'URL фото (основне)'; input.required = true;
        photosContainer.appendChild(input);
    }
});

document.addEventListener('input', (e) => {
    if (e.target.classList.contains('productPhotoInput')) {
        const url = e.target.value.trim();
        if (url && !isValidUrl(url)) {
            e.target.style.border = '1px solid red';
            showNotification('Некоректний URL фото. Використовуйте лише зображення (png, jpg, jpeg, gif, webp)', 'warning');
        } else {
            e.target.style.border = '';
        }
    }
});

document.getElementById('samePrice')?.addEventListener('click', () => {
    const priceInputs = document.querySelectorAll('#sizes .price-input');
    if (priceInputs.length) {
        const firstPrice = priceInputs[0].value;
        priceInputs.forEach(input => input.value = firstPrice);
        showNotification('Ціни вирівняно', 'success');
    }
});

document.getElementById('addSize')?.addEventListener('click', (e) => {
    e.preventDefault();
    const sizesDiv = document.getElementById('sizes');
    if (sizesDiv) {
        const newSizeRow = document.createElement('div');
        newSizeRow.className = 'size-row';
        newSizeRow.innerHTML = '<input type="text" class="size-input" placeholder="Розмір"><input type="number" class="price-input" placeholder="Ціна"><input type="number" class="discount-price-input" placeholder="Акційна ціна (опціонально)"><button class="remove-size"><i class="material-icons">delete</i></button>';
        sizesDiv.appendChild(newSizeRow);
    }
});

document.addEventListener('click', e => {
    if (e.target.classList.contains('remove-size')) {
        const sizeRow = e.target.closest('.size-row');
        const sizesContainer = e.target.closest('#sizes') || e.target.closest('#editSizes');
        if (sizeRow && document.querySelectorAll(`#${sizesContainer.id} .size-row`).length > 1) {
            sizeRow.remove();
            showNotification('Розмір видалено', 'success');
        } else showNotification('Має бути принаймні один розмір', 'warning');
    }
});

document.getElementById('addPromo')?.addEventListener('click', () => {
    const promoModal = document.getElementById('promoModal');
    if (promoModal) promoModal.style.display = 'flex';
});

document.getElementById('savePromo')?.addEventListener('click', () => {
    const name = document.getElementById('promoName')?.value || '';
    if (name) {
        push(ref(database, 'promos'), { name }).then(() => {
            document.getElementById('promoModal').style.display = 'none';
            document.getElementById('promoName').value = '';
            invalidateCache('promos');
            showNotification('Акцію додано', 'success');
        });
    } else showNotification('Введіть коректну назву акції', 'error');
});

function applyPromos() {
    document.querySelectorAll('.product').forEach(product => {
        const name = product.querySelector('h3')?.textContent;
        if (!name) return;
        const productEntry = Object.entries(products).flatMap(([cat, prods]) =>
            Object.entries(prods || {}).map(([key, prod]) => ({ key, ...prod }))
        ).find(p => p.name === name);
        if (!productEntry) return;
        const productKey = productEntry.key;
        const discountPrices = productEntry.onSale && productEntry.discountPrices ? productEntry.discountPrices : {};
        const priceSpan = product.querySelector(`span[id^="price_${productKey}"]`);
        const sizeSelect = product.querySelector('.size-select');
        const selectedSize = sizeSelect ? sizeSelect.value : productEntry.sizes[0].size;
        if (priceSpan) {
            const salePrice = discountPrices[selectedSize] || productEntry.sizes.find(s => s.size === selectedSize)?.price || '';
            priceSpan.textContent = Number(salePrice).toLocaleString('uk-UA');
            const priceContainer = priceSpan.parentElement;
            const originalPriceElement = priceContainer.querySelector(`del[id="original_price_${productKey}"]`);
            const originalPrice = productEntry.sizes.find(s => s.size === selectedSize)?.price || '';
            if (discountPrices[selectedSize] && !originalPriceElement) {
                priceSpan.insertAdjacentHTML('afterend', `<del id="original_price_${productKey}">${Number(originalPrice).toLocaleString('uk-UA')} грн</del>`);
            } else if (!discountPrices[selectedSize] && originalPriceElement) {
                originalPriceElement.remove();
            } else if (originalPriceElement) {
                originalPriceElement.textContent = `${Number(originalPrice).toLocaleString('uk-UA')} грн`;
            }
        }
    });
}

document.getElementById('applyFilters')?.addEventListener('click', () => {
    const subcategory = document.getElementById('subcategory')?.value || null;
    const subSubcategory = document.getElementById('subSubcategory')?.value || null;
    const priceMin = document.getElementById('priceMin')?.value ? parseInt(document.getElementById('priceMin').value) : null;
    const priceMax = document.getElementById('priceMax')?.value ? parseInt(document.getElementById('priceMax').value) : null;
    const availability = document.getElementById('availability')?.checked || null;
    const color = document.getElementById('color')?.value || null;
    const material = document.getElementById('material')?.value || null;
    const room = document.getElementById('room')?.value || null;
    const sale = document.getElementById('onSaleOnly')?.checked || null;
    currentFilters = { ...currentFilters, subcategory, subSubcategory, priceMin, priceMax, availability, color, material, room, sale };
    renderContent(currentFilters);
});

function updateColorSelects() {
    const colorSelects = [document.getElementById('productColors'), document.getElementById('editProductColors'), document.getElementById('color')].filter(el => el);
    colorSelects.forEach(select => {
        const currentSelection = Array.from(select.selectedOptions || []).map(opt => opt.value);
        select.innerHTML = '<option value="">Колір: Виберіть колір</option>' + colors.map(color => `<option value="${color}" ${currentSelection.includes(color) ? 'selected' : ''}>${color}</option>`).join('');
    });
}

function updateMaterialSelects() {
    const materialSelects = [document.getElementById('productMaterials'), document.getElementById('editProductMaterials'), document.getElementById('material')].filter(el => el);
    materialSelects.forEach(select => {
        const currentSelection = Array.from(select.selectedOptions || []).map(opt => opt.value);
        select.innerHTML = '<option value="">Матеріал: Виберіть матеріал</option>' + materials.map(material => `<option value="${material}" ${currentSelection.includes(material) ? 'selected' : ''}>${material}</option>`).join('');
    });
}

function updateSubcategorySelects() {
    const subcategorySelects = [document.getElementById('productSubcategory'), document.getElementById('editProductSubcategory')].filter(el => el);
    const defaultSubcategories = {
        beds: ['all', 'soft_beds', 'wooden_beds', 'bedroom_sets', 'dressers', 'nightstands'],
        sofas: ['all', 'corner', 'straight', 'armchairs'],
        wardrobes: ['all', 'sliding_wardrobes', 'sliding_wardrobes_with_carving', 'art_matting', 'tv_wardrobes'],
        tables: ['all', 'wooden', 'metal', 'coffee'],
        chairs: ['all', 'wooden', 'soft'],
        mattresses: ['all', 'standard']
    };
    subcategorySelects.forEach(select => {
        const currentValue = select.value;
        select.innerHTML = '<option value="">Виберіть підкатегорію</option>';
        const category = select.id === 'productSubcategory' ? document.getElementById('productCategory')?.value || 'beds' : document.getElementById('editProductCategory')?.value || 'beds';
        const options = new Set(defaultSubcategories[category] || []);
        if (Object.keys(subcategories).length) Object.values(subcategories).flat().forEach(sub => options.add(sub));
        [...options].sort().forEach(sub => {
            const option = document.createElement('option');
            option.value = sub;
            option.textContent = subcategoryTranslations[sub] || sub;
            select.appendChild(option);
        });
        select.value = currentValue;
    });
}

document.getElementById('addColor')?.addEventListener('click', () => {
    const colorInput = document.getElementById('colorInput')?.value.trim() || '';
    if (colorInput && !colors.includes(colorInput)) {
        push(ref(database, 'colors'), colorInput).then(() => {
            document.getElementById('colorInput').value = '';
            invalidateCache('colors');
            showNotification('Колір додано', 'success');
        });
    } else showNotification('Колір уже існує або поле порожнє', 'error');
});

document.getElementById('addMaterial')?.addEventListener('click', () => {
    const materialInput = document.getElementById('materialInput')?.value.trim() || '';
    if (materialInput && !materials.includes(materialInput)) {
        push(ref(database, 'materials'), materialInput).then(() => {
            document.getElementById('materialInput').value = '';
            invalidateCache('materials');
            showNotification('Матеріал додано', 'success');
        });
    } else showNotification('Матеріал уже існує або поле порожнє', 'error');
});

document.getElementById('productCategory')?.addEventListener('change', updateSubcategoryOptions);
document.getElementById('editProductCategory')?.addEventListener('change', updateEditSubcategoryOptions);
document.getElementById('editOnSale')?.addEventListener('change', toggleDiscountInput);

window.updatePrice = window.updatePrice;
window.removeFromCart = window.removeFromCart;
window.updateCartSize = window.updateCartSize;

document.addEventListener('DOMContentLoaded', () => {
    const searchBars = document.querySelectorAll('.searchBar');
    searchBars.forEach(searchBar => {
        const handleSearch = () => {
            const query = searchBar.value.trim();
            currentFilters.search = query ? query.toLowerCase() : null;
            if (!window.location.pathname.includes('room.html')) {
                if (query) window.location.href = `room.html?search=${query}`;
            } else {
                const url = new URL(window.location);
                if (query) url.searchParams.set('search', query);
                else url.searchParams.delete('search');
                window.history.pushState({}, '', url);
                renderContent(currentFilters);
            }
        };
        searchBar.addEventListener('keydown', (e) => { if (e.key === 'Enter') handleSearch(); });
        searchBar.addEventListener('input', () => {
            const query = searchBar.value.trim();
            currentFilters.search = query ? query.toLowerCase() : null;
            if (window.location.pathname.includes('room.html')) {
                const url = new URL(window.location);
                if (query) url.searchParams.set('search', query);
                else url.searchParams.delete('search');
                window.history.pushState({}, '', url);
                renderContent(currentFilters);
            }
        });
        if (window.location.pathname.includes('room.html')) {
            const urlParams = new URLSearchParams(window.location.search);
            const searchQuery = urlParams.get('search');
            if (searchQuery) {
                currentFilters.search = searchQuery.toLowerCase();
                searchBar.value = searchQuery;
                renderContent(currentFilters);
            }
        }
    });

    const searchButtons = document.querySelectorAll('.searchButton, .search-button');
    searchButtons.forEach(button => {
        button.addEventListener('click', () => {
            const container = button.closest('.search-content, .search-content-for-phone') || button.parentElement;
            const searchBar = container ? container.querySelector('.searchBar') : null;
            if (searchBar) {
                const query = searchBar.value.trim();
                currentFilters.search = query ? query.toLowerCase() : null;
                if (!window.location.pathname.includes('room.html')) {
                    if (query) window.location.href = `room.html?search=${query}`;
                } else {
                    const url = new URL(window.location);
                    if (query) url.searchParams.set('search', query);
                    else url.searchParams.delete('search');
                    window.history.pushState({}, '', url);
                    renderContent(currentFilters);
                }
            } else {
                console.warn('No associated searchBar found for button:', button);
            }
        });
    });

    window.addEventListener('popstate', () => {
        if (window.location.pathname.includes('room.html')) {
            const urlParams = new URLSearchParams(window.location.search);
            const searchQuery = urlParams.get('search');
            currentFilters.search = searchQuery ? searchQuery.toLowerCase() : null;
            searchBars.forEach(searchBar => { searchBar.value = searchQuery || ''; });
            renderContent(currentFilters);
        }
    });

    renderCategories();
});

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', renderCart);
} else {
    renderCart();
}

window.addEventListener('storage', (e) => {
    if (e.key === 'cart') renderCart();
});

document.getElementById('addEditPhotoBtn')?.addEventListener('click', () => {
    const input = document.createElement('input');
    input.type = 'text'; input.className = 'productPhotoInput'; input.placeholder = 'URL фото';
    document.getElementById('editPhotosContainer').appendChild(input);
});

function renderAdminProductCard(container, product) {
    const productDiv = document.createElement('div');
    productDiv.classList.add('product');
    productDiv.innerHTML = `
        <img src="${(product.photos || [])[0] || product.photo || ''}" alt="${product.name}">
        <div class="product-first">
            <h3>${product.name}</h3>
            <p>${product.description}</p>
            <p>Категорія: ${categoryTranslations[product.category] || product.category}</p>
            <p>Підкатегорія: ${subcategoryTranslations[product.subcategory] || product.subcategory}</p>
            ${product.subSubcategory ? `<p>Кількість дверей: ${subcategoryTranslations[product.subSubcategory] || product.subSubcategory}</p>` : ''}
            <p>Матеріали: ${(product.materials && product.materials.length ? product.materials.join(', ') : 'Немає')}</p>
        </div>
        <div class="product-second">
            <p>Кольори: ${(product.colors && product.colors.length ? product.colors.join(', ') : 'Немає')}</p>
            <p>Кімнати: ${(product.rooms && product.rooms.length ? product.rooms.map(room => roomTranslations[room] || room).join(', ') : 'Немає')}</p>
            <p>Хіт продажу: ${product.onClearance ? 'Так' : 'Ні'}</p>
            <p>Акція: ${product.onSale ? `Так (${Object.entries(product.discountPrices || {}).map(([size, price]) => `${size}: ${price} грн`).join(', ')})` : 'Ні'}</p>
            <p>Розміри: ${product.sizes.map(s => `${s.size}: ${s.price} грн`).join(', ')}</p>
        </div>
        <div class="product-button">
            <button onclick="editProduct('${product.key}')"><i class="material-icons">edit</i></button>
            <button onclick="removeProduct('${product.key}')"><i class="material-icons">delete</i></button>
        </div>
    `;
    container.appendChild(productDiv);
}

function renderAdminLoadMoreButton(container, total) {
    let btn = document.getElementById('adminLoadMoreBtn');
    if (!btn) {
        btn = document.createElement('button');
        btn.id = 'adminLoadMoreBtn';
        btn.className = 'load-more-btn';
        btn.textContent = 'Завантажити ще';
        container.parentNode.insertBefore(btn, container.nextSibling);
        btn.addEventListener('click', () => {
            adminProductsOffset += ADMIN_PAGE_SIZE;
            const nextBatch = adminProductsAll.slice(adminProductsOffset, adminProductsOffset + ADMIN_PAGE_SIZE);
            nextBatch.forEach(product => renderAdminProductCard(container, product));
            if (adminProductsOffset + ADMIN_PAGE_SIZE >= total) btn.style.display = 'none';
        });
    }
    btn.style.display = adminProductsOffset + ADMIN_PAGE_SIZE < total ? 'block' : 'none';
}

function renderAdminProducts(category, search) {
    const container = document.getElementById('adminCategorySelect');
    if (!container) return;
    container.innerHTML = '';
    const allProducts = Object.entries(products).flatMap(([key, prod]) => ({ key, ...prod }));
    const filteredProducts = allProducts.filter(product =>
        (category === 'all' || product.category === category) &&
        (!search || product.name.toLowerCase().includes(search.toLowerCase()))
    );
    filteredProducts.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    if (!filteredProducts.length) {
        container.innerHTML = '<p style="grid-column: 1 / -1; text-align: center; color: #666;">Немає товарів</p>';
        const btn = document.getElementById('adminLoadMoreBtn');
        if (btn) btn.style.display = 'none';
        return;
    }
    adminProductsAll = filteredProducts;
    adminProductsOffset = 0;
    const firstBatch = adminProductsAll.slice(0, ADMIN_PAGE_SIZE);
    firstBatch.forEach(product => renderAdminProductCard(container, product));
    renderAdminLoadMoreButton(container, adminProductsAll.length);
}

document.getElementById('adminSearchBar')?.addEventListener('input', () => {
    const search = document.getElementById('adminSearchBar').value.trim().toLowerCase();
    const category = document.getElementById('productFilter').value;
    renderAdminProducts(category, search);
});

document.getElementById('productFilter')?.addEventListener('change', () => {
    const search = document.getElementById('adminSearchBar').value.trim().toLowerCase();
    const category = document.getElementById('productFilter').value;
    renderAdminProducts(category, search);
});

window.removeProduct = key => remove(ref(database, 'products/' + key)).then(() => {
    invalidateCache('products');
    invalidateCache('featured_sale');
    invalidateCache('featured_clearance');
    const cleanupUpdates = {};
    cleanupUpdates[`featured/sale/${key}`] = null;
    cleanupUpdates[`featured/clearance/${key}`] = null;
    update(ref(database), cleanupUpdates);
    showNotification('Товар видалено', 'success');
});

window.editProduct = key => {
    const product = products[key];
    if (!product) { showNotification('Товар не знайдено', 'error'); return; }
    const fields = [
        { id: 'editProductName', value: product.name || '' },
        { id: 'editProductDescription', value: product.description || '' },
        { id: 'editProductCategory', value: product.category || 'beds' },
        { id: 'editProductSubcategory', value: product.subcategory || '' },
        { id: 'editProductSubSubcategory', value: product.subSubcategory || '' },
        { id: 'editAvailability', value: product.availability || false },
        { id: 'editOnSale', value: product.onSale || false },
        { id: 'editOnClearance', value: product.onClearance || false }
    ];
    fields.forEach(field => {
        const el = document.getElementById(field.id);
        if (!el) return;
        if (field.id.includes('Availability') || field.id.includes('OnSale') || field.id.includes('OnClearance')) el.checked = field.value;
        else el.value = field.value;
    });
    const materialsSelect = document.getElementById('editProductMaterials');
    if (materialsSelect) Array.from(materialsSelect.options).forEach(opt => opt.selected = product.materials?.includes(opt.value));
    const colorsSelect = document.getElementById('editProductColors');
    if (colorsSelect) Array.from(colorsSelect.options).forEach(opt => opt.selected = product.colors?.includes(opt.value));
    const roomsCheckboxes = document.querySelectorAll('#editRooms input[type="checkbox"]');
    roomsCheckboxes.forEach(checkbox => checkbox.checked = product.rooms && product.rooms.includes(checkbox.value));
    const editSizes = document.getElementById('editSizes');
    if (editSizes) {
        editSizes.innerHTML = product.sizes.map(s => `<div class="size-row"><input type="text" class="edit-size-input" value="${s.size}"><input type="number" class="edit-price-input" value="${s.price}"><input type="number" class="edit-discount-price-input" placeholder="Акційна ціна (опціонально)" value="${product.onSale && product.discountPrices && product.discountPrices[s.size] || ''}"><button class="remove-size"><i class="material-icons">delete</i></button></div>`).join('');
    }
    const editPhotosContainer = document.getElementById('editPhotosContainer');
    if (editPhotosContainer) {
        editPhotosContainer.innerHTML = '';
        (product.photos || [product.photo] || []).forEach(url => {
            const input = document.createElement('input');
            input.type = 'text'; input.value = url; input.className = 'productPhotoInput';
            editPhotosContainer.appendChild(input);
        });
    }
    const editModal = document.getElementById('editModal');
    if (editModal) {
        editModal.dataset.key = key;
        editModal.style.display = 'flex';
        updateEditSubcategoryOptions();
        const subcategorySelect = document.getElementById('editProductSubcategory');
        if (subcategorySelect && product.subcategory) subcategorySelect.value = product.subcategory;
        updateEditSubSubcategoryOptions();
        toggleDiscountInput();
        document.querySelectorAll('#editModal input, #editModal textarea, #editSizes input').forEach(input => {
            input.addEventListener('keydown', e => { if (e.key === 'Enter') e.preventDefault(); });
        });
    }
};

function isValidUrl(url) {
    return /^https?:\/\/.*\.(png|jpg|jpeg|gif|webp)$/i.test(url);
}

document.getElementById('editProductForm')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const editModal = document.getElementById('editModal');
    if (!editModal) return showNotification('Помилка: модальне вікно не знайдено', 'error');
    const key = editModal.dataset.key;
    if (!key || !products[key]) return showNotification('Помилка: товар не знайдено', 'error');
    const name = document.getElementById('editProductName')?.value.trim() || '';
    const description = document.getElementById('editProductDescription')?.value.trim() || '';
    const photos = Array.from(document.querySelectorAll('#editPhotosContainer .productPhotoInput')).map(input => input.value.trim()).filter(url => url);
    if (photos.length === 0) return showNotification('Додайте хоча б одне фото', 'error');
    if (photos.some(url => !isValidUrl(url))) return showNotification('Некоректний URL фото. Використовуйте лише зображення (png, jpg, jpeg, gif, webp)', 'error');
    const category = document.getElementById('editProductCategory')?.value || 'beds';
    const subcategory = document.getElementById('editProductSubcategory')?.value || '';
    const subSubcategory = document.getElementById('editProductSubSubcategory')?.value || '';
    const materialsSelected = Array.from(document.getElementById('editProductMaterials')?.selectedOptions || []).map(opt => opt.value);
    const colorsSelected = Array.from(document.getElementById('editProductColors')?.selectedOptions || []).map(opt => opt.value);
    const availability = document.getElementById('editAvailability')?.checked || false;
    const onSale = document.getElementById('editOnSale')?.checked || false;
    const onClearance = document.getElementById('editOnClearance')?.checked || false;
    const roomsContainer = document.getElementById('editRooms');
    const rooms = roomsContainer ? Array.from(roomsContainer.querySelectorAll('input[type="checkbox"]:checked')).map(checkbox => checkbox.value) : [];
    const sizes = Array.from(document.querySelectorAll('#editSizes .size-row')).map(row => ({
        size: row.querySelector('.edit-size-input').value.trim(),
        price: parseFloat(row.querySelector('.edit-price-input').value) || 0,
        discountPrice: parseFloat(row.querySelector('.edit-discount-price-input')?.value) || null
    })).filter(s => s.size && s.price > 0);
    if (!name) return showNotification('Введіть назву товару', 'error');
    if (!description) return showNotification('Введіть опис товару', 'error');
    if (!category) return showNotification('Виберіть категорію', 'error');
    if (!subcategory) return showNotification('Виберіть підкатегорію', 'error');
    if (category === 'wardrobes' && (subcategory === 'sliding_wardrobes' || subcategory === 'sliding_wardrobes_with_carving') && !subSubcategory)
        return showNotification('Виберіть кількість дверей', 'error');
    if (!sizes.length) return showNotification('Додайте хоча б один розмір та ціну', 'error');
    if (onSale && sizes.some(s => s.discountPrice && s.discountPrice >= s.price))
        return showNotification('Акційна ціна має бути меншою за звичайну ціну', 'error');
    const productData = {
        name, description, photos, category, subcategory,
        subSubcategory: subSubcategory || null,
        materials: materialsSelected, colors: colorsSelected,
        sizes: sizes.map(s => ({ size: s.size, price: s.price })),
        availability, rooms, onSale, onClearance,
        discountPrices: sizes.reduce((acc, s) => (s.discountPrice ? { ...acc, [s.size]: s.discountPrice } : acc), {})
    };
    update(ref(database, 'products/' + key), productData)
        .then(() => {
            invalidateCache('products');
            invalidateCache('featured_sale');
            invalidateCache('featured_clearance');
            syncFeatured(key, productData);
            showNotification('Товар успішно оновлено', 'success');
            renderAdminProducts('all', '');
        })
        .catch(error => showNotification('Помилка оновлення товару: ' + error.message, 'error'));
});

function toggleDiscountInput() {
    const onSaleCheckbox = document.getElementById('editOnSale');
    const editSizes = document.getElementById('editSizes');
    if (onSaleCheckbox && editSizes) {
        const discountInputs = editSizes.querySelectorAll('.edit-discount-price-input');
        discountInputs.forEach(input => {
            input.classList.toggle('active', onSaleCheckbox.checked);
            input.style.display = onSaleCheckbox.checked ? 'block' : 'none';
        });
    }
}

document.getElementById('editAddSize')?.addEventListener('click', (e) => {
    e.preventDefault();
    const editSizes = document.getElementById('editSizes');
    if (editSizes) {
        const newSizeRow = document.createElement('div');
        newSizeRow.className = 'size-row';
        newSizeRow.innerHTML = '<input type="text" class="edit-size-input" placeholder="Розмір"><input type="number" class="edit-price-input" placeholder="Ціна"><input type="number" class="edit-discount-price-input" placeholder="Акційна ціна (опціонально)" style="display: none;"><button class="remove-size"><i class="material-icons">delete</i></button>';
        editSizes.appendChild(newSizeRow);
        toggleDiscountInput();
    }
});

document.getElementById('editSamePrice')?.addEventListener('click', () => {
    const priceInputs = document.querySelectorAll('#editSizes .edit-price-input');
    if (priceInputs.length) {
        const firstPrice = priceInputs[0].value;
        priceInputs.forEach(input => input.value = firstPrice);
        showNotification('Ціни вирівняно', 'success');
    }
});