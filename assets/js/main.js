/* =========================================================
   Spryar Tech — interactions (shared by every page;
   each feature checks its elements exist before running)
   ========================================================= */
(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- Header state + active nav link ---------- */
  const header = $('#header');
  const onScroll = () => header.classList.toggle('scrolled', scrollY > 10);
  addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  const here = location.pathname.split('/').pop() || 'index.html';
  $$('.nav a, #mobileNav nav a').forEach(a => {
    if (a.getAttribute('href') === here) a.setAttribute('aria-current', 'page');
  });

  /* =========================================================
     Animated line icons
     Every stroke inside [data-draw] is measured, hidden with
     stroke-dasharray/offset, then drawn in sequence when the
     icon scrolls into view. Hovering a [data-draw-trigger]
     parent replays the drawing.
     ========================================================= */
  const DRAW_MS = 1300;
  const STAGGER_MS = 140;
  const SHAPES = 'path, line, circle, ellipse, rect, polyline, polygon';

  function prepIcon(svg) {
    const strokes = $$(SHAPES, svg).filter(el => !el.classList.contains('fill-dot'));
    strokes.forEach((el, i) => {
      const len = Math.ceil(el.getTotalLength()) + 2;
      el.style.strokeDasharray = `${len} ${len}`;
      el.style.strokeDashoffset = len;
      el.dataset.len = len;
      el.dataset.delay = i * STAGGER_MS;
    });
    $$('.fill-dot', svg).forEach(dot => {
      dot.style.opacity = 0;
      dot.style.transformBox = 'fill-box';
      dot.style.transformOrigin = 'center';
      dot.style.transform = 'scale(0)';
      dot.dataset.delay = strokes.length * STAGGER_MS + DRAW_MS * 0.6;
    });
    svg._strokes = strokes;
  }

  function drawIcon(svg) {
    svg._strokes.forEach(el => {
      el.style.transition = `stroke-dashoffset ${DRAW_MS}ms cubic-bezier(.65,.05,.36,1) ${el.dataset.delay}ms`;
      el.style.strokeDashoffset = 0;
    });
    $$('.fill-dot', svg).forEach(dot => {
      dot.style.transition = `opacity .4s ${dot.dataset.delay}ms, transform .6s cubic-bezier(.16,1,.3,1) ${dot.dataset.delay}ms`;
      dot.style.opacity = 1;
      dot.style.transform = 'scale(1)';
    });
    svg.dataset.drawn = '1';
  }

  function resetIcon(svg) {
    svg._strokes.forEach(el => {
      el.style.transition = 'none';
      el.style.strokeDashoffset = el.dataset.len;
    });
    $$('.fill-dot', svg).forEach(dot => {
      dot.style.transition = 'none';
      dot.style.opacity = 0;
      dot.style.transform = 'scale(0)';
    });
    svg.getBoundingClientRect(); // flush so the next draw animates from empty
  }

  const icons = $$('[data-draw]');
  if (!reduced) {
    icons.forEach(prepIcon);
    const iconIO = new IntersectionObserver(entries => {
      entries.forEach(e => {
        if (e.isIntersecting) { drawIcon(e.target); iconIO.unobserve(e.target); }
      });
    }, { threshold: 0.4 });
    icons.forEach(svg => iconIO.observe(svg));

    $$('[data-draw-trigger]').forEach(card => {
      let busy = false;
      card.addEventListener('mouseenter', () => {
        if (busy) return;
        $$('[data-draw]', card).forEach(svg => {
          if (!svg.dataset.drawn) return;
          resetIcon(svg);
          drawIcon(svg);
        });
        busy = true;
        setTimeout(() => (busy = false), DRAW_MS);
      });
    });
  }

  /* =========================================================
     Fluted frosted-glass panels (home hero + page heroes)
     Each reed holds a blurred copy of the hero art, offset a
     few px. The copies are static: only opacity (intro) and a
     light sheen (pointer) animate, both GPU-composited, so the
     expensive blur is rasterised once instead of every frame.
     ========================================================= */
  $$('[data-hero]').forEach(hero => {
    const flutes = $('.flutes', hero);
    const bg = $('[data-hero-bg]', hero);
    if (!flutes || !bg) return;

    // Fewer, wider reeds on phones: 13 slivers in half a phone screen read as blinds, not glass.
    const phone = matchMedia('(max-width: 720px)');
    const reedCount = () => (phone.matches ? 6 : +flutes.dataset.reeds || 12);
    let n = 0, panes = [], lastKey = '';

    const build = () => {
      $$('.flute', flutes).forEach(f => f.remove());
      n = reedCount();
      panes = [];
      for (let i = 0; i < n; i++) {
        const f = document.createElement('span');
        f.className = 'flute';
        const t = i / (n - 1);
        // blur and tint ease off toward the clear edge so the reeds "merge" into the image
        f.style.setProperty('--blur', `${22 - t * 8}px`);
        // real photos are busier than the placeholder art, so the glass is tinted deeper for legibility
        const tint = bg.classList.contains('has-photo') ? 0.6 - t * 0.4 : 0.42 - t * 0.36;
        f.style.setProperty('--tint', tint.toFixed(2));
        f.style.transitionDelay = `${i * 60}ms`;
        const img = bg.cloneNode(true);
        img.removeAttribute('data-hero-bg');
        img.classList.add('flute-img');
        $$('.ph-tag', img).forEach(x => x.remove());
        f.appendChild(img);
        flutes.insertBefore(f, flutes.lastElementChild);
        panes.push({ el: f, img, shift: (i % 2 ? 1 : -1) * (6 + (i % 3) * 3) });
      }
      lastKey = '';
      applyBlurred();
    };

    /* Pre-blurred photos. A live CSS blur on 13 reed copies has to be recomputed on every
       frame of a slide cross-fade, which made the arrows feel jerky. Instead each photo is
       blurred once into a small image (downscale, then smooth upscale); the reeds show that
       plain image, so fading between slides costs almost nothing. */
    const srcLayers = $$('.hb-layer', bg);
    const blurred = new Array(srcLayers.length).fill(null);
    function applyBlurred() {
      if (!blurred.some(Boolean)) return;
      panes.forEach(p => {
        $$('.hb-layer', p.img).forEach((layer, k) => {
          if (blurred[k]) layer.style.backgroundImage = `url("${blurred[k]}")`;
        });
      });
      if (blurred.every(Boolean)) flutes.classList.add('preblurred');
    }
    const loadFirst = async urls => {
      for (const u of urls) {
        try {
          const im = new Image();
          im.src = u;
          await im.decode();
          return im;
        } catch (_) { /* fall through to the next url in the layered background */ }
      }
      return null;
    };
    const blurToUrl = im => {
      const step = (src, w) => {
        const cv = document.createElement('canvas');
        cv.width = w;
        cv.height = Math.max(1, Math.round((im.naturalHeight / im.naturalWidth) * w));
        const ctx = cv.getContext('2d');
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(src, 0, 0, cv.width, cv.height);
        return cv;
      };
      // ~56px wide is a strong frosted blur once scaled back up; two upscale passes keep it smooth
      const out = step(step(step(im, 56), 180), 540);
      const ctx = out.getContext('2d');
      if ('filter' in ctx) { // gentle lift, where supported
        const tmp = step(out, out.width);
        ctx.filter = 'saturate(1.2) brightness(1.08)';
        ctx.drawImage(tmp, 0, 0);
      }
      return new Promise(res => out.toBlob(b => res(b ? URL.createObjectURL(b) : null), 'image/jpeg', 0.86));
    };
    const urlsOf = layer => [...(layer.style.backgroundImage || '').matchAll(/url\(["']?([^"')]+)["']?\)/g)].map(m => m[1]);
    srcLayers.forEach((layer, k) => {
      loadFirst(urlsOf(layer))
        .then(im => (im ? blurToUrl(im) : null))
        .then(url => { if (url) { blurred[k] = url; applyBlurred(); } });
    });

    // keep every reed's copy aligned to the hero, plus its refraction shift
    const layout = () => {
      const w = hero.clientWidth, h = hero.clientHeight;
      const key = `${w}x${h}`;
      if (key === lastKey) return;
      lastKey = key;
      panes.forEach(p => {
        p.img.style.width = `${w}px`;
        p.img.style.height = `${h}px`;
        p.img.style.left = `${-p.el.offsetLeft + p.shift}px`;
      });
    };
    build();
    layout();
    new ResizeObserver(layout).observe(hero);
    setTimeout(() => {
      flutes.classList.add('in');
      hero.classList.add('is-in', 'kb-run');
    }, 80);
    // pause the Ken Burns move while the hero is scrolled out of view
    new IntersectionObserver(([e]) => hero.classList.toggle('is-offscreen', !e.isIntersecting)).observe(hero);
    // crossing the phone breakpoint (e.g. rotating a tablet): rebuild the reeds and
    // restart every Ken Burns copy in the same frame so they stay aligned
    phone.addEventListener('change', () => {
      build();
      layout();
      hero.classList.remove('kb-run');
      void hero.offsetWidth;
      hero.classList.add('kb-run');
    });

    // the sheen glides across the reeds following the pointer
    if (!reduced && matchMedia('(pointer: fine)').matches) {
      let raf = 0, px = 0.5;
      hero.addEventListener('pointermove', e => {
        const r = hero.getBoundingClientRect();
        px = (e.clientX - r.left) / r.width;
        if (raf) return;
        raf = requestAnimationFrame(() => {
          raf = 0;
          const glassRight = flutes.offsetWidth / r.width;
          panes.forEach((p, i) => {
            const offset = (px / glassRight * n - i) * 45;
            p.el.style.setProperty('--sheen', `${Math.max(-100, Math.min(100, offset))}%`);
          });
        });
      });
      hero.addEventListener('pointerleave', () => panes.forEach(p => p.el.style.setProperty('--sheen', '-60%')));
    }
  });

  /* ---------- Home hero slides (stacked; height never changes) ----------
     Each slide has a photo layer (data-i). Slides advance every SLIDE_MS and pause
     while the pointer or keyboard focus is on the hero text, so nobody is cut off mid-read. */
  const slideEls = $$('[data-slide]');
  const tabsEl = $('#heroTabs');
  const homeHero = $('#top');
  if (slideEls.length && tabsEl && homeHero) {
    const SLIDE_MS = 10000;
    let current = -1, timer, startedAt = 0, remaining = SLIDE_MS, paused = false;
    tabsEl.style.setProperty('--slide-ms', `${SLIDE_MS}ms`);
    const tabs = slideEls.map((_, i) => {
      const b = document.createElement('button');
      b.className = 'hero-tab';
      b.setAttribute('role', 'tab');
      b.setAttribute('aria-label', `Slide ${i + 1}`);
      b.innerHTML = '<span class="bar"><i></i></span>';
      b.addEventListener('click', () => go(i));
      tabsEl.appendChild(b);
      return b;
    });
    // every copy of a slide's photo: the hero itself plus each glass reed
    const layersFor = i => $$(`.hb-layer[data-i="${i}"]`, homeHero);

    const go = i => {
      const next = (i + slideEls.length) % slideEls.length;
      if (next === current) return schedule(SLIDE_MS);
      const prevIdx = current;
      const prev = slideEls[prevIdx];
      if (prev) {
        prev.classList.remove('is-active');
        prev.classList.add('is-leaving');
        prev.setAttribute('aria-hidden', 'true');
        // once it has left, snap it back below the line without animating through view
        setTimeout(() => {
          if (prev.classList.contains('is-active')) return;
          prev.classList.add('no-anim');
          prev.classList.remove('is-leaving');
          prev.getBoundingClientRect();
          prev.classList.remove('no-anim');
        }, 450);
        // only one photo may sit under the incoming one; clear any older outgoing photo at once
        $$('.hb-layer.is-leaving', homeHero).forEach(l => l.classList.remove('is-leaving'));
        // outgoing photo stays opaque underneath (and keeps zooming) until the new one has faded in
        layersFor(prevIdx).forEach(l => { l.classList.remove('is-on'); l.classList.add('is-leaving'); });
        setTimeout(() => {
          if (current !== prevIdx) layersFor(prevIdx).forEach(l => l.classList.remove('is-leaving'));
        }, 950);
      }
      current = next;
      const el = slideEls[current];
      el.classList.remove('is-leaving', 'no-anim');
      el.classList.add('is-active');
      el.removeAttribute('aria-hidden');
      // restart the Ken Burns move on every copy in the same frame
      const incoming = layersFor(current);
      incoming.forEach(l => { l.classList.remove('is-leaving'); l.style.animation = 'none'; });
      void homeHero.offsetWidth;
      incoming.forEach(l => { l.style.animation = ''; l.classList.add('is-on'); });
      tabs.forEach((t, k) => {
        t.classList.remove('active', 'done');
        void t.offsetWidth; // restart the fill animation
        if (k < current) t.classList.add('done');
        if (k === current) t.classList.add('active');
        t.setAttribute('aria-selected', k === current);
      });
      schedule(SLIDE_MS);
    };
    const schedule = ms => {
      clearTimeout(timer);
      remaining = ms;
      if (reduced || paused) return;
      startedAt = performance.now();
      timer = setTimeout(() => go(current + 1), ms);
    };
    const pause = () => {
      if (paused) return;
      paused = true;
      clearTimeout(timer);
      remaining = Math.max(1200, remaining - (performance.now() - startedAt));
      homeHero.classList.add('is-paused');
    };
    const resume = () => {
      if (!paused) return;
      paused = false;
      homeHero.classList.remove('is-paused');
      schedule(remaining);
    };
    const copy = $('.hero-copy', homeHero);
    copy.addEventListener('pointerenter', pause);
    copy.addEventListener('pointerleave', resume);
    copy.addEventListener('focusin', pause);
    copy.addEventListener('focusout', e => { if (!copy.contains(e.relatedTarget)) resume(); });
    $('#heroPrev')?.addEventListener('click', () => go(current - 1));
    $('#heroNext')?.addEventListener('click', () => go(current + 1));
    document.addEventListener('visibilitychange', () => (document.hidden ? pause() : resume()));
    // no slide changes while the hero is scrolled away
    new IntersectionObserver(([e]) => (e.isIntersecting ? resume() : pause())).observe(homeHero);
    setTimeout(() => go(0), 120);
  }

  /* ---------- Reveal on scroll ---------- */
  const revealIO = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (e.isIntersecting) { e.target.classList.add('in'); revealIO.unobserve(e.target); }
    });
  }, { threshold: 0.15 });
  $$('.reveal').forEach((el, i) => {
    el.style.transitionDelay = `${(i % 3) * 90}ms`;
    revealIO.observe(el);
  });
  $$('.step').forEach((el, i) => {
    el.style.setProperty('--d', `${(i % 4) * 150}ms`);
    revealIO.observe(el);
  });

  /* ---------- About statement: words light up with scroll ---------- */
  const statement = $('#aboutStatement');
  if (statement) {
    const walk = node => {
      [...node.childNodes].forEach(n => {
        if (n.nodeType === 3) {
          const frag = document.createDocumentFragment();
          n.textContent.split(/(\s+)/).forEach(part => {
            if (!part.trim()) return frag.appendChild(document.createTextNode(part));
            const w = document.createElement('span');
            w.className = 'w';
            w.textContent = part;
            frag.appendChild(w);
          });
          n.replaceWith(frag);
        }
      });
    };
    walk(statement);
    const words = $$('.w', statement);
    const light = () => {
      const r = statement.getBoundingClientRect();
      const vh = innerHeight;
      const p = Math.min(1, Math.max(0, (vh * 0.85 - r.top) / (r.height + vh * 0.35)));
      const lit = Math.round(p * words.length);
      words.forEach((w, i) => w.classList.toggle('lit', i < lit));
    };
    if (reduced) words.forEach(w => w.classList.add('lit'));
    else { addEventListener('scroll', light, { passive: true }); light(); }
  }

  /* ---------- Count-up stats ---------- */
  const countIO = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (!e.isIntersecting) return;
      const el = e.target, end = +el.dataset.count, t0 = performance.now(), dur = 1600;
      const tick = t => {
        const k = Math.min(1, (t - t0) / dur);
        el.textContent = Math.round(end * (1 - Math.pow(1 - k, 4)));
        if (k < 1) requestAnimationFrame(tick);
      };
      reduced ? (el.textContent = end) : requestAnimationFrame(tick);
      countIO.unobserve(el);
    });
  }, { threshold: 0.6 });
  $$('[data-count]').forEach(el => countIO.observe(el));

  /* ---------- Industries switcher (home) ---------- */
  const indItems = $$('.ind-item');
  if (indItems.length) {
    const indImgs = $$('.ind-visual .ph');
    const indCounter = $('#indCounter');
    const activate = item => {
      const i = +item.dataset.index;
      indItems.forEach(x => x.classList.toggle('active', x === item));
      indImgs.forEach((img, j) => img.classList.toggle('active', j === i));
      if (indCounter) indCounter.textContent = `0${i + 1} / 0${indItems.length}`;
    };
    indItems.forEach(item => {
      item.addEventListener('mouseenter', () => activate(item));
      item.addEventListener('click', () => activate(item));
      item.addEventListener('focus', () => activate(item));
    });
  }

  /* ---------- Case study filters ---------- */
  const chips = $$('[data-filter]');
  if (chips.length) {
    const posts = $$('[data-cat]');
    chips.forEach(chip => chip.addEventListener('click', () => {
      const f = chip.dataset.filter;
      chips.forEach(c => c.classList.toggle('active', c === chip));
      posts.forEach(p => (p.hidden = f !== 'all' && p.dataset.cat !== f));
    }));
  }

  /* ---------- Marquees: duplicate contents once for a seamless loop ---------- */
  $$('#marquee, [data-marquee]').forEach(track => {
    [...track.children].forEach(item => {
      const copy = item.cloneNode(true);
      copy.setAttribute('aria-hidden', 'true');
      $$('img', copy).forEach(img => (img.alt = ''));
      track.appendChild(copy);
    });
  });

  /* ---------- Contact: building photo / map switch ---------- */
  $$('[data-media-toggle]').forEach(box => {
    const buttons = $$('[data-show]', box);
    buttons.forEach(btn => btn.addEventListener('click', () => {
      const view = btn.dataset.show;
      buttons.forEach(b => { b.classList.toggle('active', b === btn); b.setAttribute('aria-pressed', b === btn); });
      $$('[data-view]', box).forEach(v => (v.hidden = v.dataset.view !== view));
      // load the map only when it is first asked for
      const frame = $(`[data-view="${view}"] iframe[data-src]`, box);
      if (frame && !frame.src) frame.src = frame.dataset.src;
    }));
  });

  /* ---------- Contact dot map: South Africa ---------- */
  const map = $('#dotMap');
  if (map) {
    // simplified border as [longitude, latitude]; Lesotho and Eswatini are cut out
    const SA = [[16.45,-28.6],[17.0,-29.4],[17.4,-30.4],[18.0,-31.4],[18.3,-32.4],[17.9,-32.9],[18.4,-33.9],[18.5,-34.3],[18.8,-34.1],[19.3,-34.4],[20.0,-34.8],[21.0,-34.4],[22.1,-34.1],[23.4,-34.0],[24.8,-34.2],[25.6,-33.9],[26.5,-33.7],[27.5,-33.2],[28.5,-32.4],[29.5,-31.4],[30.3,-30.4],[31.0,-29.8],[31.6,-28.9],[32.4,-28.4],[32.9,-26.9],[32.1,-26.8],[31.97,-25.95],[32.0,-24.5],[31.9,-23.5],[31.5,-22.4],[30.5,-22.3],[29.4,-22.2],[28.9,-22.4],[28.0,-22.8],[27.3,-23.4],[26.8,-24.2],[25.9,-24.7],[25.6,-25.6],[24.8,-25.8],[23.5,-25.3],[22.7,-25.9],[22.0,-26.5],[21.0,-26.8],[20.6,-26.6],[20.0,-24.8],[20.0,-28.4],[19.5,-28.6],[18.5,-28.9],[17.4,-28.7]];
    const LESOTHO = [[27.0,-29.6],[27.5,-29.0],[28.2,-28.7],[29.0,-28.9],[29.4,-29.5],[29.1,-30.2],[28.4,-30.6],[27.6,-30.5]];
    const ESWATINI = [[30.8,-26.3],[31.3,-25.7],[31.9,-25.95],[32.1,-26.8],[31.3,-27.3],[30.8,-26.8]];
    const inside = (pt, poly) => {
      let hit = false;
      for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
        const [xi, yi] = poly[i], [xj, yj] = poly[j];
        if ((yi > pt[1]) !== (yj > pt[1]) && pt[0] < ((xj - xi) * (pt[1] - yi)) / (yj - yi) + xi) hit = !hit;
      }
      return hit;
    };
    const K = 22; // px per degree
    const toXY = ([lon, lat]) => [(lon - 16) * K + 10, (-lat - 22) * K * 1.12 + 10];
    const toLonLat = (x, y) => [(x - 10) / K + 16, -((y - 10) / (K * 1.12) + 22)];
    let dots = '';
    for (let y = 10; y < 340; y += 8) {
      for (let x = 10; x < 400; x += 8) {
        const p = toLonLat(x, y);
        if (inside(p, SA) && !inside(p, LESOTHO) && !inside(p, ESWATINI)) {
          dots += `<circle cx="${x}" cy="${y}" r="1.7" fill="currentColor"/>`;
        }
      }
    }
    const [hx, hy] = toXY([28.05, -26.1]); // Sandton head office
    map.setAttribute('viewBox', '0 0 400 340');
    map.innerHTML = dots +
      `<circle cx="${hx}" cy="${hy}" r="5" fill="var(--signal)"/>` +
      `<circle class="map-pulse" cx="${hx}" cy="${hy}" r="5" fill="none" stroke="var(--signal)" stroke-width="1.5"/>`;
  }

  /* ---------- Site search (static index of every page and section) ---------- */
  const SEARCH_INDEX = [
    { t: 'Home', u: 'index.html', s: 'Spryar Tech — Beyond Technology. Infrastructure engineering, asset management, data engineering and GIS from one accountable team.' },
    { t: 'About us', u: 'about.html', s: 'A leader in physical asset management, technology solutions and advisory services in Sandton, South Africa.' },
    { t: 'Our team', u: 'about.html#team', s: 'Herbert Zulu, Chief Executive Officer. Andile Gwebu, Head: Asset Management. Thulani Tshabalala, Head: GIS & Spatial Modelling.' },
    { t: 'Clients & professional affiliations', u: 'about.html#clients', s: 'Eskom, Transnet, DBSA, IDC, Exxaro, EY, PepsiCo, PIC, Debswana, STANLIB, City of Ekurhuleni, SANParks, ERWAT. ECSA, CESA, SAAMA, WPiAM, ASA.' },
    { t: 'Asset lifecycle', u: 'about.html', s: 'Creation, insurance, operation, maintenance, decommissioning and disposal.' },
    { t: 'Services', u: 'services.html', s: 'Four disciplines, one integrated capability.' },
    { t: 'Infrastructure Engineering', u: 'services.html#infrastructure-engineering', s: 'Mechanical, electrical, civil, chemical, mining and renewable energy engineering. SHERQ, EPCM, CAD, commissioning, project management.' },
    { t: 'Physical Asset Management', u: 'services.html#physical-asset-management', s: 'Inspection, condition analysis, valuation, risk assessment, preventive maintenance, compliance and decommissioning.' },
    { t: 'Data Engineering', u: 'services.html#data-engineering', s: 'Cloud architecture, Snowflake accredited partner, ETL/ELT pipelines, Java, Microsoft Cloud, AWS, fintech.' },
    { t: 'GIS & Spatial Analytics', u: 'services.html#gis-spatial-analytics', s: 'Geospatial mapping, risk and hazard modelling, location intelligence, weather integration, web GIS dashboards.' },
    { t: 'Industries', u: 'industries.html', s: 'Sector expertise across asset-heavy, high-stakes industries.' },
    { t: 'Energy & Utilities', u: 'industries.html#energy-utilities', s: 'Substations, networks, outage risk modelling, utility compliance.' },
    { t: 'Transport & Logistics', u: 'industries.html#transport-logistics', s: 'Road, rail, corridors, fleet and route risk mapping.' },
    { t: 'Government & Public Infrastructure', u: 'industries.html#government-public-infrastructure', s: 'Municipal asset registers, public works, condition audits.' },
    { t: 'Financial Services', u: 'industries.html#financial-services', s: 'Fintech data architecture, Snowflake warehousing, governed pipelines.' },
    { t: 'Mining & Industrial', u: 'industries.html#mining-industrial', s: 'Heavy asset condition assessment, dispersed sites, maintenance planning.' },
    { t: 'Telecommunications & ICT', u: 'industries.html#telecommunications-ict', s: 'Tower and network inspection, network footprint mapping.' },
    { t: 'Case studies', u: 'case-studies.html', s: 'Selected projects across engineering, asset management, data and GIS.' },
    { t: 'CSI', u: 'csi.html', s: 'Corporate social investment: STEM education, enterprise development, community.' },
    { t: 'Careers', u: 'careers.html', s: 'Open roles, graduates and interns. Engineers, data engineers, GIS analysts.' },
    { t: 'Privacy statement', u: 'privacy.html', s: 'POPIA, personal information, cookies, your rights, Information Officer, data protection.' },
    { t: 'Contact us', u: 'contact.html', s: '11th Floor, Sandton City Towers, Cnr 5th St & Rivonia Road. 087 265 6818. info@spryartech.co.za' },
  ];
  const searchOverlay = $('#searchOverlay');
  if (searchOverlay) {
    const input = $('input[type="search"]', searchOverlay);
    const list = $('#searchResults', searchOverlay);
    const empty = $('#searchEmpty', searchOverlay);
    const escapeHtml = s => s.replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
    const highlight = (text, terms) => {
      let html = escapeHtml(text);
      terms.forEach(term => {
        const safe = escapeHtml(term).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        html = html.replace(new RegExp(`(^|[^a-z0-9])(${safe})`, 'gi'), '$1<mark>$2</mark>');
      });
      return html;
    };
    let results = [], activeIdx = 0;
    const render = () => {
      const terms = input.value.toLowerCase().trim().split(/\s+/).filter(Boolean);
      if (!terms.length) { list.innerHTML = ''; empty.hidden = true; results = []; return; }
      // match at the start of words, so "gis" finds GIS but not "logistics"
      const res = terms.map(term => new RegExp(`(^|[^a-z0-9])${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'i'));
      results = SEARCH_INDEX
        .map(item => {
          if (!res.every(re => re.test(item.t) || re.test(item.s))) return null;
          const score = res.reduce((n, re, k) => n + (re.test(item.t) ? 3 : 0) + (item.t.toLowerCase().startsWith(terms[k]) ? 2 : 0) + 1, 0);
          return { ...item, score };
        })
        .filter(Boolean)
        .sort((a, b) => b.score - a.score)
        .slice(0, 8);
      activeIdx = 0;
      empty.hidden = results.length > 0;
      list.innerHTML = results.map((r, i) =>
        `<li${i === 0 ? ' class="active"' : ''}><a href="${r.u}"><strong>${highlight(r.t, terms)}</strong><span class="mono">${r.u.split('#')[0].replace('.html', '').replace('index', 'home')}</span><p>${highlight(r.s, terms)}</p></a></li>`
      ).join('');
    };
    const setActive = i => {
      const items = $$('li', list);
      if (!items.length) return;
      activeIdx = (i + items.length) % items.length;
      items.forEach((li, k) => li.classList.toggle('active', k === activeIdx));
      items[activeIdx].scrollIntoView({ block: 'nearest' });
    };
    input.addEventListener('input', render);
    input.addEventListener('keydown', e => {
      if (e.key === 'ArrowDown') { e.preventDefault(); setActive(activeIdx + 1); }
      if (e.key === 'ArrowUp') { e.preventDefault(); setActive(activeIdx - 1); }
    });
    $('form', searchOverlay).addEventListener('submit', e => {
      e.preventDefault();
      if (results[activeIdx]) location.href = results[activeIdx].u;
    });
    list.addEventListener('click', e => { if (e.target.closest('a')) closeAll(); });
  }

  /* ---------- Overlays & mobile nav ---------- */
  const panels = { search: $('#searchOverlay'), video: $('#videoOverlay'), menu: $('#mobileNav') };
  const open = name => {
    const p = panels[name];
    if (!p) return;
    p.classList.add('open');
    p.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    if (name === 'search') setTimeout(() => $('input', p).focus(), 200);
  };
  const closeAll = () => {
    Object.values(panels).forEach(p => { p?.classList.remove('open'); p?.setAttribute('aria-hidden', 'true'); });
    document.body.style.overflow = '';
  };
  $$('[data-open]').forEach(b => b.addEventListener('click', () => open(b.dataset.open)));
  $$('[data-close]').forEach(b => b.addEventListener('click', closeAll));
  $$('#mobileNav nav a').forEach(a => a.addEventListener('click', closeAll));
  $$('.overlay').forEach(o => o.addEventListener('click', e => { if (e.target === o) closeAll(); }));
  addEventListener('keydown', e => { if (e.key === 'Escape') closeAll(); });

  /* ---------- Contact form (front-end only; wire to your backend) ---------- */
  const form = $('#contactForm');
  if (form) {
    const sel = $('#f-service');
    sel.addEventListener('change', () => sel.classList.toggle('has-value', !!sel.value));
    // preselect a service from ?service=… (links on the services page)
    const wanted = new URLSearchParams(location.search).get('service');
    if (wanted) {
      const opt = [...sel.options].find(o => o.text.toLowerCase().replace(/[^a-z]+/g, '-').startsWith(wanted));
      if (opt) { sel.value = opt.value || opt.text; sel.classList.add('has-value'); }
    }
    form.addEventListener('submit', e => {
      e.preventDefault();
      const v = name => (form.elements[name]?.value || '').trim();
      const name = v('name'), email = v('email'), message = v('message');
      $('.form-success', form)?.remove();
      const msg = document.createElement('div');
      msg.className = 'form-success';
      msg.setAttribute('role', 'status');
      if (!name || !/^\S+@\S+\.\S+$/.test(email) || !message) {
        msg.textContent = 'Please add your name, a valid email address and a short message.';
        form.appendChild(msg);
        return;
      }
      // No backend yet: open the visitor's email client with the enquiry pre-filled.
      const org = v('org');
      const subject = `New enquiry from ${name}${org ? ` (${org})` : ''}`;
      const details = [
        `Name: ${name}`, org && `Company: ${org}`, `Email: ${email}`, v('phone') && `Phone: ${v('phone')}`,
        v('service') && `Service of interest: ${v('service')}`,
      ].filter(Boolean);
      const body = `${details.join('\n')}\n\n${message}`;
      location.href = `mailto:${form.dataset.mailto}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
      msg.textContent = `Thanks, ${name}. Your email client should now be open with the message ready to send.`;
      form.appendChild(msg);
    });
  }

  /* ---------- Cookie consent ---------- */
  const cookie = $('#cookie');
  if (cookie) {
    const KEY = 'spryartech-cookie-consent';
    let stored = null;
    try { stored = localStorage.getItem(KEY); } catch (_) {}
    if (!stored) setTimeout(() => cookie.classList.add('show'), 1400);
    $$('[data-cookie]', cookie).forEach(b => b.addEventListener('click', () => {
      try { localStorage.setItem(KEY, b.dataset.cookie); } catch (_) {}
      cookie.classList.remove('show');
    }));
    $$('#cookieSettings, [data-cookie-settings]').forEach(a => a.addEventListener('click', e => { e.preventDefault(); cookie.classList.add('show'); }));
  }

  /* ---------- Back to top: show only while the footer is on screen ---------- */
  const toTop = $('#toTop'), footer = $('.footer');
  if (toTop && footer) {
    new IntersectionObserver(([entry]) => {
      toTop.classList.toggle('show', entry.isIntersecting);
      toTop.tabIndex = entry.isIntersecting ? 0 : -1;
    }, { threshold: 0.15 }).observe(footer);
    toTop.addEventListener('click', e => {
      e.preventDefault();
      scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' });
      header.querySelector('a')?.focus({ preventScroll: true });
    });
  }

  const year = $('#year');
  if (year) year.textContent = new Date().getFullYear();
})();
