/*
 * Molduras desenhadas em canvas (1080 × 1440, proporção 3:4).
 *
 * Cada moldura tem:
 *   photo  → onde a foto fica
 *   shape  → recorte da janela (rect, round, arch) — só nas molduras com papel
 *   paint  → desenha papel, bordas, textos e enfeites
 *
 * A "moldura-modelo" é desenhada uma vez; na captura a foto vai por baixo
 * e a moldura por cima, gerando um JPG único.
 */
(function () {
  const W = 1080;
  const H = 1440;
  const cfg = () => window.WEDDING;

  const INK = '#4a3d32';
  const GOLD = '#b89a6a';

  /* ---------- utilidades ---------- */

  function loadImage(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Falha ao carregar ' + src));
      img.src = src;
    });
  }

  async function loadFonts() {
    if (!document.fonts || !document.fonts.load) return;
    const fonts = [
      '100px "WindSong"',
      '300 40px "Cormorant Garamond"',
      '400 40px "Cormorant Garamond"',
      'italic 400 40px "Cormorant Garamond"',
    ];
    await Promise.all(fonts.map((f) => document.fonts.load(f).catch(() => null)));
  }

  let assetsPromise = null;
  function assets() {
    if (!assetsPromise) {
      assetsPromise = Promise.all([loadImage('assets/farol.svg'), loadFonts()]).then(([farol]) => ({ farol }));
    }
    return assetsPromise;
  }

  function grain(ctx, alpha, rgb = [74, 61, 50]) {
    const n = document.createElement('canvas');
    n.width = n.height = 200;
    const nctx = n.getContext('2d');
    const img = nctx.createImageData(200, 200);
    for (let i = 0; i < img.data.length; i += 4) {
      img.data[i] = rgb[0];
      img.data[i + 1] = rgb[1];
      img.data[i + 2] = rgb[2];
      img.data[i + 3] = Math.random() * 255 * alpha;
    }
    nctx.putImageData(img, 0, 0);
    ctx.save();
    ctx.fillStyle = ctx.createPattern(n, 'repeat');
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }

  function softBlots(ctx, color, list) {
    for (const [x, y, r, a] of list) {
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, `rgba(${color},${a})`);
      g.addColorStop(1, `rgba(${color},0)`);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
    }
  }

  // texto com espaçamento entre letras, centralizado (ou alinhado à esquerda/direita)
  function spaced(ctx, text, x, y, sp, align = 'center') {
    const chars = [...text];
    const ws = chars.map((c) => ctx.measureText(c).width);
    const total = ws.reduce((a, b) => a + b, 0) + sp * (chars.length - 1);
    let cx = align === 'center' ? x - total / 2 : align === 'right' ? x - total : x;
    ctx.textAlign = 'left';
    chars.forEach((c, i) => {
      ctx.fillText(c, cx, y);
      cx += ws[i] + sp;
    });
  }

  // "Junior ∞ Eduarda" — nomes em caligrafia, ∞ em serifa
  function names(ctx, cx, base, size, color, joinColor) {
    const c = cfg();
    const script = `${size}px "WindSong", "Snell Roundhand", cursive`;
    const join = `300 ${Math.round(size * 0.5)}px "Cormorant Garamond", Georgia, serif`;
    ctx.font = script;
    const wa = ctx.measureText(c.groom).width;
    const wb = ctx.measureText(c.bride).width;
    ctx.font = join;
    const wj = ctx.measureText('∞').width;
    const gap = size * 0.24;
    let x = cx - (wa + wb + wj + gap * 2) / 2;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.font = script;
    ctx.fillStyle = color;
    ctx.fillText(c.groom, x, base);
    x += wa + gap;
    ctx.font = join;
    ctx.fillStyle = joinColor || color;
    ctx.fillText('∞', x, base - size * 0.13);
    x += wj + gap;
    ctx.font = script;
    ctx.fillStyle = color;
    ctx.fillText(c.bride, x, base);
  }

  function roundRectPath(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function archPath(ctx, x, y, w, h) {
    const r = w / 2;
    ctx.beginPath();
    ctx.moveTo(x, y + h);
    ctx.lineTo(x, y + r);
    ctx.arc(x + r, y + r, r, Math.PI, 0);
    ctx.lineTo(x + w, y + h);
    ctx.closePath();
  }

  function shapePath(ctx, frame, grow = 0) {
    const p = frame.photo;
    const x = p.x - grow, y = p.y - grow, w = p.w + grow * 2, h = p.h + grow * 2;
    if (frame.shape === 'arch') archPath(ctx, x, y, w, h);
    else if (frame.shape === 'round') roundRectPath(ctx, x, y, w, h, (frame.radius || 12) + grow);
    else { ctx.beginPath(); ctx.rect(x, y, w, h); }
  }

  // raminho de folhas (aquarela simples)
  function sprig(ctx, x, y, len, angle, flip = 1) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.scale(1, flip);
    const bend = -len * 0.18;
    ctx.strokeStyle = 'rgba(96,108,78,.85)';
    ctx.lineWidth = 2.2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(len / 2, bend * 2, len, 0);
    ctx.stroke();

    const n = 7;
    for (let i = 1; i <= n; i++) {
      const t = i / (n + 0.6);
      const px = t * len;
      const py = 2 * (1 - t) * t * bend * 2; // ponto na curva do caule
      const side = i % 2 ? 1 : -1;
      const s = 30 * (1 - t * 0.45);
      ctx.save();
      ctx.translate(px, py);
      ctx.rotate(side * 0.8 - 0.15);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(s * 0.6, -s * 0.42, s * 1.6, 0);
      ctx.quadraticCurveTo(s * 0.6, s * 0.42, 0, 0);
      ctx.fillStyle = i % 3 ? 'rgba(125,140,100,.55)' : 'rgba(150,160,118,.5)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(96,108,78,.6)';
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.restore();
    }
    // folha da ponta
    ctx.translate(len, 0);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(18, -11, 40, 0);
    ctx.quadraticCurveTo(18, 11, 0, 0);
    ctx.fillStyle = 'rgba(125,140,100,.6)';
    ctx.fill();
    ctx.restore();
  }

  function diamond(ctx, x, y, r, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(x, y - r);
    ctx.lineTo(x + r, y);
    ctx.lineTo(x, y + r);
    ctx.lineTo(x - r, y);
    ctx.closePath();
    ctx.fill();
  }

  function dateParts() {
    const p = (cfg().date.match(/\d+/g) || []);
    return { d: p[0] || '', m: p[1] || '', y: p[2] || '' };
  }

  /* ---------- molduras ---------- */

  const LIST = [
    {
      id: 'elegante',
      name: 'Elegante',
      photo: { x: 70, y: 70, w: 940, h: 1010 },
      shape: 'rect',
      paint(ctx, A) {
        ctx.fillStyle = '#F4EEE4';
        ctx.fillRect(0, 0, W, H);
        softBlots(ctx, '216,196,164', [[160, 220, 520, .08], [940, 1320, 560, .1], [900, 300, 340, .05]]);
        grain(ctx, .06);

        ctx.strokeStyle = GOLD;
        ctx.lineWidth = 2;
        ctx.strokeRect(26, 26, W - 52, H - 52);
        ctx.globalAlpha = .7;
        ctx.lineWidth = .9;
        ctx.strokeRect(35, 35, W - 70, H - 70);
        ctx.globalAlpha = 1;
        ctx.lineWidth = 1.2;
        ctx.strokeRect(60, 60, 960, 1030);
        [[30.5, 30.5], [W - 30.5, 30.5], [30.5, H - 30.5], [W - 30.5, H - 30.5]].forEach(([x, y]) => diamond(ctx, x, y, 7, GOLD));

        const fh = 96;
        const fw = (A.farol.width / A.farol.height) * fh;
        ctx.drawImage(A.farol, W / 2 - fw / 2, 1100, fw, fh);

        names(ctx, W / 2, 1280, 102, INK, GOLD);

        ctx.fillStyle = INK;
        ctx.font = '400 32px "Cormorant Garamond", Georgia, serif';
        spaced(ctx, cfg().date, W / 2, 1330, 6);

        ctx.font = 'italic 400 27px "Cormorant Garamond", Georgia, serif';
        ctx.fillStyle = 'rgba(74,61,50,.78)';
        ctx.textAlign = 'center';
        ctx.fillText(cfg().phrase, W / 2, 1378);
      },
    },

    {
      id: 'polaroid',
      name: 'Polaroid',
      photo: { x: 64, y: 64, w: 952, h: 1050 },
      shape: 'rect',
      paint(ctx) {
        ctx.fillStyle = '#FBF9F5';
        ctx.fillRect(0, 0, W, H);
        softBlots(ctx, '210,200,186', [[540, 1300, 700, .12]]);
        grain(ctx, .04);
        ctx.strokeStyle = 'rgba(0,0,0,.12)';
        ctx.lineWidth = 2;
        ctx.strokeRect(63, 63, 954, 1052);

        ctx.save();
        ctx.translate(W / 2, 1262);
        ctx.rotate(-0.035);
        names(ctx, 0, 0, 116, '#2f2822', '#a07c4c');
        ctx.restore();

        ctx.font = 'italic 400 30px "Cormorant Garamond", Georgia, serif';
        ctx.fillStyle = '#7a6a5b';
        const { d, m, y } = dateParts();
        spaced(ctx, `${d} · ${m} · ${y}`, W / 2, 1368, 4);
      },
    },

    {
      id: 'arco',
      name: 'Arco',
      photo: { x: 150, y: 110, w: 780, h: 960 },
      shape: 'arch',
      paint(ctx) {
        const g = ctx.createLinearGradient(0, 0, 0, H);
        g.addColorStop(0, '#F3ECE1');
        g.addColorStop(1, '#E8DCC9');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, W, H);
        softBlots(ctx, '200,170,120', [[120, 1200, 420, .12], [980, 160, 380, .08]]);
        grain(ctx, .06);

        ctx.strokeStyle = GOLD;
        ctx.lineWidth = 2;
        archPath(ctx, 134, 94, 812, 992);
        ctx.stroke();
        ctx.globalAlpha = .5;
        ctx.lineWidth = 1;
        archPath(ctx, 124, 84, 832, 1012);
        ctx.stroke();
        ctx.globalAlpha = 1;

        sprig(ctx, 128, 1090, 300, -1.66, 1);
        sprig(ctx, 128, 1090, 170, -2.45, -1);
        sprig(ctx, 952, 1090, 300, -1.48, -1);
        sprig(ctx, 952, 1090, 170, -0.69, 1);

        names(ctx, W / 2, 1210, 96, INK, GOLD);

        ctx.font = 'italic 400 34px "Cormorant Garamond", Georgia, serif';
        ctx.fillStyle = 'rgba(74,61,50,.85)';
        ctx.textAlign = 'center';
        ctx.fillText(cfg().phrase, W / 2, 1266);

        ctx.font = '400 28px "Cormorant Garamond", Georgia, serif';
        ctx.fillStyle = '#8c7350';
        spaced(ctx, cfg().date, W / 2, 1328, 7);
        diamond(ctx, W / 2, 1372, 5, GOLD);
        ctx.fillStyle = GOLD;
        ctx.fillRect(W / 2 - 60, 1371.5, 44, 1);
        ctx.fillRect(W / 2 + 16, 1371.5, 44, 1);
      },
    },

    {
      id: 'minimal',
      name: 'Minimal',
      photo: { x: 0, y: 0, w: W, h: H },
      paint(ctx) {
        let g = ctx.createLinearGradient(0, 0, 0, 260);
        g.addColorStop(0, 'rgba(0,0,0,.32)');
        g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, W, 260);
        g = ctx.createLinearGradient(0, 900, 0, H);
        g.addColorStop(0, 'rgba(0,0,0,0)');
        g.addColorStop(1, 'rgba(0,0,0,.66)');
        ctx.fillStyle = g;
        ctx.fillRect(0, 900, W, H - 900);

        ctx.strokeStyle = 'rgba(255,255,255,.75)';
        ctx.lineWidth = 2;
        ctx.strokeRect(34, 34, W - 68, H - 68);

        const c = cfg();
        ctx.fillStyle = '#fff';
        ctx.font = '400 30px "Cormorant Garamond", Georgia, serif';
        spaced(ctx, `${c.monogram[0]}  ∞  ${c.monogram[1]}`, W / 2, 104, 6);

        ctx.save();
        ctx.shadowColor = 'rgba(0,0,0,.35)';
        ctx.shadowBlur = 24;
        names(ctx, W / 2, 1294, 118, '#ffffff', '#f1dcb2');
        ctx.restore();

        ctx.fillStyle = 'rgba(255,255,255,.92)';
        ctx.font = '400 30px "Cormorant Garamond", Georgia, serif';
        spaced(ctx, c.date, W / 2, 1356, 8);
      },
    },
  ];

  /* ---------- modelos e composição ---------- */

  const cache = new Map();

  function template(id) {
    if (cache.has(id)) return cache.get(id);
    const frame = byId(id);
    const p = assets().then((A) => {
      const canvas = document.createElement('canvas');
      canvas.width = W;
      canvas.height = H;
      const ctx = canvas.getContext('2d');
      frame.paint(ctx, A);
      if (frame.shape) {
        ctx.save();
        ctx.globalCompositeOperation = 'destination-out';
        shapePath(ctx, frame);
        ctx.fill();
        ctx.restore();
      }
      return canvas;
    });
    cache.set(id, p);
    return p;
  }

  function byId(id) {
    return LIST.find((f) => f.id === id) || LIST[0];
  }

  function drawCover(ctx, src, rect, mirror) {
    const sw0 = src.videoWidth || src.width;
    const sh0 = src.videoHeight || src.height;
    const scale = Math.max(rect.w / sw0, rect.h / sh0);
    const sw = rect.w / scale;
    const sh = rect.h / scale;
    const sx = (sw0 - sw) / 2;
    const sy = (sh0 - sh) / 2;
    ctx.save();
    if (mirror) {
      ctx.translate(rect.x + rect.w, rect.y);
      ctx.scale(-1, 1);
      ctx.drawImage(src, sx, sy, sw, sh, 0, 0, rect.w, rect.h);
    } else {
      ctx.drawImage(src, sx, sy, sw, sh, rect.x, rect.y, rect.w, rect.h);
    }
    ctx.restore();
  }

  // Captura o quadro do vídeo agora (síncrono) e monta a foto final.
  async function compose(video, mirror, frameId, filter) {
    const frame = byId(frameId);
    const p = frame.photo;
    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, H);
    drawCover(ctx, video, p, mirror);
    Filters.apply(ctx, filter, p.x, p.y, p.w, p.h);

    const tpl = await template(frame.id);
    ctx.drawImage(tpl, 0, 0);

    return new Promise((resolve, reject) => {
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Falha ao gerar a imagem'))), 'image/jpeg', 0.93);
    });
  }

  window.Frames = { W, H, list: LIST, byId, template, compose, assets };
})();
