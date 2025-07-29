import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-auth.js";
import { getDatabase, ref, onValue, set, push, remove, update } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-database.js";
import { firebaseConfig } from './firebaseConfig.js';

const app = initializeApp(firebaseConfig);
const auth = getAuth();
const database = getDatabase();

let products = {}, banners = {}, promos = {}, colors = [], materials = [], subcategories = {};

const categoryTranslations = {
    beds: 'Ліжка', sofas: 'Дивани', wardrobes: 'Шафи', tables: 'Столи', chairs: 'Стільці', mattresses: 'Матраци'
};

const subcategoryTranslations = {
    soft_beds: 'Мʼякі ліжка', wooden_beds: 'Деревʼяні ліжка', bedroom_sets: 'Спальні комплекти', dressers: 'Комоди', nightstands: 'Тумби',
    corner: 'Кутові дивани', straight: 'Прямі дивани', armchairs: 'Крісла',
    sliding_wardrobes: 'Шафи-купе', sliding_wardrobes_with_carving: 'Шафи-купе з карнизами', art_matting: 'Художнє матування', tv_wardrobes: 'Шафи під телевізор',
    wooden: 'Деревʼяні', metal: 'Металеві', coffee: 'Журнальні столики',
    soft: 'Мʼякі', standard: 'Стандартні матраци',
    '2door': '2-х дверна', '3door': '3-х дверна', '4door': '4-х дверна'
};

function initializeData() {
    onValue(ref(database, 'banners'), (snapshot) => { 
        banners = snapshot.val() || {}; 
        updateBannerSlider(); 
    });
    onValue(ref(database, 'products'), (snapshot) => {
        products = snapshot.val() || {};
        renderContent();
        if (document.getElementById('productList')) renderAdminProducts('all', '');
    });
    onValue(ref(database, 'promos'), (snapshot) => { 
        promos = snapshot.val() || {}; 
        applyPromos(); 
    });
    onValue(ref(database, 'colors'), (snapshot) => { 
        colors = Object.values(snapshot.val() || []); 
        updateColorSelects(); 
    });
    onValue(ref(database, 'materials'), (snapshot) => { 
        materials = Object.values(snapshot.val() || []); 
        updateMaterialSelects(); 
    });
    onValue(ref(database, 'subcategories'), (snapshot) => {
        subcategories = snapshot.val() || {};
        updateSubcategorySelects();
        console.log('Subcategories loaded:', subcategories);
    });
}

initializeData();

function showNotification(message) {
    const notification = document.getElementById('notification');
    if (!notification) return;
    const messageDiv = document.createElement('div');
    messageDiv.className = 'notification-message';
    messageDiv.textContent = message;
    notification.appendChild(messageDiv);
    setTimeout(() => {
        messageDiv.style.animation = 'slideOut 0.5s ease-in forwards';
        setTimeout(() => messageDiv.remove(), 500);
    }, 3000);
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
    ['orderName', 'orderPhone', 'orderCountry', 'orderRegion', 'orderCity'].forEach(id => {
        const element = document.getElementById(id);
        if (element) {
            element.value = userData[id] || (id === 'orderPhone' ? '+380' : id === 'orderCountry' ? 'Україна' : '');
        }
    });
}

let currentSlide = 0;
function updateBannerSlider() {
    const slides = document.querySelector('.slides');
    if (!slides) return;
    slides.innerHTML = '';
    Object.entries(banners).forEach(([key, banner]) => {
        const img = document.createElement('img');
        img.src = banner.url;
        img.classList.add('slide');
        img.dataset.key = key;
        slides.appendChild(img);
    });
    showSlide(0);
}

function showSlide(index) {
    const slides = document.querySelector('.slides');
    if (!slides || !slides.children.length) return;
    currentSlide = (index % slides.children.length + slides.children.length) % slides.children.length;
    slides.style.transform = `translateX(-${currentSlide * 100}%)`;
}

document.querySelector('.prev')?.addEventListener('click', () => showSlide(currentSlide - 1));
document.querySelector('.next')?.addEventListener('click', () => showSlide(currentSlide + 1));

let touchStartX = 0, touchEndX = 0;
document.querySelector('.slides')?.addEventListener('touchstart', e => touchStartX = e.changedTouches[0].screenX);
document.querySelector('.slides')?.addEventListener('touchend', e => {
    touchEndX = e.changedTouches[0].screenX;
    if (touchStartX - touchEndX > 50) showSlide(currentSlide + 1);
    else if (touchEndX - touchStartX > 50) showSlide(currentSlide - 1);
});

function renderCategories() {
    const mainCategories = document.getElementById('mainCategories');
    if (!mainCategories) return;
    mainCategories.innerHTML = '';
    ['beds', 'sofas', 'wardrobes', 'tables', 'chairs', 'mattresses'].forEach(category => {
        const li = document.createElement('li');
        li.textContent = categoryTranslations[category];
        li.addEventListener('click', () => window.location.href = `room.html?category=${category}`);
        mainCategories.appendChild(li);
    });
    const saleLi = document.createElement('li');
    saleLi.textContent = '🎉 Акційні';
    saleLi.addEventListener('click', () => window.location.href = 'room.html?sale=true');
    mainCategories.appendChild(saleLi);
    const clearanceLi = document.createElement('li');
    clearanceLi.textContent = '💸 Розпродаж';
    clearanceLi.addEventListener('click', () => window.location.href = 'room.html?clearance=true');
    mainCategories.appendChild(clearanceLi);
}

document.querySelectorAll('#roomCategories li').forEach(li =>
    li.addEventListener('click', () => window.location.href = `room.html?tag=${encodeURIComponent(li.dataset.tag)}`)
);
document.querySelectorAll('.category-menu ul li[data-filter]').forEach(li =>
    li.addEventListener('click', () => window.location.href = `room.html?${li.dataset.filter}=true`)
);

function renderContent({ category, subcategory, priceMin, priceMax, availability, color, material, room, sale, clearance } = {}) {
    ['mainProducts', 'roomProducts', 'saleProducts', 'clearanceProducts'].forEach(containerId => {
        const container = document.getElementById(containerId);
        if (!container) return;
        container.innerHTML = '';
        let filteredProducts = Object.entries(products).filter(([key, product]) => {
            const matches = (!category || product.category === category) &&
                           (!subcategory || product.subcategory === subcategory) &&
                           (!priceMin || product.sizes[0].price >= priceMin) &&
                           (!priceMax || product.sizes[0].price <= priceMax) &&
                           (availability === undefined || availability === null || product.availability === availability) &&
                           (!color || (product.colors && product.colors.includes(color))) &&
                           (!material || (product.materials && product.materials.includes(material))) &&
                           (!room || (product.rooms && product.rooms.includes(room))) &&
                           (!sale || product.onSale) &&
                           (!clearance || product.onClearance);
            console.log(`Checking product ${product.name}: room=${room}, product.rooms=`, product.rooms, `matches=${matches}`);
            return matches;
        });
        console.log(`Rendering ${filteredProducts.length} products for ${containerId} with filters:`, { category, subcategory, room });
        filteredProducts.forEach(([key, product]) => {
            if (containerId === 'mainProducts' ||
                (containerId === 'roomProducts' && (!subcategory || product.subcategory === subcategory)) ||
                (containerId === 'saleProducts' && product.onSale) ||
                (containerId === 'clearanceProducts' && product.onClearance)) {
                renderProductCard(container, key, product, containerId);
            }
        });
    });
}

function filterProducts(filters) {
    renderContent(filters);
}

function renderProductCard(container, key, product, sectionId) {
    const productDiv = document.createElement('div');
    productDiv.classList.add('product');
    const discount = product.onSale && product.discount ? product.discount : promos[product.category]?.discount || 0;
    const originalPrice = product.sizes[0].price;
    const salePrice = discount ? (originalPrice * (1 - discount / 100)).toFixed(0) : originalPrice;
    productDiv.innerHTML = `
        ${product.onSale ? '<span class="promo">Sale</span>' : ''}${product.onClearance ? '<span class="promo clearance">Clearance</span>' : ''}
        <img src="${product.photo}" alt="${product.name}">
        <h3>${product.name}</h3><p>${product.description}</p>
        <div class="sizes"><select class="size-select" data-product-id="${key}" onchange="updatePrice('price_${key}', this.options[this.selectedIndex].dataset.price)">
            ${product.sizes.map((size, index) => `<option value="${size.size}" data-price="${size.price}" ${index === 0 ? 'selected' : ''}>Розмір: ${size.size} ▼</option>`).join('')}
        </select></div>
        <p>Ціна: <span id="price_${key}">${salePrice}</span> грн${discount ? `<del>${originalPrice} грн</del>` : ''}</p>
        <p class="availability">${product.availability ? '<span style="color: green;">В наявності</span>' : '<span style="color: red;">Немає в наявності</span>'}</p>
        <button class="addToCart" data-id="${key}">Додати в кошик</button>
        <button class="buyNow" data-id="${key}">Замовити</button>
    `;
    container.appendChild(productDiv);
}

window.updatePrice = (priceId, newPrice) => {
    const priceElement = document.getElementById(priceId);
    if (priceElement) priceElement.textContent = newPrice;
};

document.getElementById('searchBar')?.addEventListener('input', e => {
    const searchTerm = e.target.value.toLowerCase();
    const container = document.getElementById('mainProducts');
    if (!container) return;
    container.innerHTML = '';
    Object.entries(products).forEach(([key, product]) => {
        if (product.name.toLowerCase().includes(searchTerm) || product.description.toLowerCase().includes(searchTerm)) {
            renderProductCard(container, key, product, 'mainProducts');
        }
    });
});

function renderCart() {
    const cartItems = document.getElementById('cartItems');
    const totalPriceElement = document.getElementById('cartTotalPrice');
    if (!cartItems || !totalPriceElement) return;
    cartItems.innerHTML = '';
    const cart = JSON.parse(localStorage.getItem('cart') || '[]');
    let totalPrice = 0;
    if (cart.length === 0) {
        cartItems.innerHTML = '<p>Кошик порожній</p>';
        totalPriceElement.textContent = '';
    } else {
        cart.forEach((item, index) => {
            const product = products[item.id];
            if (!product) return;
            const size = product.sizes.find(s => s.size === item.size);
            if (!size) return;
            totalPrice += parseFloat(size.price);
            const productDiv = document.createElement('div');
            productDiv.classList.add('product');
            productDiv.innerHTML = `
                <img src="${product.photo}" alt="${product.name}">
                <h3>${product.name}</h3>
                <p>${product.description}</p>
                <div class="sizes"><select class="size-select" onchange="updateCartSize(${index}, this.value); updatePrice('price_${index}', this.options[this.selectedIndex].dataset.price)">
                    ${product.sizes.map(s => `<option value="${s.size}" data-price="${s.price}" ${s.size === item.size ? 'selected' : ''}>Розмір: ${s.size} ▼</option>`).join('')}
                </select></div>
                <p>Ціна: <span id="price_${index}">${size.price}</span> грн</p>
                <button class="remove-from-cart" onclick="removeFromCart(${index})">Видалити</button>
            `;
            cartItems.appendChild(productDiv);
        });
        totalPriceElement.textContent = `Загальна ціна: ${totalPrice} грн`;
    }
}

window.removeFromCart = (index) => {
    const cart = JSON.parse(localStorage.getItem('cart') || '[]');
    cart.splice(index, 1);
    localStorage.setItem('cart', JSON.stringify(cart));
    renderCart();
    showNotification('Товар видалено з кошика');
};

window.updateCartSize = (index, size) => {
    const cart = JSON.parse(localStorage.getItem('cart') || '[]');
    cart[index].size = size;
    localStorage.setItem('cart', JSON.stringify(cart));
    renderCart();
};

document.getElementById('cartBtn')?.addEventListener('click', () => {
    const modal = document.getElementById('cartModal');
    if (modal) {
        modal.style.display = 'flex';
        renderCart();
    }
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
        if (!products[productId]) {
            showNotification('Товар недоступний');
            return;
        }
        const sizeSelect = document.querySelector(`.size-select[data-product-id="${productId}"]`);
        if (!sizeSelect || !sizeSelect.value) {
            showNotification('Будь ласка, виберіть розмір');
            return;
        }
        const size = sizeSelect.value;
        if (e.target.classList.contains('addToCart')) {
            const cart = JSON.parse(localStorage.getItem('cart') || '[]');
            cart.push({ id: productId, size });
            localStorage.setItem('cart', JSON.stringify(cart));
            showNotification('Товар додано до кошика');
        }
        if (e.target.classList.contains('buyNow')) {
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
        return;
    }
    orderItems.forEach((item, index) => {
        const product = products[item.id];
        if (!product) return;
        const size = product.sizes.find(s => s.size === item.size);
        if (!size) return;
        const productDiv = document.createElement('div');
        productDiv.classList.add('product');
        productDiv.innerHTML = `
            <img src="${product.photo}" alt="${product.name}">
            <h3>${product.name}</h3>
            <p>${product.description}</p>
            <div class="sizes"><select class="size-select" onchange="updateOrderItemSize(${index}, this.value)">
                ${product.sizes.map(s => `<option value="${s.size}" ${s.size === item.size ? 'selected' : ''}>Розмір: ${s.size} ▼</option>`).join('')}
            </select></div>
            <p>Ціна: <span>${size.price}</span> грн</p>
        `;
        orderItemsDiv.appendChild(productDiv);
    });
}

window.updateOrderItemSize = (index, size) => {
    const orderItems = Array.from(document.querySelectorAll('#orderItems .product')).map((product, i) => {
        const sizeSelect = product.querySelector('.size-select');
        return { id: Object.keys(products).find(key => products[key].name === product.querySelector('img').alt), size: i === index ? size : sizeSelect.value };
    });
    renderOrderItems(orderItems);
};

document.getElementById('checkout')?.addEventListener('click', () => {
    const cart = JSON.parse(localStorage.getItem('cart') || '[]');
    if (!cart.length) {
        showNotification('Кошик порожній');
        return;
    }
    const orderModal = document.getElementById('orderModal');
    if (orderModal) {
        orderModal.style.display = 'flex';
        renderOrderItems(cart);
        loadUserData();
    }
});

document.getElementById('orderForm')?.addEventListener('submit', e => {
    e.preventDefault();
    const submitButton = document.querySelector('#orderForm button[type="submit"]');
    if (!submitButton) return;
    submitButton.disabled = true;
    submitButton.textContent = 'Зачекайте...';
    const cart = JSON.parse(localStorage.getItem('cart') || '[]');
    const orderItems = Array.from(document.querySelectorAll('#orderItems .product')).map(product => {
        const id = Object.keys(products).find(key => products[key].name === product.querySelector('img').alt);
        const sizeSelect = product.querySelector('.size-select');
        return { id, size: sizeSelect.value };
    }).filter(item => products[item.id] && products[item.id].sizes.some(s => s.size === item.size));
    if (!orderItems.length) {
        showNotification('Кошик містить недоступні товари');
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
        showNotification('Ім’я може містити лише літери та пробіли, до 50 символів');
        submitButton.disabled = false;
        submitButton.textContent = 'Оформити';
        return;
    }
    if (!validatePhoneNumber(phone)) {
        showNotification('Номер телефону має починатися з "+" та містити коректний код країни');
        submitButton.disabled = false;
        submitButton.textContent = 'Оформити';
        return;
    }

    const order = {
        name, phone, country, region, city, comment,
        products: orderItems.map(item => {
            const product = products[item.id];
            const size = product.sizes.find(s => s.size === item.size);
            return {
                name: product.name,
                size: item.size,
                price: size.price,
                photo: product.photo,
                availability: product.availability,
                rooms: product.rooms || []
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
            localStorage.setItem('userData', JSON.stringify({ name, phone, country, region, city }));
            document.getElementById('cartModal').style.display = 'none';
            document.getElementById('orderModal').style.display = 'none';
            document.getElementById('successModal').style.display = 'flex';
            localStorage.removeItem('cart');
        })
        .catch(err => {
            console.error('Fetch error:', err);
            showNotification('Помилка при оформленні замовлення');
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
        .catch(error => showNotification('Помилка входу: ' + error.message));
});

document.getElementById('logout')?.addEventListener('click', () =>
    signOut(auth)
        .then(() => window.location.href = 'login.html')
        .catch(error => console.error('Logout error:', error))
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
    const urlParams = new URLSearchParams(window.location.search);
    const category = urlParams.get('category');
    const sale = urlParams.get('sale') === 'true';
    const clearance = urlParams.get('clearance') === 'true';
    if (category) {
        renderSubcategories(category);
        filterProducts({ category });
    } else if (sale) {
        filterProducts({ sale: true });
    } else if (clearance) {
        filterProducts({ clearance: true });
    }
    if (document.getElementById('cartBtn')) {
        document.getElementById('cartBtn').addEventListener('click', () => {
            const modal = document.getElementById('cartModal');
            if (modal) {
                modal.style.display = 'flex';
                renderCart();
            }
        });
    }
    document.querySelectorAll('.room-filter').forEach(button => {
        button.addEventListener('click', () => {
            const room = button.dataset.room;
            document.querySelectorAll('.room-filter').forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            filterProducts({ room });
        });
    });
    if (document.getElementById('filterBtn')) {
        document.getElementById('filterBtn').addEventListener('click', () => {
            const filters = document.getElementById('filters');
            filters.style.display = filters.style.display === 'none' ? 'block' : 'none';
        });
    }
    // Ініціалізація вкладок
    document.querySelectorAll('.tab-btn').forEach(button => {
        button.addEventListener('click', () => {
            const tabId = button.dataset.tab;
            console.log('Tab clicked:', tabId);
            document.querySelectorAll('.tab-content').forEach(content => {
                content.style.display = 'none';
                content.classList.remove('active');
            });
            document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
            const content = document.getElementById(tabId);
            if (content) {
                content.style.display = 'block';
                content.classList.add('active');
                button.classList.add('active');
                console.log('Tab opened:', tabId);
            } else {
                console.error('Tab content not found for:', tabId);
            }
        });
    });
    // Відображення вкладки "welcome" за замовчуванням
    const welcomeTab = document.getElementById('welcome');
    const welcomeBtn = document.querySelector('.tab-btn[data-tab="welcome"]');
    if (welcomeTab && welcomeBtn) {
        welcomeTab.style.display = 'block';
        welcomeTab.classList.add('active');
        welcomeBtn.classList.add('active');
    }
});

function renderSubcategories(category) {
    const subcategoryList = document.getElementById('subcategoryList');
    const subcategorySelect = document.getElementById('subcategory');
    if (!subcategoryList && !subcategorySelect) return;
    if (subcategoryList) {
        subcategoryList.innerHTML = '';
        const subs = {
            beds: ['all', 'soft_beds', 'wooden_beds', 'bedroom_sets', 'dressers', 'nightstands'],
            sofas: ['all', 'corner', 'straight', 'armchairs'],
            wardrobes: ['all', 'sliding_wardrobes', 'sliding_wardrobes_with_carving', 'art_matting', 'tv_wardrobes'],
            tables: ['all', 'wooden', 'metal', 'coffee'],
            chairs: ['all', 'wooden', 'soft'],
            mattresses: ['all', 'standard']
        }[category] || [];
        const wardrobeSubSubs = {
            sliding_wardrobes: ['2door', '3door', '4door'],
            sliding_wardrobes_with_carving: ['2door', '3door', '4door']
        };
        subs.forEach(sub => {
            const li = document.createElement('li');
            li.textContent = subcategoryTranslations[sub] || sub;
            li.addEventListener('click', (e) => {
                e.stopPropagation();
                if (subcategorySelect) subcategorySelect.value = sub === 'all' ? '' : sub;
                filterProducts({ category, subcategory: sub === 'all' ? null : sub });
            });
            if (wardrobeSubSubs[sub]) {
                const ul = document.createElement('ul');
                ul.className = 'sub-subcategories';
                wardrobeSubSubs[sub].forEach(subSub => {
                    const subLi = document.createElement('li');
                    subLi.textContent = subcategoryTranslations[subSub] || subSub;
                    subLi.addEventListener('click', (e) => {
                        e.stopPropagation();
                        if (subcategorySelect) subcategorySelect.value = subSub;
                        filterProducts({ category, subcategory: subSub });
                    });
                    ul.appendChild(subLi);
                });
                li.appendChild(ul);
            }
            subcategoryList.appendChild(li);
        });
    }
}

onValue(ref(database, 'banners'), (snapshot) => {
    banners = snapshot.val() || {};
    const bannerList = document.getElementById('bannerList');
    if (bannerList) {
        bannerList.innerHTML = '';
        Object.entries(banners).forEach(([key, banner]) => {
            const li = document.createElement('li');
            li.innerHTML = `<img src="${banner.url}" alt="Banner"><button onclick="removeBanner('${key}')">Видалити</button>`;
            bannerList.appendChild(li);
        });
    }
});

window.removeBanner = key => remove(ref(database, 'banners/' + key)).then(() => showNotification('Банер видалено'));

window.moveBanner = (key, newIndex) => {
    onValue(ref(database, 'banners'), (snapshot) => {
        const currentBanners = snapshot.val() || {};
        const bannerKeys = Object.keys(currentBanners);
        const oldIndex = bannerKeys.indexOf(key);
        if (newIndex >= 0 && newIndex < bannerKeys.length) {
            const reordered = {};
            bannerKeys.filter(k => k !== key).forEach((k, i) => reordered[`banner_${i < oldIndex && i >= newIndex ? i : i + 1}`] = currentBanners[k]);
            reordered[`banner_${newIndex}`] = currentBanners[key];
            update(ref(database, 'banners'), reordered).then(() => showNotification('Банер переміщено'));
        }
    }, { onlyOnce: true });
};

document.getElementById('addBanner')?.addEventListener('click', () => {
    const url = document.getElementById('bannerUrl')?.value || '';
    if (url) push(ref(database, 'banners'), { url }).then(() => {
        document.getElementById('bannerUrl').value = '';
        showNotification('Банер додано');
    }).catch(error => showNotification('Помилка додавання банера: ' + error.message));
    else showNotification('Введіть URL банера');
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
}

function updateEditSubcategoryOptions() {
    const category = document.getElementById('editProductCategory')?.value || 'beds';
    const subcategorySelect = document.getElementById('editProductSubcategory');
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
}

document.getElementById('addProduct')?.addEventListener('click', () => {
    console.log('Add product button clicked');
    const name = document.getElementById('productName')?.value.trim() || '';
    const description = document.getElementById('productDescription')?.value.trim() || '';
    const photo = document.getElementById('productPhoto')?.value.trim() || '';
    const category = document.getElementById('productCategory')?.value || 'beds';
    const subcategory = document.getElementById('productSubcategory')?.value || '';
    const materialsSelected = Array.from(document.getElementById('productMaterials')?.selectedOptions || []).map(opt => opt.value);
    const colorsSelected = Array.from(document.getElementById('productColors')?.selectedOptions || []).map(opt => opt.value);
    const availability = document.getElementById('availability')?.checked || false;
    const rooms = Array.from(document.querySelectorAll('#rooms input[type="checkbox"]:checked')).map(checkbox => checkbox.value);
    const sizes = Array.from(document.querySelectorAll('#sizes .size-input')).map((input, i) => ({
        size: input.value.trim(),
        price: parseFloat(document.querySelectorAll('#sizes .price-input')[i]?.value) || 0
    })).filter(s => s.size && s.price > 0);

    console.log('Form data:', { name, description, photo, category, subcategory, materialsSelected, colorsSelected, availability, rooms, sizes });

    if (!name) {
        showNotification('Введіть назву товару');
        console.error('Validation failed: Name is empty');
        return;
    }
    if (!description) {
        showNotification('Введіть опис товару');
        console.error('Validation failed: Description is empty');
        return;
    }
    if (!photo) {
        showNotification('Введіть URL фото');
        console.error('Validation failed: Photo URL is empty');
        return;
    }
    if (!category) {
        showNotification('Виберіть категорію');
        console.error('Validation failed: Category is empty');
        return;
    }
    if (!subcategory) {
        showNotification('Виберіть підкатегорію');
        console.error('Validation failed: Subcategory is empty');
        return;
    }
    if (!sizes.length) {
        showNotification('Додайте хоча б один розмір та ціну');
        console.error('Validation failed: No valid sizes');
        return;
    }

    const productData = {
        name, description, photo, category, subcategory,
        materials: materialsSelected, colors: colorsSelected,
        sizes, availability, rooms
    };

    console.log('Sending product data to Firebase:', productData);

    push(ref(database, 'products'), productData)
        .then(() => {
            console.log('Product added successfully');
            ['productName', 'productDescription', 'productPhoto'].forEach(id => {
                const el = document.getElementById(id);
                if (el) el.value = '';
            });
            ['productCategory'].forEach(id => {
                const el = document.getElementById(id);
                if (el) el.value = 'beds';
            });
            ['productSubcategory'].forEach(id => {
                const el = document.getElementById(id);
                if (el) el.value = '';
            });
            ['productMaterials', 'productColors'].forEach(id => {
                const el = document.getElementById(id);
                if (el) el.selectedIndex = -1;
            });
            ['availability'].forEach(id => {
                const el = document.getElementById(id);
                if (el) el.checked = false;
            });
            document.querySelectorAll('#rooms input[type="checkbox"]').forEach(checkbox => checkbox.checked = false);
            document.getElementById('sizes').innerHTML = '<div class="size-row"><input type="text" class="size-input" placeholder="Розмір"><input type="number" class="price-input" placeholder="Ціна"><button class="remove-size">Видалити</button></div>';
            showNotification('Товар додано успішно');
            renderAdminProducts('all', '');
        })
        .catch(error => {
            console.error('Error adding product:', error);
            showNotification('Помилка додавання товару: ' + error.message);
        });
});

document.getElementById('samePrice')?.addEventListener('click', () => {
    const priceInputs = document.querySelectorAll('#sizes .price-input');
    if (priceInputs.length) {
        const firstPrice = priceInputs[0].value;
        priceInputs.forEach(input => input.value = firstPrice);
        showNotification('Ціни вирівняно');
    }
});

document.getElementById('addSize')?.addEventListener('click', () => {
    const sizesDiv = document.getElementById('sizes');
    if (sizesDiv) {
        const newSizeRow = document.createElement('div');
        newSizeRow.className = 'size-row';
        newSizeRow.innerHTML = '<input type="text" class="size-input" placeholder="Розмір"><input type="number" class="price-input" placeholder="Ціна"><button class="remove-size">Видалити</button>';
        sizesDiv.appendChild(newSizeRow);
    }
});

document.addEventListener('click', e => {
    if (e.target.classList.contains('remove-size')) {
        const sizeRow = e.target.closest('.size-row');
        if (sizeRow && document.querySelectorAll('#sizes .size-row').length > 1) {
            sizeRow.remove();
            showNotification('Розмір видалено');
        } else {
            showNotification('Має бути принаймні один розмір');
        }
    }
});

document.getElementById('productSearch')?.addEventListener('input', () => {
    const category = document.getElementById('productFilter')?.value || 'all';
    const search = document.getElementById('productSearch')?.value || '';
    renderAdminProducts(category, search);
});
document.getElementById('productFilter')?.addEventListener('change', () => {
    const category = document.getElementById('productFilter')?.value || 'all';
    const search = document.getElementById('productSearch')?.value || '';
    renderAdminProducts(category, search);
});

function renderAdminProducts(category, search) {
    const productList = document.getElementById('productList');
    if (!productList) return;
    productList.innerHTML = '';
    const filteredProducts = Object.entries(products).filter(([key, product]) =>
        (category === 'all' || product.category === category) &&
        (!search || product.name.toLowerCase().includes(search.toLowerCase()))
    );
    console.log(`Rendering ${filteredProducts.length} products for admin list`);
    if (!filteredProducts.length) {
        productList.innerHTML = '<p>Немає товарів. Додайте товар через форму.</p>';
        return;
    }
    filteredProducts.forEach(([key, product]) => {
        const productDiv = document.createElement('div');
        productDiv.classList.add('product');
        productDiv.innerHTML = `
            <img src="${product.photo}" alt="${product.name}">
            <h3>${product.name}</h3>
            <p>${product.description}</p>
            <p>Категорія: ${categoryTranslations[product.category] || product.category}</p>
            <p>Підкатегорія: ${subcategoryTranslations[product.subcategory] || product.subcategory}</p>
            <p>Матеріали: ${product.materials?.join(', ') || 'Немає'}</p>
            <p>Кольори: ${product.colors?.join(', ') || 'Немає'}</p>
            <p>Кімнати: ${product.rooms?.join(', ') || 'Немає'}</p>
            <p>Наявність: ${product.availability ? 'Так' : 'Ні'}</p>
            <p>Акція: ${product.onSale ? `Так (${product.discount}%)` : 'Ні'}</p>
            <p>Розпродаж: ${product.onClearance ? 'Так' : 'Ні'}</p>
            <div class="sizes"><select class="size-select" onchange="updatePrice('price_${key}', this.options[this.selectedIndex].dataset.price)">
                ${product.sizes.map((size, index) => `<option value="${size.size}" data-price="${size.price}" ${index === 0 ? 'selected' : ''}>Розмір: ${size.size} ▼</option>`).join('')}
            </select></div>
            <p>Ціна: <span id="price_${key}">${product.sizes[0].price}</span> грн</p>
            <button onclick="editProduct('${key}')">Редагувати</button>
            <button onclick="removeProduct('${key}')">Видалити</button>
        `;
        productList.appendChild(productDiv);
    });
}

window.removeProduct = key => remove(ref(database, 'products/' + key)).then(() => showNotification('Товар видалено'));

window.editProduct = key => {
    const product = products[key];
    if (!product) {
        showNotification('Товар не знайдено');
        console.error('Edit product failed: Product not found for key', key);
        return;
    }
    console.log('Editing product:', product);
    const fields = [
        { id: 'editProductName', value: product.name || '' },
        { id: 'editProductDescription', value: product.description || '' },
        { id: 'editProductPhoto', value: product.photo || '' },
        { id: 'editProductCategory', value: product.category || 'beds' },
        { id: 'editProductSubcategory', value: product.subcategory || '' },
        { id: 'editAvailability', value: product.availability || false },
        { id: 'editOnSale', value: product.onSale || false },
        { id: 'editOnClearance', value: product.onClearance || false }
    ];
    fields.forEach(field => {
        const el = document.getElementById(field.id);
        if (!el) {
            console.warn(`Element ${field.id} not found`);
            return;
        }
        if (field.id.includes('Availability') || field.id.includes('OnSale') || field.id.includes('OnClearance')) {
            el.checked = field.value;
        } else {
            el.value = field.value;
        }
    });
    const materialsSelect = document.getElementById('editProductMaterials');
    if (materialsSelect) {
        Array.from(materialsSelect.options).forEach(opt => opt.selected = product.materials?.includes(opt.value));
    }
    const colorsSelect = document.getElementById('editProductColors');
    if (colorsSelect) {
        Array.from(colorsSelect.options).forEach(opt => opt.selected = product.colors?.includes(opt.value));
    }
    const roomsCheckboxes = document.querySelectorAll('#editRooms input[type="checkbox"]');
    roomsCheckboxes.forEach(checkbox => {
        checkbox.checked = product.rooms?.includes(checkbox.value);
    });
    const onSaleCheckbox = document.getElementById('editOnSale');
    const discountInput = document.getElementById('discountInput');
    if (product.onSale) {
        discountInput.style.display = 'block';
        discountInput.value = product.discount || 0;
    } else {
        discountInput.style.display = 'none';
    }
    const editSizes = document.getElementById('editSizes');
    if (editSizes) {
        editSizes.innerHTML = product.sizes.map(s => `<div class="size-row"><input type="text" class="edit-size-input" value="${s.size}"><input type="number" class="edit-price-input" value="${s.price}"><button class="remove-size">Видалити</button></div>`).join('');
    }
    const editModal = document.getElementById('editModal');
    if (editModal) {
        editModal.dataset.key = key;
        editModal.style.display = 'flex';
        console.log('Edit modal opened for product key:', key);
    } else {
        console.error('Edit modal not found');
    }
};

document.getElementById('saveEdit')?.addEventListener('click', () => {
    const editModal = document.getElementById('editModal');
    if (!editModal) {
        console.error('Edit modal not found');
        showNotification('Помилка: модальне вікно не знайдено');
        return;
    }
    const key = editModal.dataset.key;
    if (!key || !products[key]) {
        console.error('Invalid product key or product not found:', key);
        showNotification('Помилка: товар не знайдено');
        return;
    }

    console.log('Save edit button clicked for product key:', key);

    const name = document.getElementById('editProductName')?.value.trim() || '';
    const description = document.getElementById('editProductDescription')?.value.trim() || '';
    const photo = document.getElementById('editProductPhoto')?.value.trim() || '';
    const category = document.getElementById('editProductCategory')?.value || 'beds';
    const subcategory = document.getElementById('editProductSubcategory')?.value || '';
    const materialsSelected = Array.from(document.getElementById('editProductMaterials')?.selectedOptions || []).map(opt => opt.value);
    const colorsSelected = Array.from(document.getElementById('editProductColors')?.selectedOptions || []).map(opt => opt.value);
    const availability = document.getElementById('editAvailability')?.checked || false;
    const rooms = Array.from(document.querySelectorAll('#editRooms input[type="checkbox"]:checked')).map(checkbox => checkbox.value);
    const onSale = document.getElementById('editOnSale')?.checked || false;
    const discount = onSale ? parseInt(document.getElementById('discountInput')?.value) || 0 : 0;
    const sizes = Array.from(document.querySelectorAll('#editSizes .edit-size-input')).map((input, i) => ({
        size: input.value.trim(),
        price: parseFloat(document.querySelectorAll('#editSizes .edit-price-input')[i]?.value) || 0
    })).filter(s => s.size && s.price > 0);

    console.log('Edit form data:', { name, description, photo, category, subcategory, materialsSelected, colorsSelected, availability, rooms, onSale, discount, sizes });

    if (!name) {
        showNotification('Введіть назву товару');
        console.error('Validation failed: Name is empty');
        return;
    }
    if (!description) {
        showNotification('Введіть опис товару');
        console.error('Validation failed: Description is empty');
        return;
    }
    if (!photo) {
        showNotification('Введіть URL фото');
        console.error('Validation failed: Photo URL is empty');
        return;
    }
    if (!category) {
        showNotification('Виберіть категорію');
        console.error('Validation failed: Category is empty');
        return;
    }
    if (!subcategory) {
        showNotification('Виберіть підкатегорію');
        console.error('Validation failed: Subcategory is empty');
        return;
    }
    if (!sizes.length) {
        showNotification('Додайте хоча б один розмір та ціну');
        console.error('Validation failed: No valid sizes');
        return;
    }
    if (onSale && (discount < 0 || discount > 100)) {
        showNotification('Знижка має бути від 0 до 100%');
        console.error('Validation failed: Invalid discount value');
        return;
    }

    const productData = {
        name, description, photo, category, subcategory,
        materials: materialsSelected, colors: colorsSelected,
        sizes, availability, rooms, onSale, discount
    };

    console.log('Updating product in Firebase:', productData);

    update(ref(database, 'products/' + key), productData)
        .then(() => {
            console.log('Product updated successfully');
            editModal.style.display = 'none';
            showNotification('Товар успішно оновлено');
            renderAdminProducts('all', '');
        })
        .catch(error => {
            console.error('Error updating product:', error);
            showNotification('Помилка оновлення товару: ' + error.message);
        });
});

function toggleDiscountInput() {
    const onSaleCheckbox = document.getElementById('editOnSale');
    const discountInput = document.getElementById('discountInput');
    if (onSaleCheckbox && discountInput) {
        discountInput.style.display = onSaleCheckbox.checked ? 'block' : 'none';
    }
}

document.getElementById('editAddSize')?.addEventListener('click', () => {
    const editSizes = document.getElementById('editSizes');
    if (editSizes) {
        const newSizeRow = document.createElement('div');
        newSizeRow.className = 'size-row';
        newSizeRow.innerHTML = '<input type="text" class="edit-size-input" placeholder="Розмір"><input type="number" class="edit-price-input" placeholder="Ціна"><button class="remove-size">Видалити</button>';
        editSizes.appendChild(newSizeRow);
    }
});

document.getElementById('editSamePrice')?.addEventListener('click', () => {
    const priceInputs = document.querySelectorAll('#editSizes .edit-price-input');
    if (priceInputs.length) {
        const firstPrice = priceInputs[0].value;
        priceInputs.forEach(input => input.value = firstPrice);
        showNotification('Ціни вирівняно');
    }
});

document.addEventListener('click', e => {
    if (e.target.classList.contains('remove-size')) {
        const sizeRow = e.target.closest('.size-row');
        if (sizeRow && document.querySelectorAll('#editSizes .size-row').length > 1) {
            sizeRow.remove();
            showNotification('Розмір видалено');
        } else {
            showNotification('Має бути принаймні один розмір');
        }
    }
});

document.getElementById('addPromo')?.addEventListener('click', () => {
    const promoModal = document.getElementById('promoModal');
    if (promoModal) promoModal.style.display = 'flex';
});

document.getElementById('savePromo')?.addEventListener('click', () => {
    const name = document.getElementById('promoName')?.value || '';
    const discount = parseInt(document.getElementById('promoDiscount')?.value) || 0;
    if (name && discount >= 0 && discount <= 100) {
        push(ref(database, 'promos'), { name, discount }).then(() => {
            document.getElementById('promoModal').style.display = 'none';
            document.getElementById('promoName').value = '';
            document.getElementById('promoDiscount').value = '';
            showNotification('Акцію додано');
        });
    } else showNotification('Введіть коректну назву та знижку (0-100%)');
});

onValue(ref(database, 'promos'), (snapshot) => {
    promos = snapshot.val() || {};
    const promoList = document.getElementById('promoList');
    if (promoList) {
        promoList.innerHTML = '';
        Object.entries(promos).forEach(([key, promo]) => {
            const li = document.createElement('li');
            li.textContent = `${promo.name}: ${promo.discount}%`;
            const deleteBtn = document.createElement('button');
            deleteBtn.textContent = 'Видалити';
            deleteBtn.onclick = () => remove(ref(database, 'promos/' + key)).then(() => showNotification('Акцію видалено'));
            li.appendChild(deleteBtn);
            promoList.appendChild(li);
        });
    }
});

function applyPromos() {
    document.querySelectorAll('.product').forEach(product => {
        const name = product.querySelector('h3')?.textContent;
        if (!name) return;
        const productKey = Object.keys(products).find(key => products[key].name === name);
        if (!productKey) return;
        const discount = promos[products[productKey].category]?.discount || 0;
        const priceSpan = product.querySelector('span[id^="price_"]');
        const originalPrice = products[productKey].sizes[0].price;
        if (priceSpan) {
            const salePrice = discount ? (originalPrice * (1 - discount / 100)).toFixed(0) : originalPrice;
            priceSpan.textContent = salePrice;
            const priceContainer = priceSpan.parentElement;
            const existingDel = priceContainer.querySelector('del');
            if (discount && !existingDel) {
                priceSpan.insertAdjacentHTML('afterend', `<del>${originalPrice} грн</del>`);
            } else if (!discount && existingDel) {
                existingDel.remove();
            }
        }
    });
}

document.getElementById('applyFilters')?.addEventListener('click', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const category = urlParams.get('category');
    const subcategory = document.getElementById('subcategory')?.value || null;
    const priceMin = document.getElementById('priceMin')?.value ? parseInt(document.getElementById('priceMin').value) : null;
    const priceMax = document.getElementById('priceMax')?.value ? parseInt(document.getElementById('priceMax').value) : null;
    const availability = document.getElementById('availability')?.checked || null;
    const color = document.getElementById('color')?.value || null;
    const material = document.getElementById('material')?.value || null;
    const room = document.getElementById('room')?.value || null;
    const sale = document.getElementById('onSaleOnly')?.checked || null;

    console.log('Applying filters:', { category, subcategory, priceMin, priceMax, availability, color, material, room, sale });

    filterProducts({ category, subcategory, priceMin, priceMax, availability, color, material, room, sale });
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
        if (Object.keys(subcategories).length) {
            Object.values(subcategories).flat().forEach(sub => options.add(sub));
        }
        [...options].sort().forEach(sub => {
            const option = document.createElement('option');
            option.value = sub;
            option.textContent = subcategoryTranslations[sub] || sub;
            select.appendChild(option);
        });
        select.value = currentValue;
        console.log(`Updated subcategory select ${select.id}:`, select.innerHTML);
    });
}

document.getElementById('addColor')?.addEventListener('click', () => {
    const colorInput = document.getElementById('colorInput')?.value.trim() || '';
    if (colorInput && !colors.includes(colorInput)) {
        push(ref(database, 'colors'), colorInput).then(() => {
            document.getElementById('colorInput').value = '';
            showNotification('Колір додано');
        });
    } else {
        showNotification('Колір уже існує або поле порожнє');
    }
});

document.getElementById('addMaterial')?.addEventListener('click', () => {
    const materialInput = document.getElementById('materialInput')?.value.trim() || '';
    if (materialInput && !materials.includes(materialInput)) {
        push(ref(database, 'materials'), materialInput).then(() => {
            document.getElementById('materialInput').value = '';
            showNotification('Матеріал додано');
        });
    } else {
        showNotification('Матеріал уже існує або поле порожнє');
    }
});

document.getElementById('productCategory')?.addEventListener('change', updateSubcategoryOptions);
document.getElementById('editProductCategory')?.addEventListener('change', updateEditSubcategoryOptions);
document.getElementById('editOnSale')?.addEventListener('change', toggleDiscountInput);

// Expose functions to the global scope
window.updatePrice = updatePrice;
window.removeFromCart = removeFromCart;
window.updateCartSize = updateCartSize;
window.updateOrderItemSize = updateOrderItemSize;
window.updateSubcategoryOptions = updateSubcategoryOptions;
window.updateEditSubcategoryOptions = updateEditSubcategoryOptions;
window.removeBanner = removeBanner;
window.moveBanner = moveBanner;
window.removeProduct = removeProduct;
window.editProduct = editProduct;
window.toggleDiscountInput = toggleDiscountInput;