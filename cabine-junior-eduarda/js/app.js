/*
 * Cabine de fotos — abertura → câmera (molduras) → foto/vídeo → galeria.
 */
(function () {
  const $ = (id) => document.getElementById(id);
  const cfg = window.WEDDING;

  const el = {
    splash: $('splash'),
    cam: $('cam'),
    video: $('video'),
    ambient: $('ambient'),
    overlay: $('overlay'),
    recCanvas: $('recCanvas'),
    card: $('card'),
    stage: $('stage'),
    countdown: $('countdown'),
    flash: $('flash'),
    recBadge: $('recBadge'),
    recTime: $('recTime'),
    loading: $('camLoading'),
    msg: $('camMsg'),
    shutter: $('btnShutter'),
    shutterWrap: $('shutterWrap'),
    shutterRing: $('shutterRing'),
    flip: $('btnFlip'),
    timer: $('btnTimer'),
    timerLabel: $('timerLabel'),
    modeSwitch: document.querySelector('.modeSwitch'),
    modes: $('modes'),
    track: $('modesTrack'),
    last: $('btnLast'),
    lastImg: $('lastImg'),
    result: $('result'),
    resultImg: $('resultImg'),
    resultVideo: $('resultVideo'),
    resultHint: $('resultHint'),
    galleryBtn: $('btnGallery'),
    resultGalleryBtn: $('btnResultGallery'),
    gallery: $('gallery'),
    galleryGrid: $('galleryGrid'),
    galleryEmpty: $('galleryEmpty'),
    galleryClose: $('btnGalleryClose'),
    viewer: $('viewer'),
    viewerMedia: $('viewerMedia'),
    viewerSave: $('btnViewerSave'),
    viewerDelete: $('btnViewerDelete'),
    viewerClose: $('btnViewerClose'),
    toast: $('toast'),
  };

  const TIMERS = [3, 10, 0];
  const MAX_REC_MS = 8000;
  const filter = Filters.list[0]; // sem efeitos — só a moldura

  const state = {
    stream: null,
    facing: 'user',
    mirror: true,
    busy: false,
    token: 0,
    frame: 0,
    timer: 0,
    mode: 'photo', // 'photo' | 'video'
    recording: false,
    photo: null, // { blob, url, type }
    galleryUrls: [],
  };

  const isIOS =
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const inApp = /Instagram|FBAN|FBAV|Line\/|WhatsApp|TikTok/i.test(navigator.userAgent);
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const tap = () => navigator.vibrate && navigator.vibrate(8);

  /* ---------- textos ---------- */

  const texts = { groom: cfg.groom, bride: cfg.bride, date: cfg.date, mono1: cfg.monogram[0], mono2: cfg.monogram[1] };
  document.querySelectorAll('[data-text]').forEach((n) => {
    if (texts[n.dataset.text]) n.textContent = texts[n.dataset.text];
  });

  /* ---------- aviso ---------- */

  let toastTimer;
  function toast(text) {
    el.toast.textContent = text;
    el.toast.classList.add('is-on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.toast.classList.remove('is-on'), 3000);
  }

  /* ---------- abertura: farol desenhado traço a traço ---------- */

  Frames.assets();
  Frames.template(Frames.list[0].id);

  const stage = (c) => el.splash.classList.add(c);
  let splashDone = false;
  function finishSplash() {
    if (splashDone) return;
    splashDone = true;
    try {
      const svg = $('lh').querySelector('svg');
      if (svg) {
        svg.querySelectorAll('path').forEach((p) => {
          if (!p.getAnimations) return;
          p.getAnimations().forEach((a) => {
            try { a.finish(); } catch (_) { a.cancel(); }
          });
        });
      }
    } catch (_) {
      /* se algo falhar aqui, a tela ainda assim aparece completa abaixo */
    }
    ['is-text', 'is-painted', 'is-lit'].forEach(stage);
  }

  // Trava de segurança: não importa o que dê errado no celular do convidado
  // (rede lenta, navegador sem suporte a alguma API), a tela nunca fica presa
  // pela metade — em 4.5s ela aparece inteira de qualquer jeito.
  setTimeout(finishSplash, 4500);

  async function drawSplash() {
    const wrap = $('lh');
    let svg;
    try {
      const svgText = await (await fetch('assets/farol.svg')).text();
      wrap.insertAdjacentHTML('afterbegin', svgText);
      svg = wrap.querySelector('svg');
      if (!svg) throw new Error('sem svg');
      svg.removeAttribute('width');
      svg.removeAttribute('height');
    } catch (_) {
      return finishSplash();
    }

    try {
      const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
      const paths = [...svg.querySelectorAll('.ink path')];
      if (reduce || !paths[0] || !paths[0].animate) return finishSplash();

      const lens = paths.map((p) => p.getTotalLength() + 1);
      const durs = lens.map((l) => 150 + Math.sqrt(l) * 38);
      const OVERLAP = 0.5;
      const k = 3400 / (durs.reduce((a, b) => a + b, 0) * OVERLAP);
      let t = 300;
      paths.forEach((p, i) => {
        const L = lens[i];
        const d = durs[i] * k;
        p.style.strokeDasharray = L + 'px';
        p.style.strokeDashoffset = L + 'px';
        p.animate([{ strokeDashoffset: L + 'px' }, { strokeDashoffset: '0px' }], {
          duration: d,
          delay: t,
          easing: 'cubic-bezier(.5,.1,.3,1)',
          fill: 'forwards',
        });
        t += d * OVERLAP;
      });
      setTimeout(() => stage('is-text'), t * 0.48);
      setTimeout(() => stage('is-painted'), t * 0.78);
      setTimeout(() => stage('is-lit'), t * 0.94);
    } catch (err) {
      console.warn('Animação da abertura falhou:', err);
      finishSplash();
    }
  }
  drawSplash();

  el.splash.addEventListener('click', (e) => {
    if (!e.target.closest('button')) finishSplash();
  });

  $('btnStart').addEventListener('click', () => {
    tap();
    el.splash.classList.remove('is-active');
    el.cam.classList.add('is-active');
    requestAnimationFrame(() => {
      fitCard();
      selectFrame(state.frame, 0, true);
    });
    openCamera();
  });

  /* ---------- tamanho do cartão (3:4) ---------- */

  function fitCard() {
    const r = el.stage.getBoundingClientRect();
    const availW = r.width - 32;
    const availH = r.height - 12;
    if (availW <= 0 || availH <= 0) return;
    const ratio = Frames.W / Frames.H;
    let w = availW;
    let h = w / ratio;
    if (h > availH) {
      h = availH;
      w = h * ratio;
    }
    el.card.style.width = Math.floor(w) + 'px';
    el.card.style.height = Math.floor(h) + 'px';
  }
  window.addEventListener('resize', () => {
    fitCard();
    centerMode(false);
  });

  /* ---------- modo: Foto / Vídeo ---------- */

  el.modeSwitch.querySelectorAll('button').forEach((b) => {
    b.addEventListener('click', () => {
      if (state.recording || state.busy) return;
      tap();
      state.mode = b.dataset.mode;
      el.modeSwitch.querySelectorAll('button').forEach((x) => x.classList.toggle('is-active', x === b));
      el.shutterWrap.classList.toggle('is-video', state.mode === 'video');
      el.shutter.setAttribute('aria-label', state.mode === 'video' ? 'Gravar vídeo' : 'Tirar foto');
    });
  });

  /* ---------- molduras ---------- */

  Frames.list.forEach((f, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.role = 'tab';
    b.textContent = f.name;
    b.addEventListener('click', () => {
      if (state.recording || state.busy) return;
      selectFrame(i, i > state.frame ? 1 : -1);
    });
    el.track.appendChild(b);
  });

  function centerMode(animate = true) {
    const btn = el.track.children[state.frame];
    if (!btn) return;
    if (!animate) el.track.style.transition = 'none';
    el.track.style.transform = `translateX(${-(btn.offsetLeft + btn.offsetWidth / 2)}px)`;
    if (!animate) requestAnimationFrame(() => (el.track.style.transition = ''));
  }

  let drawToken = 0;
  async function selectFrame(i, dir = 0, instant = false) {
    const n = Frames.list.length;
    i = (i + n) % n;
    if (i !== state.frame) tap();
    state.frame = i;
    const frame = Frames.list[i];

    [...el.track.children].forEach((b, j) => {
      b.classList.toggle('is-active', j === i);
      b.setAttribute('aria-selected', j === i);
    });
    centerMode(!instant);

    const p = frame.photo;
    Object.assign(el.video.style, {
      left: (p.x / Frames.W) * 100 + '%',
      top: (p.y / Frames.H) * 100 + '%',
      width: (p.w / Frames.W) * 100 + '%',
      height: (p.h / Frames.H) * 100 + '%',
    });

    if (dir) {
      el.card.classList.remove('is-swipe-left', 'is-swipe-right');
      void el.card.offsetWidth;
      el.card.classList.add(dir > 0 ? 'is-swipe-left' : 'is-swipe-right');
    }

    const token = ++drawToken;
    const tpl = await Frames.template(frame.id);
    if (token !== drawToken) return;
    el.overlay.width = tpl.width;
    el.overlay.height = tpl.height;
    const ctx = el.overlay.getContext('2d');
    ctx.clearRect(0, 0, tpl.width, tpl.height);
    ctx.drawImage(tpl, 0, 0);
    if (!instant && el.overlay.animate) {
      el.overlay.animate([{ opacity: 0, filter: 'blur(6px)' }, { opacity: 1, filter: 'blur(0)' }], {
        duration: 420,
        easing: 'cubic-bezier(.22,.8,.24,1)',
      });
    }
  }

  function swipe(area) {
    let x0 = null, y0 = null;
    area.addEventListener('pointerdown', (e) => { x0 = e.clientX; y0 = e.clientY; });
    area.addEventListener('pointerup', (e) => {
      if (x0 === null) return;
      const dx = e.clientX - x0, dy = e.clientY - y0;
      x0 = null;
      if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy) && !state.busy && !state.recording) {
        selectFrame(state.frame + (dx < 0 ? 1 : -1), dx < 0 ? 1 : -1);
      }
    });
    area.addEventListener('pointercancel', () => (x0 = null));
  }
  swipe(el.stage);
  swipe(el.modes);

  /* ---------- temporizador ---------- */

  el.timer.addEventListener('click', () => {
    if (state.recording) return;
    tap();
    state.timer = (state.timer + 1) % TIMERS.length;
    const t = TIMERS[state.timer];
    el.timerLabel.textContent = t ? t + 's' : 'Off';
    el.timer.classList.toggle('is-off', !t);
  });

  /* ---------- câmera ---------- */

  function showMsg(title, text, retry = true) {
    el.loading.hidden = true;
    el.msg.hidden = false;
    $('camMsgTitle').textContent = title;
    $('camMsgText').textContent = text;
    $('btnRetry').hidden = !retry;
    el.shutter.disabled = true;
  }

  function stopCamera() {
    state.token++;
    if (state.stream) state.stream.getTracks().forEach((t) => t.stop());
    state.stream = null;
    el.video.srcObject = null;
    el.ambient.srcObject = null;
    el.ambient.classList.remove('is-on');
    el.shutter.disabled = true;
  }

  async function getStream() {
    try {
      return await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: { ideal: state.facing }, width: { ideal: 1920 }, height: { ideal: 1440 } },
      });
    } catch (err) {
      if (err && err.name === 'OverconstrainedError') {
        return navigator.mediaDevices.getUserMedia({ audio: false, video: true });
      }
      throw err;
    }
  }

  async function openCamera() {
    stopCamera();
    const token = ++state.token;
    el.msg.hidden = true;
    el.loading.hidden = false;

    if (!window.isSecureContext) {
      return showMsg('Conexão não segura', 'A câmera só funciona em links https://.', false);
    }
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      return showMsg(
        'Câmera indisponível',
        inApp ? 'Toque em ⋯ e escolha "Abrir no navegador" para usar a câmera.' : 'Abra este link no Safari (iPhone) ou no Chrome (Android).',
        false
      );
    }

    try {
      const stream = await getStream();
      if (token !== state.token) return stream.getTracks().forEach((t) => t.stop());
      state.stream = stream;

      const track = stream.getVideoTracks()[0];
      const s = (track && track.getSettings && track.getSettings()) || {};
      state.mirror = (s.facingMode || state.facing) !== 'environment';
      el.video.classList.toggle('is-mirrored', state.mirror);
      el.ambient.classList.toggle('is-mirrored', state.mirror);

      el.video.srcObject = stream;
      el.ambient.srcObject = stream;
      await Promise.all([el.video.play().catch(() => {}), el.ambient.play().catch(() => {})]);
      if (!el.video.videoWidth) {
        await new Promise((r) => el.video.addEventListener('loadedmetadata', r, { once: true }));
      }
      if (token !== state.token) return;

      el.loading.hidden = true;
      el.ambient.classList.add('is-on');
      el.shutter.disabled = false;
      updateFlip();
    } catch (err) {
      if (token === state.token) cameraError(err);
    }
  }

  function cameraError(err) {
    const name = (err && err.name) || '';
    console.warn('Câmera:', name, err);
    if (name === 'NotAllowedError' || name === 'SecurityError') {
      showMsg(
        'Libere a câmera',
        (isIOS
          ? 'Toque em "aA" na barra de endereço › Ajustes do Site › Câmera › Permitir.'
          : 'Toque no cadeado ao lado do endereço › Permissões › Câmera › Permitir.') +
          (inApp ? ' Ou abra o link no navegador.' : '')
      );
    } else if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
      showMsg('Sem câmera', 'Não encontramos uma câmera neste aparelho.', false);
    } else if (name === 'NotReadableError' || name === 'TrackStartError') {
      showMsg('Câmera ocupada', 'Feche outros apps que usam a câmera e tente de novo.');
    } else {
      showMsg('Ops', 'Não foi possível abrir a câmera.');
    }
  }

  async function updateFlip() {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      el.flip.hidden = devices.filter((d) => d.kind === 'videoinput').length < 2;
    } catch (_) {
      el.flip.hidden = true;
    }
  }

  $('btnRetry').addEventListener('click', openCamera);

  el.flip.addEventListener('click', () => {
    if (state.busy || state.recording) return;
    tap();
    state.facing = state.facing === 'user' ? 'environment' : 'user';
    el.flip.classList.toggle('is-turn');
    openCamera();
  });

  document.addEventListener('visibilitychange', () => {
    if (!el.cam.classList.contains('is-active')) return;
    if (document.hidden) {
      if (state.recording) stopRecording(true);
      stopCamera();
    } else openCamera();
  });

  /* ---------- foto ---------- */

  async function shoot() {
    if (state.busy || !state.stream || !el.video.videoWidth) return;
    state.busy = true;
    tap();
    el.shutter.disabled = true;
    el.shutter.classList.add('is-busy');

    try {
      const secs = TIMERS[state.timer];
      for (let n = secs; n > 0; n--) {
        el.countdown.innerHTML = '<span>' + n + '</span>';
        await wait(1000);
        if (!state.stream) throw new Error('stopped');
      }
      el.countdown.innerHTML = '';

      const pending = Frames.compose(el.video, state.mirror, Frames.list[state.frame].id, filter);
      el.flash.classList.remove('is-on');
      void el.flash.offsetWidth;
      el.flash.classList.add('is-on');
      navigator.vibrate && navigator.vibrate([12, 40, 12]);

      const blob = await pending;
      await wait(260);
      showResult(blob, 'photo');
      LocalGallery.add({ type: 'photo', blob }).catch(() => {});
    } catch (err) {
      el.countdown.innerHTML = '';
      if (err && err.message !== 'stopped') {
        console.error(err);
        toast('Não deu certo. Tente de novo.');
      }
    } finally {
      state.busy = false;
      el.shutter.classList.remove('is-busy');
      el.shutter.disabled = !state.stream;
    }
  }

  /* ---------- vídeo ---------- */

  function pickVideoMime() {
    const cands = [
      ['video/mp4;codecs=avc1', '.mp4'],
      ['video/mp4', '.mp4'],
      ['video/webm;codecs=vp9', '.webm'],
      ['video/webm;codecs=vp8', '.webm'],
      ['video/webm', '.webm'],
    ];
    for (const [mime, ext] of cands) {
      if (window.MediaRecorder && MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(mime)) {
        return { mime, ext };
      }
    }
    return null;
  }

  let recorder = null;
  let recChunks = [];
  let recRAF = null;
  let recStart = 0;
  let recThumb = null;

  function recordFrame() {
    const frame = Frames.list[state.frame];
    const p = frame.photo;
    const canvas = el.recCanvas;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    drawVideoCover(ctx, el.video, p, state.mirror);
    const tpl = frameTemplateCache.get(frame.id);
    if (tpl) ctx.drawImage(tpl, 0, 0, canvas.width, canvas.height);
    if (!recThumb && performance.now() - recStart > 120) {
      canvas.toBlob((b) => { if (b) recThumb = b; }, 'image/jpeg', 0.7);
    }
    const elapsed = performance.now() - recStart;
    el.recTime.textContent = fmtTime(elapsed);
    el.shutterRing.style.setProperty('--progress', Math.min(100, (elapsed / MAX_REC_MS) * 100));
    if (elapsed >= MAX_REC_MS) { stopRecording(); return; }
    recRAF = requestAnimationFrame(recordFrame);
  }

  function drawVideoCover(ctx, video, rect, mirror) {
    const sw0 = video.videoWidth, sh0 = video.videoHeight;
    const scale = Math.max(rect.w / sw0, rect.h / sh0);
    const sw = rect.w / scale, sh = rect.h / scale;
    const sx = (sw0 - sw) / 2, sy = (sh0 - sh) / 2;
    ctx.save();
    if (mirror) {
      ctx.translate(rect.x + rect.w, rect.y);
      ctx.scale(-1, 1);
      ctx.drawImage(video, sx, sy, sw, sh, 0, 0, rect.w, rect.h);
    } else {
      ctx.drawImage(video, sx, sy, sw, sh, rect.x, rect.y, rect.w, rect.h);
    }
    ctx.restore();
  }

  const frameTemplateCache = new Map();
  async function preloadTemplate(frameId) {
    if (!frameTemplateCache.has(frameId)) {
      frameTemplateCache.set(frameId, await Frames.template(frameId));
    }
  }

  function fmtTime(ms) {
    const s = Math.floor(ms / 1000);
    return '0:' + String(s).padStart(2, '0');
  }

  async function startRecording() {
    if (state.busy || state.recording || !state.stream) return;
    const picked = pickVideoMime();
    if (!picked || !el.recCanvas.captureStream) {
      toast('Este navegador não grava vídeo. Tente no Safari ou Chrome.');
      return;
    }
    await preloadTemplate(Frames.list[state.frame].id);

    el.recCanvas.width = Frames.W;
    el.recCanvas.height = Frames.H;
    const canvasStream = el.recCanvas.captureStream(30);
    recChunks = [];
    recThumb = null;
    try {
      recorder = new MediaRecorder(canvasStream, { mimeType: picked.mime, videoBitsPerSecond: 5_000_000 });
    } catch (err) {
      toast('Não foi possível iniciar a gravação.');
      return;
    }
    recorder.ondataavailable = (e) => { if (e.data && e.data.size) recChunks.push(e.data); };
    recorder.onstop = onRecordingStopped;

    state.recording = true;
    tap();
    el.shutterWrap.classList.add('is-recording');
    el.recBadge.hidden = false;
    el.flip.disabled = true;
    el.timer.disabled = true;
    recStart = performance.now();
    recorder._mime = picked.mime;
    recorder._ext = picked.ext;
    recorder.start(250);
    recRAF = requestAnimationFrame(recordFrame);
  }

  function stopRecording() {
    if (!state.recording) return;
    state.recording = false;
    cancelAnimationFrame(recRAF);
    el.shutterWrap.classList.remove('is-recording');
    el.recBadge.hidden = true;
    el.flip.disabled = false;
    el.timer.disabled = false;
    el.shutterRing.style.setProperty('--progress', 0);
    navigator.vibrate && navigator.vibrate([12, 40, 12]);
    if (recorder && recorder.state !== 'inactive') recorder.stop();
  }

  function onRecordingStopped() {
    const blob = new Blob(recChunks, { type: recorder._mime.split(';')[0] });
    recChunks = [];
    blob._ext = recorder._ext;
    if (blob.size < 2000) {
      toast('A gravação ficou muito curta. Tente de novo.');
      return;
    }
    const thumbDone = recThumb
      ? Promise.resolve(recThumb)
      : new Promise((resolve) => el.recCanvas.toBlob((b) => resolve(b), 'image/jpeg', 0.7));
    thumbDone.then((thumb) => {
      showResult(blob, 'video');
      LocalGallery.add({ type: 'video', blob, thumb: thumb || undefined }).catch(() => {});
    });
  }

  /* ---------- disparador ---------- */

  el.shutter.addEventListener('click', () => {
    if (state.mode === 'video') {
      state.recording ? stopRecording() : startRecording();
    } else {
      shoot();
    }
  });

  document.addEventListener('keydown', (e) => {
    if ((e.code === 'Space' || e.key === 'Enter') && el.cam.classList.contains('is-active') && el.result.hidden && el.gallery.hidden) {
      e.preventDefault();
      el.shutter.click();
    }
    if (e.key === 'Escape') {
      if (!el.viewer.hidden) closeViewer();
      else if (!el.gallery.hidden) closeGallery();
      else if (!el.result.hidden) closeResult();
    }
  });

  /* ---------- resultado ---------- */

  function showResult(blob, type) {
    if (state.photo) URL.revokeObjectURL(state.photo.url);
    const url = URL.createObjectURL(blob);
    state.photo = { blob, url, type };

    if (type === 'video') {
      el.resultImg.hidden = true;
      el.resultVideo.hidden = false;
      el.resultVideo.src = url;
      el.resultVideo.play().catch(() => {});
      el.resultHint.textContent = 'Toque para ouvir, se o vídeo tiver som';
      el.lastImg.src = '';
    } else {
      el.resultVideo.hidden = true;
      el.resultVideo.removeAttribute('src');
      el.resultImg.hidden = false;
      el.resultImg.src = url;
      el.resultImg.style.animation = 'none';
      void el.resultImg.offsetWidth;
      el.resultImg.style.animation = '';
      el.resultHint.textContent = isIOS ? 'Toque em "Salvar Imagem" para guardar no app Fotos' : '';
      el.lastImg.src = url;
      el.last.hidden = false;
    }

    el.result.classList.remove('is-leaving');
    el.result.hidden = false;
  }

  function closeResult() {
    el.result.classList.add('is-leaving');
    setTimeout(() => {
      el.result.hidden = true;
      el.result.classList.remove('is-leaving');
      el.resultVideo.pause();
    }, 330);
  }

  el.last.addEventListener('click', () => {
    if (!state.photo) return;
    tap();
    el.result.classList.remove('is-leaving');
    el.result.hidden = false;
  });
  $('btnRetake').addEventListener('click', () => { tap(); closeResult(); });
  el.resultGalleryBtn.addEventListener('click', () => { tap(); closeResult(); openGallery(); });
  el.galleryBtn.addEventListener('click', () => { tap(); openGallery(); });

  /* ---------- salvar ---------- */

  function fileName(ext) {
    const d = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    return `${cfg.fileName}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}${ext}`;
  }

  async function save(blob, kind) {
    const ext = kind === 'video' ? blob._ext || (blob.type.includes('mp4') ? '.mp4' : '.webm') : '.jpg';
    const name = fileName(ext);

    if (isIOS && navigator.canShare && typeof File === 'function') {
      const file = new File([blob], name, { type: blob.type || (kind === 'video' ? 'video/mp4' : 'image/jpeg') });
      if (navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({ files: [file] });
          return;
        } catch (err) {
          if (err && err.name === 'AbortError') return;
        }
      }
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
    toast(isIOS ? 'Se não salvar, toque e segure para guardar' : 'Salvo ✓');
  }

  $('btnSave').addEventListener('click', () => {
    tap();
    if (state.photo) save(state.photo.blob, state.photo.type);
  });

  /* ---------- galeria ---------- */

  function clearGalleryUrls() {
    state.galleryUrls.forEach((u) => URL.revokeObjectURL(u));
    state.galleryUrls = [];
  }

  async function renderGallery() {
    clearGalleryUrls();
    el.galleryGrid.innerHTML = '';
    let rows = [];
    try {
      rows = await LocalGallery.all();
    } catch (err) {
      console.warn(err);
    }
    el.galleryEmpty.hidden = rows.length > 0;
    rows.forEach((row, i) => {
      const url = URL.createObjectURL(row.thumb || row.blob);
      state.galleryUrls.push(url);
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.style.animationDelay = Math.min(i * 40, 400) + 'ms';
      btn.setAttribute('aria-label', (row.type === 'video' ? 'Vídeo' : 'Foto') + ' ' + (i + 1));
      const img = document.createElement('img');
      img.src = url;
      img.alt = '';
      img.loading = 'lazy';
      btn.appendChild(img);
      if (row.type === 'video') {
        const play = document.createElement('span');
        play.className = 'play';
        play.innerHTML = '<svg viewBox="0 0 24 24" width="22" height="22" fill="#fff"><path d="M8 5v14l11-7z"/></svg>';
        btn.appendChild(play);
      }
      btn.addEventListener('click', () => openViewer(row));
      el.galleryGrid.appendChild(btn);
    });
  }

  async function openGallery() {
    await renderGallery();
    el.gallery.hidden = false;
    el.gallery.classList.remove('is-leaving');
  }
  function closeGallery() {
    el.gallery.classList.add('is-leaving');
    setTimeout(() => {
      el.gallery.hidden = true;
      el.gallery.classList.remove('is-leaving');
      clearGalleryUrls();
    }, 280);
  }
  el.galleryClose.addEventListener('click', () => { tap(); closeGallery(); });

  let viewerUrl = null;
  let viewingRow = null;
  function openViewer(row) {
    viewingRow = row;
    if (viewerUrl) URL.revokeObjectURL(viewerUrl);
    viewerUrl = URL.createObjectURL(row.blob);
    el.viewerMedia.innerHTML = '';
    if (row.type === 'video') {
      const v = document.createElement('video');
      v.src = viewerUrl;
      v.controls = true;
      v.autoplay = true;
      v.loop = true;
      v.playsInline = true;
      el.viewerMedia.appendChild(v);
    } else {
      const img = document.createElement('img');
      img.src = viewerUrl;
      img.alt = '';
      el.viewerMedia.appendChild(img);
    }
    resetDeleteConfirm();
    el.viewer.hidden = false;
  }
  function closeViewer() {
    el.viewer.hidden = true;
    el.viewerMedia.querySelectorAll('video').forEach((v) => v.pause());
    if (viewerUrl) { URL.revokeObjectURL(viewerUrl); viewerUrl = null; }
    viewingRow = null;
    resetDeleteConfirm();
  }
  el.viewerClose.addEventListener('click', () => { tap(); closeViewer(); });
  el.viewerSave.addEventListener('click', () => {
    tap();
    if (viewingRow) save(viewingRow.blob, viewingRow.type);
  });

  let confirmTimer = null;
  function resetDeleteConfirm() {
    clearTimeout(confirmTimer);
    el.viewerDelete.classList.remove('is-confirm');
    el.viewerDelete.textContent = 'Apagar';
  }
  el.viewerDelete.addEventListener('click', async () => {
    if (!viewingRow) return;
    if (!el.viewerDelete.classList.contains('is-confirm')) {
      el.viewerDelete.classList.add('is-confirm');
      el.viewerDelete.textContent = 'Toque de novo para apagar';
      confirmTimer = setTimeout(resetDeleteConfirm, 3200);
      return;
    }
    try {
      await LocalGallery.remove(viewingRow.id);
      closeViewer();
      toast('Apagado deste aparelho.');
      renderGallery();
    } catch (err) {
      console.warn(err);
      toast('Não foi possível apagar.');
    }
  });
})();
