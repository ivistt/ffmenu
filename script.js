/* ══════════════════════════════════════════
   РЕСТОРАН ОГОНЬ — script.js
   Дані меню зберігаються в menu.json
══════════════════════════════════════════ */

// ══════════════════════════════
//  STATE
// ══════════════════════════════
let menuData    = [];
let order       = [];
let openCats    = {};
let activeTabId = null;

// ══════════════════════════════
//  BOOTSTRAP — завантажити JSON
// ══════════════════════════════
async function init() {
  try {
    const res = await fetch('menu.json');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    menuData = await res.json();
  } catch (err) {
    console.error('Не вдалося завантажити menu.json:', err);
    document.getElementById('menuContent').innerHTML =
      '<div class="no-results">⚠️ Не вдалося завантажити меню. Відкрийте файл через веб-сервер (не file://).</div>';
    return;
  }

  menuData.forEach(c => openCats[c.id] = true);
  activeTabId = menuData[0]?.id || null;

  renderMenu();
  renderOrder();
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

// Mobile bottom nav page switch (syncs both navs)
function mobileShowPage(pageId, btn) {
  // Switch page
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById('page-' + pageId).classList.add('active');
  // Update mobile nav buttons
  document.querySelectorAll('.mobile-nav-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  // Sync desktop nav buttons too
  document.querySelectorAll('.nav-btn').forEach(b => {
    b.classList.toggle('active',
      (pageId === 'menu'  && b.textContent.includes('Меню')) ||
      (pageId === 'about' && b.textContent.includes('Про нас'))
    );
  });
  // Close order panel if open
  document.getElementById('orderPanel').classList.remove('open');
  // Scroll to top
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ══════════════════════════════
//  CATEGORY TABS
// ══════════════════════════════
function renderTabs(visibleCats) {
  const el = document.getElementById('catTabs');
  if (!el) return;
  el.innerHTML = visibleCats.map(cat => `
    <div class="cat-tab ${activeTabId === cat.id ? 'active' : ''}"
         onclick="jumpToCat('${cat.id}')">
      ${cat.name}
    </div>
  `).join('');
}

function jumpToCat(catId) {
  activeTabId = catId;

  // Відкрити категорію, якщо згорнута
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

  // Оновити активний таб
  const q = document.getElementById('searchInput').value.toLowerCase().trim();
  const visible = menuData.filter(cat =>
    !q || cat.dishes.some(d =>
      d.name.toLowerCase().includes(q) ||
      (d.description && d.description.toLowerCase().includes(q)) ||
      (d.composition && d.composition.toLowerCase().includes(q))
    )
  );
  renderTabs(visible);

  // Скролл до секції з урахуванням sticky header + sticky tabs
  isJumping = true;
  setTimeout(() => {
    const el = document.getElementById('cat-' + catId);
    if (el) {
      const y = el.getBoundingClientRect().top + window.scrollY - 64 - 52 - 8;
      window.scrollTo({ top: y, behavior: 'smooth' });
    }
    // Знімаємо блокировку після завершення анімації скролу
    setTimeout(() => { isJumping = false; }, 600);
  }, 50);
}

// ══════════════════════════════
//  RENDER MENU
// ══════════════════════════════
function renderMenu() {
  const q = document.getElementById('searchInput').value.toLowerCase().trim();
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
          <div class="cat-chevron ${isOpen ? 'open' : ''}">▾</div>
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

  // Запускаємо scroll spy після побудови DOM
  requestAnimationFrame(() => initScrollSpy());
}

function renderDish(dish) {
  const inOrder = order.some(o => o.id === dish.id);
  return `
    <div class="dish-card">
      <div class="dish-img-wrap">
        ${dish.image
          ? `<img src="${dish.image}" alt="${dish.name}" loading="lazy" onerror="this.parentElement.innerHTML='<div class=dish-img-empty>🍽</div>'">`
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
    const dish = menuData.flatMap(c => c.dishes).find(d => d.id === dishId);
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
  // Reset all buttons at once without full re-render
  document.querySelectorAll('.add-btn.added').forEach(btn => {
    btn.classList.remove('added');
    btn.textContent = '+ Додати';
    btn.title = 'Додати до замовлення';
  });
  renderOrder();
}

// Оновлює лише кнопку конкретного блюда — без перерендеру всього меню
function updateDishButton(dishId) {
  const inOrder = order.some(o => o.id === dishId);
  // Знаходимо кнопку по атрибуту onclick
  const btn = document.querySelector(`.add-btn[onclick="addToOrder('${dishId}')"]`);
  if (!btn) return;
  btn.classList.toggle('added', inOrder);
  btn.textContent = inOrder ? '✓ Додано' : '+ Додати';
  btn.title = inOrder ? 'Прибрати' : 'Додати до замовлення';
}

function renderOrder() {
  const badge        = document.getElementById('orderBadge');
  const mobileBadge  = document.getElementById('fabOrderBadge');
  const itemsEl      = document.getElementById('orderItems');
  const footer       = document.getElementById('orderFooter');
  const subtitle     = document.getElementById('orderSubtitle');

  badge.textContent = order.length;

  // Mobile badge
  if (mobileBadge) {
    if (order.length > 0) {
      mobileBadge.textContent = order.length;
      mobileBadge.classList.remove('hidden');
    } else {
      mobileBadge.classList.add('hidden');
    }
  }

  if (order.length === 0) {
    itemsEl.innerHTML = `
      <div class="order-empty">
        <div class="order-empty-icon">🍽️</div>
        <p>Оберіть страви<br>з меню</p>
      </div>`;
    footer.style.display = 'none';
    subtitle.textContent = 'Порожньо';
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
    document.getElementById('totalPrice').textContent = total;
    footer.style.display = 'block';
  }
}

// ══════════════════════════════
//  HELPERS
// ══════════════════════════════
function plural(n, one, few, many) {
  if (n % 10 === 1 && n % 100 !== 11) return one;
  if (n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20)) return few;
  return many;
}

function toggleOrder() {
  // If on "about" page — switch to menu page first (order panel lives there)
  const menuPage = document.getElementById('page-menu');
  if (!menuPage.classList.contains('active')) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    menuPage.classList.add('active');
    // Sync desktop nav
    document.querySelectorAll('.nav-btn').forEach(b => {
      b.classList.toggle('active', b.textContent.includes('Меню'));
    });
    // Sync drawer nav
    document.querySelectorAll('.drawer-page-btn').forEach(b => b.classList.remove('active'));
    const dm = document.getElementById('drawerMenuBtn');
    if (dm) dm.classList.add('active');
  }
  document.getElementById('orderPanel').classList.toggle('open');
}

// ══════════════════════════════
//  SCROLL SPY
// ══════════════════════════════
let scrollSpyObserver = null;
let isJumping = false; // блокуємо spy під час програмного скролу

function initScrollSpy() {
  if (scrollSpyObserver) scrollSpyObserver.disconnect();

  // Висота sticky header + sticky tabs ≈ 64 + 52 = 116px
  const OFFSET = 116;

  scrollSpyObserver = new IntersectionObserver((entries) => {
    if (isJumping) return;

    // Знаходимо секцію, яка найближча до верху вьюпорту
    let best = null;
    let bestTop = Infinity;

    document.querySelectorAll('.cat-section').forEach(el => {
      const rect = el.getBoundingClientRect();
      // Секція вважається "активною", якщо її верхній край вище середини екрану
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

function updateActiveTab(catId) {
  // Оновлюємо клас активного табу без повного перерендерингу
  document.querySelectorAll('.cat-tab').forEach(tab => {
    const isActive = tab.getAttribute('onclick')?.includes(`'${catId}'`);
    tab.classList.toggle('active', isActive);
  });

  // Скролимо таб-рядок так, щоб активний таб був видимий
  const activeTab = document.querySelector(`.cat-tab.active`);
  if (activeTab) {
    activeTab.scrollIntoView({ inline: 'nearest', block: 'nearest' });
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
  // Switch pages
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById('page-' + pageId).classList.add('active');
  // Sync desktop nav buttons
  document.querySelectorAll('.nav-btn').forEach(b => {
    b.classList.toggle('active',
      (pageId === 'menu'  && b.textContent.includes('Меню')) ||
      (pageId === 'about' && b.textContent.includes('Про нас'))
    );
  });
  // Update drawer nav buttons
  document.querySelectorAll('.drawer-page-btn').forEach(b => b.classList.remove('active'));
  const activeBtn = document.getElementById(pageId === 'menu' ? 'drawerMenuBtn' : 'drawerAboutBtn');
  if (activeBtn) activeBtn.classList.add('active');
  closeDrawer();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}


// ══════════════════════════════
//  START
// ══════════════════════════════
init();
