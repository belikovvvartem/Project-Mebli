import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getDatabase, ref, onValue, set, push, remove, update } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";
import { firebaseConfig } from './firebaseConfig.js';


const app = initializeApp(firebaseConfig);
const auth = getAuth();
const database = getDatabase();

let products = {}, banners = {}, promos = {}, colors = [], materials = [], subcategories = {};
let currentFilters = { category: 'all', subcategory: null, subSubcategory: null, priceMin: null, priceMax: null, availability: null, color: null, material: null, room: null, sale: null, clearance: null, search: null };
let isInitialLoad = true;

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

function initializeData() {
    onValue(ref(database, 'banners'), (snapshot) => { banners = snapshot.val() || {}; updateBannerSlider(); });
    onValue(ref(database, 'products'), (snapshot) => {
        products = snapshot.val() || {};
        renderContent(currentFilters);
        if (document.getElementById('productList')) renderAdminProducts('all', '');
        if (isInitialLoad && window.location.pathname.includes('room.html')) {
            renderSubcategories(currentFilters.category, currentFilters.subcategory);
            isInitialLoad = false;
        }


    });
    onValue(ref(database, 'promos'), (snapshot) => { promos = snapshot.val() || {}; applyPromos(); });
    onValue(ref(database, 'colors'), (snapshot) => { colors = Object.values(snapshot.val() || []); updateColorSelects(); });
    onValue(ref(database, 'materials'), (snapshot) => { materials = Object.values(snapshot.val() || []); updateMaterialSelects(); });
    onValue(ref(database, 'subcategories'), (snapshot) => { subcategories = snapshot.val() || {}; updateSubcategorySelects(); });
}
initializeData();

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
            if (selectedCategory === category) {
                li.classList.add('selected');
            }
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
        if (urlParams.get('sale') === 'true') {
            saleLi.classList.add('selected');
        }
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
        if (urlParams.get('clearance') === 'true') {
            clearanceLi.classList.add('selected');
        }
    }

    mainCategories.appendChild(clearanceLi);
}

document.addEventListener('DOMContentLoaded', () => {
    renderCategories();

    if (window.location.pathname.includes('product.html')) {
        const urlParams = new URLSearchParams(window.location.search);
        const productId = urlParams.get('id');
        if (!productId) {
            showNotification('ID продукту не вказано', 'error');
            return;
        }
        onValue(ref(database, 'products'), (snapshot) => {
            products = snapshot.val() || {};
            try {
                if (typeof renderSingleProduct === 'undefined') {
                    console.error('renderSingleProduct не визначено');
                    showNotification('Помилка завантаження скрипта', 'error');
                    return;
                }
                renderSingleProduct(productId);
            } catch (e) {
                console.error('Помилка виклику renderSingleProduct:', e);
                showNotification('Не вдалося завантажити продукт', 'error');
            }
        }, { onlyOnce: true });
    }
});

document.querySelectorAll('#roomCategories li').forEach(li =>
    li.addEventListener('click', () => window.location.href = `room.html?room=${li.dataset.tag}`)
);
document.querySelectorAll('.category-menu ul li[data-filter]').forEach(li =>
    li.addEventListener('click', () => window.location.href = `room.html?${li.dataset.filter}=true`)
);

function renderContent(filters) {
    if (Object.keys(products).length === 0) return;
    ['mainProducts', 'roomProducts', 'saleProducts', 'clearanceProducts'].forEach(containerId => {
        const container = document.getElementById(containerId);
        if (!container) return;
        container.innerHTML = '';
        let filteredProducts = Object.entries(products).filter(([key, product]) => {
            const effectivePrice = product.onSale && product.discountPrices && product.discountPrices[product.sizes[0].size] 
                ? product.discountPrices[product.sizes[0].size] 
                : product.sizes[0].price;
            const subSubcategoryMatch = !filters.subSubcategory || 
                (product.subcategory === filters.subcategory && product.subSubcategory === filters.subSubcategory);
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

        filteredProducts.forEach(([key, product]) => {
            if (containerId === 'mainProducts' ||
                (containerId === 'roomProducts' && (filters.category === 'all' || product.category === filters.category)) ||
                (containerId === 'saleProducts' && product.onSale) ||
                (containerId === 'clearanceProducts' && product.onClearance)) {
                renderProductCard(container, key, product, containerId);
            }
        });
    });
}





function renderSingleProduct(productId) {
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
    const formattedSalePrice = Number(salePrice).toLocaleString('uk-UA');
    const formattedOriginalPrice = Number(originalPrice).toLocaleString('uk-UA');

    const categoryName = categoryTranslations[product.category] || product.category;
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
            <h3>${product.name}</h3>
            <p>${product.description}</p>
        </div>
        <div class="product-container-bottom">
            <div class="sizes">
                <select class="size-select" data-product-id="${productId}" onchange="updatePrice('price_${productId}', this.options[this.selectedIndex].dataset.price, this.value, '${productId}')">
                    ${product.sizes.map((size, index) => {
                        const discount = discountPrices[size.size] || null;
                        const formattedDiscount = discount ? Number(discount).toLocaleString('uk-UA') : Number(size.price).toLocaleString('uk-UA');
                        const formattedOriginal = Number(size.price).toLocaleString('uk-UA');
                        return `<option value="${size.size}" data-price="${discount || size.price}" data-original-price="${size.price}" ${index === 0 ? 'selected' : ''}>Розмір: ${size.size}</option>`;
                    }).join('')}
                </select>
            </div>
            <div class="order-items-price">
                <p class="product-price"><span class="sale-price" id="price_${productId}">${formattedSalePrice}</span> грн${discountPrices[product.sizes[0].size] ? `<del class="original-price" id="original_price_${productId}">${formattedOriginalPrice} грн</del>` : ''}</p>
            </div>
            <div class="product-button-order">
                <button class="addToCart" data-id="${productId}"><i class="material-icons">shopping_cart</i></button>
                <button class="buyNow" data-id="${productId}">Замовити</button>
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
    const formattedSalePrice = Number(salePrice).toLocaleString('uk-UA');
    const formattedOriginalPrice = Number(originalPrice).toLocaleString('uk-UA');

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
                        const formattedDiscount = discount ? Number(discount).toLocaleString('uk-UA') : Number(size.price).toLocaleString('uk-UA');
                        const formattedOriginal = Number(size.price).toLocaleString('uk-UA');
                        return `<option value="${size.size}" data-price="${discount || size.price}" data-original-price="${size.price}" ${index === 0 ? 'selected' : ''}>Розмір: ${size.size}</option>`;
                    }).join('')}
                </select>
            </div>
            <div class="order-items-price">
                <p class="product-price"><span class="sale-price" id="price_${product.key}">${formattedSalePrice}</span> грн${discountPrices[product.sizes[0].size] ? `<del class="original-price" id="original_price_${product.key}">${formattedOriginalPrice} грн</del>` : ''}</p>
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
    const formattedSalePrice = Number(salePrice).toLocaleString('uk-UA');
    const formattedOriginalPrice = Number(originalPrice).toLocaleString('uk-UA');

    productDiv.innerHTML = `
        <div class="product-container-top" onclick="window.location.href='product.html?id=${key}'" style="cursor: pointer;">
            ${product.onClearance ? '<span class="promo clearance">Хіт продажу</span>' : ''}
            ${product.onSale ? '<span class="promo">Акція</span>' : ''}
            <img src="${(product.photos || [])[0] || product.photo}" alt="${product.name}" class="product-img">
            <h3>${product.name}</h3>
            <p>${product.description}</p> 
        </div>
        <div class="product-container-bottom">
            <div class="sizes">
                <select class="size-select" data-product-id="${key}" onchange="updatePrice('price_${key}', this.options[this.selectedIndex].dataset.price, this.value, '${key}')">
                    ${product.sizes.map((size, index) => {
                        const discount = discountPrices[size.size] || null;
                        const formattedDiscount = discount ? Number(discount).toLocaleString('uk-UA') : Number(size.price).toLocaleString('uk-UA');
                        const formattedOriginal = Number(size.price).toLocaleString('uk-UA');
                        return `<option value="${size.size}" data-price="${discount || size.price}" data-original-price="${size.price}" ${index === 0 ? 'selected' : ''}>Розмір: ${size.size}</option>`;
                    }).join('')}
                </select>
            </div>
            <p class="product-price"><span class="sale-price" id="price_${key}">${formattedSalePrice}</span> грн${discountPrices[product.sizes[0].size] ? `<del class="original-price" id="original_price_${key}">${formattedOriginalPrice} грн</del>` : ''}</p>
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
        const originalPrice = selectedOption.dataset.original-price;
        const priceElement = productDiv.querySelector(`#price_${key}`);
        const originalPriceElement = productDiv.querySelector(`#original_price_${key}`);
        if (priceElement) priceElement.textContent = Number(newPrice).toLocaleString('uk-UA');
        if (product.onSale && originalPriceElement) {
            originalPriceElement.textContent = `${Number(originalPrice).toLocaleString('uk-UA')} грн`;
        } else if (!product.onSale && originalPriceElement) {
            originalPriceElement.remove();
        } else if (product.onSale && !originalPriceElement) {
            priceElement.insertAdjacentHTML('afterend', `<del class="original-price" id="original_price_${key}">${Number(originalPrice).toLocaleString('uk-UA')} грн</del>`);
        }
    });
    container.appendChild(productDiv);
}

window.updatePrice = (priceId, newPrice, selectedSize, productId) => {
    const priceElement = document.getElementById(priceId);
    const originalPriceElement = document.getElementById(`original_price_${productId}`);
    if (!priceElement) {
        console.error('Price element not found:', priceId);
        return;
    }

    const formattedNewPrice = Number(newPrice.replace(/\s/g, '')).toLocaleString('uk-UA');
    priceElement.textContent = `${formattedNewPrice}`;
    let product = products[productId];
    if (!product) {
        product = Object.entries(products).flatMap(([cat, prods]) => 
            Object.entries(prods || {}).map(([key, prod]) => ({ key, ...prod }))
        ).find(p => p.key === productId);
    }

    if (!product) {
        console.error('Product not found:', productId);
        return;
    }


    const originalPrice = product.sizes.find(s => s.size === selectedSize)?.price || '';
    if (product.onSale && product.discountPrices && product.discountPrices[selectedSize]) {
        if (originalPriceElement) {
            const formattedOriginalPrice = Number(originalPrice).toLocaleString('uk-UA');
            originalPriceElement.textContent = `${formattedOriginalPrice} грн`;
        } else {
            const formattedOriginalPrice = Number(originalPrice).toLocaleString('uk-UA');
            priceElement.insertAdjacentHTML('afterend', `<del class="original-price" id="original_price_${productId}">${formattedOriginalPrice} грн</del>`);
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
});

function renderCart() {
    const cartItems = document.getElementById('cartItems');
    const totalPriceElement = document.getElementById('cartTotalPrice');
    const cartCountEl = document.getElementById('cartCount') || document.getElementById('cartStatus') || document.querySelector('.cart-count');

    const cart = JSON.parse(localStorage.getItem('cart') || '[]');
    if (cartCountEl) {
        cartCountEl.textContent = cart.length > 0 ? String(cart.length) : '';
    }

    if (!cartItems || !totalPriceElement) return;

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
        const formattedDiscountPrice = discountPrice ? Number(discountPrice).toLocaleString('uk-UA') : Number(size.price).toLocaleString('uk-UA');
        const formattedOriginalPrice = Number(size.price).toLocaleString('uk-UA');

        productDiv.innerHTML = `
            <img src="${(product.photos || [])[0] || product.photo || ''}" alt="${product.name || ''}">
            <div class="order-items-content">
                <div class="order-items-desc">
                    <h3>${product.name || ''}</h3>
                    <p>${product.description || ''}</p>
                </div>
                <div class="order-items-bottom">
                    <div class="order-items-price">
                        <p class="product-price">
                            <span class="sale-price" id="price_${index}">${formattedDiscountPrice}</span> грн
                            ${product.onSale ? `<del class="original-price" id="original_price_${item.id}_${index}">${formattedOriginalPrice} грн</del>` : ''}
                        </p>
                    </div>
                    <div class="sizes">
                        <select class="size-select" data-product-id="${item.id}"
                                onchange="updatePrice('price_${index}', this.options[this.selectedIndex].dataset.price, this.value, '${item.id}'); updateCartSize(${index}, this.value);">
                            ${product.sizes.map(s => {
                                const formattedPrice = Number(s.price).toLocaleString('uk-UA');
                                return `<option data-price="${s.price}" value="${s.size}" ${s.size === item.size ? 'selected' : ''}>Розмір: ${s.size}</option>`;
                            }).join('')}
                        </select>
                    </div>
                    <button class="remove-from-cart" onclick="removeFromCart(${index})">Видалити</button>
                </div>
            </div>
        `;
        cartItems.appendChild(productDiv);
    });

    const formattedTotalPrice = Number(totalPrice).toLocaleString('uk-UA');
    totalPriceElement.textContent = `Загальна ціна: ${formattedTotalPrice} грн`;
}


window.removeFromCart = (index) => {
    const cart = JSON.parse(localStorage.getItem('cart') || '[]');
    cart.splice(index, 1);
    localStorage.setItem('cart', JSON.stringify(cart));
    renderCart();
    showNotification('Товар видалено з кошика', 'success');
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
        let product = products[productId] || Object.entries(products).flatMap(([cat, prods]) =>
            Object.entries(prods || {}).map(([key, prod]) => ({ key, ...prod }))
        ).find(p => p.key === productId);
        if (!product) {
            showNotification('Товар недоступний', 'error');
            return;
        }
        const sizeSelect = document.querySelector(`.size-select[data-product-id="${productId}"]`);
        if (!sizeSelect || !sizeSelect.value) {
            showNotification('Будь ласка, виберіть розмір', 'warning');
            return;
        }
        const size = sizeSelect.value;
        if (e.target.classList.contains('addToCart')) {
            const cart = JSON.parse(localStorage.getItem('cart') || '[]');
            if (!cart.some(item => item.id === productId && item.size === size)) {
                cart.push({ id: productId, size });
                localStorage.setItem('cart', JSON.stringify(cart));
                renderCart();
                showNotification('Товар додано до кошика', 'success');
            }
        }
        if (e.target.classList.contains('buyNow')) {
            const sizeExists = product.sizes.some(s => s.size === size);
            if (!sizeExists) {
                showNotification('Вибраний розмір недоступний', 'error');
                return;
            }
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
        if (!product) {
            console.error(`Продукт з ID ${item.id} не знайдено`);
            return;
        }
        const size = product.sizes.find(s => s.size === item.size);
        if (!size) {
            console.error(`Розмір ${item.size} для продукту ${item.id} не знайдено`);
            return;
        }
        validItems++;
        const discountPrice = product.onSale && product.discountPrices ? product.discountPrices[item.size] : null;
        const formattedDiscountPrice = discountPrice ? Number(discountPrice).toLocaleString('uk-UA') : Number(size.price).toLocaleString('uk-UA');
        const formattedOriginalPrice = Number(size.price).toLocaleString('uk-UA');

        const productDiv = document.createElement('div');
        productDiv.classList.add('product');
        productDiv.dataset.productId = item.id;
        productDiv.innerHTML = `
            <img src="${(product.photos || [])[0] || product.photo || ''}" alt="${product.name}">
            <div class="order-items-content">
                <div class="order-items-desc">
                    <h3>${product.name}</h3>
                    <p>${product.description}</p>
                    ${product.subSubcategory ? `<p>Кількість дверей: ${subcategoryTranslations[product.subSubcategory] || product.subSubcategory}</p>` : ''}
                </div>
                <div class="order-items-bottom">
                    <div class="order-items-price">
                        <p class="product-price"><span class="sale-price" id="price_${index}">${formattedDiscountPrice}</span> грн${discountPrice ? `<del class="original-price" id="original_price_${item.id}_${index}">${formattedOriginalPrice} грн</del>` : ''}</p>
                    </div>
                    <div class="sizes"><select class="size-select" onchange="updateOrderItemSize(${index}, this.value)">
                        ${product.sizes.map(s => {
                            const formattedPrice = Number(s.price).toLocaleString('uk-UA');
                            return `<option value="${s.size}" data-price="${product.onSale && product.discountPrices && product.discountPrices[s.size] ? product.discountPrices[s.size] : s.price}" data-original-price="${s.price}" ${s.size === item.size ? 'selected' : ''}>Розмір: ${s.size}</option>`;
                        }).join('')}
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
        orderItems.forEach((item, index) => {
            let product = products[item.id] || Object.entries(products).flatMap(([_, prods]) => Object.values(prods || {})).find(p => p.key === item.id);
            if (product) {
                const size = product.sizes.find(s => s.size === item.size);
                const discountPrice = product.onSale && product.discountPrices ? product.discountPrices[item.size] : null;
                totalPrice += parseFloat(discountPrice || size.price);
            }
        });
        const totalPriceElement = document.getElementById('orderTotalPrice');
        if (totalPriceElement) totalPriceElement.textContent = `Загальна сума: ${Number(totalPrice).toLocaleString('uk-UA')} грн`;
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
    if (!cart.length) {
        showNotification('Кошик порожній', 'warning');
        return;
    }
    const validCartItems = cart.filter(item => {
        const product = products[item.id] || Object.entries(products).flatMap(([_, prods]) => Object.values(prods || {})).find(p => p.key === item.id);
        return product && product.sizes.some(s => s.size === item.size);
    });
    if (!validCartItems.length) {
        showNotification('Кошик містить недоступні товари', 'error');
        return;
    }
    const orderModal = document.getElementById('orderModal');
    if (orderModal) {
        orderModal.style.display = 'flex';
        renderOrderItems(validCartItems);
        loadUserData();
    }
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
        showNotification('Ім’я може містити лише літери та пробіли, до 50 символів', 'error');
        submitButton.disabled = false;
        submitButton.textContent = 'Оформити';
        return;
    }
    if (!validatePhoneNumber(phone)) {
        showNotification('Номер телефону має починатися з "+" та містити коректний код країни', 'error');
        submitButton.disabled = false;
        submitButton.textContent = 'Оформити';
        return;
    }
    if (!country || !region || !city) {
        showNotification('Заповніть усі поля адреси', 'error');
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
        .catch(err => showNotification('Помилка при оформленні замовлення', 'error'))
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
    const urlParams = new URLSearchParams(window.location.search);
    currentFilters.category = urlParams.get('category') || 'all';
    currentFilters.subcategory = urlParams.get('subcategory') || null;
    currentFilters.subSubcategory = urlParams.get('subSubcategory') || null;
    currentFilters.sale = urlParams.get('sale') === 'true' || null;
    currentFilters.clearance = urlParams.get('clearance') === 'true' || null;
    currentFilters.room = urlParams.get('room') || null;
    if (window.location.pathname.includes('room.html') && currentFilters.room) {
        const roomSelect = document.getElementById('room');
        if (roomSelect) {
            roomSelect.value = currentFilters.room;
            renderContent(currentFilters);
        }
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
            if (content) {
                content.style.display = 'block';
                content.classList.add('active');
                button.classList.add('active');
            }
        });
    });
    const welcomeTab = document.getElementById('welcome');
    const welcomeBtn = document.querySelector('.tab-btn[data-tab="welcome"]');
    if (welcomeTab && welcomeBtn) {
        welcomeTab.style.display = 'block';
        welcomeTab.classList.add('active');
        welcomeBtn.classList.add('active');
    }
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
            input.addEventListener('keydown', e => {
                if (e.key === 'Enter') e.preventDefault();
            });
        });
    }
});

function renderSubcategories(category, selectedSubcategory) {
    const subcategoryList = document.getElementById('subcategoryList');
    const subcategorySelect = document.getElementById('subcategory');
    if (!subcategoryList && !subcategorySelect) return;
    if (subcategoryList) {
        subcategoryList.innerHTML = '';
        const subs = category === 'all' ? ['all'] : {
            beds: ['all', 'soft_beds', 'wooden_beds', 'bedroom_sets', 'dressers', 'nightstands'],
            sofas: ['all', 'corner', 'straight', 'armchairs'],
            wardrobes: ['all', 'sliding_wardrobes', 'sliding_wardrobes_with_carving', 'art_matting', 'tv_wardrobes'],
            tables: ['all', 'wooden', 'metal', 'coffee'],
            chairs: ['all', 'wooden', 'soft'],
            mattresses: ['all', 'standard']
        }[category] || ['all'];
        const wardrobeSubSubs = {
            sliding_wardrobes: ['2door', '3door', '4door'],
            sliding_wardrobes_with_carving: ['2door', '3door', '4door']
        };
        subs.forEach(sub => {
            const li = document.createElement('li');
            li.textContent = subcategoryTranslations[sub] || sub;
            li.dataset.subcategory = sub;
            if (sub === selectedSubcategory || (!selectedSubcategory && sub === 'all')) li.classList.add('selected');
            li.addEventListener('click', (e) => {
                e.stopPropagation();
                document.querySelectorAll('#subcategoryList li').forEach(item => item.classList.remove('selected'));
                li.classList.add('selected');
                currentFilters.subcategory = sub === 'all' ? null : sub;
                if (!wardrobeSubSubs[sub] || sub === 'all') {
                    currentFilters.subSubcategory = null;
                    const url = new URL(window.location);
                    url.searchParams.delete('subSubcategory');
                    window.history.pushState({}, '', url);
                }
                renderContent(currentFilters);
            });
            if (wardrobeSubSubs[sub]) {
                const ul = document.createElement('ul');
                ul.className = 'sub-subcategories';
                wardrobeSubSubs[sub].forEach(subSub => {
                    const subLi = document.createElement('li');
                    subLi.textContent = subcategoryTranslations[subSub] || subSub;
                    subLi.addEventListener('click', (e) => {
                        e.stopPropagation();
                        currentFilters.subSubcategory = subSub;
                        const url = new URL(window.location);
                        url.searchParams.set('subSubcategory', subSub);
                        window.history.pushState({}, '', url);
                        renderContent(currentFilters);
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
            li.innerHTML = `<img src="${banner.url}" alt="Banner"><button onclick="removeBanner('${key}')"><i class="material-icons">delete</i></button>`;
            bannerList.appendChild(li);
        });
    }
});

window.removeBanner = key => remove(ref(database, 'banners/' + key)).then(() => showNotification('Банер видалено', 'success'));

window.moveBanner = (key, newIndex) => {
    onValue(ref(database, 'banners'), (snapshot) => {
        const currentBanners = snapshot.val() || {};
        const bannerKeys = Object.keys(currentBanners);
        const oldIndex = bannerKeys.indexOf(key);
        if (newIndex >= 0 && newIndex < bannerKeys.length) {
            const reordered = {};
            bannerKeys.filter(k => k !== key).forEach((k, i) => reordered[`banner_${i < oldIndex && i >= newIndex ? i : i + 1}`] = currentBanners[k]);
            reordered[`banner_${newIndex}`] = currentBanners[key];
            update(ref(database, 'banners'), reordered).then(() => showNotification('Банер переміщено', 'success'));
        }
    }, { onlyOnce: true });
};

document.getElementById('addBanner')?.addEventListener('click', () => {
    const url = document.getElementById('bannerUrl')?.value || '';
    if (url) push(ref(database, 'banners'), { url }).then(() => {
        document.getElementById('bannerUrl').value = '';
        showNotification('Банер додано', 'success');
    }).catch(error => showNotification('Помилка додавання банера: ' + error.message, 'error'));
    else showNotification('Введіть URL банера', 'warning');
});

function updateSubcategoryOptions() {
    const category = document.getElementById('productCategory')?.value || 'beds';
    const subcategorySelect = document.getElementById('productSubcategory');
    const subSubcategorySelect = document.getElementById('productSubSubcategory');
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
        discountPrices: sizes.reduce((acc, s) => (s.discountPrice ? { ...acc, [s.size]: s.discountPrice } : acc), {})
    };
    push(ref(database, 'products'), productData)
        .then(() => {
            ['productName', 'productDescription', 'productPhoto', 'productSubcategory', 'productSubSubcategory'].forEach(id => {
                const el = document.getElementById(id);
                if (el) el.value = '';
            });
            ['productCategory'].forEach(id => {
                const el = document.getElementById(id);
                if (el) el.value = 'beds';
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
            document.getElementById('sizes').innerHTML = '<div class="size-row"><input type="text" class="size-input" placeholder="Розмір"><input type="number" class="price-input" placeholder="Ціна"><input type="number" class="discount-price-input" placeholder="Акційна ціна (опціонально)"><button class="remove-size"><i class="material-icons">delete</i></button></div>';
            document.getElementById('productSubSubcategory').style.display = 'none';
            showNotification('Товар додано успішно', 'success');
            renderAdminProducts('all', '');
        })
        .catch(error => showNotification('Помилка додавання товару: ' + error.message, 'error'));
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
        if (sizeRow && document.querySelectorAll('#sizes .size-row').length > 1) {
            sizeRow.remove();
            showNotification('Розмір видалено', 'success');
        } else showNotification('Має бути принаймні один розмір', 'warning');
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
    const allProducts = Object.entries(products).flatMap(([key, prod]) => ({ key, ...prod })).concat(
        Object.keys(products).filter(key => !Object.values(products[key]).length).map(key => ({ key, ...products[key] }))
    );
    const filteredProducts = allProducts.filter(product =>
        (category === 'all' || product.category === category) &&
        (!search || product.name.toLowerCase().includes(search.toLowerCase()))
    );
    if (!filteredProducts.length) {
        productList.innerHTML = '<p>Немає товарів. Додайте товар через форму.</p>';
        return;
    }
    filteredProducts.forEach(product => {
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
        productList.appendChild(productDiv);
    });
}



window.removeProduct = key => remove(ref(database, 'products/' + key)).then(() => showNotification('Товар видалено', 'success'));

window.editProduct = key => {
    const product = products[key];
    if (!product) {
        showNotification('Товар не знайдено', 'error');
        return;
    }
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
            editModal.style.display = 'none';
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
            showNotification('Акцію додано', 'success');
        });
    } else showNotification('Введіть коректну назву акції', 'error');
});

onValue(ref(database, 'promos'), (snapshot) => {
    promos = snapshot.val() || {};
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

function applyPromos() {
    document.querySelectorAll('.product').forEach(product => {
        const name = product.querySelector('h3')?.textContent;
        if (!name) return;
        const productEntry = Object.entries(products).flatMap(([cat, prods]) => 
            Object.entries(prods || {}).map(([key, prod]) => ({ key, ...prod }))
        ).find(p => p.name === name);
        if (!productEntry) return;
        const discountPrices = productEntry.onSale && productEntry.discountPrices ? productEntry.discountPrices : {};
        const priceSpan = product.querySelector('span[id^="price_"]');
        const sizeSelect = product.querySelector('.size-select');
        const selectedSize = sizeSelect ? sizeSelect.value : products[productKey].sizes[0].size;
        if (priceSpan) {
            const salePrice = discountPrices[selectedSize] || products[productKey].sizes.find(s => s.size === selectedSize)?.price || '';
            priceSpan.textContent = salePrice;
            const priceContainer = priceSpan.parentElement;
            const originalPriceElement = priceContainer.querySelector(`del[id="original_price_${productKey}"]`);
            const originalPrice = products[productKey].sizes.find(s => s.size === selectedSize)?.price || '';
            if (discountPrices[selectedSize] && !originalPriceElement) {
                priceSpan.insertAdjacentHTML('afterend', `<del id="original_price_${productKey}">${originalPrice} грн</del>`);
            } else if (!discountPrices[selectedSize] && originalPriceElement) {
                originalPriceElement.remove();
            } else if (originalPriceElement) {
                originalPriceElement.textContent = `${originalPrice} грн`;
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

let productsLoaded = false;
let promosLoaded = false;

function tryRenderContent() {
    if (productsLoaded && promosLoaded) {
        renderContent(currentFilters);
    }
}

onValue(ref(database, 'products'), (snapshot) => {
    products = snapshot.val() || {};
    renderContent(currentFilters); 
});

onValue(ref(database, 'promos'), (snapshot) => {
    promos = snapshot.val() || {};
    promosLoaded = true;
    tryRenderContent();
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
            showNotification('Колір додано', 'success');
        });
    } else showNotification('Колір уже існує або поле порожнє', 'error');
});

document.getElementById('addMaterial')?.addEventListener('click', () => {
    const materialInput = document.getElementById('materialInput')?.value.trim() || '';
    if (materialInput && !materials.includes(materialInput)) {
        push(ref(database, 'materials'), materialInput).then(() => {
            document.getElementById('materialInput').value = '';
            showNotification('Матеріал додано', 'success');
        });
    } else showNotification('Матеріал уже існує або поле порожнє', 'error');
});

document.getElementById('productCategory')?.addEventListener('change', updateSubcategoryOptions);
document.getElementById('editProductCategory')?.addEventListener('change', updateEditSubcategoryOptions);
document.getElementById('editOnSale')?.addEventListener('change', toggleDiscountInput);

window.updatePrice = updatePrice;
window.removeFromCart = removeFromCart;
window.updateCartSize = updateCartSize;

document.addEventListener('DOMContentLoaded', () => {
    const searchBars = document.querySelectorAll('.searchBar');

    searchBars.forEach(searchBar => {
        const handleSearch = () => {
            const query = searchBar.value.trim();
            currentFilters.search = query ? query.toLowerCase() : null;

            if (!window.location.pathname.includes('room.html')) {
                if (query) {
                    window.location.href = `room.html?search=${query}`; 
                }
            } else {
                const url = new URL(window.location);
                if (query) {
                    url.searchParams.set('search', query); 
                } else {
                    url.searchParams.delete('search');
                }
                window.history.pushState({}, '', url);
                renderContent(currentFilters);
            }
        };

        searchBar.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                handleSearch();
            }
        });

        searchBar.addEventListener('input', () => {
            const query = searchBar.value.trim();
            currentFilters.search = query ? query.toLowerCase() : null;
            if (window.location.pathname.includes('room.html')) {
                const url = new URL(window.location);
                if (query) {
                    url.searchParams.set('search', query); 
                } else {
                    url.searchParams.delete('search');
                }
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
                    if (query) {
                        window.location.href = `room.html?search=${query}`; 
                    }
                } else {
                    const url = new URL(window.location);
                    if (query) {
                        url.searchParams.set('search', query); 
                    } else {
                        url.searchParams.delete('search');
                    }
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
            searchBars.forEach(searchBar => {
                searchBar.value = searchQuery || '';
            });
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







document.getElementById('addPhotoBtn')?.addEventListener('click', () => {
    const input = document.createElement('input');
    input.type = 'text'; input.className = 'productPhotoInput'; input.placeholder = 'URL фото';
    document.getElementById('photosContainer').appendChild(input);
});

document.getElementById('addEditPhotoBtn')?.addEventListener('click', () => {
    const input = document.createElement('input');
    input.type = 'text'; input.className = 'productPhotoInput'; input.placeholder = 'URL фото';
    document.getElementById('editPhotosContainer').appendChild(input);
});



