(function () {
  const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  document.querySelectorAll('a[href^="#"]').forEach(function (link) {
    link.addEventListener("click", function (event) {
      const id = link.getAttribute("href");
      if (!id || id === "#") return;
      const target = document.querySelector(id);
      if (!target) return;
      event.preventDefault();
      target.scrollIntoView({
        behavior: prefersReduced ? "auto" : "smooth",
        block: "start",
      });
      if (typeof target.focus === "function") {
        target.setAttribute("tabindex", "-1");
        target.focus({ preventScroll: true });
      }
    });
  });

  document.querySelectorAll("[data-cv]").forEach(function (link) {
    link.addEventListener("click", function (event) {
      event.preventDefault();
      const href = link.getAttribute("href");
      fetch(href, { method: "HEAD" })
        .then(function (response) {
          if (response.ok) {
            window.location.assign(href);
            return;
          }
          window.print();
        })
        .catch(function () {
          window.print();
        });
    });
  });

  // ============================================================================
  // LIVING SIGNAL CANVAS ENGINE (Multi-Alphabet Generative Glyph & Dithering)
  // ============================================================================
  const CELL = 12;

  // Specialized technical glyph palettes (Beyond 0/1/#)
  const GLYPHS_HALFTONE = ["·", "░", "▒", "▓", "█"];
  const GLYPHS_SPECTRUM = ["·", "▁", "▂", "▃", "▄", "▅", "▆", "▇", "█"];
  const GLYPHS_SUBBLOCK = ["·", "▖", "▘", "▝", "▗", "▞", "▚", "▛", "█"];
  const GLYPHS_CRYPTO = ["⊕", "⊗", "Δ", "Ω", "λ", "§", "◈", "∑"];
  const GLYPHS_DIRECTIONS = ["─", "╱", "│", "╲"];
  const GLYPHS_SHADE = ["·", ":", "░", "▒", "▓", "▪", "◉", "█"];

  // Fast 2D trigonometric noise for organic RF topography
  function rfNoise(x, y, t) {
    const v1 = Math.sin(x * 0.22 + t * 1.35) * Math.cos(y * 0.24 - t * 0.95);
    const v2 = Math.sin(x * 0.15 - y * 0.19 + t * 0.85) * 0.65;
    const v3 = Math.cos(Math.hypot(x - 10, y - 6) * 0.38 - t * 1.6) * 0.5;
    return (v1 + v2 + v3 + 2.15) / 4.3;
  }

  // Distance from point P to segment AB in 2D screen space
  function distToSegment(px, py, ax, ay, bx, by) {
    const l2 = (bx - ax) * (bx - ax) + (by - ay) * (by - ay);
    if (l2 === 0) return Math.hypot(px - ax, py - ay);
    let t = ((px - ax) * (bx - ax) + (py - ay) * (by - ay)) / l2;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(px - (ax + t * (bx - ax)), py - (ay + t * (by - ay)));
  }

  // 3D Cube vertices & 12 edges for the Isometric Tesseract Architecture
  const CUBE_VERTS = [
    [-1, -1, -1],
    [1, -1, -1],
    [1, 1, -1],
    [-1, 1, -1],
    [-1, -1, 1],
    [1, -1, 1],
    [1, 1, 1],
    [-1, 1, 1],
  ];
  const CUBE_EDGES = [
    [0, 1], [1, 2], [2, 3], [3, 0],
    [4, 5], [5, 6], [6, 7], [7, 4],
    [0, 4], [1, 5], [2, 6], [3, 7],
  ];

  function projectCube(rotX, rotY, rotZ, scale) {
    const cx = Math.cos(rotX), sx = Math.sin(rotX);
    const cy = Math.cos(rotY), sy = Math.sin(rotY);
    const cz = Math.cos(rotZ), sz = Math.sin(rotZ);

    return CUBE_VERTS.map(function (v) {
      let x = v[0], y = v[1], z = v[2];
      let x1 = x * cy + z * sy;
      let z1 = -x * sy + z * cy;
      let y2 = y * cx - z1 * sx;
      let z2 = y * sx + z1 * cx;
      let x3 = x1 * cz - y2 * sz;
      let y3 = x1 * sz + y2 * cz;

      const persp = 3.6 / (3.6 - z2 * 0.45);
      return [x3 * scale * persp, y3 * scale * persp, z2];
    });
  }

  function initSignalBlock(mediaEl) {
    const mode = mediaEl.getAttribute("data-signal");
    const canvas = mediaEl.querySelector(".signal-canvas");
    const card = mediaEl.closest("[data-signal-card]") || mediaEl;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    let width = 0;
    let height = 0;
    let cols = 0;
    let rows = 0;
    let dpr = Math.min(window.devicePixelRatio || 1, 2);

    const state = {
      hovered: false,
      hoverMix: 0, // 0 = rest (noir profond), 1 = hover (Bleu Klein électrique)
      pointerX: 0.5,
      pointerY: 0.5,
      smoothX: 0.5,
      smoothY: 0.5,
      visible: true,
      phase: Math.random() * 50,
    };

    function ensureSize() {
      const rect = mediaEl.getBoundingClientRect();
      const w = Math.max(1, Math.floor(rect.width || mediaEl.clientWidth || 280));
      const h = Math.max(1, Math.floor(rect.height || mediaEl.clientHeight || 168));
      const currentDpr = Math.min(window.devicePixelRatio || 1, 2);
      if (w !== width || h !== height || currentDpr !== dpr) {
        width = w;
        height = h;
        dpr = currentDpr;
        canvas.width = width * dpr;
        canvas.height = height * dpr;
        cols = Math.ceil(width / CELL);
        rows = Math.ceil(height / CELL);
      }
    }

    function updatePointer(clientX, clientY) {
      const rect = mediaEl.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      state.pointerX = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      state.pointerY = Math.max(0, Math.min(1, (clientY - rect.top) / rect.height));
    }

    card.addEventListener("mouseenter", function (e) {
      state.hovered = true;
      updatePointer(e.clientX, e.clientY);
    });

    card.addEventListener("mousemove", function (e) {
      state.hovered = true;
      updatePointer(e.clientX, e.clientY);
    });

    card.addEventListener("mouseleave", function () {
      state.hovered = false;
    });

    let simTime = state.phase;
    let lastNow = performance.now();

    function render(now) {
      ensureSize();
      const currentNow = now || performance.now();
      const dt = Math.min(0.05, Math.max(0, (currentNow - lastNow) * 0.001));
      lastNow = currentNow;

      // Balanced speed at rest (0.58x), responsive on hover (0.85x)
      const timeScale = 0.58 + state.hoverMix * 0.27;
      simTime += dt * timeScale;
      const t = simTime;

      // Smooth interpolation for hover state and magnetic cursor
      const targetMix = state.hovered ? 1 : 0;
      state.hoverMix += (targetMix - state.hoverMix) * 0.14;
      state.smoothX += (state.pointerX - state.smoothX) * 0.16;
      state.smoothY += (state.pointerY - state.smoothY) * 0.16;

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, width, height);
      ctx.font = '600 11px "Instrument Sans", sans-serif';
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      const mx = state.smoothX * cols;
      const my = state.smoothY * rows;
      const aspect = cols / Math.max(1, rows);

      // Precompute 3D tesseract projections once per frame if mode === "tesseract"
      let outerVerts = null;
      let innerVerts = null;
      if (mode === "tesseract") {
        const rx = 0.55 + t * 0.65 + (state.smoothY - 0.5) * state.hoverMix * 2.4;
        const ry = t * 0.95 + (state.smoothX - 0.5) * state.hoverMix * 2.8;
        const rz = t * 0.35;
        outerVerts = projectCube(rx, ry, rz, 0.54);
        innerVerts = projectCube(-rx * 1.2, -ry * 1.1, rz * 1.4, 0.25 * (1 + state.hoverMix * 0.22));
      }

      for (let r = 0; r < rows; r++) {
        const cy = r * CELL + CELL * 0.5;
        const ny = (r / Math.max(1, rows - 1)) * 2 - 1;

        for (let c = 0; c < cols; c++) {
          const cx = c * CELL + CELL * 0.5;
          const nx = ((c / Math.max(1, cols - 1)) * 2 - 1) * aspect;
          const dx = c - mx;
          const dy = r - my;
          const distCursor = Math.hypot(dx, dy);

          let glyph = "·";
          let intensity = 0.25;
          let isPeak = false;

          if (mode === "heatmap") {
            // DELCOM 1: Topographic RF Heatmap (Halftone Dithering ░ ▒ ▓ █)
            const baseField = rfNoise(c, r, t);
            const scannerBoost = state.hoverMix * Math.max(0, 1 - distCursor / 7.5);
            const ringPulse =
              state.hoverMix *
              Math.exp(-Math.pow(distCursor - ((t * 5.5) % 9), 2) * 0.65) *
              0.5;

            const signal = Math.min(1, baseField * 0.82 + scannerBoost * 0.68 + ringPulse);
            const idx = Math.min(
              GLYPHS_HALFTONE.length - 1,
              Math.floor(signal * GLYPHS_HALFTONE.length)
            );
            glyph = GLYPHS_HALFTONE[idx];

            intensity = 0.24 + Math.pow(signal, 1.25) * (0.66 + state.hoverMix * 0.34);
            isPeak = signal > 0.68 || (state.hoverMix > 0.2 && distCursor < 3.4);
          } else if (mode === "radar") {
            // DELCOM 2: Indoor Cellular Propagation & Wall Echo (◎ ○ ┼ ─)
            const originX = state.hoverMix > 0.05 ? mx : cols * 0.5;
            const originY = state.hoverMix > 0.05 ? my : rows * 0.5;

            const d0 = Math.hypot(c - originX, r - originY);
            const dLeft = Math.hypot(c + originX, r - originY);
            const dRight = Math.hypot(cols * 2 - c - originX, r - originY);
            const dTop = Math.hypot(c - originX, r + originY);

            const speed = t * 4.5;
            const w0 = Math.cos(d0 * 0.85 - speed);
            const wReflect =
              0.45 * Math.cos(dLeft * 0.85 - speed) +
              0.45 * Math.cos(dRight * 0.85 - speed) +
              0.35 * Math.cos(dTop * 0.85 - speed);

            const isPartition =
              (c === Math.floor(cols * 0.33) || c === Math.floor(cols * 0.68)) &&
              r % 3 !== 1;

            const combined = (w0 + wReflect * (0.45 + state.hoverMix * 0.55) + 1.8) / 3.6;
            const attenuation = Math.max(0.25, 1 - d0 / (cols * 0.95));
            const val = Math.max(0, Math.min(1, combined * attenuation));

            if (isPartition) {
              glyph = "│";
              intensity = 0.45 + state.hoverMix * 0.45;
            } else if (d0 < 1.25) {
              glyph = "◉";
              intensity = 1;
              isPeak = true;
            } else if (val > 0.65) {
              glyph = "◎";
              intensity = 0.68 + state.hoverMix * 0.32;
              isPeak = true;
            } else if (val > 0.46) {
              glyph = "○";
              intensity = 0.45 + state.hoverMix * 0.4;
            } else if (val > 0.3) {
              glyph = "◌";
              intensity = 0.3 + state.hoverMix * 0.35;
            } else {
              glyph = "·";
              intensity = 0.2 + state.hoverMix * 0.22;
            }
          } else if (mode === "matrix") {
            // DELCOM 3: Synchronized Industrial Sector Matrix (GDIZ) — Sub-block cells ▖ ▘ ▝ ▞ █
            const isAisle = c % 5 === 0 || r % 4 === 0;
            const blockX = Math.floor(c / 5);
            const blockY = Math.floor(r / 4);
            const blockSeed = blockX * 3.7 + blockY * 5.3;

            if (isAisle) {
              const isCorner = c % 5 === 0 && r % 4 === 0;
              glyph = isCorner ? "┼" : c % 5 === 0 ? "│" : "─";
              const busPacket = Math.sin(c * 0.6 - r * 0.6 + t * 5) > 0.72;
              intensity = busPacket ? 0.55 + state.hoverMix * 0.45 : 0.2 + state.hoverMix * 0.2;
              isPeak = busPacket;
            } else {
              const syncWave = 0.5 + 0.5 * Math.sin(t * 3.2 + blockSeed);
              const cursorBoost = state.hoverMix * Math.max(0, 1 - distCursor / 6.5);
              const level = Math.min(1, syncWave * 0.78 + cursorBoost * 0.75);
              const idx = Math.min(
                GLYPHS_SUBBLOCK.length - 1,
                Math.floor(level * GLYPHS_SUBBLOCK.length)
              );
              glyph = GLYPHS_SUBBLOCK[idx];
              intensity = 0.25 + level * (0.65 + state.hoverMix * 0.35);
              isPeak = level > 0.74;
            }
          } else if (mode === "flow") {
            // DELCOM 4: Vector Field & Drive Test Highway Streams (─ ╱ │ ╲ ▸)
            const fieldAngle =
              Math.sin(c * 0.16 + t * 0.9) * 0.75 +
              Math.cos(r * 0.22 - t * 0.7) * 0.65;

            let angle = fieldAngle;
            if (state.hoverMix > 0.05 && distCursor < 8.5) {
              const swirlAngle = Math.atan2(dy, dx) + Math.PI * 0.5;
              const pull = (1 - distCursor / 8.5) * state.hoverMix;
              angle = fieldAngle * (1 - pull) + swirlAngle * pull;
            }

            const normAngle = (((angle % Math.PI) + Math.PI) % Math.PI) / Math.PI;
            const dirIdx = Math.floor(((normAngle + 0.125) % 1) * 4);
            glyph = GLYPHS_DIRECTIONS[dirIdx];

            const stream = Math.sin(c * 0.38 - r * 0.28 - t * 5.2);
            const cursorWake = state.hoverMix * Math.max(0, 1 - distCursor / 6.2);

            if (cursorWake > 0.58) {
              glyph = distCursor < 1.4 ? "◈" : "▸";
              intensity = 0.95;
              isPeak = true;
            } else if (stream > 0.68) {
              intensity = 0.68 + state.hoverMix * 0.32;
              isPeak = true;
            } else if (stream > 0.15) {
              intensity = 0.38 + state.hoverMix * 0.35;
            } else {
              glyph = "·";
              intensity = 0.2 + state.hoverMix * 0.22;
            }
          } else if (mode === "singularity") {
            // MAPCOM 1: 3D Torus Vortex / Gravitational Singularity (░ ▒ ▓ █ ◉)
            const focusX = (state.smoothX * 2 - 1) * aspect * state.hoverMix * 0.45;
            const focusY = (state.smoothY * 2 - 1) * state.hoverMix * 0.45;

            const px = nx - focusX;
            const py = (ny - focusY) * (1.35 - state.hoverMix * 0.25);
            const radius = Math.hypot(px, py);
            const theta = Math.atan2(py, px);

            const ringDist = Math.abs(radius - 0.62);
            const spiral = Math.sin(theta * 4 - t * 4.2 + 3.2 / (radius + 0.18));
            const torusTube = Math.exp(-ringDist * ringDist * 14);
            const coreGlow = Math.exp(-radius * radius * 9) * (0.55 + 0.45 * Math.sin(t * 5));

            const lightAngle = theta - t * 1.8;
            const specular = 0.55 + 0.45 * Math.cos(lightAngle);

            const energy = Math.min(
              1,
              torusTube * (0.65 + 0.45 * spiral) * specular +
                coreGlow +
                Math.max(0, spiral) * 0.28 * Math.exp(-radius * 0.8)
            );

            if (radius < 0.15) {
              glyph = "◉";
              intensity = 0.98;
              isPeak = true;
            } else if (energy > 0.42) {
              const sIdx = Math.min(
                GLYPHS_SHADE.length - 1,
                Math.floor(energy * GLYPHS_SHADE.length)
              );
              glyph = GLYPHS_SHADE[sIdx];
              intensity = 0.35 + energy * 0.65;
              isPeak = energy > 0.68;
            } else if (spiral > 0.45 && radius < 1.35) {
              const tangentAngle = theta + Math.PI * 0.5;
              const nAng = (((tangentAngle % Math.PI) + Math.PI) % Math.PI) / Math.PI;
              glyph = GLYPHS_DIRECTIONS[Math.floor(((nAng + 0.125) % 1) * 4)];
              intensity = 0.32 + state.hoverMix * 0.38;
            } else {
              glyph = "·";
              intensity = 0.14 + state.hoverMix * 0.18;
            }
          } else if (mode === "prism") {
            // MAPCOM 2: Quantum Phase-Array & Twin-Core Interference (◈ ◎ ░ ▒ ▓)
            const s1x = state.hoverMix > 0.05
              ? (state.smoothX * 2 - 1) * aspect
              : Math.cos(t * 1.1) * 0.65;
            const s1y = state.hoverMix > 0.05
              ? state.smoothY * 2 - 1
              : Math.sin(t * 1.4) * 0.38;

            const s2x = -Math.cos(t * 0.9) * 0.68;
            const s2y = Math.cos(t * 1.3) * 0.42;

            const d1 = Math.hypot(nx - s1x, ny - s1y);
            const d2 = Math.hypot(nx - s2x, ny - s2y);

            const freq = 10.5 + state.hoverMix * 3.5;
            const wave1 = Math.sin(d1 * freq - t * 4.8);
            const wave2 = Math.sin(d2 * freq - t * 4.8);
            const moire = (wave1 + wave2) * 0.5;

            const scanAngle = (t * 1.6) % (Math.PI * 2);
            const pointAngle = Math.atan2(ny, nx);
            let angleDiff = Math.abs(pointAngle - (scanAngle - Math.PI));
            if (angleDiff > Math.PI) angleDiff = Math.PI * 2 - angleDiff;
            const laserSweep = Math.exp(-angleDiff * 6.5);

            const absMoire = Math.abs(moire);
            const signal = Math.min(1, absMoire * 0.78 + laserSweep * 0.48);

            if (d1 < 0.14 || d2 < 0.14) {
              glyph = "◈";
              intensity = 1;
              isPeak = true;
            } else if (moire > 0.62) {
              glyph = moire > 0.85 ? "▓" : "▒";
              intensity = 0.65 + signal * 0.35;
              isPeak = true;
            } else if (moire < -0.62) {
              glyph = (c + r) % 2 === 0 ? "◎" : "○";
              intensity = 0.48 + laserSweep * 0.5;
              isPeak = laserSweep > 0.45;
            } else if (laserSweep > 0.35) {
              glyph = "╱";
              intensity = 0.55 + laserSweep * 0.45;
              isPeak = true;
            } else {
              glyph = absMoire > 0.3 ? "░" : "·";
              intensity = 0.16 + absMoire * 0.28;
            }
          } else if (mode === "tesseract") {
            // MAPCOM 3: 4D Hypercube / Isometric Tesseract Blueprint (◈ ┼ ▪ ░)
            let minEdgeDist = 999;
            let minVertexDist = 999;
            let isInner = false;

            for (let i = 0; i < 8; i++) {
              const dvOut = Math.hypot(nx - outerVerts[i][0], ny - outerVerts[i][1]);
              const dvIn = Math.hypot(nx - innerVerts[i][0], ny - innerVerts[i][1]);
              if (dvOut < minVertexDist) minVertexDist = dvOut;
              if (dvIn < minVertexDist) minVertexDist = dvIn;

              const dConn = distToSegment(
                nx, ny,
                innerVerts[i][0], innerVerts[i][1],
                outerVerts[i][0], outerVerts[i][1]
              );
              if (dConn < minEdgeDist) {
                minEdgeDist = dConn;
                isInner = true;
              }
            }

            for (let e = 0; e < CUBE_EDGES.length; e++) {
              const a = CUBE_EDGES[e][0];
              const b = CUBE_EDGES[e][1];
              const dOut = distToSegment(
                nx, ny,
                outerVerts[a][0], outerVerts[a][1],
                outerVerts[b][0], outerVerts[b][1]
              );
              if (dOut < minEdgeDist) {
                minEdgeDist = dOut;
                isInner = false;
              }
              const dIn = distToSegment(
                nx, ny,
                innerVerts[a][0], innerVerts[a][1],
                innerVerts[b][0], innerVerts[b][1]
              );
              if (dIn < minEdgeDist) {
                minEdgeDist = dIn;
                isInner = true;
              }
            }

            if (minVertexDist < 0.13) {
              glyph = "◈";
              intensity = 1;
              isPeak = true;
            } else if (minEdgeDist < 0.095) {
              const packet = Math.sin((nx + ny) * 10 - t * 8) > 0.4;
              glyph = isInner ? (packet ? "▓" : "┼") : (packet ? "█" : "┼");
              intensity = 0.72 + state.hoverMix * 0.28;
              isPeak = true;
            } else if (minEdgeDist < 0.18) {
              glyph = "░";
              intensity = 0.34 + state.hoverMix * 0.3;
            } else {
              const isCrosshair = c % 6 === 3 && r % 4 === 2;
              glyph = isCrosshair ? "┼" : "·";
              intensity = isCrosshair ? 0.26 + state.hoverMix * 0.22 : 0.13 + state.hoverMix * 0.15;
            }
          } else if (mode === "ccna-mesh") {
            // ACCREDITATION 1 (CCNA 2): Dynamic Switching & Wireless Mesh
            const gridStepX = 6;
            const gridStepY = 4;
            const onBusX = c % gridStepX === 2;
            const onBusY = r % gridStepY === 2;

            const waveOriginX = state.hoverMix > 0.05 ? mx : cols * 0.5;
            const waveOriginY = state.hoverMix > 0.05 ? my : rows * 0.45;
            const distWave = Math.hypot(c - waveOriginX, r - waveOriginY);
            const wifiPulse = Math.cos(distWave * 0.9 - t * 5.2);

            if (onBusX && onBusY) {
              const nodeActive = Math.sin(c * 0.9 + r * 1.1 + t * 4) > 0 || distWave < 4.5;
              glyph = nodeActive ? "◉" : "◎";
              intensity = nodeActive ? 0.95 : 0.58;
              isPeak = nodeActive;
            } else if (onBusX) {
              const pkt = Math.sin(r * 0.85 - t * 9 + c) > 0.65;
              glyph = pkt ? "▮" : "│";
              intensity = pkt ? 0.88 : 0.35 + state.hoverMix * 0.28;
              isPeak = pkt;
            } else if (onBusY) {
              const pkt = Math.sin(c * 0.85 - t * 9 + r) > 0.65;
              glyph = pkt ? "▬" : "─";
              intensity = pkt ? 0.88 : 0.35 + state.hoverMix * 0.28;
              isPeak = pkt;
            } else if (wifiPulse > 0.68) {
              glyph = wifiPulse > 0.88 ? "◌" : "░";
              intensity = 0.45 + state.hoverMix * 0.45;
              isPeak = wifiPulse > 0.86;
            } else {
              glyph = "·";
              intensity = 0.14 + state.hoverMix * 0.16;
            }
          } else if (mode === "ccna-osi") {
            // ACCREDITATION 2 (CCNA 1): 7-Layer OSI Protocol Stack & Packet Bus
            const layerIdx = r % 3;
            const layerNum = Math.floor(r / 2);
            const direction = layerNum % 2 === 0 ? 1 : -1;
            const speed = (3.5 + (layerNum % 4) * 1.4) * direction;

            const cursorProx = state.hoverMix * Math.max(0, 1 - distCursor / 6.5);
            const carrier =
              0.5 +
              0.5 * Math.sin(c * 0.32 - t * speed + layerNum * 1.7) *
                Math.cos(c * 0.14 + t * 1.8);
            const signal = Math.min(1, carrier * 0.82 + cursorProx * 0.72);

            if (layerIdx === 0) {
              const isHeader = Math.sin(c * 0.45 - t * speed * 1.6) > 0.75;
              glyph = isHeader ? "▸" : "─";
              intensity = isHeader ? 0.85 : 0.24 + state.hoverMix * 0.22;
              isPeak = isHeader;
            } else {
              const barIdx = Math.min(
                GLYPHS_SPECTRUM.length - 1,
                Math.floor(signal * GLYPHS_SPECTRUM.length)
              );
              glyph = GLYPHS_SPECTRUM[barIdx];
              intensity = 0.26 + signal * 0.74;
              isPeak = signal > 0.75;
            }
          } else if (mode === "cyber-vault") {
            // ACCREDITATION 3 (Cybersecurity): Hexagonal Crypto-Shield & XOR Matrix
            const centerX = state.hoverMix > 0.05 ? (state.smoothX * 2 - 1) * aspect * 0.5 : 0;
            const centerY = state.hoverMix > 0.05 ? (state.smoothY * 2 - 1) * 0.5 : -0.05;
            const px = nx - centerX;
            const py = ny - centerY;

            const ax = Math.abs(px);
            const ay = Math.abs(py);
            const hexDist = Math.max(ax * 0.866025 + ay * 0.5, ay);

            const shieldRadius = 0.62 + Math.sin(t * 2.5) * 0.04;
            const ringDelta = Math.abs(hexDist - shieldRadius);
            const innerCore = hexDist < 0.22;

            if (innerCore) {
              glyph = hexDist < 0.11 ? "◈" : "⊕";
              intensity = 0.98;
              isPeak = true;
            } else if (ringDelta < 0.11) {
              glyph = "▓";
              intensity = 0.88 + state.hoverMix * 0.12;
              isPeak = true;
            } else if (hexDist < shieldRadius) {
              const gateIdx =
                Math.abs(Math.floor(c * 3 + r * 5 + t * 2.5)) % GLYPHS_CRYPTO.length;
              glyph = GLYPHS_CRYPTO[gateIdx];
              intensity = 0.52 + state.hoverMix * 0.38;
              isPeak = (c + r) % 3 === 0;
            } else {
              const deflectWave = Math.sin(hexDist * 9 - t * 6);
              if (deflectWave > 0.65) {
                const cipherIdx =
                  Math.abs(Math.floor(c * 7 - r * 3 + t * 9)) % GLYPHS_CRYPTO.length;
                glyph = GLYPHS_CRYPTO[cipherIdx];
                intensity = 0.42 + state.hoverMix * 0.4;
              } else {
                glyph = deflectWave > 0.2 ? "░" : "·";
                intensity = 0.15 + state.hoverMix * 0.18;
              }
            }
          } else if (mode === "ssv-sector") {
            // ACCREDITATION 4 (SSV): Tri-Sector 120° RF Beamforming
            const towerX = 0;
            const towerY = -0.05;
            const px = nx - towerX;
            const py = ny - towerY;
            const dist = Math.hypot(px, py);
            const angle = Math.atan2(py, px);

            const cursorAngle = Math.atan2(
              (state.smoothY * 2 - 1) - towerY,
              (state.smoothX * 2 - 1) * aspect - towerX
            );
            const rotBase = state.hoverMix > 0.15 ? cursorAngle : t * 0.85;

            const lobe3 = Math.max(0, Math.cos((angle - rotBase) * 1.5));
            const mainBeam = Math.pow(lobe3, 2.2);
            const pulseRing = 0.5 + 0.5 * Math.sin(dist * 10 - t * 6.5);
            const attenuation = Math.max(0, 1 - dist / 1.45);

            const rfPower = Math.min(1, mainBeam * attenuation * (0.65 + 0.35 * pulseRing));

            if (dist < 0.13) {
              glyph = "◈";
              intensity = 1;
              isPeak = true;
            } else if (
              Math.abs(Math.sin((angle - rotBase) * 1.5)) < 0.09 &&
              dist < 1.25
            ) {
              glyph = "┼";
              intensity = 0.36 + state.hoverMix * 0.35;
            } else if (rfPower > 0.18) {
              const hIdx = Math.min(
                GLYPHS_HALFTONE.length - 1,
                Math.floor(rfPower * GLYPHS_HALFTONE.length)
              );
              glyph = GLYPHS_HALFTONE[hIdx];
              intensity = 0.28 + rfPower * 0.72;
              isPeak = rfPower > 0.58;
            } else {
              glyph = "·";
              intensity = 0.14 + state.hoverMix * 0.16;
            }
          } else if (mode === "ccna-core") {
            // ACCREDITATION 5 (CCNA 200-301): 3D Dithered Network Sphere & Orbital Ring
            const rotY = t * 1.1 + (state.smoothX - 0.5) * state.hoverMix * 2.5;
            const tiltX = 0.45 + (state.smoothY - 0.5) * state.hoverMix * 1.2;

            const rSphere = 0.68;
            const d2 = nx * nx + ny * ny;

            const ringY = ny * Math.cos(tiltX);
            const ringDist = Math.abs(Math.hypot(nx * 0.72, ringY * 1.85) - 0.78);

            if (ringDist < 0.085 && (ny > 0 || d2 > rSphere * rSphere)) {
              const orbPkt = Math.sin(Math.atan2(ny, nx) * 5 - t * 7) > 0.5;
              glyph = orbPkt ? "◉" : "◎";
              intensity = orbPkt ? 0.98 : 0.65;
              isPeak = true;
            } else if (d2 <= rSphere * rSphere) {
              const nz = Math.sqrt(Math.max(0, rSphere * rSphere - d2));
              const lon = Math.atan2(nx, nz) + rotY;
              const lat = Math.asin(ny / rSphere);

              const meridianGrid =
                Math.abs(Math.sin(lon * 6)) < 0.16 ||
                Math.abs(Math.sin(lat * 5)) < 0.16;

              const lx = state.hoverMix > 0.1 ? (state.smoothX * 2 - 1) : -0.55;
              const ly = state.hoverMix > 0.1 ? (state.smoothY * 2 - 1) : -0.55;
              const lz = 0.75;
              const light = Math.max(
                0.15,
                (nx * lx + ny * ly + nz * lz) / (rSphere * 1.2)
              );

              if (meridianGrid) {
                const subIdx = Math.min(
                  GLYPHS_SUBBLOCK.length - 1,
                  Math.floor(light * GLYPHS_SUBBLOCK.length)
                );
                glyph = GLYPHS_SUBBLOCK[subIdx];
                intensity = 0.45 + light * 0.55;
                isPeak = light > 0.55;
              } else {
                const hIdx = Math.min(
                  GLYPHS_HALFTONE.length - 1,
                  Math.floor(light * 0.85 * GLYPHS_HALFTONE.length)
                );
                glyph = GLYPHS_HALFTONE[hIdx];
                intensity = 0.22 + light * 0.65;
                isPeak = light > 0.72;
              }
            } else if (ringDist < 0.085) {
              glyph = "◌";
              intensity = 0.35 + state.hoverMix * 0.3;
            } else {
              glyph = "·";
              intensity = 0.13 + state.hoverMix * 0.15;
            }
          } else if (mode === "voice-spectrum") {
            // ACCREDITATION 6 (Langue Anglaise): Acoustic Harmonic Equalizer & Carrier Wave
            const freqBand =
              Math.sin(c * 0.35 + t * 3.8) * 0.45 +
              Math.cos(c * 0.72 - t * 5.4) * 0.35 +
              Math.sin(c * 0.18 + t * 2.1) * 0.2;

            const cursorBoost =
              state.hoverMix * Math.exp(-Math.pow(c - mx, 2) * 0.08) * 0.55;
            const amplitude = Math.min(0.92, Math.abs(freqBand) * 0.75 + 0.18 + cursorBoost);

            const distFromCenter = Math.abs(ny + 0.08);

            if (distFromCenter < 0.09) {
              glyph = Math.sin(c * 0.6 - t * 8) > 0 ? "∿" : "≈";
              intensity = 0.88;
              isPeak = true;
            } else if (distFromCenter <= amplitude) {
              const ratio = 1 - distFromCenter / amplitude;
              const bIdx = Math.min(
                GLYPHS_SPECTRUM.length - 1,
                Math.max(1, Math.floor(ratio * GLYPHS_SPECTRUM.length))
              );
              glyph = GLYPHS_SPECTRUM[bIdx];
              intensity = 0.38 + ratio * 0.62;
              isPeak = ratio > 0.65;
            } else {
              glyph = "·";
              intensity = 0.14 + state.hoverMix * 0.16;
            }
          } else if (mode === "wifi-fill") {
            // ==================================================================
            // FORMATION 1 (INSTI): Pixel Wi-Fi Signal Arcs Progressively Filling Card
            // ==================================================================
            // Emitter at bottom-left corner of the banner (or cursor on hover)
            const emitX = state.hoverMix > 0.1 ? mx : 1.5;
            const emitY = state.hoverMix > 0.1 ? my : rows - 1;
            const dEmit = Math.hypot(c - emitX, (r - emitY) * 1.25);
            const maxSpan = Math.hypot(cols, rows * 1.25);

            // Progressive fill cycle: signal expands from 0 to full card capacity
            const fillFront = ((t * 0.48) % 1.15) * maxSpan;
            const ringSpacing = 3.2;
            const ringPhase = Math.cos((dEmit / ringSpacing) * Math.PI * 2 - t * 6.5);

            if (dEmit < 1.4) {
              glyph = "◉";
              intensity = 1;
              isPeak = true;
            } else if (dEmit <= fillFront) {
              if (ringPhase > 0.35) {
                glyph = ringPhase > 0.75 ? "█" : "▓";
                intensity = 0.72 + state.hoverMix * 0.28;
                isPeak = true;
              } else if (ringPhase > -0.2) {
                glyph = "▒";
                intensity = 0.42 + state.hoverMix * 0.3;
              } else {
                glyph = "░";
                intensity = 0.24 + state.hoverMix * 0.2;
              }
            } else {
              glyph = "·";
              intensity = 0.14 + state.hoverMix * 0.15;
            }
          } else if (mode === "oscilloscope") {
            // ==================================================================
            // FORMATION 2 (Baccalauréat): Dual-Trace Cathode Ray Oscilloscope
            // ==================================================================
            const freqMod = 1 + state.hoverMix * (state.smoothX + 0.4);
            const waveA =
              Math.sin(c * 0.34 * freqMod - t * 6.5) *
              Math.cos(c * 0.11 + t * 2.2) *
              0.72;
            const waveB =
              Math.cos(c * 0.24 - t * 4.2 + state.smoothY * 3) * 0.55;

            const distA = Math.abs(ny - waveA);
            const distB = Math.abs(ny - waveB);

            if (distA < 0.24) {
              glyph = distA < 0.12 ? "█" : "▓";
              intensity = 0.92;
              isPeak = true;
            } else if (distB < 0.22) {
              glyph = "▒";
              intensity = 0.62 + state.hoverMix * 0.35;
              isPeak = state.hoverMix > 0.3;
            } else if (r === Math.floor(rows * 0.5)) {
              glyph = c % 4 === 0 ? "┼" : "─";
              intensity = 0.28 + state.hoverMix * 0.25;
            } else {
              glyph = "·";
              intensity = 0.14 + state.hoverMix * 0.15;
            }
          } else if (mode === "globe-wave") {
            // ==================================================================
            // LANGUES & HOBBIES (648x470): 3D Dithered Globe + Pixel Ocean Wave + Benin Beacon
            // ==================================================================
            const gRadius = 0.72;
            const d2 = nx * nx + ny * ny;

            if (d2 <= gRadius * gRadius) {
              // 3D Globe surface
              const nz = Math.sqrt(Math.max(0, gRadius * gRadius - d2));
              const rotLon =
                t * 0.55 + (state.smoothX - 0.5) * state.hoverMix * 2.2;
              const lon = Math.atan2(nx, nz) + rotLon;
              const lat = Math.asin(ny / gRadius);

              // Benin beacon coordinates (~6.37°N, 2.39°E mapped onto visible front hemisphere)
              const beninLat = -0.18;
              const beninLon = 0.25 + rotLon;
              const bx = gRadius * Math.cos(beninLat) * Math.sin(beninLon - rotLon);
              const by = gRadius * Math.sin(beninLat);
              const dBenin = Math.hypot(nx - bx, ny - by);

              // Procedural continental landmass dithering + lat/lon graticule
              const continent =
                Math.sin(lon * 2.4 + 0.5) * Math.cos(lat * 2.8 - 0.2) +
                0.45 * Math.sin(lon * 5.1 - lat * 3.4);
              const isGraticule =
                Math.abs(Math.sin(lon * 6)) < 0.09 ||
                Math.abs(Math.sin(lat * 6)) < 0.09;

              const light = Math.max(0.18, (-nx * 0.4 - ny * 0.45 + nz * 0.85) / gRadius);

              if (dBenin < 0.095) {
                // Pulsing Benin Telecommunications Beacon (6.37°N, 2.39°E)
                glyph = "◉";
                intensity = 1;
                isPeak = true;
              } else if (Math.abs(dBenin - ((t * 0.45) % 0.42)) < 0.045) {
                // Expanding radio telemetry ring from Benin
                glyph = "◎";
                intensity = 0.92;
                isPeak = true;
              } else if (continent > 0.12) {
                const sIdx = Math.min(
                  GLYPHS_HALFTONE.length - 1,
                  Math.max(1, Math.floor(light * GLYPHS_HALFTONE.length))
                );
                glyph = GLYPHS_HALFTONE[sIdx];
                intensity = 0.42 + light * 0.58;
                isPeak = light > 0.62;
              } else if (isGraticule) {
                glyph = "┼";
                intensity = 0.28 + light * 0.35;
              } else {
                glyph = "░";
                intensity = 0.18 + light * 0.22;
              }
            } else {
              // Surrounding Pixel Wave Field (rippling pixel blocks lighting up in waves)
              const waveField =
                Math.sin(c * 0.24 - r * 0.18 - t * 3.8) +
                Math.cos(Math.hypot(nx, ny) * 6 - t * 4.2);
              const cursorRipple =
                state.hoverMix * Math.max(0, 1 - distCursor / 9.5);
              const wVal = (waveField + 2) / 4 + cursorRipple * 0.55;

              if (wVal > 0.78) {
                glyph = "▪";
                intensity = 0.58 + state.hoverMix * 0.42;
                isPeak = true;
              } else if (wVal > 0.58) {
                glyph = "░";
                intensity = 0.3 + state.hoverMix * 0.32;
              } else {
                glyph = "·";
                intensity = 0.13 + state.hoverMix * 0.15;
              }
            }
          }

          const alpha = Math.min(1, Math.max(0.15, intensity));
          if (state.hoverMix > 0.35) {
            // On Klein Blue background: crisp pure white glyphs
            const boostAlpha = Math.min(1, alpha + state.hoverMix * 0.24);
            ctx.fillStyle = "rgba(255, 255, 255, " + boostAlpha.toFixed(3) + ")";
          } else if (isPeak) {
            // Resting peaks: bright electric blue/white
            ctx.fillStyle = "rgba(95, 165, 255, " + Math.min(1, alpha + 0.25).toFixed(3) + ")";
          } else {
            // Resting base grid: subtle cool white
            ctx.fillStyle = "rgba(205, 215, 245, " + alpha.toFixed(3) + ")";
          }

          ctx.fillText(glyph, cx, cy);
        }
      }
    }

    if ("IntersectionObserver" in window) {
      const io = new IntersectionObserver(
        function (entries) {
          entries.forEach(function (entry) {
            state.visible = entry.isIntersecting;
          });
        },
        { threshold: 0.01 }
      );
      io.observe(mediaEl);
    }

    function loop(now) {
      if (state.visible) {
        render(now);
      }
      requestAnimationFrame(loop);
    }
    requestAnimationFrame(loop);
  }

  document.querySelectorAll("[data-signal]").forEach(initSignalBlock);

  // ============================================================================
  // HERO BLUEPRINT TELEMETRY FIELD (Subtle Architectural RF Grid on Warm Paper)
  // ============================================================================
  function initHeroField(frameEl) {
    const canvas = frameEl.querySelector(".hero__canvas");
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    const STEP = 24;
    let width = 0;
    let height = 0;
    let cols = 0;
    let rows = 0;
    let dpr = Math.min(window.devicePixelRatio || 1, 2);

    const state = {
      hovered: false,
      hoverMix: 0,
      pointerX: 0.5,
      pointerY: 0.5,
      smoothX: 0.5,
      smoothY: 0.5,
      visible: true,
    };

    function ensureSize() {
      const stage = canvas.parentElement || frameEl;
      const rect = stage.getBoundingClientRect();
      const w = Math.max(1, Math.floor(rect.width || 960));
      const h = Math.max(1, Math.floor(rect.height || 540));
      const currentDpr = Math.min(window.devicePixelRatio || 1, 2);
      if (w !== width || h !== height || currentDpr !== dpr) {
        width = w;
        height = h;
        dpr = currentDpr;
        canvas.width = width * dpr;
        canvas.height = height * dpr;
        cols = Math.ceil(width / STEP);
        rows = Math.ceil(height / STEP);
      }
    }

    frameEl.addEventListener("mouseenter", function (e) {
      state.hovered = true;
      const rect = canvas.getBoundingClientRect();
      state.pointerX = (e.clientX - rect.left) / Math.max(1, rect.width);
      state.pointerY = (e.clientY - rect.top) / Math.max(1, rect.height);
    });

    frameEl.addEventListener("mousemove", function (e) {
      state.hovered = true;
      const rect = canvas.getBoundingClientRect();
      state.pointerX = (e.clientX - rect.left) / Math.max(1, rect.width);
      state.pointerY = (e.clientY - rect.top) / Math.max(1, rect.height);
    });

    frameEl.addEventListener("mouseleave", function () {
      state.hovered = false;
    });

    function render(now) {
      ensureSize();
      const t = (now || performance.now()) * 0.0006;

      state.hoverMix += ((state.hovered ? 1 : 0) - state.hoverMix) * 0.12;
      state.smoothX += (state.pointerX - state.smoothX) * 0.15;
      state.smoothY += (state.pointerY - state.smoothY) * 0.15;

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, width, height);
      ctx.font = '600 12px "Instrument Sans", sans-serif';
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      const mx = state.smoothX * cols;
      const my = state.smoothY * rows;
      const centerCol = cols * 0.5;
      const centerRow = rows * 0.5;

      for (let r = 0; r < rows; r++) {
        const cy = r * STEP + STEP * 0.5;
        for (let c = 0; c < cols; c++) {
          const cx = c * STEP + STEP * 0.5;

          // Keep central zone behind the title calm and readable
          const normCenterDist = Math.hypot(
            (c - centerCol) / Math.max(1, cols * 0.34),
            (r - centerRow) / Math.max(1, rows * 0.36)
          );
          if (normCenterDist < 0.72) continue;

          const distCursor = Math.hypot(c - mx, r - my);
          const wave =
            Math.sin(c * 0.25 + t * 1.4) * Math.cos(r * 0.28 - t * 1.1) +
            Math.sin(Math.hypot(c - centerCol, r - centerRow) * 0.38 - t * 2.2) * 0.6;

          const cursorField = state.hoverMix * Math.max(0, 1 - distCursor / 7.5);
          const isMajorGrid = c % 4 === 0 && r % 3 === 0;

          let glyph = "·";
          let alpha = 0.14;
          let useAccent = false;

          if (cursorField > 0.58) {
            glyph = distCursor < 1.8 ? "◉" : "◎";
            alpha = 0.45 + cursorField * 0.45;
            useAccent = true;
          } else if (cursorField > 0.22) {
            glyph = "+";
            alpha = 0.28 + cursorField * 0.35;
            useAccent = true;
          } else if (wave > 0.78) {
            glyph = "┼";
            alpha = 0.26;
            useAccent = wave > 1.15;
          } else if (isMajorGrid) {
            glyph = "+";
            alpha = 0.2;
          } else {
            glyph = "·";
            alpha = 0.12;
          }

          // Fade smoothly near the central text halo
          const edgeFade = Math.min(1, (normCenterDist - 0.72) / 0.45);
          alpha *= edgeFade;

          if (useAccent) {
            ctx.fillStyle = "rgba(36, 82, 214, " + alpha.toFixed(3) + ")";
          } else {
            ctx.fillStyle = "rgba(10, 10, 12, " + alpha.toFixed(3) + ")";
          }

          ctx.fillText(glyph, cx, cy);
        }
      }
    }

    if ("IntersectionObserver" in window) {
      const io = new IntersectionObserver(
        function (entries) {
          entries.forEach(function (entry) {
            state.visible = entry.isIntersecting;
          });
        },
        { threshold: 0.01 }
      );
      io.observe(frameEl);
    }

    function loop(now) {
      if (state.visible) {
        render(now);
      }
      requestAnimationFrame(loop);
    }
    requestAnimationFrame(loop);
  }

  document.querySelectorAll("[data-hero-field]").forEach(initHeroField);

  // ============================================================================
  // OUTER SHELL AMBIENT SIGNALS (Random square clusters all around the frame)
  // ============================================================================
  function initShellCanvas() {
    const canvas = document.querySelector(".shell-canvas");
    const pageEl = document.querySelector(".page");
    if (!canvas || !pageEl) return;

    const ctx = canvas.getContext("2d");
    let width = 0;
    let height = 0;
    let dpr = Math.min(window.devicePixelRatio || 1, 2);

    // Square-pixel modes are weighted higher so the shell reads as "carrés"
    const MODES = [
      "pixels", "pixels", "blink", "blink", "scan", "bars",
      "radar", "heatmap", "matrix", "spectrum",
    ];
    const SHAPES = ["square", "square", "round", "diamond"];
    const CELLS = [8, 10, 12, 14, 16];
    const patches = [];
    let nextSpawnAt = 0;

    function rand(min, max) {
      return min + Math.random() * (max - min);
    }

    function pick(list) {
      return list[Math.floor(Math.random() * list.length)];
    }

    // Deterministic per-cell hash in [0, 1)
    function hash(a, b, c) {
      const s = Math.sin(a * 127.1 + b * 311.7 + c * 74.7) * 43758.5453;
      return s - Math.floor(s);
    }

    function resize() {
      width = window.innerWidth;
      height = window.innerHeight;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = width * dpr;
      canvas.height = height * dpr;
    }

    function maxPatches() {
      return Math.max(4, Math.min(12, Math.round((width * height) / 160000)));
    }

    // Visible shell regions around the frame (left, right, top, bottom)
    function visibleRegions() {
      const r = pageEl.getBoundingClientRect();
      const regions = [];
      if (r.left > 8) regions.push({ x0: 0, y0: 0, x1: r.left, y1: height });
      if (width - r.right > 8) regions.push({ x0: r.right, y0: 0, x1: width, y1: height });
      if (r.top > 8) regions.push({ x0: r.left, y0: 0, x1: r.right, y1: r.top });
      if (height - r.bottom > 8) {
        regions.push({ x0: r.left, y0: r.bottom, x1: r.right, y1: height });
      }
      return regions;
    }

    function spawnPatch(now) {
      const regions = visibleRegions();
      if (!regions.length) return;

      // Pick a region weighted by its visible area
      let total = 0;
      regions.forEach(function (g) {
        g.area = (g.x1 - g.x0) * (g.y1 - g.y0);
        total += g.area;
      });

      const cell = pick(CELLS);
      const cols = 3 + Math.floor(Math.random() * 10);
      const rows = 3 + Math.floor(Math.random() * 10);
      const radius = Math.max(cols, rows) * cell * 0.5;

      // Try a few random spots, keep the first that doesn't crowd others
      for (let attempt = 0; attempt < 8; attempt++) {
        let roll = Math.random() * total;
        let region = regions[0];
        for (let i = 0; i < regions.length; i++) {
          roll -= regions[i].area;
          if (roll <= 0) {
            region = regions[i];
            break;
          }
        }

        const x = rand(region.x0, region.x1);
        const y = rand(region.y0, region.y1);
        const crowded = patches.some(function (p) {
          return Math.hypot(p.x - x, p.y - y) < (p.radius + radius) * 0.9;
        });
        if (crowded) continue;

        patches.push({
          x: x,
          y: y,
          cell: cell,
          cols: cols,
          rows: rows,
          radius: radius,
          mode: pick(MODES),
          shape: pick(SHAPES),
          born: now,
          duration: rand(2600, 9000),
          speed: rand(0.6, 1.8),
          seed: Math.random() * 100,
        });
        return;
      }
    }

    function inShape(shape, dx, dy) {
      if (shape === "round") return Math.hypot(dx, dy);
      if (shape === "diamond") return Math.abs(dx) + Math.abs(dy);
      return Math.max(Math.abs(dx), Math.abs(dy));
    }

    function drawSquare(px, py, size, color) {
      ctx.fillStyle = color;
      ctx.fillRect(px - size * 0.5, py - size * 0.5, size, size);
    }

    resize();
    window.addEventListener("resize", resize, { passive: true });

    const startNow = performance.now();
    for (let i = 0; i < 5; i++) {
      spawnPatch(startNow - Math.random() * 3000);
    }

    function render(now) {
      if (now >= nextSpawnAt && patches.length < maxPatches()) {
        spawnPatch(now);
        nextSpawnAt = now + rand(180, 1400);
      }

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, width, height);
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      for (let i = patches.length - 1; i >= 0; i--) {
        const p = patches[i];
        const age = now - p.born;
        if (age >= p.duration) {
          patches.splice(i, 1);
          continue;
        }
        if (age < 0) continue;

        const envelope = Math.sin((age / p.duration) * Math.PI);
        const pt = (now * 0.0006) * p.speed + p.seed;
        const halfC = p.cols * 0.5;
        const halfR = p.rows * 0.5;
        const S = p.cell;
        ctx.font = "600 " + Math.round(S * 0.8) + 'px "Instrument Sans", sans-serif';

        for (let r = 0; r < p.rows; r++) {
          for (let c = 0; c < p.cols; c++) {
            const dx = (c + 0.5 - halfC) / halfC;
            const dy = (r + 0.5 - halfR) / halfR;
            const radial = inShape(p.shape, dx, dy);
            if (radial > 1) continue;

            const falloff = 1 - radial * 0.75;
            const px = Math.round(p.x / S) * S + (c - halfC) * S;
            const py = Math.round(p.y / S) * S + (r - halfR) * S;

            let level = 0; // 0..1 intensity
            let glyph = null;

            if (p.mode === "pixels") {
              level = rfNoise(c * 1.7 + p.seed, r * 1.7 + p.seed, pt);
            } else if (p.mode === "blink") {
              const h = hash(c, r, p.seed);
              const tick = Math.floor(pt * (1.5 + h * 3) + h * 10);
              level = hash(c, r, tick) > 0.55 ? 0.6 + 0.4 * h : 0.08;
            } else if (p.mode === "scan") {
              const line = ((pt * 4) % (p.rows + 4)) - 2;
              level = Math.max(0.08, 1 - Math.abs(r - line) * 0.45);
            } else if (p.mode === "bars") {
              const hgt = 0.5 + 0.5 * Math.sin(pt * 3 + c * 0.9 + hash(c, 1, p.seed) * 6);
              level = (p.rows - r) / p.rows < hgt ? 0.85 : 0.06;
            } else if (p.mode === "radar") {
              const wave = Math.cos(radial * 5.5 - pt * 4.2);
              glyph = radial < 0.22 ? "◉" : wave > 0.55 ? "◎" : wave > 0 ? "○" : "·";
              level = wave > 0.55 || radial < 0.22 ? 0.9 : 0.4;
            } else if (p.mode === "heatmap") {
              const n = rfNoise(c + p.seed, r + p.seed, pt);
              glyph = GLYPHS_HALFTONE[Math.min(GLYPHS_HALFTONE.length - 1, Math.floor(n * GLYPHS_HALFTONE.length))];
              level = n;
            } else if (p.mode === "matrix") {
              const v = 0.5 + 0.5 * Math.sin(pt * 3.5 + c * 1.3 + r * 1.7);
              glyph = GLYPHS_SUBBLOCK[Math.min(GLYPHS_SUBBLOCK.length - 1, Math.floor(v * GLYPHS_SUBBLOCK.length))];
              level = v;
            } else {
              const s = 0.5 + 0.5 * Math.sin(c * 0.6 - pt * 5);
              glyph = GLYPHS_SPECTRUM[Math.min(GLYPHS_SPECTRUM.length - 1, Math.floor(s * GLYPHS_SPECTRUM.length))];
              level = s;
            }

            const isPeak = level > 0.66;
            const alpha = envelope * falloff * (isPeak ? 0.75 : 0.18 + level * 0.3);
            if (alpha < 0.03) continue;

            const color = isPeak
              ? "rgba(77, 123, 255, " + alpha.toFixed(3) + ")"
              : "rgba(184, 199, 255, " + alpha.toFixed(3) + ")";

            if (glyph) {
              ctx.fillStyle = color;
              ctx.fillText(glyph, px, py);
            } else {
              // Square pixel whose size follows the intensity
              const size = Math.max(1.5, (S - 2) * (0.25 + 0.75 * level));
              drawSquare(px, py, size, color);
            }
          }
        }
      }

      if (!prefersReduced) requestAnimationFrame(render);
    }

    if (prefersReduced) {
      // Static frame only: no continuous motion
      render(startNow + 1500);
      window.addEventListener("resize", function () {
        render(startNow + 1500);
      }, { passive: true });
      return;
    }
    requestAnimationFrame(render);
  }

  initShellCanvas();

  // ============================================================================
  // SECTION BANDS (one unique, themed pixel animation per section header)
  //   Déploiements   → route    : drive-test vehicle sampling coverage along a road
  //   Accréditations → scan     : verification beam validating a certificate grid
  //   Formations     → progress : learning bars filling up at their own pace
  //   Langues        → wave     : voice waveform / spectrum
  //   Contact        → ping     : packets routed between network nodes
  // ============================================================================
  function initBands() {
    const heads = document.querySelectorAll(".section-head");
    if (!heads.length) return;

    const MODE_BY_ID = {
      deploiements: "route",
      accreditations: "scan",
      formations: "progress",
      langues: "wave",
      contact: "ping",
    };
    const FALLBACK = ["route", "scan", "progress", "wave", "ping"];
    const G = 6;
    const BLUE = "77,123,255";
    const ICE = "184,199,255";
    const WHITE = "255,255,255";
    const bands = [];

    function bHash(a, b, c) {
      const s = Math.sin(a * 127.1 + b * 311.7 + c * 74.7) * 43758.5453;
      return s - Math.floor(s);
    }

    function sq(ctx, x, y, s, rgb, a) {
      if (a < 0.02) return;
      ctx.fillStyle = "rgba(" + rgb + "," + Math.min(1, a).toFixed(3) + ")";
      ctx.fillRect(Math.round(x - s / 2), Math.round(y - s / 2), s, s);
    }

    // Dim the animation behind the centered title so it stays readable
    function textMask(b, x) {
      const d = Math.abs(x / b.w - 0.5);
      if (d < 0.14) return 0.2;
      if (d < 0.28) return 0.2 + ((d - 0.14) / 0.14) * 0.8;
      return 1;
    }

    heads.forEach(function (head, idx) {
      const owner = head.closest("[id]");
      const mode = (owner && MODE_BY_ID[owner.id]) || FALLBACK[idx % FALLBACK.length];
      const canvas = document.createElement("canvas");
      canvas.className = "band-canvas";
      canvas.setAttribute("aria-hidden", "true");
      head.insertBefore(canvas, head.firstChild);

      const band = {
        head: head,
        canvas: canvas,
        ctx: canvas.getContext("2d"),
        mode: mode,
        w: 0,
        h: 0,
        dpr: 1,
        visible: true,
        seed: Math.random() * 100,
        state: {},
      };
      bands.push(band);

      if ("IntersectionObserver" in window) {
        new IntersectionObserver(function (entries) {
          entries.forEach(function (e) {
            band.visible = e.isIntersecting;
          });
        }).observe(head);
      }
    });

    function fit(b) {
      const r = b.head.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = Math.round(r.width);
      const h = Math.round(r.height);
      if (w !== b.w || h !== b.h || dpr !== b.dpr) {
        b.w = w;
        b.h = h;
        b.dpr = dpr;
        b.canvas.width = w * dpr;
        b.canvas.height = h * dpr;
        b.state = {};
      }
    }

    // --- Déploiements: drive-test vehicle measuring coverage along a route ---
    function drawRoute(b, ctx, now, t) {
      const w = b.w;
      const h = b.h;
      const mid = h / 2;
      const pathY = function (x) {
        return mid + Math.sin(x * 0.018 + b.seed) * h * 0.2 + Math.sin(x * 0.047 + b.seed * 2) * h * 0.07;
      };
      const span = w + 320;
      const head = ((t * 90) % span) - 160;
      const trail = 320;

      // Planned drive route (faint dotted road)
      for (let x = G / 2; x < w; x += G * 2) {
        sq(ctx, x, pathY(x), 2, ICE, 0.16 * textMask(b, x));
      }

      // Measured samples left behind the vehicle, with signal-strength bars
      for (let x = Math.floor((head - trail) / G) * G + G / 2; x <= head; x += G) {
        if (x < 0 || x > w) continue;
        const age = (head - x) / trail;
        const lvl = rfNoise(x * 0.06 + b.seed, b.seed, 0);
        const y = pathY(x);
        const m = textMask(b, x) * (1 - age);
        sq(ctx, x, y, 4, lvl > 0.6 ? BLUE : ICE, (0.35 + lvl * 0.6) * m);
        const bars = Math.round(lvl * 3);
        for (let k = 1; k <= bars; k++) {
          sq(ctx, x, y - k * G, 3, ICE, 0.3 * m * (1 - k / 4));
          sq(ctx, x, y + k * G, 3, ICE, 0.12 * m * (1 - k / 4));
        }
      }

      // Vehicle + radio ripple
      if (head >= 0 && head <= w) {
        const y = pathY(head);
        const m = textMask(b, head);
        sq(ctx, head, y, 6, WHITE, 0.95 * m);
        const rp = (t * 1.6) % 1;
        const s = 6 + rp * 26;
        ctx.strokeStyle = "rgba(" + BLUE + "," + ((1 - rp) * 0.7 * m).toFixed(3) + ")";
        ctx.lineWidth = 1;
        ctx.strokeRect(Math.round(head - s / 2) + 0.5, Math.round(y - s / 2) + 0.5, s, s);
      }
    }

    // --- Accréditations: verification beam validating a certificate grid ---
    function drawScan(b, ctx, now, t) {
      const w = b.w;
      const h = b.h;
      const cols = Math.ceil(w / G);
      const rows = Math.ceil(h / G);
      if (!b.state.hits || b.state.hits.length !== cols) {
        b.state.hits = new Float32Array(cols).fill(-1e9);
      }
      const hits = b.state.hits;
      const phase = t * 0.55 + b.seed;
      const lx = (0.5 - 0.5 * Math.cos(phase)) * w;
      const dir = Math.sin(phase) >= 0 ? 1 : -1;
      const lc = Math.floor(lx / G);
      for (let c = Math.max(0, lc - 1); c <= Math.min(cols - 1, lc + 1); c++) hits[c] = now;

      for (let c = 0; c < cols; c++) {
        const x = c * G + G / 2;
        const m = textMask(b, x);
        const decay = Math.exp(-(now - hits[c]) / 900);
        for (let r = 0; r < rows; r++) {
          const hs = bHash(c, r, b.seed);
          if (hs < 0.42) continue;
          const y = r * G + G / 2;
          const color = decay > 0.5 && hs > 0.88 ? WHITE : hs > 0.7 ? BLUE : ICE;
          sq(ctx, x, y, decay > 0.3 ? 4 : 2, color, (0.12 + decay * 0.7 * hs) * m);
        }
      }

      // Beam with a glow trailing behind its direction of travel
      const lm = textMask(b, lx);
      const g = ctx.createLinearGradient(lx - 34 * dir, 0, lx, 0);
      g.addColorStop(0, "rgba(" + BLUE + ",0)");
      g.addColorStop(1, "rgba(120,160,255," + (0.35 * lm).toFixed(3) + ")");
      ctx.fillStyle = g;
      ctx.fillRect(Math.min(lx, lx - 34 * dir), 0, 34, h);
      ctx.fillStyle = "rgba(" + WHITE + "," + (0.85 * lm).toFixed(3) + ")";
      ctx.fillRect(Math.round(lx), 0, 1, h);
    }

    // --- Formations: learning progress bars, each at its own pace ---
    function drawProgress(b, ctx, now, t) {
      const w = b.w;
      const h = b.h;
      const cols = Math.floor(w / G);
      const rows = Math.floor(h / G);
      for (let r = 1; r < rows - 1; r += 2) {
        const sp = 0.07 + bHash(r, 1, b.seed) * 0.14;
        const off = bHash(r, 2, b.seed);
        const cyc = (t * sp + off) % 1.25;
        const fill = Math.min(1, cyc);
        const flash = cyc > 1 ? 1 - (cyc - 1) / 0.25 : 0;
        const fc = Math.floor(fill * cols);
        const y = r * G + G / 2;
        for (let c = 0; c < cols; c++) {
          const x = c * G + G / 2;
          const m = textMask(b, x);
          if (c < fc) {
            const d = fc - c;
            const color = d < 2 ? WHITE : d < 8 ? BLUE : ICE;
            const a = d < 2 ? 0.95 : d < 8 ? 0.55 : 0.16 + flash * 0.55;
            sq(ctx, x, y, 4, color, a * m * (0.6 + 0.4 * bHash(c, r, 3)));
          } else if (bHash(c, r, b.seed) > 0.7) {
            sq(ctx, x, y, 2, ICE, 0.08 * m);
          }
        }
      }
    }

    // --- Langues: mirrored voice waveform ---
    function drawWave(b, ctx, now, t) {
      const w = b.w;
      const h = b.h;
      const mid = h / 2;
      const maxR = Math.floor((h / 2 - G) / G);
      for (let x = G / 2; x < w; x += G) {
        const env = 0.55 + 0.45 * Math.sin(x * 0.004 - t * 0.7 + b.seed);
        const a1 = Math.sin(x * 0.035 - t * 2.4);
        const a2 = Math.sin(x * 0.083 + t * 1.7) * 0.6;
        const a3 = Math.sin(x * 0.011 + t * 0.9) * 0.4;
        const amp = (Math.abs(a1 + a2 + a3) / 2) * env;
        const n = Math.round(amp * maxR);
        const m = textMask(b, x);
        sq(ctx, x, mid, 2, ICE, 0.25 * m);
        for (let k = 1; k <= n; k++) {
          const top = k === n;
          const color = top ? WHITE : k > n * 0.6 ? BLUE : ICE;
          const a = (top ? 0.9 : 0.2 + 0.35 * (k / n)) * m;
          sq(ctx, x, mid - k * G, 4, color, a);
          sq(ctx, x, mid + k * G, 4, color, a * 0.45);
        }
      }
    }

    // --- Contact: packets routed between nodes, ripple on delivery ---
    function drawPing(b, ctx, now, t) {
      const w = b.w;
      const h = b.h;
      const st = b.state;
      if (!st.nodes) {
        st.nodes = [];
        for (let i = 0; i < 6; i++) {
          const left = i < 3;
          const fx = left ? 0.03 + Math.random() * 0.14 : 0.83 + Math.random() * 0.14;
          st.nodes.push({
            x: Math.round((fx * w) / G) * G + G / 2,
            y: G * 2 + Math.floor(Math.random() * Math.max(1, h / G - 4)) * G + G / 2,
            left: left,
            phase: Math.random() * 6,
          });
        }
        st.packets = [];
        st.rings = [];
        st.next = now;
      }

      if (now >= st.next) {
        const from = st.nodes[Math.floor(Math.random() * st.nodes.length)];
        const pool = st.nodes.filter(function (n) {
          return n.left !== from.left;
        });
        const to = pool[Math.floor(Math.random() * pool.length)];
        st.packets.push({ from: from, to: to, born: now, dur: 1400 + Math.random() * 1600 });
        st.next = now + 300 + Math.random() * 900;
      }

      // Manhattan route: horizontal → vertical → horizontal
      function pos(p, s) {
        const dx = p.to.x - p.from.x;
        const dy = p.to.y - p.from.y;
        const h1 = Math.abs(dx) / 2;
        const v = Math.abs(dy);
        const sx = Math.sign(dx);
        if (s <= h1) return [p.from.x + sx * s, p.from.y];
        if (s <= h1 + v) return [p.from.x + sx * h1, p.from.y + Math.sign(dy) * (s - h1)];
        return [p.from.x + sx * (h1 + s - h1 - v), p.to.y];
      }

      for (let i = st.packets.length - 1; i >= 0; i--) {
        const p = st.packets[i];
        const prog = (now - p.born) / p.dur;
        if (prog >= 1) {
          st.rings.push({ x: p.to.x, y: p.to.y, born: now });
          st.packets.splice(i, 1);
          continue;
        }
        const L = Math.abs(p.to.x - p.from.x) + Math.abs(p.to.y - p.from.y);
        const s = prog * L;
        for (let k = 0; k < 9; k++) {
          const sk = s - k * G;
          if (sk < 0) break;
          const xy = pos(p, sk);
          const m = textMask(b, xy[0]);
          sq(ctx, xy[0], xy[1], k === 0 ? 5 : 3, k === 0 ? WHITE : BLUE, (k === 0 ? 0.95 : 0.6 * (1 - k / 9)) * m);
        }
      }

      for (let i = st.rings.length - 1; i >= 0; i--) {
        const r = st.rings[i];
        const p = (now - r.born) / 700;
        if (p >= 1) {
          st.rings.splice(i, 1);
          continue;
        }
        const s = 5 + p * 26;
        ctx.strokeStyle = "rgba(" + BLUE + "," + ((1 - p) * 0.8).toFixed(3) + ")";
        ctx.lineWidth = 1;
        ctx.strokeRect(Math.round(r.x - s / 2) + 0.5, Math.round(r.y - s / 2) + 0.5, s, s);
      }

      st.nodes.forEach(function (n) {
        const pulse = 0.55 + 0.45 * Math.sin(t * 2.2 + n.phase);
        sq(ctx, n.x, n.y, 6, ICE, 0.35 + 0.4 * pulse);
        sq(ctx, n.x, n.y, 2, WHITE, 0.9);
      });
    }

    const DRAW = {
      route: drawRoute,
      scan: drawScan,
      progress: drawProgress,
      wave: drawWave,
      ping: drawPing,
    };

    function frame(now) {
      const t = now * 0.0006;
      bands.forEach(function (b) {
        if (!b.visible) return;
        fit(b);
        b.ctx.setTransform(b.dpr, 0, 0, b.dpr, 0, 0);
        b.ctx.clearRect(0, 0, b.w, b.h);
        DRAW[b.mode](b, b.ctx, now, t);
      });
      if (!prefersReduced) requestAnimationFrame(frame);
    }

    if (prefersReduced) {
      frame(performance.now());
      window.addEventListener("resize", function () {
        frame(performance.now());
      }, { passive: true });
      return;
    }
    requestAnimationFrame(frame);
  }

  initBands();

  // ============================================================================
  // CONTACT FOOTER BOTTOM STARS (subtle, soft fading twinkling stars below buttons)
  // ============================================================================
  function initContactStars() {
    const canvas = document.querySelector(".contact__stars-canvas");
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    let w = 0;
    let h = 0;
    let dpr = Math.min(window.devicePixelRatio || 1, 2);
    let visible = true;
    const stars = [];
    const NUM_STARS = 42;

    function resize() {
      const r = canvas.getBoundingClientRect();
      w = Math.round(r.width);
      h = Math.round(r.height);
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = w * dpr;
      canvas.height = h * dpr;
    }

    function createStar(randomY) {
      return {
        x: Math.random() * (w || 800),
        y: randomY ? Math.random() * (h || 120) : (h || 120) * (0.15 + Math.random() * 0.8),
        size: Math.random() < 0.3 ? 2.5 : Math.random() < 0.65 ? 1.5 : 1.0,
        speed: 0.5 + Math.random() * 1.0,
        phase: Math.random() * Math.PI * 2,
        isCross: Math.random() < 0.28,
        hue: Math.random() < 0.4 ? "184, 199, 255" : "255, 255, 255",
      };
    }

    resize();
    window.addEventListener("resize", function () {
      resize();
      stars.length = 0;
      for (let i = 0; i < NUM_STARS; i++) {
        stars.push(createStar(true));
      }
    }, { passive: true });

    for (let i = 0; i < NUM_STARS; i++) {
      stars.push(createStar(true));
    }

    if ("IntersectionObserver" in window) {
      new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          visible = e.isIntersecting;
        });
      }).observe(canvas);
    }

    function render(now) {
      if (!visible) {
        if (!prefersReduced) requestAnimationFrame(render);
        return;
      }

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);

      const t = now * 0.001;

      for (let i = 0; i < stars.length; i++) {
        const s = stars[i];
        // Soft twinkle oscillating with a calm sinusoidal breathing
        const twinkle = 0.45 + 0.55 * Math.sin(t * s.speed + s.phase);
        // Vertical gradient fade: softer towards the top, delicate presence towards bottom
        const yRatio = Math.min(1, s.y / (h || 1));
        const alpha = Math.max(0, twinkle * (0.25 + 0.75 * yRatio) * 0.68);

        if (alpha < 0.03) continue;

        ctx.fillStyle = "rgba(" + s.hue + ", " + alpha.toFixed(3) + ")";

        if (s.isCross && s.size > 1.2) {
          const arm = s.size * 1.8;
          ctx.fillRect(Math.round(s.x - arm), Math.round(s.y), arm * 2 + 1, 1);
          ctx.fillRect(Math.round(s.x), Math.round(s.y - arm), 1, arm * 2 + 1);
          ctx.fillRect(Math.round(s.x - 0.5), Math.round(s.y - 0.5), 1.5, 1.5);
        } else {
          ctx.fillRect(Math.round(s.x - s.size * 0.5), Math.round(s.y - s.size * 0.5), s.size, s.size);
        }
      }

      if (!prefersReduced) requestAnimationFrame(render);
    }

    if (prefersReduced) {
      render(performance.now());
      return;
    }
    requestAnimationFrame(render);
  }

  initContactStars();
})();
