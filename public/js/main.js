/* ============ NovaEdge — interactions ============ */
(() => {
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  const lerp = (a, b, t) => a + (b - a) * t;
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const inr = (paise) => '₹' + (paise / 100).toLocaleString('en-IN');

  $('#year').textContent = new Date().getFullYear();

  /* ---------- Split hero text into chars ---------- */
  let charIndex = 0;
  $$('.split').forEach((el) => {
    const words = el.textContent.trim().split(' ');
    el.innerHTML = words.map((w) =>
      `<span style="display:inline-block;white-space:nowrap">${[...w].map((c) => `<span class="char" style="--i:${charIndex++}">${c}</span>`).join('')}</span>`
    ).join(' ');
  });

  /* ---------- Preloader ---------- */
  const loader = $('#loader');
  const startSite = () => {
    document.body.classList.remove('is-loading');
    document.body.classList.add('is-ready');
    $$('.hero .reveal-up').forEach((el) => {
      el.style.setProperty('--d', (el.dataset.delay || 0) + 's');
      el.classList.add('is-in');
    });
    startRotator();
  };
  if (reduced) {
    loader.remove(); startSite();
  } else {
    const num = $('#loaderNum'), bar = $('#loaderBar');
    let p = 0;
    const tick = () => {
      p = Math.min(100, p + Math.random() * 9 + 3);
      num.textContent = Math.floor(p);
      bar.style.width = p + '%';
      if (p < 100) setTimeout(tick, 45);
      else setTimeout(() => {
        loader.classList.add('done');
        startSite();
        setTimeout(() => loader.remove(), 1100);
      }, 250);
    };
    tick();
  }

  /* ---------- Word rotator ---------- */
  function startRotator() {
    const words = $$('#rotator span');
    let i = 0;
    words[0].classList.add('is-active');
    if (reduced) return;
    setInterval(() => {
      const cur = words[i];
      cur.classList.remove('is-active'); cur.classList.add('is-out');
      setTimeout(() => cur.classList.remove('is-out'), 800);
      i = (i + 1) % words.length;
      words[i].classList.add('is-active');
    }, 2400);
  }

  /* ---------- Scroll reveal ---------- */
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (!e.isIntersecting) return;
      const el = e.target;
      el.style.setProperty('--d', (el.dataset.delay || 0) + 's');
      el.classList.add('is-in');
      io.unobserve(el);
    });
  }, { threshold: 0.15, rootMargin: '0px 0px -40px 0px' });
  $$('.reveal-up').forEach((el) => { if (!el.closest('.hero')) io.observe(el); });

  /* ---------- Counters ---------- */
  const countIO = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (!e.isIntersecting) return;
      const el = e.target, end = parseFloat(el.dataset.count), dec = +(el.dataset.decimals || 0), suf = el.dataset.suffix || '';
      const dur = 1800, t0 = performance.now();
      const step = (t) => {
        const k = clamp((t - t0) / dur, 0, 1), eased = 1 - Math.pow(1 - k, 4);
        el.textContent = (end * eased).toFixed(dec) + suf;
        if (k < 1) requestAnimationFrame(step);
      };
      reduced ? (el.textContent = end.toFixed(dec) + suf) : requestAnimationFrame(step);
      countIO.unobserve(el);
    });
  }, { threshold: 0.5 });
  $$('[data-count]').forEach((el) => countIO.observe(el));

  /* ---------- Nav: hide on scroll down, mobile menu ---------- */
  const nav = $('#nav');
  let lastY = 0;
  $('#burger').addEventListener('click', () => nav.classList.toggle('is-open'));
  $$('#navLinks a').forEach((a) => a.addEventListener('click', () => nav.classList.remove('is-open')));

  /* ---------- Scroll-driven: progress + process track ---------- */
  const progress = $('#progressBar');
  const processSec = $('#process'), track = $('#processTrack'), steps = $$('.step');
  const onScroll = () => {
    const y = window.scrollY, max = document.documentElement.scrollHeight - innerHeight;
    progress.style.transform = `scaleX(${max > 0 ? y / max : 0})`;
    if (!nav.classList.contains('is-open')) nav.classList.toggle('is-hidden', y > lastY && y > 300);
    lastY = y;

    if (!reduced) {
      const r = processSec.getBoundingClientRect();
      const total = processSec.offsetHeight - innerHeight;
      const p = clamp(-r.top / total, 0, 1);
      const dist = track.scrollWidth - innerWidth + Math.max(24, (innerWidth - 1200) / 2);
      track.style.transform = `translate3d(${-p * Math.max(0, dist)}px,0,0)`;
      steps.forEach((s, i) => s.style.setProperty('--p', clamp(p * steps.length - i, 0, 1)));
    }
  };
  addEventListener('scroll', onScroll, { passive: true });
  addEventListener('resize', onScroll);
  onScroll();

  /* ---------- Custom cursor + magnetic buttons ---------- */
  if (finePointer && !reduced) {
    const cursor = $('.cursor'), dot = $('.cursor__dot'), ring = $('.cursor__ring');
    let mx = innerWidth / 2, my = innerHeight / 2, rx = mx, ry = my;
    addEventListener('mousemove', (e) => { mx = e.clientX; my = e.clientY; });
    (function loop() {
      rx = lerp(rx, mx, 0.18); ry = lerp(ry, my, 0.18);
      dot.style.transform = `translate(${mx}px,${my}px) translate(-50%,-50%)`;
      ring.style.transform = `translate(${rx}px,${ry}px) translate(-50%,-50%)`;
      requestAnimationFrame(loop);
    })();
    document.addEventListener('mouseover', (e) => {
      cursor.classList.toggle('is-hover', !!e.target.closest('a, button, input, textarea, label, .card'));
    });

    $$('.magnetic').forEach((el) => {
      const strength = el.classList.contains('bigcta__btn') ? 0.4 : 0.25;
      el.addEventListener('mousemove', (e) => {
        const r = el.getBoundingClientRect();
        const x = e.clientX - r.left - r.width / 2, y = e.clientY - r.top - r.height / 2;
        el.style.transform = `translate(${x * strength}px, ${y * strength}px)`;
      });
      el.addEventListener('mouseleave', () => { el.style.transform = ''; });
    });

    /* Card tilt + spotlight */
    $$('.tilt').forEach((card) => {
      card.addEventListener('mousemove', (e) => {
        const r = card.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height;
        card.style.setProperty('--mx', px * 100 + '%');
        card.style.setProperty('--my', py * 100 + '%');
        card.style.transform = `perspective(900px) rotateX(${(0.5 - py) * 10}deg) rotateY(${(px - 0.5) * 10}deg) translateY(-4px)`;
      });
      card.addEventListener('mouseleave', () => { card.style.transform = ''; });
    });
  }

  /* ---------- Hero canvas: flowing particle field ---------- */
  (function heroCanvas() {
    const canvas = $('#heroCanvas'), ctx = canvas.getContext('2d');
    let w, h, dpr, particles = [], mouse = { x: -9999, y: -9999 };
    const resize = () => {
      dpr = Math.min(devicePixelRatio || 1, 2);
      w = canvas.clientWidth; h = canvas.clientHeight;
      canvas.width = w * dpr; canvas.height = h * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const n = Math.round(clamp((w * h) / 9000, 60, 180));
      particles = Array.from({ length: n }, () => ({
        x: Math.random() * w, y: Math.random() * h, vx: 0, vy: 0, s: Math.random() * 1.6 + 0.4, a: Math.random() * 0.5 + 0.2,
      }));
    };
    resize(); addEventListener('resize', resize);
    canvas.parentElement.addEventListener('mousemove', (e) => { const r = canvas.getBoundingClientRect(); mouse.x = e.clientX - r.left; mouse.y = e.clientY - r.top; });
    canvas.parentElement.addEventListener('mouseleave', () => { mouse.x = mouse.y = -9999; });
    let t = 0, visible = true;
    new IntersectionObserver(([e]) => { visible = e.isIntersecting; }).observe(canvas);
    const draw = () => {
      requestAnimationFrame(draw);
      if (!visible) return;
      t += 0.003;
      ctx.clearRect(0, 0, w, h);
      for (const p of particles) {
        const ang = Math.sin(p.x * 0.004 + t) * Math.cos(p.y * 0.004 - t) * Math.PI * 2;
        p.vx += Math.cos(ang) * 0.04; p.vy += Math.sin(ang) * 0.04;
        const dx = p.x - mouse.x, dy = p.y - mouse.y, d2 = dx * dx + dy * dy;
        if (d2 < 22000) { const f = (22000 - d2) / 22000; p.vx += (dx / Math.sqrt(d2 + 1)) * f * 1.2; p.vy += (dy / Math.sqrt(d2 + 1)) * f * 1.2; }
        p.vx *= 0.94; p.vy *= 0.94; p.x += p.vx; p.y += p.vy;
        if (p.x < 0) p.x = w; if (p.x > w) p.x = 0; if (p.y < 0) p.y = h; if (p.y > h) p.y = 0;
      }
      // links
      ctx.lineWidth = 0.6;
      for (let i = 0; i < particles.length; i++) {
        const a = particles[i];
        for (let j = i + 1; j < particles.length; j++) {
          const b = particles[j], dx = a.x - b.x, dy = a.y - b.y, d = dx * dx + dy * dy;
          if (d < 9000) { ctx.strokeStyle = `rgba(215,255,60,${(1 - d / 9000) * 0.12})`; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); }
        }
      }
      for (const p of particles) { ctx.fillStyle = `rgba(242,239,232,${p.a})`; ctx.beginPath(); ctx.arc(p.x, p.y, p.s, 0, Math.PI * 2); ctx.fill(); }
    };
    if (!reduced) draw(); else { for (const p of particles) { ctx.fillStyle = `rgba(242,239,232,${p.a})`; ctx.beginPath(); ctx.arc(p.x, p.y, p.s, 0, 6.28); ctx.fill(); } }
  })();

  /* ---------- Toast ---------- */
  const toastEl = $('#toast'); let toastT;
  const toast = (msg, isError) => {
    toastEl.textContent = msg; toastEl.classList.toggle('is-error', !!isError); toastEl.classList.add('is-show');
    clearTimeout(toastT); toastT = setTimeout(() => toastEl.classList.remove('is-show'), 4000);
  };

  /* ---------- Form helpers ---------- */
  const setErr = (form, name, msg) => {
    const input = form.elements[name]; if (!input) return;
    const field = input.closest('.field'); if (!field) return;
    field.classList.toggle('has-error', !!msg); $('small', field).textContent = msg || '';
  };
  const validate = (form, required) => {
    let ok = true;
    for (const name of required) {
      const v = (form.elements[name].value || '').trim();
      let msg = '';
      if (name === 'name' && v.length < 2) msg = 'Please enter your name';
      if (name === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)) msg = 'Please enter a valid email';
      if (name === 'phone') { const d = v.replace(/\D/g, ''); if (d.length < 10 || d.length > 13) msg = 'Please enter a valid phone number'; }
      setErr(form, name, msg); if (msg) ok = false;
    }
    return ok;
  };
  $$('.field input, .field textarea').forEach((el) => el.addEventListener('input', () => {
    const f = el.closest('.field'); f.classList.remove('has-error'); $('small', f).textContent = '';
  }));

  /* ---------- Lead form ---------- */
  const leadForm = $('#leadForm'), leadBtn = $('#leadBtn');
  leadForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!validate(leadForm, ['name', 'email', 'phone'])) return;
    const data = Object.fromEntries(new FormData(leadForm));
    leadBtn.classList.add('is-loading'); leadBtn.disabled = true;
    try {
      const res = await fetch('/api/leads', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.ok) {
        if (json.errors) Object.entries(json.errors).forEach(([k, v]) => setErr(leadForm, k, v));
        throw new Error(json.error || 'Please check the highlighted fields');
      }
      leadForm.classList.add('is-sent');
    } catch (err) {
      toast(err.message || 'Something went wrong. Please try again.', true);
    } finally {
      leadBtn.classList.remove('is-loading'); leadBtn.disabled = false;
    }
  });
  $('#leadAgain').addEventListener('click', () => { leadForm.reset(); leadForm.classList.remove('is-sent'); });

  /* ---------- Modals ---------- */
  const openModal = (m) => { m.classList.add('is-open'); document.body.style.overflow = 'hidden'; };
  const closeModal = (m) => { m.classList.remove('is-open'); document.body.style.overflow = ''; };
  $$('.modal').forEach((m) => $$('[data-close]', m).forEach((b) => b.addEventListener('click', () => closeModal(m))));
  addEventListener('keydown', (e) => { if (e.key === 'Escape') $$('.modal.is-open').forEach(closeModal); });

  /* ---------- Payments (Razorpay) ---------- */
  let config = { razorpayKeyId: null, plans: [] };
  fetch('/api/config').then((r) => r.json()).then((c) => { config = c; }).catch(() => {});

  const checkoutModal = $('#checkoutModal'), checkoutForm = $('#checkoutForm'), payBtn = $('#payBtn'), checkoutError = $('#checkoutError');
  let currentPlan = null;

  $$('[data-plan]').forEach((btn) => btn.addEventListener('click', () => {
    const plan = config.plans.find((p) => p.id === btn.dataset.plan) || { id: btn.dataset.plan, name: btn.dataset.plan, amount: 0 };
    currentPlan = plan;
    $('#checkoutTitle').textContent = `${plan.name} plan`;
    $('#checkoutAmount').textContent = plan.amount ? inr(plan.amount) : '';
    checkoutError.textContent = '';
    openModal(checkoutModal);
    setTimeout(() => $('#c-name').focus(), 300);
  }));

  checkoutForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    checkoutError.textContent = '';
    if (!validate(checkoutForm, ['name', 'email', 'phone'])) return;
    if (typeof window.Razorpay !== 'function') { checkoutError.textContent = 'Payment library failed to load. Check your internet connection.'; return; }
    const customer = Object.fromEntries(new FormData(checkoutForm));
    payBtn.classList.add('is-loading'); payBtn.disabled = true;
    try {
      const res = await fetch('/api/payment/create-order', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId: currentPlan.id, ...customer }),
      });
      const order = await res.json();
      if (!res.ok || !order.ok) throw new Error(order.error || 'Could not start payment');

      const rzp = new window.Razorpay({
        key: order.keyId,
        amount: order.amount,
        currency: order.currency,
        order_id: order.orderId,
        name: 'NovaEdge',
        description: `${order.planName} plan`,
        prefill: { name: customer.name, email: customer.email, contact: customer.phone },
        theme: { color: '#d7ff3c' },
        handler: async (resp) => {
          try {
            const v = await fetch('/api/payment/verify', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(resp) });
            const vj = await v.json();
            closeModal(checkoutModal);
            showResult(v.ok && vj.ok, vj.paymentId || resp.razorpay_payment_id, vj.error);
          } catch { showResult(false, resp.razorpay_payment_id, 'Could not verify payment'); }
        },
        modal: { ondismiss: () => toast('Payment cancelled') },
      });
      rzp.on('payment.failed', (r) => toast(r.error?.description || 'Payment failed', true));
      rzp.open();
    } catch (err) {
      checkoutError.textContent = err.message;
    } finally {
      payBtn.classList.remove('is-loading'); payBtn.disabled = false;
    }
  });

  const resultModal = $('#resultModal');
  function showResult(ok, paymentId, error) {
    $('#resultIcon').classList.toggle('is-fail', !ok);
    $('#resultTitle').textContent = ok ? 'Payment successful' : 'Payment not verified';
    $('#resultText').innerHTML = ok ? 'Your payment ID is <code id="resultId"></code>' : (error || 'Please contact support.') + ' <code id="resultId"></code>';
    $('#resultId').textContent = paymentId || '';
    const icon = $('#resultIcon'); const clone = icon.cloneNode(true); icon.replaceWith(clone); // restart draw animation
    openModal(resultModal);
    if (ok && !reduced) confetti($('#confetti'));
  }

  /* ---------- Confetti ---------- */
  function confetti(canvas) {
    const ctx = canvas.getContext('2d'), dpr = Math.min(devicePixelRatio || 1, 2);
    const w = canvas.clientWidth, h = canvas.clientHeight;
    canvas.width = w * dpr; canvas.height = h * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const colors = ['#d7ff3c', '#7c6cff', '#f2efe8', '#ff9f5b'];
    const bits = Array.from({ length: 120 }, () => ({
      x: w / 2, y: h * 0.35, vx: (Math.random() - 0.5) * 12, vy: Math.random() * -11 - 3,
      r: Math.random() * Math.PI, vr: (Math.random() - 0.5) * 0.3, s: Math.random() * 6 + 4, c: colors[(Math.random() * colors.length) | 0],
    }));
    let frames = 0;
    (function frame() {
      ctx.clearRect(0, 0, w, h);
      for (const b of bits) {
        b.vy += 0.3; b.vx *= 0.99; b.x += b.vx; b.y += b.vy; b.r += b.vr;
        ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(b.r); ctx.fillStyle = b.c; ctx.fillRect(-b.s / 2, -b.s / 4, b.s, b.s / 2); ctx.restore();
      }
      if (++frames < 180) requestAnimationFrame(frame); else ctx.clearRect(0, 0, w, h);
    })();
  }
})();
