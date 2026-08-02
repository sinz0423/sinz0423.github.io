/* ===================================
   苏浩哲 · 个人主页 — 动画引擎
   示波器扫描网格 + 滚动揭示 + 计数动画
   =================================== */

// ---- 尊重系统"减少动态效果"设置 ----
const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// 标记 JS 可用（用于渐进增强：图片淡入、标签交错等仅 JS 时生效）
document.documentElement.classList.add('js');

// ---- Canvas: Oscilloscope Grid + Scanning Line ----
(function() {
  const canvas = document.getElementById('heroCanvas');
  if (!canvas || prefersReducedMotion) return;
  const ctx = canvas.getContext('2d');

  let w, h, scanY, scanDirection;
  const gridSize = 32;
  const scanSpeed = 0.35; // px per frame — slow & deliberate

  // 数据星点：稀疏漂移的"观测样本"，光标附近连线微微增强
  const particles = [];
  for (let i = 0; i < 34; i++) {
    particles.push({
      x: Math.random(),
      y: Math.random(),
      vx: (Math.random() - 0.5) * 0.00013,
      vy: (Math.random() - 0.5) * 0.00013,
      r: Math.random() * 1.4 + 0.6
    });
  }
  const pointer = { x: -9999, y: -9999, active: false };
  if (window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
    window.addEventListener('mousemove', (e) => {
      const rect = canvas.getBoundingClientRect();
      pointer.x = e.clientX - rect.left;
      pointer.y = e.clientY - rect.top;
      pointer.active = true;
    }, { passive: true });
    canvas.addEventListener('mouseleave', () => { pointer.active = false; pointer.x = pointer.y = -9999; });
  }

  function drawParticles(cssW, cssH) {
    const LINK = 110;
    ctx.fillStyle = 'rgba(91,155,213,0.5)';
    for (const p of particles) {
      p.x += p.vx; p.y += p.vy;
      if (p.x < 0) p.x += 1; else if (p.x > 1) p.x -= 1;
      if (p.y < 0) p.y += 1; else if (p.y > 1) p.y -= 1;
      ctx.beginPath();
      ctx.arc(p.x * cssW, p.y * cssH, p.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.lineWidth = 0.6;
    for (let i = 0; i < particles.length; i++) {
      for (let j = i + 1; j < particles.length; j++) {
        const a = particles[i], b = particles[j];
        const ax = a.x * cssW, ay = a.y * cssH, bx = b.x * cssW, by = b.y * cssH;
        const dx = ax - bx, dy = ay - by;
        const d2 = dx * dx + dy * dy;
        if (d2 < LINK * LINK) {
          let alpha = 0.10 * (1 - Math.sqrt(d2) / LINK);
          if (pointer.active) {
            const mx = (ax + bx) / 2 - pointer.x;
            const my = (ay + by) / 2 - pointer.y;
            const md2 = mx * mx + my * my;
            if (md2 < 160 * 160) alpha = Math.min(alpha + 0.10 * (1 - Math.sqrt(md2) / 160), 0.22);
          }
          ctx.strokeStyle = 'rgba(91,155,213,' + alpha.toFixed(3) + ')';
          ctx.beginPath();
          ctx.moveTo(ax, ay);
          ctx.lineTo(bx, by);
          ctx.stroke();
        }
      }
    }
  }

  function resize() {
    const rect = canvas.parentElement.getBoundingClientRect();
    w = canvas.width = rect.width * devicePixelRatio;
    h = canvas.height = rect.height * devicePixelRatio;
    canvas.style.width = rect.width + 'px';
    canvas.style.height = rect.height + 'px';
    ctx.scale(devicePixelRatio, devicePixelRatio);
    scanY = h / devicePixelRatio * 0.25;
    scanDirection = 1;
  }

  function draw(timestamp) {
    const cssW = w / devicePixelRatio;
    const cssH = h / devicePixelRatio;
    ctx.clearRect(0, 0, cssW, cssH);

    // Grid dots — like oscilloscope graticule
    ctx.fillStyle = 'rgba(91,155,213,0.04)';
    const dotRadius = 0.8;
    for (let x = gridSize; x < cssW; x += gridSize) {
      for (let y = gridSize; y < cssH; y += gridSize) {
        ctx.beginPath();
        ctx.arc(x, y, dotRadius, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Major grid lines (every 4 minor)
    ctx.strokeStyle = 'rgba(91,155,213,0.02)';
    ctx.lineWidth = 0.5;
    for (let x = gridSize * 4; x < cssW; x += gridSize * 4) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, cssH);
      ctx.stroke();
    }
    for (let y = gridSize * 4; y < cssH; y += gridSize * 4) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(cssW, y);
      ctx.stroke();
    }

    // Crosshair at center
    const cx = cssW / 2, cy = cssH * 0.38;
    ctx.strokeStyle = 'rgba(91,155,213,0.06)';
    ctx.lineWidth = 0.5;
    ctx.setLineDash([4, 12]);
    ctx.beginPath();
    ctx.moveTo(cx - 60, cy); ctx.lineTo(cx + 60, cy);
    ctx.moveTo(cx, cy - 60); ctx.lineTo(cx, cy + 60);
    ctx.stroke();
    ctx.setLineDash([]);
    // Center dot
    ctx.fillStyle = 'rgba(200,145,90,0.15)';
    ctx.beginPath();
    ctx.arc(cx, cy, 2.5, 0, Math.PI * 2);
    ctx.fill();

    // 数据星点连线
    drawParticles(cssW, cssH);

    // Scanning line — like oscilloscope beam
    const scan = scanY;
    const glowGrad = ctx.createLinearGradient(0, scan - 30, 0, scan + 30);
    glowGrad.addColorStop(0, 'transparent');
    glowGrad.addColorStop(0.45, 'rgba(91,155,213,0.12)');
    glowGrad.addColorStop(0.5, 'rgba(91,155,213,0.28)');
    glowGrad.addColorStop(0.55, 'rgba(91,155,213,0.12)');
    glowGrad.addColorStop(1, 'transparent');
    ctx.fillStyle = glowGrad;
    ctx.fillRect(0, scan - 30, cssW, 60);

    // Bright scan line
    ctx.strokeStyle = 'rgba(91,155,213,0.22)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, scan);
    ctx.lineTo(cssW, scan);
    ctx.stroke();

    // Animate scan
    const speed = 0.12 + Math.sin(timestamp * 0.0003) * 0.04;
    scanY += speed * scanDirection;
    if (scanY > cssH * 0.72) scanDirection = -1;
    if (scanY < cssH * 0.18) scanDirection = 1;
  }

  function animate(timestamp) {
    draw(timestamp);
    requestAnimationFrame(animate);
  }

  resize();
  window.addEventListener('resize', resize);
  requestAnimationFrame(animate);
})();


// ---- Scroll Reveal (Intersection Observer) ----
(function() {
  // 减少动态效果：直接揭示全部内容，不做滚动动画
  if (prefersReducedMotion) {
    document.querySelectorAll('.reveal').forEach(el => el.classList.add('revealed'));
    document.querySelectorAll('.award-item').forEach(el => el.classList.add('revealed'));
    document.querySelectorAll('.course-card').forEach(el => el.classList.add('revealed'));
    document.querySelectorAll('.section-title').forEach(el => el.classList.add('revealed'));
    return;
  }

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry, i) => {
      if (entry.isIntersecting) {
        // Staggered reveal for grouped items
        const delay = entry.target.dataset.revealDelay || 0;
        setTimeout(() => {
          entry.target.classList.add('revealed');
        }, delay);
        observer.unobserve(entry.target);
      }
    });
  }, {
    threshold: 0.12,
    rootMargin: '0px 0px -40px 0px'
  });

  document.querySelectorAll('.reveal').forEach(el => observer.observe(el));

  // Award items — sequential reveal with stagger
  const awardObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        const items = entry.target.querySelectorAll('.award-item');
        items.forEach((item, i) => {
          item.style.transitionDelay = (i * 0.06) + 's';
          item.classList.add('revealed');
        });
        awardObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.1 });
  const timeline = document.querySelector('.awards-timeline');
  if (timeline) awardObserver.observe(timeline);

  // Course cards — animate bars on reveal
  const courseObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.querySelectorAll('.course-card').forEach((card, i) => {
          setTimeout(() => card.classList.add('revealed'), i * 80);
        });
        courseObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.1 });
  const courseGrid = document.querySelector('.course-grid');
  if (courseGrid) courseObserver.observe(courseGrid);

  // Section title underline reveal
  const titleObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) entry.target.classList.add('revealed');
    });
  }, { threshold: 0.5 });
  document.querySelectorAll('.section-title').forEach(el => titleObserver.observe(el));
})();


// ---- Counter Animation ----
(function() {
  if (prefersReducedMotion) {
    document.querySelectorAll('.counter').forEach(el => {
      const target = parseFloat(el.dataset.target);
      const decimals = parseInt(el.dataset.decimals) || 0;
      el.textContent = target.toFixed(decimals);
    });
    return;
  }

  function animateCounter(el) {
    const target = parseFloat(el.dataset.target);
    const decimals = parseInt(el.dataset.decimals) || 0;
    const duration = 1800;
    const start = performance.now();

    function update(now) {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      // Ease-out expo
      const eased = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
      const current = target * eased;
      el.textContent = current.toFixed(decimals);
      if (progress < 1) {
        requestAnimationFrame(update);
      } else {
        el.textContent = target.toFixed(decimals);
      }
    }
    requestAnimationFrame(update);
  }

  const counterObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        animateCounter(entry.target);
        counterObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.5 });

  document.querySelectorAll('.counter').forEach(el => counterObserver.observe(el));
})();


// ---- Navigation scroll effect ----
(function() {
  const nav = document.getElementById('nav');
  if (!nav) return;

  function updateNav() {
    nav.classList.toggle('scrolled', window.scrollY > 60);
  }

  window.addEventListener('scroll', updateNav, { passive: true });
  updateNav();
})();


// ---- Scroll-spy：高亮当前 section 对应的导航项 ----
(function() {
  const navLinks = Array.from(document.querySelectorAll('.nav-link'));
  if (!navLinks.length) return;
  const sections = navLinks
    .map(a => document.querySelector(a.getAttribute('href')))
    .filter(Boolean);
  if (!sections.length) return;

  const OFFSET = 100;

  function update() {
    let current = sections[0];
    for (const sec of sections) {
      if (sec.getBoundingClientRect().top <= OFFSET) current = sec;
    }
    const id = current.getAttribute('id');
    navLinks.forEach(a => a.classList.toggle('active', a.getAttribute('href') === '#' + id));
  }

  window.addEventListener('scroll', update, { passive: true });
  window.addEventListener('resize', update);
  update();
})();


// ---- Mobile 导航菜单切换 ----
(function() {
  const nav = document.getElementById('nav');
  const toggle = document.getElementById('navToggle');
  if (!nav || !toggle) return;

  toggle.addEventListener('click', () => {
    const open = nav.classList.toggle('open');
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? '关闭菜单' : '打开菜单');
  });

  nav.querySelectorAll('.nav-link').forEach(a => {
    a.addEventListener('click', () => {
      nav.classList.remove('open');
      toggle.setAttribute('aria-expanded', 'false');
      toggle.setAttribute('aria-label', '打开菜单');
    });
  });
})();


// ---- Smooth parallax on hero grid ----
(function() {
  const canvas = document.getElementById('heroCanvas');
  if (!canvas) return;

  let ticking = false;
  window.addEventListener('scroll', () => {
    if (!ticking) {
      requestAnimationFrame(() => {
        const scrollY = window.scrollY;
        const hero = document.querySelector('.hero');
        if (!hero) return;
        const heroHeight = hero.offsetHeight;
        if (scrollY < heroHeight) {
          const parallax = scrollY * 0.15;
          canvas.style.transform = `translateY(${parallax}px)`;
        }
        ticking = false;
      });
      ticking = true;
    }
  }, { passive: true });
})();


// ---- Lightbox ----
(function() {
  const lb = document.createElement('div');
  lb.className = 'lightbox';
  lb.innerHTML = `
    <button class="lightbox-close" aria-label="关闭">&times;</button>
    <button class="lightbox-prev" aria-label="上一张">&lsaquo;</button>
    <button class="lightbox-next" aria-label="下一张">&rsaquo;</button>
    <img src="" alt="">
    <div class="lightbox-caption"></div>
  `;
  document.body.appendChild(lb);

  const img = lb.querySelector('img');
  const caption = lb.querySelector('.lightbox-caption');
  let currentGroup = [];
  let currentIndex = 0;

  function open(group, index) {
    currentGroup = group;
    currentIndex = index;
    updateImage();
    lb.classList.add('active');
    document.body.style.overflow = 'hidden';
  }

  function close() {
    lb.classList.remove('active');
    document.body.style.overflow = '';
  }

  function updateImage() {
    const item = currentGroup[currentIndex];
    if (!item) return;
    const src = item.dataset.src;
    img.src = src;
    const cap = item.querySelector('.gallery-caption');
    caption.textContent = cap ? cap.textContent : '';
  }

  function prev() {
    currentIndex = (currentIndex - 1 + currentGroup.length) % currentGroup.length;
    updateImage();
  }

  function next() {
    currentIndex = (currentIndex + 1) % currentGroup.length;
    updateImage();
  }

  // Delegate clicks on gallery items
  document.addEventListener('click', (e) => {
    const item = e.target.closest('.gallery-item');
    if (!item) return;
    const parent = item.parentElement;
    const group = Array.from(parent.querySelectorAll('.gallery-item'));
    const index = group.indexOf(item);
    open(group, index);
  });

  lb.querySelector('.lightbox-close').addEventListener('click', close);
  lb.querySelector('.lightbox-prev').addEventListener('click', prev);
  lb.querySelector('.lightbox-next').addEventListener('click', next);
  // 移动端左右滑动切图
  let touchX = null;
  lb.addEventListener('touchstart', (e) => { touchX = e.changedTouches[0].clientX; }, { passive: true });
  lb.addEventListener('touchend', (e) => {
    if (touchX === null) return;
    const dx = e.changedTouches[0].clientX - touchX;
    if (Math.abs(dx) > 40) { dx < 0 ? next() : prev(); }
    touchX = null;
  });

  lb.addEventListener('click', (e) => { if (e.target === lb) close(); });
  document.addEventListener('keydown', (e) => {
    if (!lb.classList.contains('active')) return;
    if (e.key === 'Escape') close();
    if (e.key === 'ArrowLeft') prev();
    if (e.key === 'ArrowRight') next();
  });
})();

// ---- Hover glow effect on project cards ----
(function() {
  // 触屏设备无 hover，减少动态效果时禁用 tilt
  if (prefersReducedMotion || window.matchMedia('(hover: none)').matches) return;

  document.querySelectorAll('.project-card').forEach(card => {
    card.addEventListener('mousemove', (e) => {
      const rect = card.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const cx = rect.width / 2;
      const cy = rect.height / 2;
      const rotateX = (y - cy) / cy * -3;
      const rotateY = (x - cx) / cx * 3;
      card.style.transform = `perspective(800px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateY(-3px)`;
    });
    card.addEventListener('mouseleave', () => {
      card.style.transform = '';
    });
  });
})();


// ---- 顶部滚动进度条 ----
(function() {
  const bar = document.getElementById('scrollProgress');
  if (!bar) return;
  let ticking = false;
  function update() {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    const p = max > 0 ? Math.min(window.scrollY / max, 1) : 0;
    bar.style.transform = 'scaleX(' + p.toFixed(4) + ')';
    ticking = false;
  }
  window.addEventListener('scroll', () => {
    if (!ticking) { requestAnimationFrame(update); ticking = true; }
  }, { passive: true });
  update();
})();


// ---- 光标光晕（仅桌面精确指针） ----
(function() {
  const glow = document.getElementById('cursorGlow');
  if (!glow || prefersReducedMotion) return;
  if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;

  let tx = -400, ty = -400, x = -400, y = -400, shown = false;
  document.addEventListener('mousemove', (e) => {
    tx = e.clientX; ty = e.clientY;
    if (!shown) { shown = true; glow.classList.add('on'); }
  }, { passive: true });
  document.addEventListener('mouseleave', () => { shown = false; glow.classList.remove('on'); });

  (function loop() {
    x += (tx - x) * 0.12;
    y += (ty - y) * 0.12;
    glow.style.transform = 'translate3d(' + x.toFixed(1) + 'px, ' + y.toFixed(1) + 'px, 0)';
    requestAnimationFrame(loop);
  })();
})();


// ---- Hero 鼠标视差 ----
(function() {
  if (prefersReducedMotion) return;
  const hero = document.querySelector('.hero');
  const content = document.querySelector('.hero-content');
  if (!hero || !content) return;
  if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;

  let tx = 0, ty = 0, x = 0, y = 0;
  hero.addEventListener('mousemove', (e) => {
    const r = hero.getBoundingClientRect();
    tx = ((e.clientX - r.left) / r.width - 0.5) * -16;
    ty = ((e.clientY - r.top) / r.height - 0.5) * -10;
  }, { passive: true });
  hero.addEventListener('mouseleave', () => { tx = 0; ty = 0; });

  (function loop() {
    x += (tx - x) * 0.06;
    y += (ty - y) * 0.06;
    if (Math.abs(x) > 0.05 || Math.abs(y) > 0.05) {
      content.style.transform = 'translate3d(' + x.toFixed(2) + 'px, ' + y.toFixed(2) + 'px, 0)';
    } else if (x !== 0 || y !== 0) {
      x = 0; y = 0;
      content.style.transform = '';
    }
    requestAnimationFrame(loop);
  })();
})();


// ---- Hero 遥测读数：帧计数 + 滚出淡出 ----
(function() {
  const hero = document.querySelector('.hero');
  const readout = document.querySelector('.hero-readout');
  const pos = document.getElementById('rdPos');
  const frame = document.getElementById('rdFrame');
  if (!hero || !readout) return;

  if (!prefersReducedMotion && frame) {
    let n = 0;
    setInterval(() => { n = (n + 1) % 1000000; frame.textContent = String(n).padStart(6, '0'); }, 40);
  }
  if (pos) {
    window.addEventListener('mousemove', (e) => {
      pos.textContent = String(e.clientX).padStart(4, '0') + ' : ' + String(e.clientY).padStart(4, '0');
    }, { passive: true });
  }

  let ticking = false;
  function update() {
    readout.classList.toggle('dimmed', window.scrollY > hero.offsetHeight * 0.55);
    ticking = false;
  }
  window.addEventListener('scroll', () => {
    if (!ticking) { requestAnimationFrame(update); ticking = true; }
  }, { passive: true });
})();


// ---- 项目指标数字滚动 ----
(function() {
  const els = document.querySelectorAll('.metric-value[data-count]');
  if (!els.length || prefersReducedMotion) return;

  function animate(el) {
    const target = parseFloat(el.dataset.count);
    const decimals = parseInt(el.dataset.decimals) || 0;
    const prefix = el.dataset.prefix || '';
    const suffix = el.dataset.suffix || '';
    const duration = 1500;
    const start = performance.now();
    function tick(now) {
      const p = Math.min((now - start) / duration, 1);
      const eased = p === 1 ? 1 : 1 - Math.pow(2, -10 * p);
      el.textContent = prefix + (target * eased).toFixed(decimals) + suffix;
      if (p < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }

  const obs = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (e.isIntersecting) { animate(e.target); obs.unobserve(e.target); }
    });
  }, { threshold: 0.4 });
  els.forEach(el => obs.observe(el));
})();


// ---- 技能标签交错索引 + 图片加载淡入 ----
(function() {
  document.querySelectorAll('.skill-cloud .skill-tag').forEach((t, i) => t.style.setProperty('--i', i));

  const imgs = document.querySelectorAll('.gallery-item img, .about-photo');
  imgs.forEach(img => {
    if (img.complete) { img.classList.add('loaded'); return; }
    img.addEventListener('load', () => img.classList.add('loaded'));
    img.addEventListener('error', () => img.classList.add('loaded'));
  });
})();
