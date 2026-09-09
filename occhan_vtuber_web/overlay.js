const OVT = (() => {
  if (window.__occhanVTuber) {
    window.__occhanVTuber.show();
    return window.__occhanVTuber;
  }

  const SVG_NS = "http://www.w3.org/2000/svg";

  const SCRIPT_URL = new URL(import.meta.url);
  const BASE_URL = new URL(".", SCRIPT_URL);
  const asset = name => new URL(`assets/${name}.png`, BASE_URL).href;

  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const lerp = (a, b, t) => a + (b - a) * t;

  const makeLayer = (src, style) => {
    const img = document.createElement("img");
    img.src = src;
    img.draggable = false;
    img.style.cssText = `position:absolute; pointer-events:none; ${style}`;
    return img;
  };

  const svgEl = (tag, attrs = {}) => {
    const el = document.createElementNS(SVG_NS, tag);
    for (const [k, v] of Object.entries(attrs)) {
      el.setAttribute(k, String(v));
    }
    return el;
  };

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
    transform-origin:50% 85%;
    will-change:transform;
    pointer-events:none;
    overflow:visible;
  `;
  root.appendChild(stage);

  // ===== Base and image parts =====

  // base_head.png を reference に合わせて少し拡大＆上左へ寄せる
  const base = makeLayer(
    asset("base_head"),
    "left:-3.9%; top:-3.5%; width:102.7%; height:auto;"
  );

  const browL = makeLayer(
    asset("brow_l"),
    "left:22.7%; top:44.4%; width:28.4%;"
  );

  const browR = makeLayer(
    asset("brow_r"),
    "left:51.0%; top:44.4%; width:28.4%;"
  );

  const nose = makeLayer(
    asset("nose"),
    "left:40.6%; top:63.0%; width:20.0%; opacity:.82;"
  );

  const mouth = makeLayer(
    asset("mouth_neutral"),
    "left:31.0%; top:73.8%; width:36.4%; transform-origin:50% 50%;"
  );

  stage.appendChild(base);
  stage.appendChild(browL);
  stage.appendChild(browR);

  // ===== SVG rig for eyes + glasses =====

  const svg = svgEl("svg", {
    viewBox: "0 0 335 435",
    preserveAspectRatio: "none"
  });
  svg.style.cssText = `
    position:absolute;
    inset:0;
    width:100%;
    height:100%;
    overflow:visible;
    pointer-events:none;
  `;

  const eyesGroup = svgEl("g");
  const glassesGroup = svgEl("g");
  svg.appendChild(eyesGroup);
  svg.appendChild(glassesGroup);
  stage.appendChild(svg);

  function createEye(cx, cy) {
    const group = svgEl("g");
    const openGroup = svgEl("g");

    const sclera = svgEl("ellipse", {
      cx,
      cy,
      rx: 30,
      ry: 17.5,
      fill: "#fbfbfa"
    });

    // 上まぶた（元画像のやや眠そうな形）
    const upper = svgEl("path", {
      d: `M ${cx - 32} ${cy - 4}
          Q ${cx - 12} ${cy - 24} ${cx} ${cy - 23}
          Q ${cx + 18} ${cy - 22} ${cx + 32} ${cy - 5}`,
      fill: "none",
      stroke: "#2b2726",
      "stroke-width": "8.5",
      "stroke-linecap": "round",
      "stroke-linejoin": "round"
    });

    // 下まぶたは弱め
    const lower = svgEl("path", {
      d: `M ${cx - 27} ${cy + 10}
          Q ${cx} ${cy + 17} ${cx + 27} ${cy + 9}`,
      fill: "none",
      stroke: "#3a3635",
      "stroke-width": "4.8",
      "stroke-linecap": "round",
      "stroke-linejoin": "round",
      opacity: "0.92"
    });

    const iris = svgEl("ellipse", {
      cx,
      cy: cy + 2,
      rx: 10.2,
      ry: 13.0,
      fill: "#2f2b2a"
    });

    const pupil = svgEl("ellipse", {
      cx,
      cy: cy + 2.7,
      rx: 4.2,
      ry: 5.2,
      fill: "#1b1918",
      opacity: "0.45"
    });

    openGroup.appendChild(sclera);
    openGroup.appendChild(iris);
    openGroup.appendChild(pupil);
    openGroup.appendChild(upper);
    openGroup.appendChild(lower);
    group.appendChild(openGroup);

    return {
      group,
      openGroup,
      iris,
      pupil,
      baseCx: cx,
      baseCy: cy + 2
    };
  }

  // reference に寄せた位置
  const leftEye = createEye(118, 248);
  const rightEye = createEye(219, 248);

  eyesGroup.appendChild(leftEye.group);
  eyesGroup.appendChild(rightEye.group);

  function addRoughPath(parent, d, {
    stroke = "#151312",
    width = 11,
    opacity = 1
  } = {}) {
    const p = svgEl("path", {
      d,
      fill: "none",
      stroke,
      "stroke-width": width,
      "stroke-linecap": "round",
      "stroke-linejoin": "round",
      opacity
    });
    parent.appendChild(p);
    return p;
  }

  // 元画像っぽい少し四角寄りの黒縁メガネ
  const leftLens =
    "M 60 246 " +
    "Q 62 232 78 230 " +
    "L 141 230 " +
    "Q 156 231 158 245 " +
    "L 157 270 " +
    "Q 154 282 139 282 " +
    "L 79 282 " +
    "Q 64 281 61 268 Z";

  const rightLens =
    "M 178 245 " +
    "Q 180 231 194 230 " +
    "L 257 230 " +
    "Q 272 231 274 245 " +
    "L 273 269 " +
    "Q 270 282 255 282 " +
    "L 196 282 " +
    "Q 181 281 178 267 Z";

  const bridge =
    "M 157 247 " +
    "Q 167 240 178 246";

  const templeL =
    "M 61 253 Q 49 256 43 263";

  const templeR =
    "M 274 253 Q 286 256 292 263";

  // 少しラフさを出すため二重に引く
  addRoughPath(glassesGroup, leftLens, { width: 11, opacity: 1 });
  addRoughPath(glassesGroup, rightLens, { width: 11, opacity: 1 });
  addRoughPath(glassesGroup, bridge, { width: 9, opacity: 1 });
  addRoughPath(glassesGroup, templeL, { width: 7.5, opacity: 1 });
  addRoughPath(glassesGroup, templeR, { width: 7.5, opacity: 1 });

  addRoughPath(glassesGroup, leftLens, { width: 7, opacity: 0.28, stroke: "#272322" });
  addRoughPath(glassesGroup, rightLens, { width: 7, opacity: 0.28, stroke: "#272322" });
  addRoughPath(glassesGroup, bridge, { width: 5.5, opacity: 0.28, stroke: "#272322" });

  stage.appendChild(nose);
  stage.appendChild(mouth);

  // ===== Controls =====

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

  // ===== State =====

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
    blinkL: 0,
    blinkR: 0,
    jaw: 0,
    smile: 0,
    pucker: 0,
    browL: 0,
    browR: 0,
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

  function chooseMouth() {
    const jaw = target.jaw;
    const smile = target.smile;
    const pucker = target.pucker;

    let name = "mouth_neutral";

    // 笑顔でも目は変えず、口だけ差し替え
    if (jaw < 0.16 && smile > 0.28) {
      name = "mouth_smile";
    } else if (jaw > 0.57 && pucker > 0.25) {
      name = "mouth_surprise";
    } else if (jaw > 0.42) {
      name = "mouth_a";
    } else if (jaw > 0.24 && pucker > 0.28) {
      name = "mouth_o";
    } else if (jaw > 0.24) {
      name = "mouth_e";
    } else {
      name = "mouth_neutral";
    }

    mouth.src = asset(name);
  }

  function setEyeOpen(eye, blink) {
    const sy = Math.max(0.08, 1 - blink * 0.92);
    const ty = eye.baseCy * (1 - sy);
    eye.openGroup.setAttribute(
      "transform",
      `translate(0 ${ty.toFixed(2)}) scale(1 ${sy.toFixed(3)})`
    );
  }

  function render() {
    const k = 0.22;

    for (const key of Object.keys(state)) {
      state[key] = lerp(state[key], target[key], k);
    }

    stage.style.transform =
      `translate3d(${state.x}px, ${state.y}px, 0) ` +
      `rotate(${state.roll}deg) ` +
      `skewX(${state.yaw * -1.1}deg) ` +
      `scaleX(${1 - Math.abs(state.yaw) * 0.012}) ` +
      `scaleY(${1 + state.pitch * 0.004})`;

    // 黒目の移動量は控えめ
    const eyeShiftX = state.yaw * 3.4;
    const eyeShiftY = state.pitch * 1.0;

    leftEye.iris.setAttribute("cx", (leftEye.baseCx + eyeShiftX).toFixed(2));
    leftEye.iris.setAttribute("cy", (leftEye.baseCy + eyeShiftY).toFixed(2));
    leftEye.pupil.setAttribute("cx", (leftEye.baseCx + eyeShiftX).toFixed(2));
    leftEye.pupil.setAttribute("cy", (leftEye.baseCy + 0.7 + eyeShiftY).toFixed(2));

    rightEye.iris.setAttribute("cx", (rightEye.baseCx + eyeShiftX).toFixed(2));
    rightEye.iris.setAttribute("cy", (rightEye.baseCy + eyeShiftY).toFixed(2));
    rightEye.pupil.setAttribute("cx", (rightEye.baseCx + eyeShiftX).toFixed(2));
    rightEye.pupil.setAttribute("cy", (rightEye.baseCy + 0.7 + eyeShiftY).toFixed(2));

    setEyeOpen(leftEye, state.blinkL);
    setEyeOpen(rightEye, state.blinkR);

    browL.style.transform = `translateY(${-state.browL * 3.0}px)`;
    browR.style.transform = `translateY(${-state.browR * 3.0}px)`;

    mouth.style.transform =
      `scale(${1 + state.jaw * 0.015}, ${1 + state.jaw * 0.025})`;

    raf = requestAnimationFrame(render);
  }

  render();

  // ===== Face tracking =====

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
      blinkL: 0,
      blinkR: 0,
      jaw: 0,
      smile: 0,
      pucker: 0,
      browL: 0,
      browR: 0
    });

    mouth.src = asset("mouth_neutral");
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
          const yaw = clamp((nosePt.x - midX) / eyeDist * 2.7, -1, 1);
          const pitch = clamp(((nosePt.y - midY) / eyeDist - 0.72) * 1.25, -1, 1);

          target.roll = clamp(roll, -12, 12);
          target.yaw = yaw;
          target.pitch = pitch;

          target.x = clamp((0.5 - nosePt.x) * 20, -7.5, 7.5);
          target.y = clamp((nosePt.y - 0.5) * 12, -5, 5);
        }

        const cats = res.faceBlendshapes?.[0]?.categories;
        if (cats) {
          const m = scoreMap(cats);

          target.blinkL = s(m, "eyeBlinkLeft");
          target.blinkR = s(m, "eyeBlinkRight");
          target.jaw = s(m, "jawOpen");
          target.smile =
            (s(m, "mouthSmileLeft") + s(m, "mouthSmileRight")) * 0.5;
          target.pucker = Math.max(
            s(m, "mouthPucker"),
            s(m, "mouthFunnel")
          );

          target.browL =
            Math.max(s(m, "browInnerUp"), s(m, "browOuterUpLeft")) -
            s(m, "browDownLeft");

          target.browR =
            Math.max(s(m, "browInnerUp"), s(m, "browOuterUpRight")) -
            s(m, "browDownRight");

          chooseMouth();
        }
      } catch (e) {
        console.warn("[occhan VTuber] frame error", e);
      }
    }

    requestAnimationFrame(trackLoop);
  }

  // ===== Drag / resize =====

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
      target.y = Math.sin(t * 1.7) * 1.0;
      target.roll = Math.sin(t * 0.85) * 0.55;
    }
    idleRaf = requestAnimationFrame(idle);
  };
  idleRaf = requestAnimationFrame(idle);

  return api;
})();
