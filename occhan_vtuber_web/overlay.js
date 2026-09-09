
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
    position:fixed; right:10px; bottom:12px; width:min(38vw,220px);
    aspect-ratio:328/408; z-index:2147483647; pointer-events:none;
    user-select:none; -webkit-user-select:none; touch-action:none;
    filter:drop-shadow(0 3px 6px rgba(0,0,0,.18));
  `;

  const stage = document.createElement("div");
  stage.style.cssText = `
    position:absolute; inset:0; transform-origin:50% 85%;
    will-change:transform; pointer-events:none;
  `;

  const makeLayer = (src, style) => {
    const img = document.createElement("img");
    img.src = src;
    img.draggable = false;
    img.style.cssText = `position:absolute; pointer-events:none; ${style}`;
    return img;
  };

  const base = makeLayer(asset("base_head"), "inset:0;width:100%;height:100%;object-fit:contain;");
  const browL = makeLayer(asset("brow_l"), "left:25%;top:45.3%;width:28%;");
  const browR = makeLayer(asset("brow_r"), "left:54.9%;top:45.3%;width:28%;");
  const eyeL = makeLayer(asset("eye_l"), "left:26.2%;top:55.1%;width:24.4%;transform-origin:50% 60%;");
  const eyeR = makeLayer(asset("eye_r"), "left:56.7%;top:55.1%;width:24.4%;transform-origin:50% 60%;");
  const glasses = makeLayer(asset("glasses"), "left:14.6%;top:52.7%;width:71.6%;");
  const nose = makeLayer(asset("nose"), "left:42.4%;top:67.4%;width:16.8%;");
  const mouth = makeLayer(asset("mouth_neutral"), "left:32%;top:78.2%;width:36.6%;transform-origin:50% 50%;");

  [base, browL, browR, eyeL, eyeR, glasses, nose, mouth].forEach(x => stage.appendChild(x));
  root.appendChild(stage);

  // Small control pill; hidden during recording with one tap.
  const controls = document.createElement("div");
  controls.style.cssText = `
    position:absolute; right:-2px; bottom:-4px; pointer-events:auto;
    display:flex; gap:5px; align-items:center; padding:5px 7px;
    border-radius:999px; background:rgba(20,20,20,.76); color:white;
    font:12px/1 -apple-system,BlinkMacSystemFont,sans-serif;
    box-shadow:0 2px 8px rgba(0,0,0,.2); backdrop-filter:blur(8px);
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
      border:0;background:transparent;color:white;font:inherit;padding:4px 5px;
    `;
    controls.appendChild(b);
  });
  root.appendChild(controls);
  document.documentElement.appendChild(root);

  let faceLandmarker = null;
  let video = null;
  let stream = null;
  let tracking = false;
  let loading = false;
  let editMode = false;
  let uiVisible = true;
  let raf = 0;
  let lastVideoTime = -1;

  const state = {
    x: 0, y: 0, roll: 0, yaw: 0, pitch: 0,
    blinkL: 0, blinkR: 0, jaw: 0, smile: 0, pucker: 0,
    browL: 0, browR: 0,
  };
  const target = {...state};

  const scoreMap = cats => {
    const m = Object.create(null);
    for (const c of (cats || [])) m[c.categoryName] = c.score;
    return m;
  };
  const s = (m, name) => m[name] || 0;

  function chooseMouth(m) {
    const jaw = target.jaw;
    const smile = target.smile;
    const pucker = target.pucker;
    let name = "mouth_neutral";
    if (jaw < 0.16 && smile > 0.28) name = "mouth_smile";
    else if (jaw > 0.55 && pucker > 0.22) name = "mouth_surprise";
    else if (jaw > 0.42) name = "mouth_a";
    else if (jaw > 0.22 && pucker > 0.25) name = "mouth_o";
    else if (jaw > 0.22) name = "mouth_e";
    mouth.src = asset(name);
  }

  function render() {
    const k = 0.22;
    for (const key of Object.keys(state)) state[key] = lerp(state[key], target[key], k);

    stage.style.transform =
      `translate3d(${state.x}px,${state.y}px,0) rotate(${state.roll}deg) ` +
      `skewX(${state.yaw * -1.6}deg) scaleX(${1 - Math.abs(state.yaw)*0.018}) ` +
      `scaleY(${1 + state.pitch*0.006})`;

    const eyeShift = state.yaw * 1.2;
    eyeL.style.transform = `translateX(${eyeShift}px) scaleY(${Math.max(0.08, 1 - state.blinkL*0.92)})`;
    eyeR.style.transform = `translateX(${eyeShift}px) scaleY(${Math.max(0.08, 1 - state.blinkR*0.92)})`;
    browL.style.transform = `translateY(${-state.browL * 3.5}px)`;
    browR.style.transform = `translateY(${-state.browR * 3.5}px)`;

    raf = requestAnimationFrame(render);
  }
  render();

  async function ensureTracker() {
    if (faceLandmarker || loading) return;
    loading = true;
    camBtn.textContent = "読込中…";
    try {
      const vision = await import("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/+esm");
      const { FaceLandmarker, FilesetResolver } = vision;
      const fileset = await FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/wasm"
      );
      faceLandmarker = await FaceLandmarker.createFromOptions(fileset, {
        baseOptions: {
          modelAssetPath: "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
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
      alert("顔追跡ライブラリを読み込めませんでした。このサイトのCSPで外部スクリプトが禁止されている可能性があります。");
    } finally {
      loading = false;
    }
  }

  async function startTracking() {
    if (tracking) return stopTracking();
    await ensureTracker();
    if (!faceLandmarker) return;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 480 }, height: { ideal: 640 } },
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
      alert("前面カメラを開始できませんでした。Safariのカメラ許可を確認してください。");
    }
  }

  function stopTracking() {
    tracking = false;
    camBtn.textContent = "顔追跡";
    if (stream) stream.getTracks().forEach(t => t.stop());
    if (video) video.remove();
    stream = video = null;
    Object.assign(target, {
      x:0,y:0,roll:0,yaw:0,pitch:0,blinkL:0,blinkR:0,jaw:0,smile:0,pucker:0,browL:0,browR:0
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
          const eyeLpt = lm[33], eyeRpt = lm[263], nosePt = lm[1];
          const midX = (eyeLpt.x + eyeRpt.x) * 0.5;
          const midY = (eyeLpt.y + eyeRpt.y) * 0.5;
          const eyeDx = eyeRpt.x - eyeLpt.x;
          const eyeDy = eyeRpt.y - eyeLpt.y;
          const eyeDist = Math.max(0.001, Math.hypot(eyeDx, eyeDy));
          const roll = Math.atan2(eyeDy, eyeDx) * 180 / Math.PI;
          const yaw = clamp((nosePt.x - midX) / eyeDist * 3.2, -1, 1);
          const pitch = clamp(((nosePt.y - midY) / eyeDist - 0.72) * 1.4, -1, 1);

          target.roll = clamp(roll, -14, 14);
          target.yaw = yaw;
          target.pitch = pitch;
          target.x = clamp((0.5 - nosePt.x) * 24, -9, 9);
          target.y = clamp((nosePt.y - 0.5) * 15, -6, 6);
        }

        const cats = res.faceBlendshapes?.[0]?.categories;
        if (cats) {
          const m = scoreMap(cats);
          target.blinkL = s(m, "eyeBlinkLeft");
          target.blinkR = s(m, "eyeBlinkRight");
          target.jaw = s(m, "jawOpen");
          target.smile = (s(m, "mouthSmileLeft") + s(m, "mouthSmileRight")) * 0.5;
          target.pucker = Math.max(s(m, "mouthPucker"), s(m, "mouthFunnel"));
          target.browL = Math.max(s(m, "browInnerUp"), s(m, "browOuterUpLeft")) - s(m, "browDownLeft");
          target.browR = Math.max(s(m, "browInnerUp"), s(m, "browOuterUpRight")) - s(m, "browDownRight");
          chooseMouth(m);
        }
      } catch (e) {
        console.warn("[occhan VTuber] frame error", e);
      }
    }
    requestAnimationFrame(trackLoop);
  }

  // Edit mode: drag avatar; pinch changes size.
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
    pointers.set(e.pointerId, {x:e.clientX,y:e.clientY});
    startRect = root.getBoundingClientRect();
    if (pointers.size === 2) {
      const p = [...pointers.values()];
      startDist = Math.hypot(p[0].x-p[1].x,p[0].y-p[1].y);
      startWidth = startRect.width;
    }
  });

  root.addEventListener("pointermove", e => {
    if (!editMode || !pointers.has(e.pointerId)) return;
    e.preventDefault();
    const prev = pointers.get(e.pointerId);
    pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
    if (pointers.size === 1 && startRect) {
      const dx=e.clientX-prev.x, dy=e.clientY-prev.y;
      const r=root.getBoundingClientRect();
      root.style.right="auto"; root.style.bottom="auto";
      root.style.left=`${clamp(r.left+dx,0,innerWidth-r.width)}px`;
      root.style.top=`${clamp(r.top+dy,0,innerHeight-r.height)}px`;
    } else if (pointers.size === 2) {
      const p=[...pointers.values()];
      const d=Math.hypot(p[0].x-p[1].x,p[0].y-p[1].y);
      const newW=clamp(startWidth*d/Math.max(1,startDist),100,innerWidth*0.65);
      root.style.width=`${newW}px`;
    }
  });

  const endPointer = e => { pointers.delete(e.pointerId); };
  root.addEventListener("pointerup", endPointer);
  root.addEventListener("pointercancel", endPointer);

  camBtn.addEventListener("click", e => { e.stopPropagation(); startTracking(); });
  editBtn.addEventListener("click", e => { e.stopPropagation(); setEdit(!editMode); });
  hideUIBtn.addEventListener("click", e => {
    e.stopPropagation();
    uiVisible = false;
    controls.style.display = "none";
    // Three-finger-ish fallback: tapping the avatar 3 times in edit mode isn't convenient,
    // so expose a public method and add a tiny re-show hotspot at the extreme lower right.
    hotspot.style.display = "block";
  });

  const hotspot = document.createElement("button");
  hotspot.title = "VTuber controls";
  hotspot.style.cssText = `
    position:fixed;right:0;bottom:0;width:12px;height:12px;opacity:.05;
    z-index:2147483647;border:0;background:#000;display:none;pointer-events:auto;
  `;
  hotspot.addEventListener("click", () => {
    controls.style.display = "flex";
    hotspot.style.display = "none";
    uiVisible = true;
  });
  document.documentElement.appendChild(hotspot);

  const api = {
    show(){ root.style.display = ""; },
    hide(){ root.style.display = "none"; },
    toggle(){ root.style.display = root.style.display === "none" ? "" : "none"; },
    startTracking,
    stopTracking,
    destroy(){
      stopTracking();
      cancelAnimationFrame(raf);
      root.remove(); hotspot.remove();
      delete window.__occhanVTuber;
    }
  };
  window.__occhanVTuber = api;

  // Gentle idle while tracking is off.
  let t0 = performance.now();
  (function idle(now){
    if (!tracking) {
      const t=(now-t0)/1000;
      target.y = Math.sin(t*1.7)*1.2;
      target.roll = Math.sin(t*0.85)*0.7;
    }
    requestAnimationFrame(idle);
  })(t0);

  return api;
})();
