/* ===================================
   苏浩哲 · 个人主页 — 动画引擎
   示波器扫描网格 + 滚动揭示 + 计数动画
   =================================== */

// ---- Canvas: Oscilloscope Grid + Scanning Line ----
(function() {
  const canvas = document.getElementById('heroCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  let w, h, scanY, scanDirection;
  const gridSize = 32;
  const scanSpeed = 0.35; // px per frame — slow & deliberate

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
  let lastScroll = 0;

  function updateNav() {
    const scrollY = window.scrollY;
    if (scrollY > 60) {
      nav.classList.add('scrolled');
    } else {
      nav.classList.remove('scrolled');
    }
    lastScroll = scrollY;
    requestAnimationFrame(() => {});
  }

  window.addEventListener('scroll', updateNav, { passive: true });
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
