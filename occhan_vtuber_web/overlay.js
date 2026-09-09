const OVT = (() => {
  if (window.__occhanVTuber) {
    window.__occhanVTuber.show();
    return window.__occhanVTuber;
  }

  const SCRIPT_URL = new URL(import.meta.url);
  const BASE_URL = new URL(".", SCRIPT_URL);
  const asset = name => new URL(`assets/${name}.png`, BASE_URL).href;

  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const lerp = (a, b, t) => a + (b - a) * t;

  const root = document.createElement("div");
  root.id = "occhan-vtuber-root";
  root.style.cssText = `
    position:fixed;
    right:10px;
    bottom:12px;
    width:min(40vw,240px);
    aspect-ratio:335/435;
    z-index:2147483647;
    pointer-events:none;
    user-select:none;
    -webkit-user-select:none;
    touch-action:none;
    filter:drop-shadow(0 3px 6px rgba(0,0,0,.18));
  `;

  const stage = document.createElement("div");
  stage.style.cssText = `
    position:absolute;
    inset:0;
    transform-origin:50% 84%;
    will-change:transform;
    pointer-events:none;
    overflow:hidden;
  `;
  root.appendChild(stage);

  // =========================
  // Base face: use the approved reference as-is
  // =========================
  const base = document.createElement("img");
  base.src = asset("reference");
  base.draggable = false;
  base.style.cssText = `
    position:absolute;
    inset:0;
    width:100%;
    height:100%;
    object-fit:fill;
    pointer-events:none;
  `;
  stage.appendChild(base);

  // reference.png に含まれる余計な左上文字を隠す
  const coverLeftTop = document.createElement("div");
  coverLeftTop.style.cssText = `
    position:absolute;
    left:0;
    top:0;
    width:9%;
    height:12%;
    background:#f5f4ef;
    pointer-events:none;
  `;
  stage.appendChild(coverLeftTop);

  // reference.png に含まれる下の黒線を隠す
  const coverBottom = document.createElement("div");
  coverBottom.style.cssText = `
    position:absolute;
    left:0;
    right:0;
    bottom:0;
    height:5.8%;
    background:#f5f4ef;
    pointer-events:none;
  `;
  stage.appendChild(coverBottom);

  // =========================
  // Mouth rig
  // =========================

  // 口の差し替え時だけ、元の口を少し隠すための下地
  const mouthBaseCover = document.createElement("div");
  mouthBaseCover.style.cssText = `
    position:absolute;
    left:29.8%;
    top:72.8%;
    width:40.2%;
    height:15.2%;
    border-radius:50%;
    background:rgba(245,244,239,.97);
    filter:blur(1px);
    opacity:0;
    pointer-events:none;
    transition:opacity .08s linear;
  `;
  stage.appendChild(mouthBaseCover);

  const mouth = document.createElement("img");
  mouth.src = asset("mouth_neutral");
  mouth.draggable = false;
  mouth.style.cssText = `
    position:absolute;
    left:31.0%;
    top:73.9%;
    width:36.4%;
    height:auto;
    transform-origin:50% 50%;
    opacity:0;
    pointer-events:none;
    will-change:transform, opacity;
  `;
  stage.appendChild(mouth);

  function setMouth(name, visible) {
    if (!visible) {
      mouth.style.opacity = "0";
      mouthBaseCover.style.opacity = "0";
      return;
    }
    mouth.src = asset(name);
    mouth.style.opacity = "1";
    mouthBaseCover.style.opacity = "1";
  }

  function chooseMouth(target) {
    const jaw = target.jaw;
    const smile = target.smile;
    const pucker = target.pucker;

    // まずは「静止時の元画像完全一致」を優先
    if (jaw < 0.12 && smile < 0.26) {
      setMouth("mouth_neutral", false);
      return;
    }

    let name = "mouth_e";

    if (jaw < 0.18 && smile >= 0.26) {
      name = "mouth_smile";
    } else if (jaw > 0.58 && pucker > 0.24) {
      name = "mouth_surprise";
    } else if (jaw > 0.44) {
      name = "mouth_a";
    } else if (jaw > 0.26 && pucker > 0.28) {
      name = "mouth_o";
    } else if (jaw > 0.22 && pucker > 0.18) {
      name = "mouth_u";
    } else if (jaw > 0.18) {
      name = "mouth_e";
    }

    setMouth(name, true);
  }

  // =========================
  // Controls
  // =========================
  const controls = document.createElement("div");
  controls.style.cssText = `
    position:absolute;
    right:-2px;
    bottom:-4px;
    pointer-events:auto;
    display:flex;
    gap:5px;
    align-items:center;
    padding:5px 7px;
    border-radius:999px;
    background:rgba(20,20,20,.76);
    color:white;
    font:12px/1 -apple-system,BlinkMacSystemFont,sans-serif;
    box-shadow:0 2px 8px rgba(0,0,0,.2);
    backdrop-filter:blur(8px);
    -webkit-backdrop-filter:blur(8px);
  `;

  const camBtn = document.createElement("button");
  camBtn.textContent = "顔追跡";

  const editBtn = document.createElement("button");
  editBtn.textContent = "移動";

  const hideUIBtn = document.createElement("button");
  hideUIBtn.textContent = "●";

  [camBtn, editBtn, hideUIBtn].forEach(b => {
    b.style.cssText = `
      border:0;
      background:transparent;
      color:white;
      font:inherit;
      padding:4px 5px;
    `;
    controls.appendChild(b);
  });

  root.appendChild(controls);
  document.documentElement.appendChild(root);

  // =========================
  // State
  // =========================
  let faceLandmarker = null;
  let video = null;
  let stream = null;
  let tracking = false;
  let loading = false;
  let editMode = false;
  let raf = 0;
  let idleRaf = 0;
  let lastVideoTime = -1;

  const state = {
    x: 0,
    y: 0,
    roll: 0,
    yaw: 0,
    pitch: 0,
    jaw: 0,
    smile: 0,
    pucker: 0,
  };

  const target = { ...state };

  const scoreMap = cats => {
    const m = Object.create(null);
    for (const c of (cats || [])) {
      m[c.categoryName] = c.score;
    }
    return m;
  };

  const s = (m, name) => m[name] || 0;

  // =========================
  // Render
  // =========================
  function render() {
    const k = 0.22;

    for (const key of Object.keys(state)) {
      state[key] = lerp(state[key], target[key], k);
    }

    // 顔全体を少しだけ動かす
    stage.style.transform =
      `translate3d(${state.x}px, ${state.y}px, 0) ` +
      `rotate(${state.roll}deg) ` +
      `skewX(${state.yaw * -0.8}deg) ` +
      `scaleX(${1 - Math.abs(state.yaw) * 0.008}) ` +
      `scaleY(${1 + state.pitch * 0.003})`;

    chooseMouth(state);

    const mouthScaleX = 1 + state.jaw * 0.025;
    const mouthScaleY = 1 + state.jaw * 0.045;
    const mouthShiftY = state.jaw * 1.5;

    mouth.style.transform =
      `translateY(${mouthShiftY}px) scale(${mouthScaleX}, ${mouthScaleY})`;

    raf = requestAnimationFrame(render);
  }

  render();

  // =========================
  // Face tracking
  // =========================
  async function ensureTracker() {
    if (faceLandmarker || loading) return;

    loading = true;
    camBtn.textContent = "読込中…";

    try {
      const vision = await import(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/+esm"
      );

      const {
        FaceLandmarker,
        FilesetResolver
      } = vision;

      const fileset = await FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/wasm"
      );

      faceLandmarker = await FaceLandmarker.createFromOptions(fileset, {
        baseOptions: {
          modelAssetPath:
            "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
          delegate: "GPU"
        },
        runningMode: "VIDEO",
        numFaces: 1,
        outputFaceBlendshapes: true,
        outputFacialTransformationMatrixes: false
      });

      camBtn.textContent = "顔追跡";
    } catch (e) {
      console.error("[occhan VTuber] tracker load failed", e);
      camBtn.textContent = "追跡NG";
      alert(
        "顔追跡ライブラリを読み込めませんでした。" +
        "このサイトのCSPで外部スクリプトが禁止されている可能性があります。"
      );
    } finally {
      loading = false;
    }
  }

  async function startTracking() {
    if (tracking) {
      return stopTracking();
    }

    await ensureTracker();
    if (!faceLandmarker) return;

    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "user",
          width: { ideal: 480 },
          height: { ideal: 640 }
        },
        audio: false
      });

      video = document.createElement("video");
      video.playsInline = true;
      video.muted = true;
      video.srcObject = stream;
      video.style.display = "none";
      document.documentElement.appendChild(video);

      await video.play();

      tracking = true;
      camBtn.textContent = "停止";
      trackLoop();
    } catch (e) {
      console.error("[occhan VTuber] camera failed", e);
      alert(
        "前面カメラを開始できませんでした。" +
        "Safariのカメラ許可を確認してください。"
      );
    }
  }

  function stopTracking() {
    tracking = false;
    camBtn.textContent = "顔追跡";

    if (stream) {
      stream.getTracks().forEach(t => t.stop());
    }
    if (video) {
      video.remove();
    }

    stream = null;
    video = null;

    Object.assign(target, {
      x: 0,
      y: 0,
      roll: 0,
      yaw: 0,
      pitch: 0,
      jaw: 0,
      smile: 0,
      pucker: 0,
    });

    setMouth("mouth_neutral", false);
  }

  function trackLoop() {
    if (!tracking || !video || !faceLandmarker) return;

    const now = performance.now();

    if (video.readyState >= 2 && video.currentTime !== lastVideoTime) {
      lastVideoTime = video.currentTime;

      try {
        const res = faceLandmarker.detectForVideo(video, now);
        const lm = res.faceLandmarks?.[0];

        if (lm) {
          const eyeLpt = lm[33];
          const eyeRpt = lm[263];
          const nosePt = lm[1];

          const midX = (eyeLpt.x + eyeRpt.x) * 0.5;
          const midY = (eyeLpt.y + eyeRpt.y) * 0.5;

          const eyeDx = eyeRpt.x - eyeLpt.x;
          const eyeDy = eyeRpt.y - eyeLpt.y;
          const eyeDist = Math.max(0.001, Math.hypot(eyeDx, eyeDy));

          const roll = Math.atan2(eyeDy, eyeDx) * 180 / Math.PI;
          const yaw = clamp((nosePt.x - midX) / eyeDist * 2.3, -1, 1);
          const pitch = clamp(((nosePt.y - midY) / eyeDist - 0.72) * 1.15, -1, 1);

          target.roll = clamp(roll, -9, 9);
          target.yaw = yaw;
          target.pitch = pitch;

          target.x = clamp((0.5 - nosePt.x) * 15, -6, 6);
          target.y = clamp((nosePt.y - 0.5) * 10, -4, 4);
        }

        const cats = res.faceBlendshapes?.[0]?.categories;
        if (cats) {
          const m = scoreMap(cats);

          target.jaw = s(m, "jawOpen");
          target.smile =
            (s(m, "mouthSmileLeft") + s(m, "mouthSmileRight")) * 0.5;
          target.pucker = Math.max(
            s(m, "mouthPucker"),
            s(m, "mouthFunnel")
          );
        }
      } catch (e) {
        console.warn("[occhan VTuber] frame error", e);
      }
    }

    requestAnimationFrame(trackLoop);
  }

  // =========================
  // Drag / resize
  // =========================
  let pointers = new Map();
  let startRect = null;
  let startDist = 0;
  let startWidth = 0;

  function setEdit(v) {
    editMode = v;
    root.style.pointerEvents = v ? "auto" : "none";
    controls.style.pointerEvents = "auto";
    editBtn.textContent = v ? "完了" : "移動";
    root.style.outline = v ? "1px dashed rgba(40,40,40,.45)" : "none";
  }

  root.addEventListener("pointerdown", e => {
    if (!editMode || e.target.closest("button")) return;

    e.preventDefault();
    root.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    startRect = root.getBoundingClientRect();

    if (pointers.size === 2) {
      const p = [...pointers.values()];
      startDist = Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y);
      startWidth = startRect.width;
    }
  });

  root.addEventListener("pointermove", e => {
    if (!editMode || !pointers.has(e.pointerId)) return;

    e.preventDefault();

    const prev = pointers.get(e.pointerId);
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pointers.size === 1 && startRect) {
      const dx = e.clientX - prev.x;
      const dy = e.clientY - prev.y;
      const r = root.getBoundingClientRect();

      root.style.right = "auto";
      root.style.bottom = "auto";
      root.style.left = `${clamp(r.left + dx, 0, innerWidth - r.width)}px`;
      root.style.top = `${clamp(r.top + dy, 0, innerHeight - r.height)}px`;
    } else if (pointers.size === 2) {
      const p = [...pointers.values()];
      const d = Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y);
      const newW = clamp(
        startWidth * d / Math.max(1, startDist),
        100,
        innerWidth * 0.68
      );
      root.style.width = `${newW}px`;
    }
  });

  const endPointer = e => {
    pointers.delete(e.pointerId);
  };

  root.addEventListener("pointerup", endPointer);
  root.addEventListener("pointercancel", endPointer);

  camBtn.addEventListener("click", e => {
    e.stopPropagation();
    startTracking();
  });

  editBtn.addEventListener("click", e => {
    e.stopPropagation();
    setEdit(!editMode);
  });

  hideUIBtn.addEventListener("click", e => {
    e.stopPropagation();
    controls.style.display = "none";
    hotspot.style.display = "block";
  });

  const hotspot = document.createElement("button");
  hotspot.title = "VTuber controls";
  hotspot.style.cssText = `
    position:fixed;
    right:0;
    bottom:0;
    width:12px;
    height:12px;
    opacity:.05;
    z-index:2147483647;
    border:0;
    background:#000;
    display:none;
    pointer-events:auto;
  `;

  hotspot.addEventListener("click", () => {
    controls.style.display = "flex";
    hotspot.style.display = "none";
  });

  document.documentElement.appendChild(hotspot);

  const api = {
    show() {
      root.style.display = "";
    },
    hide() {
      root.style.display = "none";
    },
    toggle() {
      root.style.display =
        root.style.display === "none" ? "" : "none";
    },
    startTracking,
    stopTracking,
    destroy() {
      stopTracking();
      cancelAnimationFrame(raf);
      cancelAnimationFrame(idleRaf);
      root.remove();
      hotspot.remove();
      delete window.__occhanVTuber;
    }
  };

  window.__occhanVTuber = api;

  // tracking off 時の軽いアイドル
  let t0 = performance.now();
  const idle = now => {
    if (!tracking) {
      const t = (now - t0) / 1000;
      target.y = Math.sin(t * 1.7) * 0.8;
      target.roll = Math.sin(t * 0.85) * 0.45;
    }
    idleRaf = requestAnimationFrame(idle);
  };
  idleRaf = requestAnimationFrame(idle);

  return api;
})();
