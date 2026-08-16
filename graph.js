/* ===================================
   苏浩哲 · 个人主页 — 课程知识图谱
   持续力导向布局 · 节点拖拽 / 空白平移 / 滚轮缩放 · 悬停显示名称
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
    if (scale !== 1 && isFinite(scale)) {
      nodes.forEach(n => { n.x *= scale; n.y *= scale; });
    }
  }

  // ---- 视口（平移 / 缩放）----
  const view = { x: 0, y: 0, scale: 1 };
  const SCALE_MIN = 0.5, SCALE_MAX = 3.5;

  function toWorld(sx, sy) {
    return { x: (sx - view.x) / view.scale, y: (sy - view.y) / view.scale };
  }

  // ---- 物理（世界坐标，持续运行；能量衰减收敛，拖拽时重新加热）----
  const REST = 62;
  const K_LINK = 0.05;
  const K_REP = 2600;
  const K_CENTER = 0.008;
  const DAMP = 0.80;         // 速度阻尼（越大越稳，抑制跳跃）
  const MAX_SPEED = 4;       // 每帧速度上限，防止节点弹飞
  const ALPHA_DECAY = 0.05;  // 能量衰减速率：系统自然收敛，闲置时安静

  let dragging = null;       // 被拖拽的节点
  let alpha = 1;             // 全局能量（所有力乘以它）

  function reheat() { alpha = 1; }

  function step(decay) {
    if (decay !== false) {                    // 静态布局时固定满能量
      alpha *= (1 - ALPHA_DECAY);
      if (alpha < 0.002) alpha = 0.002;
      if (dragging) alpha = Math.max(alpha, 0.3);   // 拖拽期间保持响应
    }
    const aScale = alpha;
    const cx = W / 2, cy = H / 2;
    for (const n of nodes) {
      if (n === dragging) continue;
      n.vx += (cx - n.x) * K_CENTER * aScale;
      n.vy += (cy - n.y) * K_CENTER * aScale;
    }
    for (const l of links) {
      const a = l.source, b = l.target;
      let dx = b.x - a.x, dy = b.y - a.y;
      let d = Math.sqrt(dx * dx + dy * dy) || 1;
      const f = K_LINK * (d - REST) * aScale;
      dx /= d; dy /= d;
      if (a !== dragging) { a.vx += dx * f; a.vy += dy * f; }
      if (b !== dragging) { b.vx -= dx * f; b.vy -= dy * f; }
    }
    for (let i = 0; i < nodes.length; i++) {
      const a = nodes[i];
      if (a === dragging) continue;
      for (let j = i + 1; j < nodes.length; j++) {
        const b = nodes[j];
        if (b === dragging) continue;
        const dx = a.x - b.x, dy = a.y - b.y;
        const d2 = Math.max(1, dx * dx + dy * dy);
        const d = Math.sqrt(d2);
        const f = K_REP * aScale / d2;
        const ux = dx / d, uy = dy / d;
        a.vx += ux * f; b.vx -= ux * f;
        a.vy += uy * f; b.vy -= uy * f;
      }
    }
    for (const n of nodes) {
      if (n === dragging) { n.vx = 0; n.vy = 0; continue; }
      n.vx *= DAMP; n.vy *= DAMP;
      const sp = Math.sqrt(n.vx * n.vx + n.vy * n.vy);
      if (sp > MAX_SPEED) { n.vx *= MAX_SPEED / sp; n.vy *= MAX_SPEED / sp; }
      n.x += n.vx; n.y += n.vy;
      n.x = Math.max(-W * 0.5, Math.min(W * 1.5, n.x));
      n.y = Math.max(-H * 0.5, Math.min(H * 1.5, n.y));
    }
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

  // ---- tooltip（名称 + 科目 + Obsidian 笔记库）----
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
      n.course + (n.type === '主笔记' ? ' · 课程' : '') + ' · Obsidian 笔记库';
    tip.style.opacity = '1';
    const tw = tip.offsetWidth, th = tip.offsetHeight;
    let left = px + 14, top = py + 14;
    if (left + tw > window.innerWidth - 8) left = px - tw - 14;
    if (top + th > window.innerHeight - 8) top = py - th - 14;
    tip.style.left = left + 'px';
    tip.style.top = top + 'px';
  }
  function hideTip() { tip.style.opacity = '0'; }

  function nodeAt(sx, sy) {
    const w = toWorld(sx, sy);
    let best = null, bestD = Infinity;
    for (const n of nodes) {
      const dx = n.x - w.x, dy = n.y - w.y;
      const d = dx * dx + dy * dy;
      const r = radiusOf(n) + 14 / view.scale;   // 命中半径随缩放增大
      if (d < r * r && d < bestD) { best = n; bestD = d; }
    }
    return best;
  }

  // ---- 交互：拖拽节点 / 平移空白 / 悬停 ----
  let panning = null;   // {sx, sy, vx, vy}

  function setCursor(mode) {
    canvas.style.cursor = mode;
  }

  function onDown(e) {
    const n = nodeAt(e.clientX, e.clientY);
    if (n) {
      dragging = n;
      hoverId = n.id;
      showTip(n, e.clientX, e.clientY);
      setCursor('grabbing');
      reheat();                     // 拖拽重新加热，相连节点随之响应
    } else {
      panning = { sx: e.clientX, sy: e.clientY, vx: view.x, vy: view.y };
      setCursor('grabbing');
    }
  }

  function onMove(e) {
    if (dragging) {
      const w = toWorld(e.clientX, e.clientY);
      dragging.x = Math.max(-W * 0.5, Math.min(W * 1.5, w.x));
      dragging.y = Math.max(-H * 0.5, Math.min(H * 1.5, w.y));
      hoverId = dragging.id;
      showTip(dragging, e.clientX, e.clientY);
      return;
    }
    if (panning) {
      view.x = panning.vx + (e.clientX - panning.sx);
      view.y = panning.vy + (e.clientY - panning.sy);
      return;
    }
    const n = nodeAt(e.clientX, e.clientY);
    if (n) {
      if (hoverId !== n.id) hoverId = n.id;
      setCursor('grab');
      showTip(n, e.clientX, e.clientY);
    } else {
      if (hoverId !== null) hideTip();
      hoverId = null;
      setCursor('grab');
    }
  }

  function onUp() {
    if (dragging) { dragging.vx = 0; dragging.vy = 0; }
    dragging = null;
    panning = null;
    setCursor('grab');
  }

  function onWheel(e) {
    e.preventDefault();
    const factor = Math.exp(-e.deltaY * 0.0012);
    const next = Math.max(SCALE_MIN, Math.min(SCALE_MAX, view.scale * factor));
    // 以光标为中心缩放
    const wx = (e.clientX - view.x) / view.scale;
    const wy = (e.clientY - view.y) / view.scale;
    view.scale = next;
    view.x = e.clientX - wx * view.scale;
    view.y = e.clientY - wy * view.scale;
    // 缩放时隐藏 tooltip 避免错位
    if (hoverId !== null) { hideTip(); hoverId = null; }
  }

  canvas.addEventListener('mousedown', onDown);
  canvas.addEventListener('mousemove', onMove);
  window.addEventListener('mouseup', onUp);
  canvas.addEventListener('mouseleave', () => { hoverId = null; hideTip(); });
  canvas.addEventListener('wheel', onWheel, { passive: false });

  // 触摸：拖动节点或平移
  canvas.addEventListener('touchstart', e => {
    if (e.touches.length === 1) {
      const t = e.touches[0];
      onDown({ clientX: t.clientX, clientY: t.clientY });
    }
  }, { passive: true });
  canvas.addEventListener('touchmove', e => {
    if (e.touches.length === 1) {
      const t = e.touches[0];
      onMove({ clientX: t.clientX, clientY: t.clientY });
    }
  }, { passive: true });
  canvas.addEventListener('touchend', () => onUp());

  // ---- 渲染（世界坐标 + 视口变换）----
  function draw() {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    ctx.setTransform(dpr * view.scale, 0, 0, dpr * view.scale, dpr * view.x, dpr * view.y);

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
      if (hoverId === n.id) {
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
      if (n.type === '主笔记') {
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

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  // ---- 启动 ----
  resize();
  window.addEventListener('resize', resize);

  function start() {
    initPositions();
    if (reducedMotion) {
      for (let i = 0; i < 500; i++) step(false);   // 固定满能量，收敛出静态布局
      draw();
      // 交互（拖拽/平移/缩放/悬停）后按需重绘，不运行动画
      const refresh = () => draw();
      canvas.addEventListener('mousemove', refresh);
      canvas.addEventListener('wheel', refresh);
      window.addEventListener('mouseup', refresh);
      canvas.addEventListener('touchend', refresh);
      return;
    }
    (function frame() {
      step();
      draw();
      requestAnimationFrame(frame);
    })();
  }

  const rect = wrap.getBoundingClientRect();
  const inView = rect.top < window.innerHeight && rect.bottom > 0;
  if (inView) {
    start();
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
