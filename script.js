/* ══════════════════════════════════════════
   РЕСТОРАН ОГОНЬ — script.js
   Дані меню завантажуються з Google Sheets через Apps Script

   НАЛАШТУВАННЯ:
   1. Завантажте menu_google_sheets.xlsx у Google Sheets
   2. Розширення → Apps Script → вставте код з appscript.js
   3. Деплой → Новий деплой → Web App (доступ: Усі)
   4. Скопіюйте URL деплою і вставте нижче
══════════════════════════════════════════ */

const MENU_URL = './menu.json';

/* ══════════════════════════════
   TELEGRAM CONFIG
   Вставте свій Bot Token і Chat ID нижче
══════════════════════════════ */
const TG_BOT_TOKEN = '8377287560:AAHn4_GmkzUiFJvcifhnwgRJm0ye04L5KhE';  // напр. '7123456789:AAFxxx...'
const TG_CHAT_ID   = '-1003850549188';    // напр. '-1001234567890'

/* ══════════════════════════════
   TABLE NUMBER — зчитується з URL
   Підтримує: ?table=12  або  ?=table12  або  #table12
══════════════════════════════ */
function getTableNumber() {
  const search = window.location.search;   // ?=table12  або  ?table=12
  const hash   = window.location.hash;     // #table12

  // ?table=12
  const paramMatch = search.match(/[?&]table=([^&]+)/i);
  if (paramMatch) return decodeURIComponent(paramMatch[1]);

  // ?=table12
  const eqMatch = search.match(/[?&]=([^&]+)/i);
  if (eqMatch) return decodeURIComponent(eqMatch[1]);

  // #table12
  if (hash && hash.length > 1) return decodeURIComponent(hash.slice(1));

  return null;
}

const TABLE_NUMBER = getTableNumber();

/* ══════════════════════════════
   BANNERS
   Додайте/відредагуйте банери тут.
   image: URL картинки (або '' для кольорового фону)
   label: маленький підпис зверху
   title: великий заголовок
   sub: підзаголовок
   bg: CSS градієнт/колір якщо немає картинки
══════════════════════════════ */
const BANNERS = [
  {
    image: 'images/banners/banner1.png',
    bg: 'linear-gradient(135deg, #1a0a00 0%, #6b2a00 100%)',
    label: '🔥 Хіт сезону',
    title: 'М\'ясо з тандиру',
    sub: 'Соковите, з димком — щодня з 12:00',
  },
  {
    image: 'images/banners/banner2.png',
    bg: 'linear-gradient(135deg, #001a0f 0%, #005c30 100%)',
    label: '🍣 Новинка',
    title: 'Суші-сет «Огонь»',
    sub: '24 ролли + місо-суп у подарунок',
  },
  {
    image: 'images/banners/banner3.png',
    bg: 'linear-gradient(135deg, #0d0a1a 0%, #3a1a6b 100%)',
    label: '🥂 Банкети',
    title: 'Святкуйте з нами',
    sub: 'Організуємо будь-яке свято — від 20 осіб',
  },
];
// Приклад: 'https://script.google.com/macros/s/AKfycbyfb4nDNfrYMl9NZ90TfkYYehM75XRbp7uj6QpE34qUX3Fo6-JGKRVTWKRTqhk6iVeW/exec'

// ══════════════════════════════
//  STATE
// ══════════════════════════════
let menuData    = [];
let order       = [];
let openCats    = {};
let activeTabId = null;

// ══════════════════════════════
//  BANNER SWIPER
// ══════════════════════════════
function initBannerSwiper() {
  const wrap = document.getElementById('bannerSlides');
  if (!wrap) return;

  wrap.innerHTML = BANNERS.map(b => `
    <div class="swiper-slide">
      <div class="banner-slide" style="${b.image ? `background-image:url('${b.image}');background-size:cover;background-position:center;` : `background:${b.bg};`}">
        <div class="banner-slide-inner">
          ${b.label ? `<div class="banner-label">${b.label}</div>` : ''}
          <div class="banner-title">${b.title}</div>
          ${b.sub ? `<div class="banner-sub">${b.sub}</div>` : ''}
        </div>
      </div>
    </div>
  `).join('');

  new Swiper('.banner-swiper', {
    loop: true,
    autoplay: { delay: 4500, disableOnInteraction: false },
    grabCursor: true,
    speed: 600,
    effect: 'slide',
  });
}

// ══════════════════════════════
//  DISH LOOKUP MAP  (O(1) пошук)
// ══════════════════════════════
let dishMap = new Map();

function buildDishMap() {
  dishMap = new Map();
  menuData.forEach(cat => cat.dishes.forEach(d => dishMap.set(d.id, d)));
}

// ══════════════════════════════
//  BOOTSTRAP
// ══════════════════════════════
const CACHE_KEY     = 'ogon_menu_v1';
const CACHE_TIME_KEY= 'ogon_menu_time_v1';
const CACHE_TTL     = 10 * 60 * 1000; // 10 хвилин

async function init() {
  initBannerSwiper();

  // Показуємо кешоване меню миттєво
  try {
    const cached   = localStorage.getItem(CACHE_KEY);
    const cacheAge = Date.now() - Number(localStorage.getItem(CACHE_TIME_KEY) || 0);
    if (cached && cacheAge < CACHE_TTL) {
      menuData = JSON.parse(cached);
      buildAndRender();
      fetchMenu(/* silent */ true); // оновити в фоні
      return;
    }
  } catch (_) {}

  showMenuSkeleton();
  await fetchMenu(false);
}

async function fetchMenu(silent) {
  try {
    const res = await fetch(MENU_URL);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (!Array.isArray(data) || !data.length) throw new Error('Порожнє меню');

    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(data));
      localStorage.setItem(CACHE_TIME_KEY, String(Date.now()));
    } catch (_) {}

    if (silent) {
      // Тихе оновлення — перемальовуємо тільки якщо дані змінились
      if (JSON.stringify(data) !== JSON.stringify(menuData)) {
        menuData = data;
        buildAndRender();
      }
    } else {
      menuData = data;
      buildAndRender();
    }
  } catch (err) {
    console.error('Не вдалося завантажити меню:', err);
    if (!silent) {
      document.getElementById('menuContent').innerHTML = `
        <div class="no-results">
          ⚠️ Не вдалося завантажити меню.<br>
          <small style="color:#aaa">${err.message}</small>
        </div>`;
      hideLoader();
    }
  }
}

function buildAndRender() {
  // Категорія "Рекомендації"
  const recommended = menuData
    .flatMap(c => c.dishes)
    .filter(d => d.extras && d.extras.some(e => e.toLowerCase() === 'рекомендуємо'));

  const base = menuData.filter(c => c.id !== '__recommended__');
  menuData = recommended.length
    ? [{ id: '__recommended__', name: 'Рекомендації', dishes: recommended }, ...base]
    : base;

  menuData.forEach(c => { if (openCats[c.id] === undefined) openCats[c.id] = true; });
  activeTabId = menuData[0]?.id || null;

  buildDishMap();
  renderMenu();
  renderOrder();
}

function showMenuSkeleton() {
  document.getElementById('menuContent').innerHTML = `
    <div style="padding:32px;text-align:center;color:#888">
      <div style="font-size:32px;margin-bottom:12px">⏳</div>
      Завантаження меню…
    </div>`;
}

// ══════════════════════════════
//  PAGE SWITCH
// ══════════════════════════════
function showPage(pageId, btn) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById('page-' + pageId).classList.add('active');
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
}

function mobileShowPage(pageId, btn) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById('page-' + pageId).classList.add('active');
  document.querySelectorAll('.mobile-nav-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  document.querySelectorAll('.nav-btn').forEach(b => {
    b.classList.toggle('active',
      (pageId === 'menu'  && b.textContent.includes('Меню')) ||
      (pageId === 'about' && b.textContent.includes('Про нас'))
    );
  });
  document.getElementById('orderPanel').classList.remove('open');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ══════════════════════════════
//  CATEGORY TABS
// ══════════════════════════════
let catTabsSwiper = null;

function renderTabs(visibleCats) {
  const el = document.getElementById('catTabs');
  if (!el) return;

  const spacer = `<div class="swiper-slide cat-tab-spacer" style="width:12px!important;padding:0;background:none;border:none;pointer-events:none;margin-right:0!important;"></div>`;

  el.innerHTML = spacer + visibleCats.map(cat => `
    <div class="swiper-slide cat-tab ${activeTabId === cat.id ? 'active' : ''}"
         data-cat-id="${cat.id}"
         onclick="jumpToCat('${cat.id}')">
      ${cat.name}
    </div>
  `).join('') + spacer;

  if (!catTabsSwiper) {
    catTabsSwiper = new Swiper('.cat-tabs-swiper', {
      slidesPerView: 'auto',
      spaceBetween: 7,
      freeMode: {
        enabled: true,
        momentum: true,
        momentumRatio: 0.6,
        momentumVelocityRatio: 0.6,
      },
      mousewheel: { forceToAxis: true },
      grabCursor: true,
      cssMode: false,
    });
  } else {
    catTabsSwiper.update();
  }
}

function jumpToCat(catId) {
  activeTabId = catId;

  if (!openCats[catId]) {
    openCats[catId] = true;
    const body = document.getElementById('body-' + catId);
    if (body) {
      const cat = menuData.find(c => c.id === catId);
      body.classList.remove('collapsed');
      body.style.maxHeight = cat.dishes.length * 500 + 'px';
      const chevron = body.previousElementSibling.querySelector('.cat-chevron');
      if (chevron) chevron.classList.add('open');
    }
  }

  // Просто оновлюємо active-клас без пересоздання DOM
  document.querySelectorAll('#catTabs .cat-tab').forEach(el => {
    el.classList.toggle('active', el.dataset.catId === catId);
  });

  isJumping = true;
  // При програмному скролі до категорії — показуємо хедер назад
  document.body.classList.remove('scrolled-down');
  setTimeout(() => {
    const el = document.getElementById('cat-' + catId);
    if (el) {
      // Динамічно рахуємо висоту sticky-зони (header + search-tabs-sticky)
      const stickyEl = document.querySelector('.search-tabs-sticky');
      const headerEl = document.querySelector('header');
      const stickyH  = (headerEl ? headerEl.offsetHeight : 64) +
                       (stickyEl ? stickyEl.offsetHeight : 52);
      const MARGIN   = 12;
      const y = el.getBoundingClientRect().top + window.scrollY - stickyH - MARGIN;
      window.scrollTo({ top: y, behavior: 'smooth' });
    }
    setTimeout(() => { isJumping = false; }, 700);
  }, 50);
}

// ══════════════════════════════
//  RENDER MENU
// ══════════════════════════════
function renderMenu() {
  const q = '';
  const content = document.getElementById('menuContent');
  let html = '';
  let anyResult = false;
  const visibleCats = [];

  menuData.forEach(cat => {
    const dishes = q
      ? cat.dishes.filter(d =>
          d.name.toLowerCase().includes(q) ||
          (d.description && d.description.toLowerCase().includes(q)) ||
          (d.composition && d.composition.toLowerCase().includes(q))
        )
      : cat.dishes;

    if (!dishes.length) return;
    anyResult = true;
    visibleCats.push(cat);

    const isOpen = openCats[cat.id];

    html += `
      <div class="cat-section" id="cat-${cat.id}">
        <div class="cat-header" onclick="toggleCat('${cat.id}')">
          <div class="cat-header-left">
            <div class="cat-title">${cat.name}</div>
            <div class="cat-count">${dishes.length}</div>
          </div>
        </div>
        <div class="cat-body ${isOpen ? '' : 'collapsed'}"
             id="body-${cat.id}"
             style="max-height: ${isOpen ? dishes.length * 500 + 'px' : '0'}">
          <div class="dishes-grid">
            ${dishes.map(d => renderDish(d)).join('')}
          </div>
        </div>
      </div>`;
  });

  if (!anyResult) {
    html = `<div class="no-results">😕 Нічого не знайдено за запитом «${q}»</div>`;
  }

  content.innerHTML = html;
  renderTabs(visibleCats);

  requestAnimationFrame(() => {
    reobserveScrollSpy();
    hideLoader();
  });
}

function hideLoader() {
  const loader = document.getElementById('siteLoader');
  if (loader && !loader.classList.contains('hidden')) {
    loader.classList.add('hidden');
  }
}

function renderDish(dish) {
  const inOrder = order.some(o => o.id === dish.id);
  return `
    <div class="dish-card">
      <div class="dish-img-wrap">
        ${dish.image_url || dish.image
            ? `<img src="${dish.image_url || dish.image}" alt="${dish.name}" loading="lazy" onerror="this.parentElement.innerHTML='<div class=dish-img-empty>🍽</div>'">`
            : '<div class="dish-img-empty">🍽</div>'}
        ${dish.extras && dish.extras.length
          ? `<div class="dish-badges">${dish.extras.map(e => `<span class="dish-badge">⚡ ${e}</span>`).join('')}</div>`
          : ''}
      </div>
      <div class="dish-body">
        <div class="dish-name">${dish.name}</div>
        ${dish.description ? `<div class="dish-desc">${dish.description}</div>` : ''}
        ${dish.composition ? `<div class="dish-composition">${dish.composition}</div>` : ''}
        <div class="dish-footer">
          <div class="dish-meta">
            <div class="dish-price">${dish.price} ₴</div>
            ${dish.weight ? `<div class="dish-weight">⚖ ${dish.weight}</div>` : ''}
          </div>
          <button
            data-dish-id="${dish.id}"
            class="add-btn ${inOrder ? 'added' : ''}"
            onclick="addToOrder('${dish.id}')"
            title="${inOrder ? 'Прибрати' : 'Додати до замовлення'}">
            ${inOrder ? '✓ Додано' : '+ Додати'}
          </button>
        </div>
      </div>
    </div>`;
}

// ══════════════════════════════
//  TOGGLE CATEGORY
// ══════════════════════════════
function toggleCat(catId) {
  openCats[catId] = !openCats[catId];
  const body    = document.getElementById('body-' + catId);
  const chevron = body.previousElementSibling.querySelector('.cat-chevron');
  const cat     = menuData.find(c => c.id === catId);

  if (openCats[catId]) {
    body.classList.remove('collapsed');
    body.style.maxHeight = cat.dishes.length * 500 + 'px';
    chevron.classList.add('open');
  } else {
    body.classList.add('collapsed');
    body.style.maxHeight = '0';
    chevron.classList.remove('open');
  }
}

// ══════════════════════════════
//  ORDER
// ══════════════════════════════
function addToOrder(dishId) {
  if (order.some(o => o.id === dishId)) {
    order = order.filter(o => o.id !== dishId);
  } else {
    const dish = dishMap.get(dishId);
    if (dish) order.push({ id: dish.id, name: dish.name, price: dish.price });
  }
  updateDishButton(dishId);
  renderOrder();
}

function removeFromOrder(dishId) {
  order = order.filter(o => o.id !== dishId);
  updateDishButton(dishId);
  renderOrder();
}

function clearOrder() {
  order = [];
  document.querySelectorAll('.add-btn.added').forEach(btn => {
    btn.classList.remove('added');
    btn.textContent = '+ Додати';
    btn.title = 'Додати до замовлення';
  });
  renderOrder();
}

function updateDishButton(dishId) {
  const inOrder = order.some(o => o.id === dishId);
  document.querySelectorAll(`[data-dish-id="${dishId}"]`).forEach(btn => {
    btn.classList.toggle('added', inOrder);
    btn.textContent = inOrder ? '✓ Додано' : '+ Додати';
    btn.title = inOrder ? 'Прибрати' : 'Додати до замовлення';
  });
}

function renderOrder() {
  const badge     = document.getElementById('orderBadge');
  const itemsEl   = document.getElementById('orderItems');
  const subtitle  = document.getElementById('orderSubtitle');
  const cartBar   = document.getElementById('mobileCartBar');
  const cartCount = document.getElementById('mobileCartCount');
  const cartPrice = document.getElementById('mobileCartPrice');

  badge.textContent = order.length;

  if (order.length === 0) {
    itemsEl.innerHTML = `
      <div class="order-empty">
        <div class="order-empty-icon">🍽️</div>
        <p>Оберіть страви<br>з меню</p>
      </div>`;
    subtitle.textContent = 'Порожньо';
    if (cartBar) cartBar.classList.remove('visible');
    const panel   = document.getElementById('orderPanel');
    const overlay = document.getElementById('orderOverlay');
    if (panel)   panel.classList.remove('open');
    if (overlay) overlay.classList.remove('open');
  } else {
    const total = order.reduce((s, o) => s + o.price, 0);
    subtitle.textContent = `${order.length} ${plural(order.length, 'страва', 'страви', 'страв')}`;
    itemsEl.innerHTML = order.map(item => `
      <div class="order-item">
        <div class="order-item-info">
          <div class="order-item-name">${item.name}</div>
          <div class="order-item-price">${item.price} ₴</div>
        </div>
        <button class="remove-item-btn"
                onclick="removeFromOrder('${item.id}')"
                title="Видалити">✕</button>
      </div>`).join('');

    if (cartBar) {
      const countText = `${order.length} ${plural(order.length, 'позиція', 'позиції', 'позицій')}`;
      if (cartCount) cartCount.textContent = countText;
      if (cartPrice) cartPrice.textContent = `${total} ₴`;
      cartBar.classList.add('visible');
    }
  }

  // Кнопки Telegram
  renderTgButtons();
  updateOrderButtons();
}

function renderTgButtons() {
  if (document.getElementById('tgSendOrderBtn')) return;

  const panel = document.getElementById('orderPanel');
  if (!panel) return;

  const wrap = document.createElement('div');
  wrap.className = 'tg-actions';
  wrap.id = 'tgActions';
  wrap.innerHTML = `
    <div class="tg-table-label">
      ${TABLE_NUMBER
        ? `📍 <span>Стіл <b>${TABLE_NUMBER}</b></span>`
        : `📍 <span style="color:var(--text3)">Стіл не визначено</span>`}
    </div>
    <button id="tgSendOrderBtn" class="tg-btn tg-btn-primary tg-btn-disabled" onclick="sendOrder()" disabled>
      <span class="tg-btn-icon">📨</span>
      <span class="tg-btn-label">Відправити замовлення</span>
    </button>
    <button id="tgCallWaiterBtn" class="tg-btn tg-btn-secondary" onclick="callWaiter()">
      <span class="tg-btn-icon">🔔</span>
      <span class="tg-btn-label">Викликати офіціанта</span>
    </button>
  `;
  panel.appendChild(wrap);
}

// ══════════════════════════════
//  HELPERS
// ══════════════════════════════
function scrollToTop() {
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function plural(n, one, few, many) {
  if (n % 10 === 1 && n % 100 !== 11) return one;
  if (n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20)) return few;
  return many;
}

function toggleOrder() {
  const menuPage = document.getElementById('page-menu');
  if (!menuPage.classList.contains('active')) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    menuPage.classList.add('active');
    document.querySelectorAll('.nav-btn').forEach(b => {
      b.classList.toggle('active', b.textContent.includes('Меню'));
    });
    document.querySelectorAll('.drawer-page-btn').forEach(b => b.classList.remove('active'));
    const dm = document.getElementById('drawerMenuBtn');
    if (dm) dm.classList.add('active');
  }
  const panel   = document.getElementById('orderPanel');
  const overlay = document.getElementById('orderOverlay');
  const isOpen  = panel.classList.toggle('open');
  if (overlay) overlay.classList.toggle('open', isOpen);
  updateCartBarPanelState(isOpen);
}

function closeOrderPanel() {
  const panel   = document.getElementById('orderPanel');
  const overlay = document.getElementById('orderOverlay');
  panel.classList.remove('open');
  if (overlay) overlay.classList.remove('open');
  updateCartBarPanelState(false);
}

function updateCartBarPanelState(isOpen) {
  const defaultBtn = document.querySelector('.cart-bar-default-btn');
  const panelBtn   = document.querySelector('.cart-bar-panel-btn');
  const actionEl   = document.getElementById('mobileCartAction');
  const mainBtn    = document.getElementById('mobileCartMainBtn');

  if (isOpen) {
    // Panel is open: show waiter bell, change action to "Замовити" that sends order
    if (defaultBtn) defaultBtn.style.display = 'none';
    if (panelBtn)   panelBtn.style.display = 'flex';
    if (actionEl)   actionEl.textContent = 'Замовити';
    if (mainBtn) {
      mainBtn.onclick = function() { sendOrder(); };
    }
  } else {
    // Panel is closed: restore scroll-top, show "Подивитись"
    if (defaultBtn) defaultBtn.style.display = 'flex';
    if (panelBtn)   panelBtn.style.display = 'none';
    if (actionEl)   actionEl.textContent = 'Подивитись';
    if (mainBtn) {
      mainBtn.onclick = function() { toggleOrder(); };
    }
  }
}

// ══════════════════════════════
//  SCROLL SPY
// ══════════════════════════════
let scrollSpyObserver = null;
let isJumping = false;

function initScrollSpy() {
  if (scrollSpyObserver) scrollSpyObserver.disconnect();

  const OFFSET = 116;

  scrollSpyObserver = new IntersectionObserver((entries) => {
    if (isJumping) return;

    let best = null;
    let bestTop = Infinity;

    document.querySelectorAll('.cat-section').forEach(el => {
      const rect = el.getBoundingClientRect();
      const top = rect.top - OFFSET;
      if (top <= window.innerHeight * 0.5 && rect.bottom > OFFSET) {
        if (Math.abs(top) < bestTop) {
          bestTop = Math.abs(top);
          best = el;
        }
      }
    });

    if (best) {
      const catId = best.id.replace('cat-', '');
      if (catId !== activeTabId) {
        activeTabId = catId;
        updateActiveTab(catId);
      }
    }
  }, {
    threshold: [0, 0.1, 0.5],
    rootMargin: `-${OFFSET}px 0px -40% 0px`
  });

  document.querySelectorAll('.cat-section').forEach(el => {
    scrollSpyObserver.observe(el);
  });
}

function reobserveScrollSpy() {
  if (!scrollSpyObserver) { initScrollSpy(); return; }
  scrollSpyObserver.disconnect();
  document.querySelectorAll('.cat-section').forEach(el => scrollSpyObserver.observe(el));
}

function updateActiveTab(catId) {
  document.querySelectorAll('.cat-tab').forEach(tab => {
    const isActive = tab.getAttribute('onclick')?.includes(`'${catId}'`);
    tab.classList.toggle('active', isActive);
  });

  const activeTab = document.querySelector('.cat-tab.active');
  if (activeTab && catTabsSwiper) {
    const wrapperEl    = catTabsSwiper.wrapperEl;
    const wrapperWidth = catTabsSwiper.el.offsetWidth;
    const tabLeft      = activeTab.offsetLeft;
    const tabWidth     = activeTab.offsetWidth;

    // Ціль: центруємо активний таб у видимій зоні
    let targetTranslate = -(tabLeft - wrapperWidth / 2 + tabWidth / 2);

    // Не виходимо за межі
    const maxTranslate = 0;
    const minTranslate = wrapperWidth - wrapperEl.scrollWidth;
    targetTranslate = Math.min(maxTranslate, Math.max(minTranslate, targetTranslate));

    // Плавна CSS-анімація через transition на wrapperEl
    wrapperEl.style.transition = 'transform 0.35s cubic-bezier(0.25, 0.46, 0.45, 0.94)';
    catTabsSwiper.setTranslate(targetTranslate);
    catTabsSwiper.updateProgress();

    // Прибираємо transition після завершення, щоб не заважати свайпу
    setTimeout(() => {
      if (wrapperEl) wrapperEl.style.transition = '';
    }, 380);
  }
}

// ══════════════════════════════
//  BURGER DRAWER (mobile)
// ══════════════════════════════
function toggleDrawer() {
  const drawer  = document.getElementById('drawer');
  const overlay = document.getElementById('drawerOverlay');
  const isOpen  = drawer.classList.contains('open');
  if (isOpen) closeDrawer();
  else {
    drawer.classList.add('open');
    overlay.classList.add('open');
    document.body.style.overflow = 'hidden';
  }
}

function closeDrawer() {
  document.getElementById('drawer').classList.remove('open');
  document.getElementById('drawerOverlay').classList.remove('open');
  document.body.style.overflow = '';
}

function drawerGoPage(pageId) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById('page-' + pageId).classList.add('active');
  document.querySelectorAll('.nav-btn').forEach(b => {
    b.classList.toggle('active',
      (pageId === 'menu'  && b.textContent.includes('Меню')) ||
      (pageId === 'about' && b.textContent.includes('Про нас'))
    );
  });
  document.querySelectorAll('.drawer-page-btn').forEach(b => b.classList.remove('active'));
  const activeBtn = document.getElementById(pageId === 'menu' ? 'drawerMenuBtn' : 'drawerAboutBtn');
  if (activeBtn) activeBtn.classList.add('active');
  closeDrawer();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ══════════════════════════════
//  HIDE-ON-SCROLL (mobile)
// ══════════════════════════════
function initHideOnScroll() {
  let lastY      = window.scrollY;
  let ticking    = false;
  const THRESHOLD = 6;   // мін. дельта щоб спрацювало
  const SHOW_ZONE = 40;  // px від верху — завжди показуємо

  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      // Тільки мобільна ширина
      if (window.innerWidth > 768) {
        document.body.classList.remove('scrolled-down');
        lastY = window.scrollY;
        ticking = false;
        return;
      }

      const y     = window.scrollY;
      const delta = y - lastY;

      if (y <= SHOW_ZONE) {
        document.body.classList.remove('scrolled-down');
      } else if (delta > THRESHOLD) {
        // скролл вниз — ховаємо
        document.body.classList.add('scrolled-down');
      } else if (delta < -THRESHOLD) {
        // скролл вгору — показуємо
        document.body.classList.remove('scrolled-down');
      }

      lastY   = y;
      ticking = false;
    });
  }

  window.addEventListener('scroll', onScroll, { passive: true });
}

// ══════════════════════════════
//  TELEGRAM
// ══════════════════════════════
async function sendTelegramMessage(text) {
  const url = `https://api.telegram.org/bot${TG_BOT_TOKEN}/sendMessage`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: TG_CHAT_ID,
      text,
      parse_mode: 'HTML',
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.description || `HTTP ${res.status}`);
  }
  return res.json();
}

async function sendOrder() {
  if (!order.length) return;

  const tableLabel = TABLE_NUMBER ? `Стіл: <b>${TABLE_NUMBER}</b>` : 'Стіл: <b>невідомий</b>';
  const time = new Date().toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' });
  const total = order.reduce((s, o) => s + o.price, 0);

  const items = order.map((o, i) => `  ${i + 1}. ${o.name} — ${o.price} ₴`).join('\n');

  const text =
    `🍽 <b>НОВЕ ЗАМОВЛЕННЯ</b>\n` +
    `${tableLabel}\n` +
    `🕐 ${time}\n\n` +
    `${items}\n\n` +
    `💰 Сума: <b>${total} ₴</b>`;

  await sendWithFeedback('order', text);
}

async function callWaiter() {
  const tableLabel = TABLE_NUMBER ? TABLE_NUMBER : 'невідомий';
  const time = new Date().toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' });

  const text =
    `🔔 <b>ВИКЛИК ОФІЦІАНТА</b>\n` +
    `Стіл: <b>${tableLabel}</b>\n` +
    `🕐 ${time}`;

  await sendWithFeedback('waiter', text);
}

async function sendWithFeedback(type, text) {
  const btnOrder  = document.getElementById('tgSendOrderBtn');
  const btnWaiter = document.getElementById('tgCallWaiterBtn');

  // Блокуємо обидві кнопки під час запиту
  [btnOrder, btnWaiter].forEach(b => { if (b) { b.disabled = true; b.classList.add('tg-loading'); } });

  try {
    await sendTelegramMessage(text);
    showTgModal(
      type === 'order'
        ? `✅ Замовлення відправлено!\nОфіціант підійде найближчим часом.`
        : `🔔 Офіціанта викликано!\nЗачекайте, будь ласка.`
    );
  } catch (err) {
    showTgModal(`⚠️ Помилка відправки.\nСпробуйте ще раз або зверніться до офіціанта.\n\n${err.message}`);
  } finally {
    [btnOrder, btnWaiter].forEach(b => { if (b) { b.disabled = false; b.classList.remove('tg-loading'); } });
    updateOrderButtons();
  }
}

function updateOrderButtons() {
  const btn = document.getElementById('tgSendOrderBtn');
  if (!btn) return;
  btn.disabled = order.length === 0;
  btn.classList.toggle('tg-btn-disabled', order.length === 0);
}

// ══════════════════════════════
//  MODAL
// ══════════════════════════════
function showTgModal(message) {
  let modal = document.getElementById('tgModal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'tgModal';
    modal.className = 'tg-modal-overlay';
    modal.innerHTML = `
      <div class="tg-modal">
        <div class="tg-modal-text" id="tgModalText"></div>
        <button class="tg-modal-ok" onclick="closeTgModal()">OK</button>
      </div>`;
    document.body.appendChild(modal);
  }
  document.getElementById('tgModalText').innerText = message;
  modal.classList.add('open');
}

function closeTgModal() {
  const modal = document.getElementById('tgModal');
  if (modal) modal.classList.remove('open');
}

// ══════════════════════════════
//  START
// ══════════════════════════════
init();
initHideOnScroll();