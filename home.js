const HOME_MENU_URL = 'https://ffmenuregular.skifchaqwerty.workers.dev/menu';
const MENU_IMAGES = Array.from({ length: 26 }, (_, index) =>
  `./images/menu/${index + 1}.webp`
);
const SOCIAL_LINKS = {
  instagram: '',
  facebook: '',
  telegram: '',
  viber: '',
};
const CONTACT_LOCATIONS = {
  odesa: { query: 'Ресторан Огонь, Одеса, Фабрична, 1', title: 'Ресторан ОГОнь — Одеса' },
  dalnyk: { query: 'вулиця Маякська, 16в, Великий Дальник, Одеська область, 67668', title: 'Ресторан ОГОнь — Великий Дальник, вул. Маякська, 16в' },
};

const contactMapTabs = Array.from(document.querySelectorAll('[data-map-location]'));
function switchContactMap(locationId, focus = false) {
  const location = CONTACT_LOCATIONS[locationId];
  if (!location) return;
  const selected = contactMapTabs.find(tab => tab.dataset.mapLocation === locationId);
  const map = document.getElementById('contactsMap');
  if (selected.getAttribute('aria-selected') !== 'true') {
    const source = new URL('https://maps.google.com/maps');
    source.search = new URLSearchParams({ q: location.query, z: '16', output: 'embed', hl: 'uk' });
    map.src = source.href;
  }
  map.title = location.title;
  const route = new URL('https://www.google.com/maps/dir/');
  route.search = new URLSearchParams({ api: '1', destination: location.query });
  const routeLink = document.getElementById('contactsRoute');
  routeLink.href = route.href;
  routeLink.setAttribute('aria-label', `Прокласти маршрут: ${location.title}`);
  document.getElementById('contactsMapPanel').setAttribute('aria-labelledby', selected.id);
  contactMapTabs.forEach(tab => {
    const active = tab === selected;
    tab.classList.toggle('tab-active', active);
    tab.setAttribute('aria-selected', String(active));
    tab.tabIndex = active ? 0 : -1;
  });
  if (focus) selected.focus();
}
contactMapTabs.forEach((tab, index) => {
  tab.addEventListener('click', () => switchContactMap(tab.dataset.mapLocation));
  tab.addEventListener('keydown', event => {
    let target;
    if (event.key === 'ArrowRight') target = (index + 1) % contactMapTabs.length;
    else if (event.key === 'ArrowLeft') target = (index - 1 + contactMapTabs.length) % contactMapTabs.length;
    else if (event.key === 'Home') target = 0;
    else if (event.key === 'End') target = contactMapTabs.length - 1;
    else return;
    event.preventDefault();
    switchContactMap(contactMapTabs[target].dataset.mapLocation, true);
  });
});

document.querySelectorAll('[data-social]').forEach(link => {
  const href = SOCIAL_LINKS[link.dataset.social];
  if (!href) return;
  link.href = href;
  link.target = '_blank';
  link.rel = 'noopener';
  link.removeAttribute('aria-disabled');
  link.removeAttribute('tabindex');
});
const menuRail = document.getElementById('menuRail');
const recommendationsRail = document.getElementById('recommendationsRail');
const mobileSliders = new Map();
const aboutGallery = document.querySelector('.about-gallery');
const aboutGalleryTrack = aboutGallery.querySelector('.about-gallery-track');
const aboutGalleryPause = document.getElementById('aboutGalleryPause');
const galleryMotionPreference = matchMedia('(prefers-reduced-motion: reduce)');
let aboutGallerySlider = null;
let aboutGalleryPaused = false;
let aboutGalleryVisible = false;
const menuGalleryDialog = document.getElementById('menuGalleryDialog');
const menuGalleryImage = document.getElementById('menuGalleryImage');
const menuGalleryViewport = document.getElementById('menuGalleryViewport');
const menuGalleryZoom = document.getElementById('menuGalleryZoom');
const printMenuButton = document.getElementById('printMenuButton');
let menuImageIndex = 0;
let menuImageZoomed = false;

function setMenuZoom(zoomed) {
  menuImageZoomed = zoomed;
  menuGalleryViewport.classList.toggle('is-zoomed', zoomed);
  menuGalleryZoom.setAttribute('aria-pressed', String(zoomed));
  menuGalleryZoom.setAttribute('aria-label', zoomed ? 'Вмістити зображення' : 'Збільшити зображення');
  menuGalleryZoom.title = zoomed ? 'Вмістити зображення' : 'Збільшити зображення';
  menuGalleryZoom.querySelector('i').className = zoomed ? 'fa-solid fa-magnifying-glass-minus' : 'fa-solid fa-magnifying-glass-plus';
  menuGalleryViewport.scrollTo(0, 0);
}

function showMenuImage(index) {
  menuImageIndex = Math.max(0, Math.min(index, MENU_IMAGES.length - 1));
  const source = MENU_IMAGES[menuImageIndex];
  setMenuZoom(false);
  menuGalleryImage.src = source;
  menuGalleryImage.alt = `Меню, сторінка ${menuImageIndex + 1}`;
  document.getElementById('menuGalleryOriginal').href = source;
  document.getElementById('menuGalleryCounter').textContent = `${menuImageIndex + 1} / ${MENU_IMAGES.length}`;
  document.getElementById('menuGalleryPrevious').disabled = menuImageIndex === 0;
  document.getElementById('menuGalleryNext').disabled = menuImageIndex === MENU_IMAGES.length - 1;
  document.getElementById('menuGalleryError').hidden = true;
  menuGalleryImage.hidden = false;
}

function openMenuGallery(index = 0) {
  if (!MENU_IMAGES.length) return;
  showMenuImage(index);
  menuGalleryDialog.showModal();
}

function renderMenuGallery() {
  printMenuButton.disabled = !MENU_IMAGES.length;
  document.getElementById('floatingMenuButton').disabled = !MENU_IMAGES.length;
  menuRail.innerHTML = MENU_IMAGES.length ? MENU_IMAGES.map((source, index) => `
    <button class="menu-image-slide" data-menu-image="${index}" aria-label="Збільшити сторінку меню ${index + 1}">
      <img src="${escapeHtml(source.replace('.webp', '-thumb.webp'))}" alt="Меню, сторінка ${index + 1}" loading="lazy" decoding="async">
      <i class="fa-solid fa-expand" aria-hidden="true"></i>
    </button>`).join('') : '<p class="menu-empty">Друковане меню незабаром з’явиться тут.</p>';
  menuRail.querySelectorAll('img').forEach(img => img.addEventListener('error', () => {
    img.hidden = true;
    const slide = img.closest('button');
    slide.classList.add('image-unavailable');
    slide.setAttribute('aria-label', `${img.alt}: зображення недоступне`);
  }));
  syncMobileSliders();
  updateRailControls();
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[character]);
}

function dishImage(dish) {
  const raw = String(dish.image_url || dish.image || '');
  if (!raw || raw.endsWith('/')) return null;
  const relative = raw.replace(/^\/ffmenu\/images\//, './images/');
  const url = new URL(relative, location.href);
  return ['http:', 'https:'].includes(url.protocol) || (url.protocol === 'file:' && location.protocol === 'file:') ? url.href : null;
}

function isBanquet(dish) {
  const key = Object.keys(dish).find(key => key.trim().toLowerCase() === 'where');
  const value = dish[key] ?? '';
  const tokens = Array.isArray(value) ? value : String(value).split(/[,;|\s]+/);
  return tokens.some(token => String(token).trim().toLowerCase() === 'banquet');
}

function priceLabel(value) {
  const price = Number(value);
  return Number.isFinite(price) && value !== null && value !== ''
    ? `${new Intl.NumberFormat('uk-UA').format(price)} ₴` : 'За запитом';
}

function extrasList(dish) {
  if (Array.isArray(dish.extras)) return dish.extras;
  try { const extras = JSON.parse(dish.extras); return Array.isArray(extras) ? extras : []; }
  catch { return []; }
}

function renderRecommendations(categories) {
  const recommended = [...new Map(categories.flatMap(category => category.dishes)
    .filter(dish => extrasList(dish).some(extra => String(extra).trim().toLowerCase() === 'рекомендуємо'))
    .map(dish => [dish.id, dish])).values()];

  recommendationsRail.innerHTML = recommended.length ? recommended.map(dish => {
    const image = dishImage(dish);
    return `<article class="dish-preview"><div class="dish-preview-image">${image ? `<img src="${escapeHtml(image)}" alt="${escapeHtml(dish.name)}" loading="lazy" width="400" height="400">` : '<span class="loading-message">ОГОнь</span>'}</div><div class="dish-preview-heading"><h3>${escapeHtml(dish.name)}</h3><span class="dish-price">${escapeHtml(priceLabel(dish.price))}</span></div>${dish.weight ? `<p>${escapeHtml(dish.weight)}</p>` : ''}</article>`;
  }).join('') : '<p class="loading-message">Незабаром тут з’являться наші рекомендації.</p>';
  recommendationsRail.querySelectorAll('img').forEach(img => img.addEventListener('error', () => {
    img.hidden = true;
  }, { once: true }));

  syncMobileSliders();
  updateRailControls();
}

async function fetchRecommendationsMenu() {
  for (let attempt = 0; attempt < 3; attempt++) {
    let response;
    try {
      response = await fetch(HOME_MENU_URL, { signal: AbortSignal.timeout(15000) });
    } catch (error) {
      if (attempt === 2) throw error;
    }
    if (response?.ok) return response.json();
    if (response && (response.status < 500 || attempt === 2)) {
      throw new Error(`Menu HTTP ${response.status}`);
    }
    await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
  }
}

let recommendationsLoading = false;
async function loadRecommendations() {
  if (recommendationsLoading) return;
  recommendationsLoading = true;
  recommendationsRail.setAttribute('aria-busy', 'true');
  recommendationsRail.innerHTML = '<p class="loading-message" role="status">Завантажуємо рекомендації…</p>';
  try {
    const data = await fetchRecommendationsMenu();
    if (!Array.isArray(data)) throw new Error('Invalid menu');
    const categories = data.map(category => ({ ...category, dishes: (category.dishes || []).filter(dish => !isBanquet(dish)) }))
      .filter(category => category.dishes.length)
      .sort((a, b) => {
        const section = category => category.section === 'bar' || String(category.id).startsWith('bar-') ? 1 : 0;
        return section(a) - section(b) || (Number(a.sort_order) || 0) - (Number(b.sort_order) || 0);
      });
    if (!categories.length) throw new Error('Empty menu');
    renderRecommendations(categories);
  } catch (error) {
    console.error('Не вдалося завантажити меню:', error);
    const message = '<p class="loading-message">Не вдалося завантажити меню. <button class="text-link" data-retry>Спробувати ще раз</button></p>';
    recommendationsRail.innerHTML = message;
  } finally {
    recommendationsLoading = false;
    recommendationsRail.setAttribute('aria-busy', 'false');
    updateRailControls();
  }
}

function syncMobileSliders() {
  [menuRail, recommendationsRail].forEach(rail => {
    const slider = mobileSliders.get(rail.id);
    const slides = Array.from(rail.children).filter(el => el.matches('.menu-image-slide, .dish-preview'));
    if (window.innerWidth > 760 || !slides.length) {
      if (slider) {
        slider.destroy(true, true);
        mobileSliders.delete(rail.id);
        rail.parentElement.classList.remove('swiper');
        rail.classList.remove('swiper-wrapper');
        slides.forEach(slide => slide.classList.remove('swiper-slide'));
        rail.scrollTo({ left: 0, behavior: 'instant' });
      }
      return;
    }
    if (slider || !window.Swiper) return;
    rail.parentElement.classList.add('swiper');
    rail.classList.add('swiper-wrapper');
    slides.forEach(slide => slide.classList.add('swiper-slide'));
    rail.scrollTo({ left: 0, behavior: 'instant' });
    mobileSliders.set(rail.id, new Swiper(rail.parentElement, {
      slidesPerView: 'auto',
      centeredSlides: true,
      loop: slides.length >= 3,
      centerInsufficientSlides: slides.length < 3,
      spaceBetween: 14,
      speed: matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 350,
      on: { slideChange: updateRailControls },
    }));
  });
  syncAboutGallery();
}

function updateAboutGalleryMotion() {
  if (!aboutGallerySlider) return;
  const reduced = galleryMotionPreference.matches;
  aboutGallerySlider.params.speed = reduced ? 0 : 6500;
  aboutGalleryPause.hidden = reduced;
  aboutGalleryPause.setAttribute('aria-pressed', String(aboutGalleryPaused));
  const label = aboutGalleryPaused ? 'Продовжити рух фотографій' : 'Зупинити рух фотографій';
  aboutGalleryPause.setAttribute('aria-label', label);
  aboutGalleryPause.title = label;
  aboutGalleryPause.querySelector('i').className = aboutGalleryPaused ? 'fa-solid fa-play' : 'fa-solid fa-pause';
  const focusedPhoto = aboutGallery.querySelector('.gallery-photo:focus-visible');
  const shouldPlay = !reduced && !aboutGalleryPaused && aboutGalleryVisible && !document.hidden && !document.querySelector('dialog[open]') && !focusedPhoto;
  if (shouldPlay && !aboutGallerySlider.autoplay.running) aboutGallerySlider.autoplay.start();
  if (!shouldPlay && aboutGallerySlider.autoplay.running) {
    const translate = aboutGallerySlider.getTranslate();
    aboutGallerySlider.autoplay.stop();
    aboutGallerySlider.setTransition(0);
    aboutGallerySlider.setTranslate(translate);
    // The interrupted CSS transition will no longer emit transitionend.
    aboutGallerySlider.animating = false;
  }
}

function syncAboutGallery() {
  if (!aboutGallerySlider && window.Swiper) {
    const originals = Array.from(aboutGalleryTrack.children);
    // Repeat complete sets to keep the desktop loop filled with fewer photos.
    const copies = originals.length ? Math.ceil(5 / originals.length) - 1 : 0;
    for (let copy = 0; copy < copies; copy++) {
      originals.forEach(photo => {
        const repeat = photo.cloneNode(true);
        repeat.setAttribute('aria-hidden', 'true');
        repeat.tabIndex = -1;
        aboutGalleryTrack.append(repeat);
      });
    }
    const photos = Array.from(aboutGalleryTrack.children);
    aboutGallery.classList.add('swiper');
    aboutGalleryTrack.classList.add('swiper-wrapper');
    photos.forEach(photo => photo.classList.add('swiper-slide'));
    aboutGallerySlider = new Swiper(aboutGallery, {
      slidesPerView: 'auto',
      centeredSlides: true,
      loop: true,
      spaceBetween: 16,
      breakpoints: { 0: { spaceBetween: 12 }, 761: { spaceBetween: 16 } },
      speed: 6500,
      autoplay: { delay: 0, disableOnInteraction: false },
      on: {
        touchStart(slider) { slider.params.speed = galleryMotionPreference.matches ? 0 : 350; },
        transitionEnd(slider) { slider.params.speed = galleryMotionPreference.matches ? 0 : 6500; },
      },
    });
  }
  updateAboutGalleryMotion();
}

function updateRailControls() {
  document.querySelectorAll('[data-scroll]').forEach(button => {
    const rail = document.getElementById(button.dataset.scroll);
    const slider = mobileSliders.get(rail.id);
    if (slider) {
      button.disabled = slider.isLocked || (!slider.params.loop && (Number(button.dataset.direction) < 0 ? slider.isBeginning : slider.isEnd));
      return;
    }
    button.disabled = Number(button.dataset.direction) < 0
      ? rail.scrollLeft <= 2 : rail.scrollLeft >= rail.scrollWidth - rail.clientWidth - 2;
  });
}

function initSectionReveals() {
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  if (reducedMotion.matches || !window.IntersectionObserver || !Element.prototype.animate) return;

  const delays = new Map();
  const running = new Map();
  // Keep Swiper's moving wrappers outside the animations.
  [
    '.hero-content-wrap > *',
    '.about-copy > *',
    '.about-gallery',
    '.delivery-layout > *',
    '#menu .section-heading, #menu .rail-container, #menu .rail-footer',
    '#recommendations .section-heading, #recommendations .rail-container, #recommendations .rail-footer',
    '.contacts-section > *',
    '.review-inner > *',
  ].forEach(selector => {
    document.querySelectorAll(selector).forEach((element, index) => {
      delays.set(element, Math.min(index * 65, 150));
    });
  });

  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      observer.unobserve(entry.target);
      if (reducedMotion.matches) return;
      const animation = entry.target.animate([
        { opacity: 0, translate: '0 16px' },
        { opacity: 1, translate: '0 0' },
      ], {
        duration: 520,
        delay: delays.get(entry.target),
        easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
        fill: 'backwards',
      });
      running.set(entry.target, animation);
      animation.onfinish = () => running.delete(entry.target);
    });
  }, { rootMargin: '0px 0px 40px 0px', threshold: 0 });
  delays.forEach((delay, element) => observer.observe(element));

  document.addEventListener('focusin', event => {
    running.forEach((animation, element) => {
      if (element.contains(event.target)) {
        animation.cancel();
        running.delete(element);
      }
    });
  });
  reducedMotion.addEventListener('change', event => {
    if (!event.matches) return;
    observer.disconnect();
    running.forEach(animation => animation.cancel());
    running.clear();
  });
}

const header = document.getElementById('homeHeader');
const navToggle = document.getElementById('navToggle');
const mobileNav = document.getElementById('mobileNav');
const headerSocials = header.querySelector('.header-socials');
function syncHeaderSocials() {
  const target = window.innerWidth <= 900 ? mobileNav : header.querySelector('.header-actions');
  if (headerSocials.parentElement === target) return;
  if (target === mobileNav) target.append(headerSocials);
  else target.insertBefore(headerSocials, navToggle);
}
function setNavOpen(open) {
  mobileNav.hidden = !open;
  header.classList.toggle('nav-open', open);
  navToggle.setAttribute('aria-expanded', String(open));
  navToggle.setAttribute('aria-label', open ? 'Закрити навігацію' : 'Відкрити навігацію');
  navToggle.querySelector('i').className = open ? 'fa-solid fa-xmark' : 'fa-solid fa-bars';
}
navToggle.addEventListener('click', () => setNavOpen(mobileNav.hidden));
mobileNav.addEventListener('click', event => {
  const link = event.target.closest('a');
  if (link && link.getAttribute('aria-disabled') !== 'true') setNavOpen(false);
});
document.addEventListener('keydown', event => {
  if (menuGalleryDialog.open && ['ArrowLeft', 'ArrowRight'].includes(event.key)) {
    event.preventDefault();
    showMenuImage(menuImageIndex + (event.key === 'ArrowLeft' ? -1 : 1));
  }
  if (event.key === 'Escape' && !mobileNav.hidden) { setNavOpen(false); navToggle.focus(); }
});
document.addEventListener('click', event => {
  if (!mobileNav.hidden && !header.contains(event.target)) setNavOpen(false);
  const photo = event.target.closest('[data-photo]');
  if (photo) {
    const img = document.getElementById('dialogPhoto');
    img.src = photo.dataset.photo;
    img.alt = photo.querySelector('img').alt;
    document.getElementById('photoCaption').textContent = photo.dataset.caption;
    document.getElementById('photoDialog').showModal();
  }
  const menuImage = event.target.closest('[data-menu-image]');
  if (menuImage) openMenuGallery(Number(menuImage.dataset.menuImage));
  const scrollButton = event.target.closest('[data-scroll]');
  if (scrollButton) {
    const rail = document.getElementById(scrollButton.dataset.scroll);
    const slider = mobileSliders.get(rail.id);
    if (slider) {
      if (Number(scrollButton.dataset.direction) < 0) slider.slidePrev();
      else slider.slideNext();
    } else {
      const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
      rail.scrollBy({ left: rail.clientWidth * .8 * Number(scrollButton.dataset.direction), behavior: reduced ? 'instant' : 'smooth' });
    }
  }
  if (event.target.closest('[data-retry]')) {
    recommendationsRail.setAttribute('aria-busy', 'true');
    loadRecommendations();
  }
});
printMenuButton.addEventListener('click', () => openMenuGallery());
document.getElementById('floatingMenuButton').addEventListener('click', () => openMenuGallery());
document.getElementById('menuGalleryPrevious').addEventListener('click', () => showMenuImage(menuImageIndex - 1));
document.getElementById('menuGalleryNext').addEventListener('click', () => showMenuImage(menuImageIndex + 1));
menuGalleryZoom.addEventListener('click', () => setMenuZoom(!menuImageZoomed));
menuGalleryImage.addEventListener('click', () => setMenuZoom(!menuImageZoomed));
menuGalleryViewport.addEventListener('click', event => {
  if (event.target === menuGalleryViewport) menuGalleryDialog.close();
});
menuGalleryImage.addEventListener('error', () => {
  menuGalleryImage.hidden = true;
  document.getElementById('menuGalleryError').hidden = false;
});
let menuTouchStart = null;
let menuSwipeHandled = false;
menuGalleryViewport.addEventListener('click', event => {
  if (!menuSwipeHandled) return;
  menuSwipeHandled = false;
  event.preventDefault();
  event.stopImmediatePropagation();
}, { capture: true });
menuGalleryViewport.addEventListener('touchstart', event => {
  menuSwipeHandled = false;
  menuTouchStart = event.touches.length === 1 && !menuImageZoomed
    ? { x: event.touches[0].clientX, y: event.touches[0].clientY } : null;
}, { passive: true });
menuGalleryViewport.addEventListener('touchend', event => {
  if (!menuTouchStart || menuImageZoomed) return;
  const dx = event.changedTouches[0].clientX - menuTouchStart.x;
  const dy = event.changedTouches[0].clientY - menuTouchStart.y;
  if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) {
    menuSwipeHandled = true;
    showMenuImage(menuImageIndex + (dx < 0 ? 1 : -1));
  }
  menuTouchStart = null;
}, { passive: true });
menuGalleryViewport.addEventListener('touchcancel', () => { menuTouchStart = null; });
aboutGalleryPause.addEventListener('click', () => {
  aboutGalleryPaused = !aboutGalleryPaused;
  updateAboutGalleryMotion();
});
aboutGallery.addEventListener('focusin', updateAboutGalleryMotion);
aboutGallery.addEventListener('focusout', () => requestAnimationFrame(updateAboutGalleryMotion));
galleryMotionPreference.addEventListener('change', updateAboutGalleryMotion);
document.addEventListener('visibilitychange', updateAboutGalleryMotion);
if (window.IntersectionObserver) {
  new IntersectionObserver(entries => {
    aboutGalleryVisible = entries[0].isIntersecting;
    updateAboutGalleryMotion();
  }, { threshold: 0.05 }).observe(aboutGallery);
} else aboutGalleryVisible = true;
const galleryModalObserver = new MutationObserver(updateAboutGalleryMotion);
document.querySelectorAll('dialog').forEach(dialog => galleryModalObserver.observe(dialog, { attributes: true, attributeFilter: ['open'] }));
window.addEventListener('scroll', () => header.classList.toggle('scrolled', window.scrollY > 30), { passive: true });
window.addEventListener('resize', () => {
  if (window.innerWidth > 900) setNavOpen(false);
  syncHeaderSocials();
  syncMobileSliders();
  updateRailControls();
});
[menuRail, recommendationsRail].forEach(rail => rail.addEventListener('scroll', updateRailControls, { passive: true }));
header.classList.toggle('scrolled', window.scrollY > 30);
syncHeaderSocials();
document.getElementById('copyrightYear').textContent = new Date().getFullYear();
renderMenuGallery();
loadRecommendations();
initSectionReveals();
