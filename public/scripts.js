import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-auth.js";
import { getDatabase, ref, onValue, set, push, remove, update } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-database.js";

const firebaseConfig = {
    apiKey: "AIzaSyCiHLrGnPv1kRQ4SdX0qAdsVWLYGdASERc",
    authDomain: "premium-d5066.firebaseapp.com",
    projectId: "premium-d5066",
    storageBucket: "premium-d5066.firebasestorage.app",
    messagingSenderId: "408653526535",
    appId: "1:408653526535:web:0a0c2a04fda12a09a6dca2",
    measurementId: "G-71LHFB8FK3"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth();
const database = getDatabase();

// Fake data
const fakeBanners = [
    { url: "https://via.placeholder.com/800x300?text=Banner+1" },
    { url: "https://via.placeholder.com/800x300?text=Banner+2" }
];
const fakeProducts = {
    "product1": {
        name: "454364756879p8",
        description: "Зручне ліжко",
        photo: "https://picsum.photos/id/237/200/300",
        category: "beds",
        sizes: [{ size: "1222 * 134", price: "100" }]
    },
    "product2": {
        name: "Гайса2",
        description: "Стильне дзеркало",
        photo: "https://picsum.photos/seed/picsum/200/300",
        category: "mirrors",
        sizes: [{ size: "12+5", price: "200" }]
    }
};

let products = {};
let banners = {};

function initializeData() {
    onValue(ref(database, 'banners'), (snapshot) => {
        banners = snapshot.val() || {};
        if (Object.keys(banners).length === 0) {
            fakeBanners.forEach(banner => push(ref(database, 'banners'), banner));
        }
        updateBannerSlider();
    }, (error) => console.error('Error loading banners:', error));

    onValue(ref(database, 'products'), (snapshot) => {
        products = snapshot.val() || {};
        if (Object.keys(products).length === 0) {
            for (const key in fakeProducts) {
                set(ref(database, 'products/' + key), fakeProducts[key]);
            }
        }
        renderProducts('all');
        if (document.getElementById('productList')) {
            renderAdminProducts('all', '');
        }
    }, (error) => console.error('Error loading products:', error));
}

initializeData();

// Notification function
function showNotification(message) {
    const notification = document.getElementById('notification');
    if (!notification) return;
    const messageDiv = document.createElement('div');
    messageDiv.className = 'notification-message';
    messageDiv.textContent = message;
    notification.appendChild(messageDiv);
    setTimeout(() => messageDiv.remove(), 3000);
}

// Update price function
window.updatePrice = (elementId, price) => {
    const element = document.getElementById(elementId);
    if (element) element.textContent = price;
};

// Validate phone number
function validatePhoneNumber(phone) {
    const phoneRegex = /^\+[0-9]{1,3}[0-9]{9,12}$/;
    const validCountryCodes = ['+1', '+44', '+380', '+48', '+33', '+49', '+7', '+81', '+86'];
    const countryCode = phone.match(/^\+\d{1,3}/)?.[0];
    return phoneRegex.test(phone) && validCountryCodes.includes(countryCode);
}

// Validate name
function validateName(name) {
    const nameRegex = /^[A-Za-zА-Яа-яЁёІіЇїЄєҐґ ]{1,50}$/;
    return nameRegex.test(name);
}

// Load user data from localStorage
function loadUserData() {
    const userData = JSON.parse(localStorage.getItem('userData') || '{}');
    const orderName = document.getElementById('orderName');
    const orderPhone = document.getElementById('orderPhone');
    const orderCountry = document.getElementById('orderCountry');
    const orderRegion = document.getElementById('orderRegion');
    const orderCity = document.getElementById('orderCity');
    if (orderName) orderName.value = userData.name || '';
    if (orderPhone) orderPhone.value = userData.phone || '+380';
    if (orderCountry) orderCountry.value = userData.country || 'Україна';
    if (orderRegion) orderRegion.value = userData.region || '';
    if (orderCity) orderCity.value = userData.city || '';
}

// Banner slider
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
    if (!slides) return;
    const slideCount = slides.children.length;
    currentSlide = (index % slideCount + slideCount) % slideCount;
    slides.style.transform = `translateX(-${currentSlide * 100}%)`;
}

document.querySelector('.prev')?.addEventListener('click', () => showSlide(currentSlide - 1));
document.querySelector('.next')?.addEventListener('click', () => showSlide(currentSlide + 1));

// Touch events for banner slider
let touchStartX = 0;
let touchEndX = 0;
document.querySelector('.slides')?.addEventListener('touchstart', (e) => {
    touchStartX = e.changedTouches[0].screenX;
});
document.querySelector('.slides')?.addEventListener('touchend', (e) => {
    touchEndX = e.changedTouches[0].screenX;
    if (touchStartX - touchEndX > 50) showSlide(currentSlide + 1);
    else if (touchEndX - touchStartX > 50) showSlide(currentSlide - 1);
});

// Product list
function renderProducts(category) {
    const productList = document.querySelector('.products');
    if (!productList) return;
    productList.innerHTML = '';
    for (const key in products) {
        const product = products[key];
        if (category === 'all' || product.category === category) {
            const productDiv = document.createElement('div');
            productDiv.classList.add('product');
            productDiv.innerHTML = `
                <img src="${product.photo}" alt="${product.name}">
                <h3>${product.name}</h3>
                <p>${product.description}</p>
                <div class="sizes">
                    <select class="size-select" id="size_select_${key}" onchange="updatePrice('price_${key}', this.options[this.selectedIndex].dataset.price)">
                        ${product.sizes.map((size, index) => `
                            <option value="${size.size}" data-price="${size.price}" ${index === 0 ? 'selected' : ''}>Розмір: ${size.size} ▼</option>
                        `).join('')}
                    </select>
                </div>
                <p>Ціна: <span id="price_${key}">${product.sizes[0].price}</span> грн</p>
                <button class="addToCart" data-id="${key}">Додати в кошик</button>
                <button class="buyNow" data-id="${key}">Замовити</button>
            `;
            productList.appendChild(productDiv);
        }
    }
}

// Filters
document.querySelectorAll('.filters button').forEach(button => {
    button.addEventListener('click', () => {
        const category = button.dataset.category || 'all';
        renderProducts(category);
        document.querySelectorAll('.filters button').forEach(btn => btn.classList.remove('active'));
        button.classList.add('active');
    });
});

// Cart logic
function renderCart() {
    const cartItems = document.getElementById('cartItems');
    if (!cartItems) return;
    cartItems.innerHTML = '';
    const cart = JSON.parse(localStorage.getItem('cart') || '[]');
    if (cart.length === 0) {
        cartItems.innerHTML = '<p>Кошик порожній</p>';
        return;
    }
    cart.forEach((item, index) => {
        const product = products[item.id];
        if (!product) {
            cartItems.innerHTML += `<p>Товар (ID: ${item.id}) недоступний</p>`;
            return;
        }
        const size = product.sizes.find(s => s.size === item.size);
        if (!size) {
            cartItems.innerHTML += `<p>Розмір ${item.size} для товару (ID: ${item.id}) недоступний</p>`;
            return;
        }
        const productDiv = document.createElement('div');
        productDiv.classList.add('product');
        productDiv.innerHTML = `
            <img src="${product.photo}" alt="${product.name}">
            <h3>${product.name}</h3>
            <p>${product.description}</p>
            <div class="sizes">
                <select class="size-select" onchange="updateCartSize(${index}, this.value); updatePrice('price_${index}', this.options[this.selectedIndex].dataset.price)">
                    ${product.sizes.map(s => `
                        <option value="${s.size}" data-price="${s.price}" ${s.size === item.size ? 'selected' : ''}>Розмір: ${s.size} ▼</option>
                    `).join('')}
                </select>
            </div>
            <p>Ціна: <span id="price_${index}">${size.price}</span> грн</p>
            <button class="remove-from-cart" onclick="removeFromCart(${index})">Видалити</button>
        `;
        cartItems.appendChild(productDiv);
    });
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

document.querySelector('#cartModal .close')?.addEventListener('click', () => {
    const modal = document.getElementById('cartModal');
    if (modal) modal.style.display = 'none';
});

document.getElementById('cartModal')?.addEventListener('click', (e) => {
    if (e.target === document.getElementById('cartModal')) {
        document.getElementById('cartModal').style.display = 'none';
    }
});

// Add to cart or buy now
document.addEventListener('click', (e) => {
    if (e.target.classList.contains('addToCart') || e.target.classList.contains('buyNow')) {
        const productId = e.target.dataset.id;
        if (!products[productId]) {
            showNotification('Товар недоступний');
            return;
        }
        const sizeSelect = document.getElementById(`size_select_${productId}`);
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

// Render order items
function renderOrderItems(orderItems) {
    const orderItemsDiv = document.getElementById('orderItems');
    if (!orderItemsDiv) return;
    orderItemsDiv.innerHTML = '';
    if (!orderItems || orderItems.length === 0) {
        orderItemsDiv.innerHTML = '<p>Кошик порожній</p>';
        return;
    }
    orderItems.forEach((item, index) => {
        const product = products[item.id];
        if (!product) {
            orderItemsDiv.innerHTML += `<p>Товар (ID: ${item.id}) недоступний</p>`;
            return;
        }
        const size = product.sizes.find(s => s.size === item.size);
        if (!size) {
            orderItemsDiv.innerHTML += `<p>Розмір ${item.size} для товару (ID: ${item.id}) недоступний</p>`;
            return;
        }
        const productDiv = document.createElement('div');
        productDiv.classList.add('product');
        productDiv.innerHTML = `
            <img src="${product.photo}" alt="${product.name}">
            <h3>${product.name}</h3>
            <p>${product.description}</p>
            <div class="sizes">
                <select class="size-select" onchange="updateOrderItemSize(${index}, this.value)">
                    ${product.sizes.map(s => `
                        <option value="${s.size}" ${s.size === item.size ? 'selected' : ''}>Розмір: ${s.size} ▼</option>
                    `).join('')}
                </select>
            </div>
            <p>Ціна: <span>${size.price}</span> грн</p>
        `;
        orderItemsDiv.appendChild(productDiv);
    });
}

// Update order item size
window.updateOrderItemSize = (index, size) => {
    const orderItems = Array.from(document.querySelectorAll('#orderItems .product')).map((product, i) => {
        const sizeSelect = product.querySelector('.size-select');
        return { id: Object.keys(products).find(key => products[key].name === product.querySelector('img').alt), size: i === index ? size : sizeSelect.value };
    });
    renderOrderItems(orderItems);
};

// Checkout
document.getElementById('checkout')?.addEventListener('click', () => {
    const cart = JSON.parse(localStorage.getItem('cart') || '[]');
    if (cart.length === 0) {
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

document.getElementById('orderForm')?.addEventListener('submit', (e) => {
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
    });
    const validOrderItems = orderItems.filter(item => products[item.id] && products[item.id].sizes.some(s => s.size === item.size));
    if (validOrderItems.length === 0) {
        showNotification('Кошик містить недоступні товари');
        submitButton.disabled = false;
        submitButton.textContent = 'Оформити';
        return;
    }
    const name = document.getElementById('orderName')?.value || '';
    const phone = document.getElementById('orderPhone')?.value || '';
    const country = document.getElementById('orderCountry')?.value || '';
    const region = document.getElementById('orderRegion')?.value || '';
    const city = document.getElementById('orderCity')?.value || '';
    const comment = document.getElementById('orderComment')?.value || '';

    if (!validateName(name)) {
        showNotification('Ім’я може містити лише літери та пробіли, до 50 символів');
        submitButton.disabled = false;
        submitButton.textContent = 'Оформити';
        return;
    }
    if (!validatePhoneNumber(phone)) {
        showNotification('Номер телефону має починатися з "+" та містити коректний код країни (наприклад, +380)');
        submitButton.disabled = false;
        submitButton.textContent = 'Оформити';
        return;
    }

    const order = {
        name,
        phone,
        country,
        region,
        city,
        comment,
        products: validOrderItems.map(item => {
            const product = products[item.id];
            const size = product.sizes.find(s => s.size === item.size);
            return { name: product.name, size: item.size, price: size.price, photo: product.photo };
        })
    };

    fetch('https://project-mebli.onrender.com/sendOrder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(order)
    }).then(response => {
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        localStorage.setItem('userData', JSON.stringify({ name, phone, country, region, city }));
        const cartModal = document.getElementById('cartModal');
        const orderModal = document.getElementById('orderModal');
        const successModal = document.getElementById('successModal');
        if (cartModal) cartModal.style.display = 'none';
        if (orderModal) orderModal.style.display = 'none';
        if (successModal) successModal.style.display = 'flex';
        localStorage.removeItem('cart');
        if (document.getElementById('orderName')) document.getElementById('orderName').value = '';
        if (document.getElementById('orderPhone')) document.getElementById('orderPhone').value = '+380';
        if (document.getElementById('orderCountry')) document.getElementById('orderCountry').value = 'Україна';
        if (document.getElementById('orderRegion')) document.getElementById('orderRegion').value = '';
        if (document.getElementById('orderCity')) document.getElementById('orderCity').value = '';
        if (document.getElementById('orderComment')) document.getElementById('orderComment').value = '';
        submitButton.disabled = false;
        submitButton.textContent = 'Оформити';
    }).catch(err => {
        console.error('Fetch error:', err);
        showNotification('Помилка при оформленні замовлення. Спробуйте ще раз.');
        submitButton.disabled = false;
        submitButton.textContent = 'Оформити';
    });
});

document.querySelector('#orderModal .close')?.addEventListener('click', () => {
    const modal = document.getElementById('orderModal');
    if (modal) modal.style.display = 'none';
});

document.getElementById('orderModal')?.addEventListener('click', (e) => {
    if (e.target === document.getElementById('orderModal')) {
        document.getElementById('orderModal').style.display = 'none';
    }
});

document.querySelector('#successModal .close')?.addEventListener('click', () => {
    const modal = document.getElementById('successModal');
    if (modal) modal.style.display = 'none';
});

document.getElementById('successModal')?.addEventListener('click', (e) => {
    if (e.target === document.getElementById('successModal')) {
        document.getElementById('successModal').style.display = 'none';
    }
});

// Login
document.getElementById('loginBtn')?.addEventListener('click', () => {
    const email = document.getElementById('email')?.value || '';
    const password = document.getElementById('password')?.value || '';
    signInWithEmailAndPassword(auth, email, password)
        .then(() => {
            window.location.href = 'admin.html';
        })
        .catch(error => showNotification('Помилка входу: ' + error.message));
});

// Logout
document.getElementById('logout')?.addEventListener('click', () => {
    signOut(auth).then(() => {
        window.location.href = 'login.html';
    }).catch(error => console.error('Logout error:', error));
});

// Auth check
onAuthStateChanged(auth, user => {
    if (!user && window.location.pathname.includes('admin.html')) {
        window.location.href = 'login.html';
    }
});

// Admin: Banner management
onValue(ref(database, 'banners'), (snapshot) => {
    banners = snapshot.val() || {};
    const bannerList = document.getElementById('bannerList');
    if (!bannerList) return;
    bannerList.innerHTML = '';
    const bannerKeys = Object.keys(banners);
    bannerKeys.forEach((key, index) => {
        const li = document.createElement('li');
        li.innerHTML = `
            <img src="${banners[key].url}" alt="Banner">
            <button onclick="moveBanner('${key}', ${index - 1})" ${index === 0 ? 'disabled' : ''}>↑</button>
            <button onclick="moveBanner('${key}', ${index + 1})" ${index === bannerKeys.length - 1 ? 'disabled' : ''}>↓</button>
            <button onclick="removeBanner('${key}')">Видалити</button>
        `;
        bannerList.appendChild(li);
    });
});

window.removeBanner = key => {
    remove(ref(database, 'banners/' + key)).then(() => showNotification('Банер видалено')).catch(error => console.error('Remove banner error:', error));
};

window.moveBanner = (key, newIndex) => {
    onValue(ref(database, 'banners'), (snapshot) => {
        const currentBanners = snapshot.val() || {};
        const bannerKeys = Object.keys(currentBanners);
        const oldIndex = bannerKeys.indexOf(key);
        if (newIndex >= 0 && newIndex < bannerKeys.length) {
            const reorderedKeys = [...bannerKeys];
            reorderedKeys.splice(oldIndex, 1);
            reorderedKeys.splice(newIndex, 0, key);
            const newBanners = {};
            reorderedKeys.forEach((k, i) => {
                newBanners[`banner_${i}`] = currentBanners[k];
            });
            update(ref(database, 'banners'), newBanners).then(() => showNotification('Банер переміщено')).catch(error => console.error('Move banner error:', error));
        }
    }, { onlyOnce: true });
};

// Admin: Add banner
document.getElementById('addBanner')?.addEventListener('click', () => {
    const url = document.getElementById('bannerUrl')?.value || '';
    if (url) {
        push(ref(database, 'banners'), { url }).then(() => {
            document.getElementById('bannerUrl').value = '';
            showNotification('Банер додано');
        }).catch(error => console.error('Add banner error:', error));
    } else {
        showNotification('Введіть URL банера');
    }
});

// Admin: Add product
document.getElementById('addProduct')?.addEventListener('click', () => {
    const name = document.getElementById('productName')?.value || '';
    const description = document.getElementById('productDescription')?.value || '';
    const photo = document.getElementById('productPhoto')?.value || '';
    const category = document.getElementById('productCategory')?.value || 'beds';
    const sizes = Array.from(document.querySelectorAll('#sizes .size-input')).map((input, i) => ({
        size: input.value,
        price: document.querySelectorAll('#sizes .price-input')[i]?.value || ''
    })).filter(s => s.size && s.price);
    if (name && description && photo && sizes.length) {
        push(ref(database, 'products'), { name, description, photo, category, sizes }).then(() => {
            document.getElementById('productName').value = '';
            document.getElementById('productDescription').value = '';
            document.getElementById('productPhoto').value = '';
            document.getElementById('productCategory').value = 'beds';
            document.getElementById('sizes').innerHTML = '<div class="size-row"><input type="text" class="size-input" placeholder="Розмір"><input type="number" class="price-input" placeholder="Ціна"></div>';
            showNotification('Товар додано');
        }).catch(error => console.error('Add product error:', error));
    } else {
        showNotification('Заповніть усі поля та додайте хоча б один розмір');
    }
});

// Admin: Same price
document.getElementById('samePrice')?.addEventListener('click', () => {
    const priceInputs = document.querySelectorAll('.price-input');
    if (priceInputs.length) {
        const firstPrice = priceInputs[0].value;
        priceInputs.forEach(input => input.value = firstPrice);
        showNotification('Ціни вирівняно');
    }
});

// Admin: Add size
document.getElementById('addSize')?.addEventListener('click', () => {
    const sizesDiv = document.getElementById('sizes');
    if (sizesDiv) {
        const newSizeRow = document.createElement('div');
        newSizeRow.className = 'size-row';
        newSizeRow.innerHTML = '<input type="text" class="size-input" placeholder="Розмір"><input type="number" class="price-input" placeholder="Ціна">';
        sizesDiv.appendChild(newSizeRow);
    }
});

// Admin: Product list with filter and search
const categoryTranslations = {
    beds: 'Ліжка',
    mirrors: 'Дзеркала',
    wardrobes: 'Шафи'
};

function renderAdminProducts(category, search) {
    const productList = document.getElementById('productList');
    if (!productList) return;
    productList.innerHTML = '';
    for (const key in products) {
        const product = products[key];
        if ((category === 'all' || product.category === category) && (!search || product.name.toLowerCase().includes(search.toLowerCase()))) {
            const productDiv = document.createElement('div');
            productDiv.classList.add('product');
            productDiv.innerHTML = `
                <img src="${product.photo}" alt="${product.name}">
                <h3>${product.name}</h3>
                <p>${product.description}</p>
                <p>Категорія: ${categoryTranslations[product.category] || product.category}</p>
                <div class="sizes">
                    <select class="size-select" onchange="updatePrice('price_${key}', this.options[this.selectedIndex].dataset.price)">
                        ${product.sizes.map((size, index) => `
                            <option value="${size.size}" data-price="${size.price}" ${index === 0 ? 'selected' : ''}>Розмір: ${size.size} ▼</option>
                        `).join('')}
                    </select>
                </div>
                <p>Ціна: <span id="price_${key}">${product.sizes[0].price}</span> грн</p>
                <button onclick="editProduct('${key}')">Редагувати</button>
                <button onclick="removeProduct('${key}')">Видалити</button>
            `;
            productList.appendChild(productDiv);
        }
    }
}

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

window.removeProduct = key => {
    remove(ref(database, 'products/' + key)).then(() => showNotification('Товар видалено')).catch(error => console.error('Remove product error:', error));
};

window.editProduct = key => {
    const product = products[key];
    if (!product) return;
    const editName = document.getElementById('editProductName');
    const editDescription = document.getElementById('editProductDescription');
    const editPhoto = document.getElementById('editProductPhoto');
    const editCategory = document.getElementById('editProductCategory');
    const editSizes = document.getElementById('editSizes');
    if (editName) editName.value = product.name;
    if (editDescription) editDescription.value = product.description;
    if (editPhoto) editPhoto.value = product.photo;
    if (editCategory) editCategory.value = product.category;
    if (editSizes) editSizes.innerHTML = product.sizes.map(s => `
        <div class="size-row">
            <input type="text" class="edit-size-input" value="${s.size}">
            <input type="number" class="edit-price-input" value="${s.price}">
        </div>
    `).join('');
    const editModal = document.getElementById('editModal');
    if (editModal) {
        editModal.dataset.key = key;
        editModal.style.display = 'flex';
    }
};

document.getElementById('editAddSize')?.addEventListener('click', () => {
    const editSizes = document.getElementById('editSizes');
    if (editSizes) {
        const newSizeRow = document.createElement('div');
        newSizeRow.className = 'size-row';
        newSizeRow.innerHTML = '<input type="text" class="edit-size-input" placeholder="Розмір"><input type="number" class="edit-price-input" placeholder="Ціна">';
        editSizes.appendChild(newSizeRow);
    }
});

document.getElementById('editSamePrice')?.addEventListener('click', () => {
    const priceInputs = document.querySelectorAll('.edit-price-input');
    if (priceInputs.length) {
        const firstPrice = priceInputs[0].value;
        priceInputs.forEach(input => input.value = firstPrice);
        showNotification('Ціни вирівняно');
    }
});

document.getElementById('saveEdit')?.addEventListener('click', () => {
    const key = document.getElementById('editModal')?.dataset.key;
    if (!key) return;
    const name = document.getElementById('editProductName')?.value || '';
    const description = document.getElementById('editProductDescription')?.value || '';
    const photo = document.getElementById('editProductPhoto')?.value || '';
    const category = document.getElementById('editProductCategory')?.value || 'beds';
    const sizes = Array.from(document.querySelectorAll('.edit-size-input')).map((input, i) => ({
        size: input.value,
        price: document.querySelectorAll('.edit-price-input')[i]?.value || ''
    })).filter(s => s.size && s.price);
    if (name && description && photo && sizes.length) {
        update(ref(database, 'products/' + key), { name, description, photo, category, sizes }).then(() => {
            const editModal = document.getElementById('editModal');
            if (editModal) editModal.style.display = 'none';
            showNotification('Товар відредаговано');
        }).catch(error => console.error('Save edit error:', error));
    } else {
        showNotification('Заповніть усі поля та додайте хоча б один розмір');
    }
});

document.querySelector('#editModal .close')?.addEventListener('click', () => {
    const modal = document.getElementById('editModal');
    if (modal) modal.style.display = 'none';
});

document.getElementById('editModal')?.addEventListener('click', (e) => {
    if (e.target === document.getElementById('editModal')) {
        document.getElementById('editModal').style.display = 'none';
    }
});

// Accordion logic
document.querySelectorAll('.accordion-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const content = btn.nextElementSibling;
        if (!content) return;
        const isActive = content.classList.contains('active');
        document.querySelectorAll('.accordion-content').forEach(c => c.classList.remove('active'));
        content.classList.toggle('active', !isActive);
    });
});

// Initialize page
document.addEventListener('DOMContentLoaded', () => {
    const cartModal = document.getElementById('cartModal');
    const orderModal = document.getElementById('orderModal');
    const successModal = document.getElementById('successModal');
    const editModal = document.getElementById('editModal');
    if (cartModal) cartModal.style.display = 'none';
    if (orderModal) orderModal.style.display = 'none';
    if (successModal) successModal.style.display = 'none';
    if (editModal) editModal.style.display = 'none';
    document.querySelectorAll('.accordion-content').forEach(content => content.classList.remove('active'));
});