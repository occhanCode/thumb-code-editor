const OVT = (() => {
  if (window.__occhanVTuber) {
    window.__occhanVTuber.show();
    return window.__occhanVTuber;
  }

  const SCRIPT_URL = new URL(import.meta.url);
  const BASE_URL = new URL('.', SCRIPT_URL);
  const asset = name => new URL(`assets/${name}`, BASE_URL).href;

  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const lerp = (a, b, t) => a + (b - a) * t;

  const root = document.createElement('div');
  root.id = 'occhan-vtuber-root';
  root.style.cssText = `
    position:fixed;
    right:10px;
    bottom:12px;
    width:min(40vw,240px);
    aspect-ratio:328/408;
    z-index:2147483647;
    pointer-events:none;
    user-select:none;
    -webkit-user-select:none;
    touch-action:none;
    filter:drop-shadow(0 3px 6px rgba(0,0,0,.18));
  `;

  const stage = document.createElement('div');
  stage.style.cssText = `
    position:absolute;
    inset:0;
    transform-origin:50% 82%;
    will-change:transform;
    pointer-events:none;
  `;
  root.appendChild(stage);

  // 元画像そのものから口だけ消した顔。
  // 目・眉・メガネ・鼻・輪郭は描き直していない。
  const face = document.createElement('img');
  face.src = asset('face_mouthless_exact.png');
  face.draggable = false;
  face.style.cssText = `
    position:absolute;
    inset:0;
    width:100%;
    height:100%;
    object-fit:contain;
    pointer-events:none;
  `;
  stage.appendChild(face);

  // 元画像からそのまま切り出した口。
  const mouth = document.createElement('img');
  mouth.src = asset('mouth_exact_crop.png');
  mouth.draggable = false;
  mouth.style.cssText = `
    position:absolute;
    left:38.109756%;
    top:78.431373%;
    width:35.670732%;
    height:auto;
    transform-origin:50% 50%;
    will-change:transform;
    pointer-events:none;
  `;
  stage.appendChild(mouth);

  const controls = document.createElement('div');
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

  const camBtn = document.createElement('button');
  camBtn.textContent = '顔追跡';

  const editBtn = document.createElement('button');
  editBtn.textContent = '移動';

  const hideUIBtn = document.createElement('button');
  hideUIBtn.textContent = '●';

  [camBtn, editBtn, hideUIBtn].forEach(button => {
    button.style.cssText = `
      border:0;
      background:transparent;
      color:white;
      font:inherit;
      padding:4px 5px;
    `;
    controls.appendChild(button);
  });

  root.appendChild(controls);
  document.documentElement.appendChild(root);

  let faceLandmarker = null;
  let video = null;
  let stream = null;
  let tracking = false;
  let loading = false;
  let editMode = false;
  let raf = 0;
  let lastVideoTime = -1;

  const state = {
    x: 0,
    y: 0,
    roll: 0,
    yaw: 0,
    pitch: 0,
    jaw: 0,
  };

  const target = { ...state };

  const scoreMap = categories => {
    const result = Object.create(null);

    for (const category of categories || []) {
      result[category.categoryName] = category.score;
    }

    return result;
  };

  const score = (map, name) => map[name] || 0;

  function render() {
    const k = 0.18;

    for (const key of Object.keys(state)) {
      state[key] = lerp(state[key], target[key], k);
    }

    // 顔全体を動かす。
    // パーツ個別の位置は変えないので本人感が崩れにくい。
    stage.style.transform =
      `translate3d(${state.x}px, ${state.y}px, 0) ` +
      `rotate(${state.roll}deg) ` +
      `skewX(${state.yaw * -0.55}deg) ` +
      `scaleX(${1 - Math.abs(state.yaw) * 0.004}) ` +
      `scaleY(${1 + state.pitch * 0.002})`;

    // 今の段階では「元の口そのもの」を伸縮させる。
    // jaw=0 なら元画像と完全に同じ位置・大きさ。
    const j = clamp(state.jaw, 0, 1);

    const scaleX = 1 + j * 0.025;
    const scaleY = 1 + j * 0.18;
    const shiftY = j * 2.2;

    mouth.style.transform =
      `translateY(${shiftY}px) scale(${scaleX}, ${scaleY})`;

    raf = requestAnimationFrame(render);
  }

  render();

  async function ensureTracker() {
    if (faceLandmarker || loading) return;

    loading = true;
    camBtn.textContent = '読込中…';

    try {
      const vision = await import(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/+esm'
      );

      const {
        FaceLandmarker,
        FilesetResolver
      } = vision;

      const fileset = await FilesetResolver.forVisionTasks(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/wasm'
      );

      faceLandmarker = await FaceLandmarker.createFromOptions(fileset, {
        baseOptions: {
          modelAssetPath:
            'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
          delegate: 'GPU',
        },
        runningMode: 'VIDEO',
        numFaces: 1,
        outputFaceBlendshapes: true,
        outputFacialTransformationMatrixes: false,
      });

      camBtn.textContent = '顔追跡';
    } catch (error) {
      console.error('[occhan VTuber] tracker load failed', error);

      camBtn.textContent = '追跡NG';

      alert(
        '顔追跡ライブラリを読み込めませんでした。' +
        'このサイトのCSPで外部スクリプトが禁止されている可能性があります。'
      );
    } finally {
      loading = false;
    }
  }

  async function startTracking() {
    if (tracking) {
      stopTracking();
      return;
    }

    await ensureTracker();

    if (!faceLandmarker) return;

    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'user',
          width: { ideal: 480 },
          height: { ideal: 640 },
        },
        audio: false,
      });

      video = document.createElement('video');
      video.playsInline = true;
      video.muted = true;
      video.srcObject = stream;
      video.style.display = 'none';

      document.documentElement.appendChild(video);

      await video.play();

      tracking = true;
      camBtn.textContent = '停止';

      trackLoop();
    } catch (error) {
      console.error('[occhan VTuber] camera failed', error);

      alert(
        '前面カメラを開始できませんでした。' +
        'Safariのカメラ許可を確認してください。'
      );
    }
  }

  function stopTracking() {
    tracking = false;
    camBtn.textContent = '顔追跡';

    if (stream) {
      stream.getTracks().forEach(track => track.stop());
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
    });
  }

  function trackLoop() {
    if (!tracking || !video || !faceLandmarker) return;

    const now = performance.now();

    if (
      video.readyState >= 2 &&
      video.currentTime !== lastVideoTime
    ) {
      lastVideoTime = video.currentTime;

      try {
        const result =
          faceLandmarker.detectForVideo(video, now);

        const landmarks =
          result.faceLandmarks?.[0];

        if (landmarks) {
          const leftEye = landmarks[33];
          const rightEye = landmarks[263];
          const nose = landmarks[1];

          const midX =
            (leftEye.x + rightEye.x) * 0.5;

          const midY =
            (leftEye.y + rightEye.y) * 0.5;

          const eyeDx =
            rightEye.x - leftEye.x;

          const eyeDy =
            rightEye.y - leftEye.y;

          const eyeDist =
            Math.max(
              0.001,
              Math.hypot(eyeDx, eyeDy)
            );

          const roll =
            Math.atan2(eyeDy, eyeDx) *
            180 /
            Math.PI;

          const yaw =
            clamp(
              (nose.x - midX) /
              eyeDist *
              2.0,
              -1,
              1
            );

          const pitch =
            clamp(
              (
                (nose.y - midY) /
                eyeDist -
                0.72
              ) *
              1.0,
              -1,
              1
            );

          target.roll =
            clamp(roll, -8, 8);

          target.yaw = yaw;
          target.pitch = pitch;

          target.x =
            clamp(
              (0.5 - nose.x) *
              12,
              -5,
              5
            );

          target.y =
            clamp(
              (nose.y - 0.5) *
              8,
              -3.5,
              3.5
            );
        }

        const categories =
          result
            .faceBlendshapes?.[0]
            ?.categories;

        if (categories) {
          const map =
            scoreMap(categories);

          target.jaw =
            score(map, 'jawOpen');
        }
      } catch (error) {
        console.warn(
          '[occhan VTuber] frame error',
          error
        );
      }
    }

    requestAnimationFrame(trackLoop);
  }

  let pointers = new Map();
  let startRect = null;
  let startDist = 0;
  let startWidth = 0;

  function setEdit(value) {
    editMode = value;

    root.style.pointerEvents =
      value ? 'auto' : 'none';

    controls.style.pointerEvents =
      'auto';

    editBtn.textContent =
      value ? '完了' : '移動';

    root.style.outline =
      value
        ? '1px dashed rgba(40,40,40,.45)'
        : 'none';
  }

  root.addEventListener(
    'pointerdown',
    event => {
      if (
        !editMode ||
        event.target.closest('button')
      ) {
        return;
      }

      event.preventDefault();

      root.setPointerCapture(
        event.pointerId
      );

      pointers.set(
        event.pointerId,
        {
          x: event.clientX,
          y: event.clientY,
        }
      );

      startRect =
        root.getBoundingClientRect();

      if (pointers.size === 2) {
        const p =
          [...pointers.values()];

        startDist =
          Math.hypot(
            p[0].x - p[1].x,
            p[0].y - p[1].y
          );

        startWidth =
          startRect.width;
      }
    }
  );

  root.addEventListener(
    'pointermove',
    event => {
      if (
        !editMode ||
        !pointers.has(event.pointerId)
      ) {
        return;
      }

      event.preventDefault();

      const prev =
        pointers.get(event.pointerId);

      pointers.set(
        event.pointerId,
        {
          x: event.clientX,
          y: event.clientY,
        }
      );

      if (
        pointers.size === 1 &&
        startRect
      ) {
        const dx =
          event.clientX - prev.x;

        const dy =
          event.clientY - prev.y;

        const r =
          root.getBoundingClientRect();

        root.style.right = 'auto';
        root.style.bottom = 'auto';

        root.style.left =
          `${clamp(
            r.left + dx,
            0,
            innerWidth - r.width
          )}px`;

        root.style.top =
          `${clamp(
            r.top + dy,
            0,
            innerHeight - r.height
          )}px`;
      } else if (
        pointers.size === 2
      ) {
        const p =
          [...pointers.values()];

        const d =
          Math.hypot(
            p[0].x - p[1].x,
            p[0].y - p[1].y
          );

        const newWidth =
          clamp(
            startWidth *
            d /
            Math.max(
              1,
              startDist
            ),
            100,
            innerWidth * 0.68
          );

        root.style.width =
          `${newWidth}px`;
      }
    }
  );

  const endPointer =
    event => {
      pointers.delete(
        event.pointerId
      );
    };

  root.addEventListener(
    'pointerup',
    endPointer
  );

  root.addEventListener(
    'pointercancel',
    endPointer
  );

  camBtn.addEventListener(
    'click',
    event => {
      event.stopPropagation();
      startTracking();
    }
  );

  editBtn.addEventListener(
    'click',
    event => {
      event.stopPropagation();
      setEdit(!editMode);
    }
  );

  const hotspot =
    document.createElement('button');

  hotspot.title =
    'VTuber controls';

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

  hideUIBtn.addEventListener(
    'click',
    event => {
      event.stopPropagation();

      controls.style.display =
        'none';

      hotspot.style.display =
        'block';
    }
  );

  hotspot.addEventListener(
    'click',
    () => {
      controls.style.display =
        'flex';

      hotspot.style.display =
        'none';
    }
  );

  document.documentElement
    .appendChild(hotspot);

  const api = {
    show() {
      root.style.display = '';
    },

    hide() {
      root.style.display = 'none';
    },

    toggle() {
      root.style.display =
        root.style.display === 'none'
          ? ''
          : 'none';
    },

    startTracking,

    stopTracking,

    destroy() {
      stopTracking();
      cancelAnimationFrame(raf);

      root.remove();
      hotspot.remove();

      delete window.__occhanVTuber;
    },
  };

  window.__occhanVTuber = api;

  return api;
})();
