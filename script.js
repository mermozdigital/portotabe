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

    function render(now) {
      ensureSize();
      const t = (now || performance.now()) * 0.001 + state.phase;

      // Smooth interpolation for hover state and magnetic cursor
      const targetMix = state.hovered ? 1 : 0;
      state.hoverMix += (targetMix - state.hoverMix) * 0.16;
      state.smoothX += (state.pointerX - state.smoothX) * 0.2;
      state.smoothY += (state.pointerY - state.smoothY) * 0.2;

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
      const t = (now || performance.now()) * 0.001;

      state.hoverMix += ((state.hovered ? 1 : 0) - state.hoverMix) * 0.12;
      state.smoothX += (state.pointerX - state.smoothX) * 0.16;
      state.smoothY += (state.pointerY - state.smoothY) * 0.16;

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
            ctx.fillStyle = "rgba(0, 56, 255, " + alpha.toFixed(3) + ")";
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
})();
