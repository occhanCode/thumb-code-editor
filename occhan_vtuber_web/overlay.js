const OVT = (() => {
  if (window.__occhanVTuber) {
    window.__occhanVTuber.show();
    return window.__occhanVTuber;
  }

  const SCRIPT_URL = new URL(import.meta.url);
  const BASE_URL = new URL(".", SCRIPT_URL);
  const asset = name => new URL(`assets/${name}`, BASE_URL).href;

  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const lerp = (a, b, t) => a + (b - a) * t;

  const root = document.createElement("div");
  root.id = "occhan-vtuber-root";

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

  const stage = document.createElement("div");

  stage.style.cssText = `
    position:absolute;
    inset:0;
    transform-origin:50% 82%;
    will-change:transform;
    pointer-events:none;
  `;

  root.appendChild(stage);

  // =========================================================
  // Face
  // =========================================================

  // 元画像そのもの。
  // 口だけ消してあり、輪郭外と角の間は透明。
  const face = document.createElement("img");

  face.src =
    asset("face_mouthless_pupilless_exact_v5.png");

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

  // =========================================================
  // Eye blink overlay
  // =========================================================
  //
  // 通常時は完全透明。
  // そのため blink=0 では元画像そのもの。
  //
  // 瞬きするときだけ、
  // 元の黒目部分を淡い背景色で隠して
  // 閉じたまぶたを重ねる。
  //
  // メガネ自体は元画像に焼き込まれたままなので、
  // メガネの形は一切変わらない。
  // =========================================================

  const SVG_NS = "http://www.w3.org/2000/svg";

  const makePupil = (src, left, top, width) => {
    const img = document.createElement("img");
  
    img.src = asset(src);
    img.draggable = false;
  
    img.style.cssText = `
      position:absolute;
      left:${left}%;
      top:${top}%;
      width:${width}%;
      height:auto;
      pointer-events:none;
      will-change:transform;
      transform-origin:50% 50%;
    `;
  
    stage.appendChild(img);
  
    return img;
  };
  
  // 元画像からそのまま抜いた黒目。
  // 初期位置では元画像と完全一致する。
  const pupilL = makePupil(
    "pupil_l_exact_v5.png",
    35.0610,
    62.7451,
    10.3659
  );
  
  const pupilL = makePupil(
    "pupil_l_exact_v7.png",
    35.6707,
    63.9706,
    9.4512
  );

  const blinkSvg =
    document.createElementNS(
      SVG_NS,
      "svg"
    );

  blinkSvg.setAttribute(
    "viewBox",
    "0 0 328 408"
  );

  blinkSvg.setAttribute(
    "preserveAspectRatio",
    "none"
  );

  blinkSvg.style.cssText = `
    position:absolute;
    inset:0;
    width:100%;
    height:100%;
    overflow:visible;
    pointer-events:none;
  `;

  stage.appendChild(blinkSvg);

  function svg(tag, attrs = {}) {
    const el =
      document.createElementNS(
        SVG_NS,
        tag
      );

    for (
      const [key, value]
      of Object.entries(attrs)
    ) {
      el.setAttribute(
        key,
        String(value)
      );
    }

    return el;
  }

  function createBlinkEye({
    cx,
    cy,
    rx,
    ry
  }) {
    const group = svg("g");

    // 元の黒目・まぶたを隠す。
    // メガネの内側だけなので
    // フレームには干渉しない。
    const cover = svg(
      "ellipse",
      {
        cx,
        cy,
        rx,
        ry,
        fill: "#f5f3ef",
        opacity: 0
      }
    );

    // 閉じたときの線。
    // 元アイコンに合わせて
    // 少し下向きのゆるいカーブ。
    const line = svg(
      "path",
      {
        d:
          `M ${cx - rx * 0.72} ${cy}
           Q ${cx} ${cy + 7}
           ${cx + rx * 0.72} ${cy}`,

        fill: "none",
        stroke: "#2d2927",
        "stroke-width": 6,
        "stroke-linecap": "round",
        opacity: 0
      }
    );

    group.appendChild(cover);
    group.appendChild(line);

    blinkSvg.appendChild(group);

    return {
      cover,
      line
    };
  }

  // 元画像上の目の位置に合わせた値
  const eyeLeft = createBlinkEye({
    cx: 134,
    cy: 264,
    rx: 29,
    ry: 22
  });
  
  const eyeRight = createBlinkEye({
    cx: 237,
    cy: 264,
    rx: 29,
    ry: 22
  });

  function renderBlink(
    eye,
    value
  ) {
    const b =
      clamp(
        value,
        0,
        1
      );

    // 閉じる終盤で一気に黒目を消す。
    // 常時半透明にすると元画像感が失われるため、
    // 小さいblink値ではほぼ何もしない。
    const coverOpacity =
      clamp(
        (b - 0.15) / 0.65,
        0,
        1
      );

    const lineOpacity =
      clamp(
        (b - 0.18) / 0.55,
        0,
        1
      );

    eye.cover.setAttribute(
      "opacity",
      coverOpacity.toFixed(3)
    );

    eye.line.setAttribute(
      "opacity",
      lineOpacity.toFixed(3)
    );
  }

  // =========================================================
  // Mouth
  // =========================================================

  const mouthInside =
    document.createElement("div");

  mouthInside.style.cssText = `
    position:absolute;
    left:42.3%;
    top:83.2%;
    width:27.2%;
    height:5.0%;
    border-radius:50%;
    background:
      radial-gradient(
        ellipse at 50% 38%,
        #504746 0%,
        #272222 58%,
        #171313 100%
      );
    opacity:0;
    transform-origin:50% 50%;
    will-change:transform,opacity;
    pointer-events:none;
  `;

  stage.appendChild(
    mouthInside
  );

  const makeMouthHalf =
    clipPath => {
      const img =
        document.createElement(
          "img"
        );

      img.src =
        asset(
          "mouth_exact_crop.png"
        );

      img.draggable = false;

      img.style.cssText = `
        position:absolute;
        left:38.109756%;
        top:78.431373%;
        width:35.670732%;
        height:auto;
        transform-origin:50% 50%;
        clip-path:${clipPath};
        -webkit-clip-path:${clipPath};
        will-change:transform;
        pointer-events:none;
      `;

      return img;
    };

  const mouthUpper =
    makeMouthHalf(
      "inset(0 0 50% 0)"
    );

  const mouthLower =
    makeMouthHalf(
      "inset(50% 0 0 0)"
    );

  stage.appendChild(
    mouthUpper
  );

  stage.appendChild(
    mouthLower
  );

  // =========================================================
  // Controls
  // =========================================================

  const controls =
    document.createElement(
      "div"
    );

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
    font:12px/1
      -apple-system,
      BlinkMacSystemFont,
      sans-serif;
    box-shadow:
      0 2px 8px
      rgba(0,0,0,.2);
    backdrop-filter:
      blur(8px);
    -webkit-backdrop-filter:
      blur(8px);
  `;

  const camBtn =
    document.createElement(
      "button"
    );

  camBtn.textContent =
    "顔追跡";

  const editBtn =
    document.createElement(
      "button"
    );

  editBtn.textContent =
    "移動";

  const hideUIBtn =
    document.createElement(
      "button"
    );

  hideUIBtn.textContent =
    "●";

  [
    camBtn,
    editBtn,
    hideUIBtn
  ].forEach(button => {
    button.style.cssText = `
      border:0;
      background:transparent;
      color:white;
      font:inherit;
      padding:4px 5px;
    `;

    controls.appendChild(
      button
    );
  });

  root.appendChild(
    controls
  );

  document.documentElement
    .appendChild(
      root
    );

  // =========================================================
  // Tracking state
  // =========================================================

  let faceLandmarker =
    null;

  let video =
    null;

  let stream =
    null;

  let tracking =
    false;

  let loading =
    false;

  let editMode =
    false;

  let raf =
    0;

  let idleRaf =
    0;

  let lastVideoTime =
    -1;

  const state = {
    x: 0,
    y: 0,
  
    roll: 0,
    yaw: 0,
    pitch: 0,
  
    jaw: 0,
    smile: 0,
    pucker: 0,
  
    blinkL: 0,
    blinkR: 0,
  
    gazeX: 0,
    gazeY: 0,
  };

  const target = {
    ...state
  };

  const scoreMap =
    categories => {
      const result =
        Object.create(null);

      for (
        const category
        of categories || []
      ) {
        result[
          category.categoryName
        ] =
          category.score;
      }

      return result;
    };

  const score =
    (map, name) =>
      map[name] || 0;

  // =========================================================
  // Render
  // =========================================================

  function render() {
    // 顔全体はゆっくり。
    // 口と瞬きはそれより速く追従させる。
    const headK = tracking ? 0.10 : 0.08;
    const mouthK = tracking ? 0.24 : 0.12;
    const blinkK = tracking ? 0.42 : 0.18;
    
    state.x = lerp(state.x, target.x, headK);
    state.y = lerp(state.y, target.y, headK);
    
    state.roll =
      lerp(
        state.roll,
        target.roll,
        headK
      );
    
    state.yaw =
      lerp(
        state.yaw,
        target.yaw,
        headK
      );
    
    state.pitch =
      lerp(
        state.pitch,
        target.pitch,
        headK
      );
    
    state.jaw =
      lerp(
        state.jaw,
        target.jaw,
        mouthK
      );
    
    state.smile =
      lerp(
        state.smile,
        target.smile,
        mouthK
      );
    
    state.pucker =
      lerp(
        state.pucker,
        target.pucker,
        mouthK
      );
    
    state.blinkL =
      lerp(
        state.blinkL,
        target.blinkL,
        blinkK
      );
    
    state.blinkR =
      lerp(
        state.blinkR,
        target.blinkR,
        blinkK
      );

    state.gazeX =
      lerp(
        state.gazeX,
        target.gazeX,
        0.18
      );
    
    state.gazeY =
      lerp(
        state.gazeY,
        target.gazeY,
        0.18
      );

    // -------------------------
    // Whole face
    // -------------------------

    stage.style.transform =
      `translate3d(
        ${state.x}px,
        ${state.y}px,
        0
      )
      rotate(
        ${state.roll}deg
      )
      skewX(
        ${state.yaw * -0.45}deg
      )
      scaleX(
        ${
          1 -
          Math.abs(
            state.yaw
          ) *
          0.0035
        }
      )
      scaleY(
        ${
          1 +
          state.pitch *
          0.0018
        }
      )`;

    // 元画像の黒目そのものをほんの少しだけ移動。
    // 本人感を壊さないよう最大約2.5px。
    const pupilX =
      clamp(
        state.gazeX,
        -2.5,
        2.5
      );
    
    const pupilY =
      clamp(
        state.gazeY,
        -1.8,
        1.8
      );
    
    pupilL.style.transform =
      `translate(${pupilX}px, ${pupilY}px)`;
    
    pupilR.style.transform =
      `translate(${pupilX}px, ${pupilY}px)`;

    // -------------------------
    // Blink
    // -------------------------

    renderBlink(
      eyeLeft,
      state.blinkL
    );

    renderBlink(
      eyeRight,
      state.blinkR
    );

    // -------------------------
    // Mouth
    // -------------------------

    const open =
      clamp(
        (
          state.jaw -
          0.07
        ) /
        0.55,
        0,
        1
      );

    const smile =
      clamp(
        (
          state.smile -
          0.12
        ) /
        0.55,
        0,
        1
      );

    const pucker =
      clamp(
        (
          state.pucker -
          0.10
        ) /
        0.55,
        0,
        1
      );

    const widthScale =
      1 +
      smile *
      0.055 -
      pucker *
      0.075;

    const easedOpen =
      open *
      open *
      (3 - 2 * open);
    
    const upperY =
      -easedOpen * 1.4;
    
    const lowerY =
      easedOpen * 6.4;
    
    const lowerScaleY =
      1 +
      easedOpen * 0.045;

    mouthUpper.style.transform =
      `translateY(
        ${upperY}px
      )
      scaleX(
        ${widthScale}
      )`;

    mouthLower.style.transform =
      `translateY(
        ${lowerY}px
      )
      scaleX(
        ${widthScale}
      )
      scaleY(
        ${lowerScaleY}
      )`;

    const interiorScaleY =
      0.08 +
      easedOpen * 1.22;
    
    const interiorScaleX =
      0.90 +
      easedOpen * 0.14 +
      smile * 0.08 -
      pucker * 0.12;

    mouthInside.style.opacity =
      String(
        clamp(
          open *
          1.35,
          0,
          0.96
        )
      );

    mouthInside.style.transform =
      `translateY(
        ${easedOpen * 2.3}px
      )
      scale(
        ${interiorScaleX},
        ${interiorScaleY}
      )`;

    raf =
      requestAnimationFrame(
        render
      );
  }

  render();

  // =========================================================
  // MediaPipe
  // =========================================================

  async function ensureTracker() {
    if (
      faceLandmarker ||
      loading
    ) {
      return;
    }

    loading =
      true;

    camBtn.textContent =
      "読込中…";

    try {
      const vision =
        await import(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/+esm"
        );

      const {
        FaceLandmarker,
        FilesetResolver
      } =
        vision;

      const fileset =
        await FilesetResolver
          .forVisionTasks(
            "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/wasm"
          );

      faceLandmarker =
        await FaceLandmarker
          .createFromOptions(
            fileset,
            {
              baseOptions: {
                modelAssetPath:
                  "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",

                delegate:
                  "GPU",
              },

              runningMode:
                "VIDEO",

              numFaces:
                1,

              outputFaceBlendshapes:
                true,

              outputFacialTransformationMatrixes:
                false,
            }
          );

      camBtn.textContent =
        "顔追跡";

    } catch (error) {

      console.error(
        "[occhan VTuber] tracker load failed",
        error
      );

      camBtn.textContent =
        "追跡NG";

      alert(
        "顔追跡ライブラリを読み込めませんでした。"
      );

    } finally {
      loading =
        false;
    }
  }

  async function startTracking() {
    if (tracking) {
      stopTracking();
      return;
    }

    await ensureTracker();

    if (
      !faceLandmarker
    ) {
      return;
    }

    try {
      stream =
        await navigator
          .mediaDevices
          .getUserMedia({
            video: {
              facingMode:
                "user",

              width: {
                ideal:
                  480
              },

              height: {
                ideal:
                  640
              },
            },

            audio:
              false,
          });

      video =
        document
          .createElement(
            "video"
          );

      video.playsInline =
        true;

      video.muted =
        true;

      video.srcObject =
        stream;

      video.style.display =
        "none";

      document.documentElement
        .appendChild(
          video
        );

      await video.play();

      tracking =
        true;

      camBtn.textContent =
        "停止";

      trackLoop();

    } catch (error) {

      console.error(
        "[occhan VTuber] camera failed",
        error
      );

      alert(
        "前面カメラを開始できませんでした。"
      );
    }
  }

  function stopTracking() {
    tracking =
      false;

    camBtn.textContent =
      "顔追跡";

    if (stream) {
      stream
        .getTracks()
        .forEach(
          track =>
            track.stop()
        );
    }

    if (video) {
      video.remove();
    }

    stream =
      null;

    video =
      null;

    Object.assign(
      target,
      {
        x: 0,
        y: 0,

        roll: 0,
        yaw: 0,
        pitch: 0,

        jaw: 0,
        smile: 0,
        pucker: 0,

        blinkL: 0,
        blinkR: 0,

        gazeX: 0,
        gazeY: 0,
      }
    );
  }

  function trackLoop() {
    if (
      !tracking ||
      !video ||
      !faceLandmarker
    ) {
      return;
    }

    const now =
      performance.now();

    if (
      video.readyState >= 2 &&
      video.currentTime !==
        lastVideoTime
    ) {
      lastVideoTime =
        video.currentTime;

      try {
        const result =
          faceLandmarker
            .detectForVideo(
              video,
              now
            );

        const landmarks =
          result
            .faceLandmarks?.[0];

        if (landmarks) {
          const leftEye =
            landmarks[33];

          const rightEye =
            landmarks[263];

          const nose =
            landmarks[1];

          const midX =
            (
              leftEye.x +
              rightEye.x
            ) *
            0.5;

          const midY =
            (
              leftEye.y +
              rightEye.y
            ) *
            0.5;

          const eyeDx =
            rightEye.x -
            leftEye.x;

          const eyeDy =
            rightEye.y -
            leftEye.y;

          const eyeDist =
            Math.max(
              0.001,
              Math.hypot(
                eyeDx,
                eyeDy
              )
            );

          const roll =
            Math.atan2(
              eyeDy,
              eyeDx
            ) *
            180 /
            Math.PI;

          const yaw =
            clamp(
              (
                nose.x -
                midX
              ) /
              eyeDist *
              1.9,
              -1,
              1
            );

          const pitch =
            clamp(
              (
                (
                  nose.y -
                  midY
                ) /
                eyeDist -
                0.72
              ) *
              0.9,
              -1,
              1
            );

          target.roll =
            clamp(
              roll,
              -7,
              7
            );

          target.yaw =
            yaw;

          target.pitch =
            pitch;

          target.x =
            clamp(
              (
                0.5 -
                nose.x
              ) *
              10,
              -4.5,
              4.5
            );

          target.y =
            clamp(
              (
                nose.y -
                0.5
              ) *
              7,
              -3,
              3
            );
        }

        const categories =
          result
            .faceBlendshapes?.[0]
            ?.categories;

        if (categories) {
          const map =
            scoreMap(
              categories
            );

          const lookX =
            (
              (
                score(map, "eyeLookInRight") -
                score(map, "eyeLookOutRight")
              ) +
              (
                score(map, "eyeLookOutLeft") -
                score(map, "eyeLookInLeft")
              )
            ) * 0.5;
          
          const lookY =
            (
              (
                score(map, "eyeLookDownRight") -
                score(map, "eyeLookUpRight")
              ) +
              (
                score(map, "eyeLookDownLeft") -
                score(map, "eyeLookUpLeft")
              )
            ) * 0.5;
          
          // あえてかなり弱くする。
          // 大きく動かすと元アイコン感が失われる。
          target.gazeX =
            clamp(
              lookX * 7,
              -2.5,
              2.5
            );
          
          target.gazeY =
            clamp(
              lookY * 5,
              -1.8,
              1.8
            );

          target.jaw =
            score(
              map,
              "jawOpen"
            );

          target.smile =
            (
              score(
                map,
                "mouthSmileLeft"
              ) +
              score(
                map,
                "mouthSmileRight"
              )
            ) *
            0.5;

          target.pucker =
            Math.max(
              score(
                map,
                "mouthPucker"
              ),

              score(
                map,
                "mouthFunnel"
              )
            );

          // 笑顔では目を変えない。
          // 純粋な瞬きだけ反映。
          target.blinkL =
            score(
              map,
              "eyeBlinkLeft"
            );

          target.blinkR =
            score(
              map,
              "eyeBlinkRight"
            );
        }

      } catch (error) {

        console.warn(
          "[occhan VTuber] frame error",
          error
        );
      }
    }

    requestAnimationFrame(
      trackLoop
    );
  }

  // =========================================================
  // Move / Resize
  // =========================================================

  let pointers =
    new Map();

  let startRect =
    null;

  let startDist =
    0;

  let startWidth =
    0;

  function setEdit(value) {
    editMode =
      value;

    root.style.pointerEvents =
      value
        ? "auto"
        : "none";

    controls.style.pointerEvents =
      "auto";

    editBtn.textContent =
      value
        ? "完了"
        : "移動";

    root.style.outline =
      value
        ? "1px dashed rgba(40,40,40,.45)"
        : "none";
  }

  root.addEventListener(
    "pointerdown",
    event => {
      if (
        !editMode ||
        event.target.closest(
          "button"
        )
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
          x:
            event.clientX,

          y:
            event.clientY,
        }
      );

      startRect =
        root
          .getBoundingClientRect();

      if (
        pointers.size === 2
      ) {
        const p =
          [
            ...pointers.values()
          ];

        startDist =
          Math.hypot(
            p[0].x -
              p[1].x,

            p[0].y -
              p[1].y
          );

        startWidth =
          startRect.width;
      }
    }
  );

  root.addEventListener(
    "pointermove",
    event => {
      if (
        !editMode ||
        !pointers.has(
          event.pointerId
        )
      ) {
        return;
      }

      event.preventDefault();

      const prev =
        pointers.get(
          event.pointerId
        );

      pointers.set(
        event.pointerId,
        {
          x:
            event.clientX,

          y:
            event.clientY,
        }
      );

      if (
        pointers.size === 1 &&
        startRect
      ) {
        const dx =
          event.clientX -
          prev.x;

        const dy =
          event.clientY -
          prev.y;

        const r =
          root
            .getBoundingClientRect();

        root.style.right =
          "auto";

        root.style.bottom =
          "auto";

        root.style.left =
          `${clamp(
            r.left + dx,
            0,
            innerWidth -
              r.width
          )}px`;

        root.style.top =
          `${clamp(
            r.top + dy,
            0,
            innerHeight -
              r.height
          )}px`;

      } else if (
        pointers.size === 2
      ) {
        const p =
          [
            ...pointers.values()
          ];

        const d =
          Math.hypot(
            p[0].x -
              p[1].x,

            p[0].y -
              p[1].y
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
            innerWidth *
              0.68
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
    "pointerup",
    endPointer
  );

  root.addEventListener(
    "pointercancel",
    endPointer
  );

  camBtn.addEventListener(
    "click",
    event => {
      event.stopPropagation();

      startTracking();
    }
  );

  editBtn.addEventListener(
    "click",
    event => {
      event.stopPropagation();

      setEdit(
        !editMode
      );
    }
  );

  const hotspot =
    document.createElement(
      "button"
    );

  hotspot.title =
    "VTuber controls";

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
    "click",
    event => {
      event.stopPropagation();

      controls.style.display =
        "none";

      hotspot.style.display =
        "block";
    }
  );

  hotspot.addEventListener(
    "click",
    () => {
      controls.style.display =
        "flex";

      hotspot.style.display =
        "none";
    }
  );

  document.documentElement
    .appendChild(
      hotspot
    );

  const api = {
    show() {
      root.style.display =
        "";
    },

    hide() {
      root.style.display =
        "none";
    },

    toggle() {
      root.style.display =
        root.style.display ===
        "none"
          ? ""
          : "none";
    },

    startTracking,

    stopTracking,

    destroy() {
      stopTracking();

      cancelAnimationFrame(
        raf
      );

      cancelAnimationFrame(
        idleRaf
      );

      root.remove();

      hotspot.remove();

      delete window
        .__occhanVTuber;
    },
  };

  window.__occhanVTuber =
    api;

  // =========================================================
  // Idle
  // =========================================================

  let t0 =
    performance.now();

  const idle =
    now => {
      if (!tracking) {
        const t =
          (
            now -
            t0
          ) /
          1000;

        target.y =
          Math.sin(
            t *
            1.55
          ) *
          0.55;

        target.roll =
          Math.sin(
            t *
            0.72
          ) *
          0.28;
      }

      idleRaf =
        requestAnimationFrame(
          idle
        );
    };

  idleRaf =
    requestAnimationFrame(
      idle
    );

  return api;
})();
