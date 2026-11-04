/* Окраєць — інтерактив сторінки.
   Без залежностей: шапка, меню, табло печі, вкладки, торба, форма, анімації. */
(() => {
  'use strict';

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const desktop = window.matchMedia('(min-width: 1080px)');

  /* ---------- Налаштування ---------- */
  const OPEN = 7 * 60;          // 07:00
  const CLOSE = 20 * 60;        // 20:00
  const BAKE_MIN = 40;          // скільки хвилин партія в печі
  const SLOT_STEP = 30;         // крок часу для передзамовлення
  const LEAD_MIN = 40;          // мінімум хвилин до видачі сьогодні
  const BAG_KEY = 'okraiets-bag';

  const store = {
    get(key) {
      try { return JSON.parse(localStorage.getItem(key)); } catch (e) { return null; }
    },
    set(key, value) {
      try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* приватний режим */ }
    }
  };

  const pad = (n) => String(n).padStart(2, '0');
  const toMin = (t) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
  const fmt = (min) => `${pad(Math.floor(min / 60) % 24)}:${pad(min % 60)}`;
  const money = (n) => `${n.toLocaleString('uk-UA')} грн`;

  /* Київський час, незалежно від часового поясу відвідувача */
  const kyivFormatter = (() => {
    try {
      return new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Europe/Kyiv', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23'
      });
    } catch (e) {
      return null;
    }
  })();
  function kyivNow() {
    const d = new Date();
    if (kyivFormatter) {
      const p = {};
      kyivFormatter.formatToParts(d).forEach(({ type, value }) => { p[type] = Number(value); });
      return { h: p.hour % 24, m: p.minute, s: p.second };
    }
    return { h: d.getHours(), m: d.getMinutes(), s: d.getSeconds() };
  }

  /* ---------- Шапка: тінь, ховання при скролі ---------- */
  const hdr = $('[data-hdr]');
  let lastY = window.scrollY;
  let menuOpen = false;

  function onScrollHeader() {
    const y = window.scrollY;
    hdr.classList.toggle('is-scrolled', y > 8);
    if (!menuOpen) {
      const goingDown = y > lastY + 4;
      const goingUp = y < lastY - 4;
      if (goingDown && y > 480) hdr.classList.add('is-hidden');
      else if (goingUp || y < 120) hdr.classList.remove('is-hidden');
    }
    lastY = y;
  }

  /* ---------- Мобільне меню ---------- */
  const burger = $('[data-burger]');
  const drawer = $('[data-drawer]');
  const burgerLabel = $('[data-burger-label]');
  const main = $('#main');

  function setMenu(open) {
    menuOpen = open;
    drawer.classList.toggle('is-open', open);
    hdr.classList.toggle('is-menu', open);
    hdr.classList.remove('is-hidden');
    burger.setAttribute('aria-expanded', String(open));
    burgerLabel.textContent = open ? 'Закрити меню' : 'Відкрити меню';
    document.body.classList.toggle('is-locked', open);
    drawer.toggleAttribute('inert', !open);
    if (main) main.toggleAttribute('inert', open);
    if (open) {
      const first = $('a', drawer);
      setTimeout(() => first && first.focus({ preventScroll: true }), 250);
    }
  }
  drawer.setAttribute('inert', '');
  burger.addEventListener('click', () => setMenu(!menuOpen));
  drawer.addEventListener('click', (e) => { if (e.target.closest('a')) setMenu(false); });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && menuOpen) { setMenu(false); burger.focus(); }
  });
  desktop.addEventListener?.('change', (e) => { if (e.matches && menuOpen) setMenu(false); });

  /* ---------- Активний пункт навігації ---------- */
  const navLinks = $$('.nav a');
  if ('IntersectionObserver' in window && navLinks.length) {
    const map = new Map(navLinks.map((a) => [a.getAttribute('href').slice(1), a]));
    const spy = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (en.isIntersecting) {
          navLinks.forEach((a) => a.classList.remove('is-current'));
          const link = map.get(en.target.id);
          if (link) link.classList.add('is-current');
        }
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    map.forEach((_, id) => { const el = document.getElementById(id); if (el) spy.observe(el); });
  }

  /* ---------- Перший екран ---------- */
  const hero = $('[data-hero]');
  const startHero = () => hero.classList.add('is-ready');
  if (document.fonts && document.fonts.ready) {
    Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 1200))]).then(() => requestAnimationFrame(startHero));
  } else {
    startHero();
  }

  /* ---------- Поява блоків при скролі ---------- */
  $$('[data-stagger]').forEach((group) => {
    Array.from(group.children).forEach((el, i) => el.style.setProperty('--d', `${i * 90}ms`));
  });
  $$('.board tbody tr').forEach((tr, i) => tr.style.setProperty('--i', i));
  $$('.note').forEach((n, i) => n.style.setProperty('--i', i));
  $$('.sheet__grid .frame').forEach((f, i) => f.style.setProperty('--d', `${(i % 3) * 90}ms`));

  const revealTargets = [...$$('[data-reveal]'), ...$$('[data-notes]'), ...$$('[data-word]')];
  if ('IntersectionObserver' in window && !reduceMotion) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (!en.isIntersecting) return;
        en.target.classList.add('is-in');
        io.unobserve(en.target);
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
    revealTargets.forEach((el) => io.observe(el));
  } else {
    revealTargets.forEach((el) => el.classList.add('is-in'));
  }

  /* ---------- Лічильники ---------- */
  const counters = $$('[data-count]');
  function countUp(el) {
    const target = Number(el.dataset.count);
    if (reduceMotion || !target) { el.textContent = target; return; }
    const dur = 1500;
    const t0 = performance.now();
    const tick = (t) => {
      const k = Math.min(1, (t - t0) / dur);
      const eased = 1 - Math.pow(1 - k, 3);
      el.textContent = Math.round(target * eased);
      if (k < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }
  if ('IntersectionObserver' in window && !reduceMotion) {
    const cio = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (en.isIntersecting) { countUp(en.target); cio.unobserve(en.target); }
      });
    }, { threshold: 0.6 });
    counters.forEach((el) => { el.textContent = '0'; cio.observe(el); });
  }

  /* ---------- Біжучий рядок: реагує на швидкість і напрям скролу ---------- */
  const track = $('[data-marquee]');
  if (track) {
    const original = track.innerHTML;
    track.innerHTML = original + original;
    let half = 0;
    const measure = () => {
      track.innerHTML = original + original;
      half = track.scrollWidth / 2;
      while (half > 0 && half < window.innerWidth * 1.2) {
        track.innerHTML += original + original;
        half = track.scrollWidth / 2;
      }
    };
    measure();
    window.addEventListener('resize', debounce(measure, 200));

    if (!reduceMotion) {
      let x = 0;
      let dir = 1;
      let boost = 0;
      let visible = true;
      let prev = performance.now();
      let lastScroll = window.scrollY;

      window.addEventListener('scroll', () => {
        const dy = window.scrollY - lastScroll;
        lastScroll = window.scrollY;
        if (Math.abs(dy) > 1) dir = dy > 0 ? 1 : -1;
        boost = Math.min(boost + Math.abs(dy) * 0.6, 22);
      }, { passive: true });

      if ('IntersectionObserver' in window) {
        new IntersectionObserver(([en]) => { visible = en.isIntersecting; }).observe(track);
      }

      const loop = (t) => {
        const dt = Math.min(64, t - prev) / 16.67;
        prev = t;
        if (visible && half) {
          x -= (0.7 + boost) * dir * dt;
          boost *= 0.9;
          if (x <= -half) x += half;
          if (x > 0) x -= half;
          track.style.transform = `translate3d(${x.toFixed(2)}px,0,0)`;
        }
        requestAnimationFrame(loop);
      };
      requestAnimationFrame(loop);
    }
  }

  /* ---------- Таймлайн «36 годин»: заповнюється при скролі ---------- */
  const steps = $('[data-steps]');
  const stepItems = steps ? $$('.step', steps) : [];
  function updateSteps() {
    if (!steps) return;
    const r = steps.getBoundingClientRect();
    const vh = window.innerHeight;
    let p;
    if (desktop.matches) {
      p = (vh * 0.85 - r.top) / (vh * 0.5);
    } else {
      p = (vh * 0.62 - r.top) / r.height;
    }
    p = Math.max(0, Math.min(1, p));
    steps.style.setProperty('--p', p.toFixed(3));
    stepItems.forEach((li, i) => {
      const at = desktop.matches
        ? i / (stepItems.length - 1)
        : li.offsetTop / steps.offsetHeight;
      li.classList.toggle('is-on', p >= at - 0.001 || reduceMotion);
    });
  }

  /* ---------- Скрол: одна rAF-обробка на кадр ---------- */
  let ticking = false;
  window.addEventListener('scroll', () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      onScrollHeader();
      updateSteps();
      ticking = false;
    });
  }, { passive: true });
  window.addEventListener('resize', debounce(updateSteps, 100));
  onScrollHeader();
  updateSteps();

  /* ---------- Табло печі, статус «відчинено», квиток на першому екрані ---------- */
  const rows = $$('[data-board] tr').map((tr) => ({
    tr,
    t: toMin(tr.dataset.t),
    name: $('.board__n', tr).firstChild.textContent.trim(),
    nameCell: $('.board__n', tr),
    st: $('[data-st]', tr)
  }));
  const statusEls = $$('[data-status]');
  const ticket = $('[data-ticket]');
  const clock = $('[data-clock]');
  const ovenNote = $('[data-oven-note]');
  let lastMinute = -1;

  function setStatus(min) {
    const open = min >= OPEN && min < CLOSE;
    let text;
    if (open) {
      const left = CLOSE - min;
      text = left <= 60 ? `Відчинено ще ${left} хв` : 'Відчинено до 20:00';
    } else if (min < OPEN) {
      text = 'Зачинено · відчиняємось о 07:00';
    } else {
      text = 'Зачинено · завтра з 07:00';
    }
    statusEls.forEach((el) => {
      el.classList.toggle('is-open', open);
      const t = $('[data-status-text]', el);
      if (t) t.textContent = text;
    });
  }

  function setClock(h, m) {
    if (!clock) return;
    const digits = `${pad(h)}${pad(m)}`;
    $$('.flip__d', clock).forEach((d, i) => {
      if (d.textContent !== digits[i]) {
        d.textContent = digits[i];
        if (!reduceMotion && lastMinute !== -1) {
          d.classList.remove('is-flip');
          void d.offsetWidth;
          d.classList.add('is-flip');
        }
      }
    });
    clock.setAttribute('aria-label', `Київський час ${pad(h)}:${pad(m)}`);
  }

  function setBoard(now) {
    let baking = null;
    let next = null;
    let done = 0;
    rows.forEach((r) => {
      r.tr.classList.remove('is-done', 'is-gone', 'is-baking', 'is-next');
      const old = $('.bake', r.nameCell);
      if (old) old.remove();

      if (now >= r.t) {
        r.tr.classList.add(now >= CLOSE ? 'is-gone' : 'is-done');
        r.st.textContent = now >= CLOSE ? 'розібрали' : 'на полиці';
        done++;
      } else if (now >= r.t - BAKE_MIN && !baking) {
        baking = r;
        r.tr.classList.add('is-baking');
        const left = Math.max(1, Math.ceil(r.t - now));
        r.st.textContent = `у печі · ${left} хв`;
        const bar = document.createElement('span');
        bar.className = 'bake';
        bar.setAttribute('aria-hidden', 'true');
        bar.innerHTML = `<span style="width:${(((now - (r.t - BAKE_MIN)) / BAKE_MIN) * 100).toFixed(1)}%"></span>`;
        r.nameCell.appendChild(bar);
      } else if (!next) {
        next = r;
        r.tr.classList.add('is-next');
        r.st.textContent = 'наступна';
      } else {
        r.st.textContent = 'за розкладом';
      }
    });

    if (ovenNote) {
      ovenNote.textContent = done === 0
        ? 'Київський час · перша партія ще попереду'
        : `Київський час · на полиці ${done} з ${rows.length} партій`;
    }
    return { baking, next };
  }

  function setTicket(now, { baking, next }) {
    if (!ticket) return;
    const label = $('[data-ticket-label]', ticket);
    const name = $('[data-ticket-name]', ticket);
    const meta = $('[data-ticket-meta]', ticket);
    const bar = $('[data-ticket-bar]', ticket);
    ticket.classList.toggle('is-baking', Boolean(baking));

    if (baking) {
      const left = Math.max(1, Math.ceil(baking.t - now));
      label.textContent = 'Зараз у печі';
      name.textContent = baking.name;
      meta.textContent = `вийде о ${fmt(baking.t)} · ще ${left} хв`;
      bar.style.width = `${((now - (baking.t - BAKE_MIN)) / BAKE_MIN) * 100}%`;
    } else if (next && now < CLOSE) {
      label.textContent = 'Наступна партія';
      name.textContent = next.name;
      meta.textContent = `у піч о ${fmt(next.t - BAKE_MIN)} · на полиці о ${fmt(next.t)}`;
      bar.style.width = '0%';
    } else {
      label.textContent = 'Піч відпочиває';
      name.textContent = now >= CLOSE ? 'До завтра!' : 'Скоро розпалюємо';
      meta.textContent = 'перший багет — о 07:00';
      bar.style.width = '0%';
    }
  }

  function tickTime() {
    const { h, m, s } = kyivNow();
    const min = h * 60 + m;
    const now = min + s / 60;
    setClock(h, m);
    if (min !== lastMinute) {
      setStatus(min);
      setTicket(now, setBoard(now));
      refreshSlots();
      lastMinute = min;
    }
  }

  /* ---------- Вкладки меню ---------- */
  const tabs = $$('[role="tab"]');
  const ink = $('[data-tabs-ink]');
  const tabList = $('[data-tabs]');

  function moveInk(tab) {
    if (!ink || !tab) return;
    ink.style.width = `${tab.offsetWidth - (tab === tabs[0] ? 14 : 28)}px`;
    ink.style.transform = `translateX(${tab.offsetLeft + (tab === tabs[0] ? 0 : 14)}px)`;
  }

  function selectTab(tab, focus) {
    tabs.forEach((t) => {
      const on = t === tab;
      t.setAttribute('aria-selected', String(on));
      t.tabIndex = on ? 0 : -1;
      const panel = document.getElementById(t.getAttribute('aria-controls'));
      if (panel) {
        panel.classList.toggle('is-active', on);
        if (on) $$('.item', panel).forEach((it, i) => it.style.setProperty('--i', i));
      }
    });
    moveInk(tab);
    if (focus) tab.focus();
    const tl = tabList;
    if (tl && tl.scrollWidth > tl.clientWidth) {
      tl.scrollTo({ left: tab.offsetLeft - 40, behavior: reduceMotion ? 'auto' : 'smooth' });
    }
  }

  tabs.forEach((tab, i) => {
    tab.addEventListener('click', () => selectTab(tab));
    tab.addEventListener('keydown', (e) => {
      let j = null;
      if (e.key === 'ArrowRight') j = (i + 1) % tabs.length;
      if (e.key === 'ArrowLeft') j = (i - 1 + tabs.length) % tabs.length;
      if (e.key === 'Home') j = 0;
      if (e.key === 'End') j = tabs.length - 1;
      if (j !== null) { e.preventDefault(); selectTab(tabs[j], true); }
    });
  });
  const initInk = () => moveInk(tabs.find((t) => t.getAttribute('aria-selected') === 'true'));
  initInk();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(initInk);
  window.addEventListener('resize', debounce(initInk, 100));

  /* ---------- Торба ---------- */
  const bagBtn = $('[data-bagbtn]');
  const bagCount = $('[data-bag-count]');
  const bagList = $('[data-bag-list]');
  const bagEmpty = $('[data-bag-empty]');
  const bagTotal = $('[data-bag-total]');
  const bagClear = $('[data-bag-clear]');
  const toastEl = $('[data-toast]');

  let bag = [];
  const saved = store.get(BAG_KEY);
  if (Array.isArray(saved)) {
    bag = saved.filter((x) => x && x.id && x.name && Number(x.price) > 0 && Number(x.qty) > 0)
      .map((x) => ({ id: String(x.id), name: String(x.name), price: Number(x.price), qty: Math.min(20, Number(x.qty)) }));
  }

  const totalQty = () => bag.reduce((s, x) => s + x.qty, 0);
  const totalSum = () => bag.reduce((s, x) => s + x.qty * x.price, 0);

  function renderBag() {
    const qty = totalQty();
    bagCount.textContent = qty;
    bagBtn.classList.toggle('has-items', qty > 0);
    bagBtn.setAttribute('aria-label', `Торба, позицій: ${qty}`);
    bagEmpty.hidden = bag.length > 0;
    bagClear.hidden = bag.length === 0;
    bagTotal.textContent = money(totalSum());

    bagList.innerHTML = '';
    bag.forEach((x) => {
      const li = document.createElement('li');
      li.innerHTML = `
        <span class="bag__name"></span>
        <span class="bag__sum">${money(x.qty * x.price)}</span>
        <span class="stepper">
          <button type="button" data-dec aria-label="Менше: ${escapeHtml(x.name)}"><svg class="ico" aria-hidden="true"><use href="#i-minus"/></svg></button>
          <output aria-live="polite">${x.qty}</output>
          <button type="button" data-inc aria-label="Більше: ${escapeHtml(x.name)}"><svg class="ico" aria-hidden="true"><use href="#i-plus"/></svg></button>
          <span class="stepper__unit">× ${x.price} грн</span>
        </span>`;
      li.dataset.id = x.id;
      $('.bag__name', li).textContent = x.name;
      bagList.appendChild(li);
    });
    store.set(BAG_KEY, bag);
  }

  function bump(el, cls = 'is-bump') {
    if (reduceMotion || !el) return;
    el.classList.remove(cls);
    void el.offsetWidth;
    el.classList.add(cls);
  }

  let toastTimer;
  function toast(text) {
    toastEl.textContent = text;
    toastEl.classList.add('is-on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('is-on'), 2300);
  }

  function fly(fromEl) {
    if (reduceMotion || !fromEl || !bagBtn || typeof document.body.animate !== 'function') {
      bump(bagBtn);
      return;
    }
    hdr.classList.remove('is-hidden');
    const a = fromEl.getBoundingClientRect();
    const b = bagBtn.getBoundingClientRect();
    const x0 = a.left + a.width / 2;
    const y0 = a.top + a.height / 2;
    const x1 = b.left + b.width / 2;
    const y1 = b.top + b.height / 2;
    const crumb = document.createElement('span');
    crumb.className = 'crumb';
    document.body.appendChild(crumb);
    const midX = x0 + (x1 - x0) * 0.5;
    const midY = Math.min(y0, y1) - 90;
    const anim = crumb.animate([
      { transform: `translate(${x0}px, ${y0}px) scale(1)` },
      { transform: `translate(${midX}px, ${midY}px) scale(1.25)`, offset: 0.45 },
      { transform: `translate(${x1}px, ${y1}px) scale(0.45)`, opacity: 0.7 }
    ], { duration: 720, easing: 'cubic-bezier(.45,0,.4,1)' });
    anim.onfinish = () => { crumb.remove(); bump(bagBtn); };
  }

  function addToBag(btn) {
    const { id, name } = btn.dataset;
    const price = Number(btn.dataset.price);
    const found = bag.find((x) => x.id === id);
    if (found) {
      if (found.qty >= 20) { toast('Більше 20 штук — краще домовимось у Telegram'); return; }
      found.qty += 1;
    } else {
      bag.push({ id, name, price, qty: 1 });
    }
    renderBag();
    bump($('.bag__total'));
    fly(btn);
    toast(`«${name}» — у торбі`);
    if (btn.classList.contains('add')) {
      btn.classList.add('is-added');
      setTimeout(() => btn.classList.remove('is-added'), 1100);
    }
    hideReceipt();
  }

  $$('[data-add]').forEach((btn) => btn.addEventListener('click', () => addToBag(btn)));

  bagList.addEventListener('click', (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;
    const id = btn.closest('li').dataset.id;
    const item = bag.find((x) => x.id === id);
    if (!item) return;
    if (btn.hasAttribute('data-inc')) item.qty = Math.min(20, item.qty + 1);
    if (btn.hasAttribute('data-dec')) item.qty -= 1;
    if (item.qty <= 0) bag = bag.filter((x) => x.id !== id);
    renderBag();
    bump(bagBtn);
    const again = bagList.querySelector(`li[data-id="${CSS.escape(id)}"] [${btn.hasAttribute('data-inc') ? 'data-inc' : 'data-dec'}]`);
    if (again) again.focus();
  });

  bagClear.addEventListener('click', () => {
    bag = [];
    renderBag();
    toast('Торбу очищено');
  });

  /* ---------- Форма передзамовлення ---------- */
  const form = $('[data-form]');
  const timeSel = $('[data-time]');
  const dayToday = $('#d-today');
  const dayTomorrow = $('#d-tomorrow');
  const formErr = $('[data-form-err]');
  const receiptSlot = $('[data-receipt-slot]');
  const receipt = $('[data-receipt]');

  function slotsFor(day) {
    const { h, m } = kyivNow();
    const nowMin = h * 60 + m;
    const out = [];
    for (let t = OPEN + SLOT_STEP; t <= CLOSE - SLOT_STEP; t += SLOT_STEP) {
      if (day === 'today' && t < nowMin + LEAD_MIN) continue;
      out.push(t);
    }
    return out;
  }

  function refreshSlots() {
    if (!timeSel) return;
    const todaySlots = slotsFor('today');
    dayToday.disabled = todaySlots.length === 0;
    if (dayToday.disabled && dayToday.checked) dayTomorrow.checked = true;

    const day = dayToday.checked ? 'today' : 'tomorrow';
    const list = day === 'today' ? todaySlots : slotsFor('tomorrow');
    const prev = timeSel.value;
    timeSel.innerHTML = '<option value="">Оберіть час</option>' +
      list.map((t) => `<option value="${fmt(t)}">${fmt(t)}</option>`).join('');
    if (list.map(fmt).includes(prev)) timeSel.value = prev;
  }
  [dayToday, dayTomorrow].forEach((r) => r.addEventListener('change', refreshSlots));

  const phoneInput = $('#f-phone');
  phoneInput.addEventListener('input', () => {
    const clean = phoneInput.value.replace(/[^\d+()\-\s]/g, '');
    if (clean !== phoneInput.value) phoneInput.value = clean;
  });

  function setFieldError(input, msg) {
    const field = input.closest('.field');
    const err = document.getElementById(input.getAttribute('aria-describedby'));
    field.classList.toggle('is-bad', Boolean(msg));
    input.setAttribute('aria-invalid', msg ? 'true' : 'false');
    if (err) err.textContent = msg || '';
  }

  function validate() {
    const name = form.elements.name;
    const phone = form.elements.phone;
    const time = form.elements.time;
    const errors = [];

    const nameOk = name.value.trim().length >= 2;
    setFieldError(name, nameOk ? '' : 'Як до вас звертатись? Хоча б дві літери.');
    if (!nameOk) errors.push(name);

    const digits = phone.value.replace(/\D/g, '');
    const phoneOk = /^(380\d{9}|0\d{9})$/.test(digits);
    setFieldError(phone, phoneOk ? '' : 'Перевірте номер: наприклад, 050 123 45 67.');
    if (!phoneOk) errors.push(phone);

    const timeOk = Boolean(time.value);
    setFieldError(time, timeOk ? '' : 'Оберіть, о котрій заберете.');
    if (!timeOk) errors.push(time);

    formErr.innerHTML = bag.length ? '' : 'Торба порожня. Додайте щось із <a href="#menu">меню</a>.';
    return { errors, ok: errors.length === 0 && bag.length > 0 };
  }

  ['name', 'phone', 'time'].forEach((n) => {
    const el = form.elements[n];
    el.addEventListener(n === 'time' ? 'change' : 'blur', () => {
      if (el.closest('.field').classList.contains('is-bad')) validate();
    });
  });

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const { errors, ok } = validate();
    if (!ok) {
      bump(form, 'is-shake');
      if (errors[0]) errors[0].focus();
      else document.getElementById('order').scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
      return;
    }
    printReceipt();
  });

  function printReceipt() {
    const isToday = dayToday.checked;
    const time = form.elements.time.value;
    const no = String(Math.floor(1000 + Math.random() * 9000));
    const name = form.elements.name.value.trim();
    const note = form.elements.note.value.trim();

    const lines = bag.map((x) => `
      <div class="receipt__row"><span>${escapeHtml(x.name)}</span><span></span></div>
      <div class="receipt__row"><span>&nbsp;&nbsp;${x.qty} × ${x.price}</span><span>${money(x.qty * x.price)}</span></div>`).join('');

    receipt.innerHTML = `
      <p class="receipt__brand">окраєць</p>
      <p class="receipt__c">пекарня на заквасці<br>Суми, Петропавлівська, 58</p>
      <hr>
      <div class="receipt__row"><span>Замовлення</span><span>№ ${no}</span></div>
      <div class="receipt__row"><span>Видача</span><span>${isToday ? 'сьогодні' : 'завтра'}, ${time}</span></div>
      <div class="receipt__row"><span>На ім’я</span><span>${escapeHtml(name)}</span></div>
      ${note ? `<div class="receipt__row"><span>Коментар</span><span></span></div><p>${escapeHtml(note)}</p>` : ''}
      <hr>
      ${lines}
      <hr>
      <div class="receipt__row receipt__total"><span>РАЗОМ</span><span>${money(totalSum())}</span></div>
      <div class="receipt__row"><span>Оплата</span><span>на касі</span></div>
      <hr>
      <p class="receipt__c">Дякуємо! Тримаємо замовлення<br>30 хв після ${time}.</p>
      <div class="receipt__bars" aria-hidden="true"></div>
      <p class="receipt__c">демо · замовлення не надіслано</p>`;

    form.hidden = true;
    receiptSlot.hidden = false;
    receipt.classList.remove('is-printing');
    void receipt.offsetWidth;
    if (!reduceMotion) receipt.classList.add('is-printing');
    receipt.focus({ preventScroll: true });
    receiptSlot.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'center' });

    bag = [];
    renderBag();
  }

  function hideReceipt() {
    if (receiptSlot.hidden) return;
    receiptSlot.hidden = true;
    form.hidden = false;
    form.reset();
    refreshSlots();
  }

  $('[data-receipt-new]').addEventListener('click', () => {
    hideReceipt();
    document.getElementById('menu').scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth' });
  });

  /* ---------- Питання: плавне розкриття ---------- */
  if (!reduceMotion && typeof document.body.animate === 'function') {
    $$('[data-faq] details').forEach((d) => {
      const summary = $('summary', d);
      let anim = null;
      summary.addEventListener('click', (e) => {
        e.preventDefault();
        if (anim) anim.cancel();
        const start = d.offsetHeight;
        if (d.open) {
          const end = summary.offsetHeight;
          anim = d.animate({ height: [`${start}px`, `${end}px`] }, { duration: 380, easing: 'cubic-bezier(.65,0,.35,1)' });
          anim.onfinish = () => { d.open = false; anim = null; };
        } else {
          d.open = true;
          const end = d.offsetHeight;
          anim = d.animate({ height: [`${start}px`, `${end}px`] }, { duration: 460, easing: 'cubic-bezier(.16,1,.3,1)' });
          anim.onfinish = () => { anim = null; };
        }
      });
    });
  }

  /* ---------- Галерея: «обвести» найкращий кадр ---------- */
  const sheet = $('[data-sheet]');
  if (sheet && 'IntersectionObserver' in window) {
    const so = new IntersectionObserver(([en]) => {
      if (en.isIntersecting) {
        setTimeout(() => $$('.frame--pick', sheet).forEach((f) => f.classList.add('is-picked')), 700);
        so.disconnect();
      }
    }, { threshold: 0.35 });
    so.observe(sheet);
  } else if (sheet) {
    $$('.frame--pick', sheet).forEach((f) => f.classList.add('is-picked'));
  }

  /* ---------- Велике слово у футері: по літерах ---------- */
  const word = $('[data-word]');
  if (word) {
    const letters = Array.from(word.textContent.trim());
    word.innerHTML = `<span class="foot__word-clip">${letters.map((l, i) => `<span class="l" style="--i:${i}">${l}</span>`).join('')}</span>`;
    // Підганяємо розмір, щоб слово рівно заповнило ширину контейнера
    const fitWord = () => {
      const clip = word.firstElementChild;
      word.style.fontSize = '100px';
      const natural = clip.scrollWidth;
      const avail = word.clientWidth;
      if (natural && avail) word.style.fontSize = `${Math.floor((100 * avail / natural) * 0.97)}px`;
    };
    fitWord();
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(fitWord);
    window.addEventListener('resize', debounce(fitWord, 150));
  }

  /* ---------- Панель швидкого зв’язку ---------- */
  const quick = $('[data-quick]');
  if (quick && 'IntersectionObserver' in window) {
    new IntersectionObserver(([en]) => {
      quick.classList.toggle('is-on', !en.isIntersecting && en.boundingClientRect.top < 0);
    }, { threshold: 0 }).observe(hero);
  }

  /* ---------- Рік ---------- */
  const year = $('[data-year]');
  if (year) year.textContent = new Date().getFullYear();

  /* ---------- Допоміжне ---------- */
  function debounce(fn, ms) {
    let t;
    return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
  }
  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  /* ---------- Старт ---------- */
  renderBag();
  tickTime();
  setInterval(tickTime, 5000);
})();
