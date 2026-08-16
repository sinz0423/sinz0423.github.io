/* ===================================
   苏浩哲 · 个人主页 — 课程知识图谱
   自研力导向布局 · 悬停显示名称 · 主题配色
   =================================== */

(function() {
  'use strict';

  const canvas = document.getElementById('knowledgeGraph');
  if (!canvas || !window.GRAPH_DATA) return;
  const ctx = canvas.getContext('2d');
  const wrap = canvas.parentElement;
  const reducedMotion = window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---- 配色：10 门科目（蓝色系渐变）+ 主笔记黄铜金 ----
  const PALETTE = {
    '自控原理':     '#5b9bd5',
    '模拟电路':     '#43a8b5',
    '数字电路':     '#4f8fd2',
    '电路原理':     '#7ba6e0',
    '高数':         '#6b86d8',
    '现代控制理论': '#7b8cdd',
    '微机原理':     '#5d7ad0',
    '线代':         '#9aa5e8',
    '信号原理':     '#3f9fd6',
    'C语言':        '#57c1c5',
  };
  const CSS_BRASS = (getComputedStyle(document.documentElement).getPropertyValue('--color-brass') || '#c8915a').trim();
  const CSS_OPTICS = (getComputedStyle(document.documentElement).getPropertyValue('--color-optics') || '#5b9bd5').trim();
  const EDGE_COLOR = 'rgba(91,155,213,0.15)';
  const EDGE_HOVER = 'rgba(200,145,90,0.45)';

  function colorOf(n) {
    return n.type === '主笔记' ? CSS_BRASS : (PALETTE[n.course] || CSS_OPTICS);
  }

  // ---- 数据 ----
  const nodes = GRAPH_DATA.nodes.map(n => Object.assign({}, n, { x: 0, y: 0, vx: 0, vy: 0 }));
  const links = GRAPH_DATA.links
    .map(l => ({
      source: nodes.find(n => n.id === l.source),
      target: nodes.find(n => n.id === l.target),
    }))
    .filter(l => l.source && l.target && l.source !== l.target);

  const maxDeg = Math.max(1, ...nodes.map(n => n.degree));
  function radiusOf(n) {
    if (n.type === '主笔记') return 7;
    return 2.2 + 2.8 * (n.degree / maxDeg);
  }
  function nodeAt(x, y) {
    let best = null, bestD = Infinity;
    for (const n of nodes) {
      const dx = n.x - x, dy = n.y - y;
      const d = dx * dx + dy * dy;
      const r = radiusOf(n) + 6;
      if (d < r * r && d < bestD) { best = n; bestD = d; }
    }
    return best;
  }

  // ---- 画布尺寸（DPR 适配）----
  let W = 0, H = 0;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  function resize() {
    const cw = wrap.clientWidth || canvas.clientWidth || 800;
    const ch = canvas.clientHeight || 420;
    if (cw === 0) return;
    const scale = (W && H) ? Math.min(cw / W, ch / H) : 1;
    W = cw; H = ch;
    canvas.width = Math.round(cw * dpr);
    canvas.height = Math.round(ch * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (scale !== 1 && isFinite(scale)) {
      nodes.forEach(n => { n.x *= scale; n.y *= scale; });
    }
  }

  // ---- 物理参数 ----
  const REST = 62;          // 链接理想距离
  const K_LINK = 0.05;      // 弹簧系数
  const K_REP = 2600;       // 排斥强度（/d²）
  const K_CENTER = 0.008;   // 向心引力
  const DAMP = 0.85;        // 速度阻尼

  function step() {
    const cx = W / 2, cy = H / 2;
    for (const n of nodes) {          // 向心
      n.vx += (cx - n.x) * K_CENTER;
      n.vy += (cy - n.y) * K_CENTER;
    }
    for (const l of links) {          // 链接弹簧
      const a = l.source, b = l.target;
      let dx = b.x - a.x, dy = b.y - a.y;
      let d = Math.sqrt(dx * dx + dy * dy) || 1;
      const f = K_LINK * (d - REST);
      dx /= d; dy /= d;
      a.vx += dx * f; a.vy += dy * f;
      b.vx -= dx * f; b.vy -= dy * f;
    }
    for (let i = 0; i < nodes.length; i++) {   // 全对排斥
      const a = nodes[i];
      for (let j = i + 1; j < nodes.length; j++) {
        const b = nodes[j];
        const dx = a.x - b.x, dy = a.y - b.y;
        const d2 = Math.max(1, dx * dx + dy * dy);
        const d = Math.sqrt(d2);
        const f = K_REP / d2;
        const ux = dx / d, uy = dy / d;
        a.vx += ux * f; b.vx -= ux * f;
        a.vy += uy * f; b.vy -= uy * f;
      }
    }
    let maxSpeed = 0;
    for (const n of nodes) {          // 积分 + 阻尼 + 边界
      n.vx *= DAMP; n.vy *= DAMP;
      n.x += n.vx; n.y += n.vy;
      const sp = n.vx * n.vx + n.vy * n.vy;
      if (sp > maxSpeed) maxSpeed = sp;
      n.x = Math.max(16, Math.min(W - 16, n.x));
      n.y = Math.max(16, Math.min(H - 16, n.y));
    }
    return maxSpeed;
  }

  function initPositions() {
    const cx = W / 2, cy = H / 2, R = Math.min(W, H) * 0.38;
    for (const n of nodes) {
      const a = Math.random() * Math.PI * 2;
      const r = Math.sqrt(Math.random()) * R;
      n.x = cx + Math.cos(a) * r;
      n.y = cy + Math.sin(a) * r;
      n.vx = 0; n.vy = 0;
    }
  }

  // ---- tooltip（仅显示名称，不做点击跳转）----
  const tip = document.createElement('div');
  tip.className = 'graph-tooltip';
  tip.setAttribute('role', 'tooltip');
  document.body.appendChild(tip);

  let hoverId = null;
  function showTip(n, px, py) {
    tip.innerHTML =
      '<span class="graph-tooltip-name"></span>' +
      '<span class="graph-tooltip-sub"></span>';
    tip.querySelector('.graph-tooltip-name').textContent = n.name;
    tip.querySelector('.graph-tooltip-sub').textContent =
      n.course + (n.type === '主笔记' ? ' · 课程' : '');
    tip.style.opacity = '1';
    const tw = tip.offsetWidth, th = tip.offsetHeight;
    let left = px + 14, top = py + 14;
    if (left + tw > window.innerWidth - 8) left = px - tw - 14;
    if (top + th > window.innerHeight - 8) top = py - th - 14;
    tip.style.left = left + 'px';
    tip.style.top = top + 'px';
  }
  function hideTip() { tip.style.opacity = '0'; }

  function onMove(e) {
    const rect = canvas.getBoundingClientRect();
    const n = nodeAt(e.clientX - rect.left, e.clientY - rect.top);
    if (n) {
      hoverId = n.id;
      showTip(n, e.clientX, e.clientY);
    } else {
      hoverId = null;
      hideTip();
    }
  }
  canvas.addEventListener('mousemove', onMove);
  canvas.addEventListener('mouseleave', () => { hoverId = null; hideTip(); });
  canvas.addEventListener('touchmove', onMove, { passive: true });
  canvas.addEventListener('touchend', () => { hoverId = null; hideTip(); });

  // ---- 渲染 ----
  function draw() {
    ctx.clearRect(0, 0, W, H);

    ctx.lineWidth = 1;
    for (const l of links) {
      const a = l.source, b = l.target;
      const hot = hoverId === a.id || hoverId === b.id;
      ctx.strokeStyle = hot ? EDGE_HOVER : EDGE_COLOR;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }

    for (const n of nodes) {
      const r = radiusOf(n);
      const col = colorOf(n);
      if (hoverId === n.id) {          // 悬停光晕
        const g = ctx.createRadialGradient(n.x, n.y, r * 0.4, n.x, n.y, r * 2.8);
        g.addColorStop(0, 'rgba(200,145,90,0.32)');
        g.addColorStop(1, 'rgba(200,145,90,0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(n.x, n.y, r * 2.8, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.beginPath();
      ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
      ctx.fillStyle = col;
      ctx.fill();
      if (n.type === '主笔记') {       // 主笔记描边，更醒目
        ctx.strokeStyle = 'rgba(255,255,255,0.30)';
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    }

    if (hoverId) {
      const h = nodes.find(n => n.id === hoverId);
      if (h) {
        ctx.beginPath();
        ctx.arc(h.x, h.y, radiusOf(h) + 3.5, 0, Math.PI * 2);
        ctx.strokeStyle = CSS_BRASS;
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
    }
  }

  // ---- 启动 ----
  resize();
  window.addEventListener('resize', resize);

  function start() {
    initPositions();
    let settled = false, frames = 0;
    (function frame() {
      if (!settled) {
        frames++;
        const ms = step();
        if (ms < 0.05 || frames > 1600) settled = true;
      }
      draw();
      requestAnimationFrame(frame);
    })();
  }

  if (reducedMotion) {
    initPositions();
    for (let i = 0; i < 500; i++) step();
    draw();
  } else {
    const rect = wrap.getBoundingClientRect();
    const inView = rect.top < window.innerHeight && rect.bottom > 0;
    if (inView) {
      start();                       // 首屏内直接启动
    } else {
      const io = new IntersectionObserver(entries => {
        entries.forEach(en => {
          if (!en.isIntersecting) return;
          io.disconnect();
          start();
        });
      }, { threshold: 0.08 });
      io.observe(wrap);
    }
  }

  // ---- 图例（与配色表同一来源）----
  const legend = wrap.querySelector('.graph-legend');
  if (legend) {
    const mk = (col, label) => {
      const s = document.createElement('span');
      s.className = 'graph-legend-item';
      s.innerHTML = '<i class="graph-legend-dot" style="background:' + col + '"></i>' + label;
      legend.appendChild(s);
    };
    mk(CSS_BRASS, '主笔记');
    for (const c of Object.keys(PALETTE)) mk(PALETTE[c], c);
  }
})();
