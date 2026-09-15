import {
  Box3,
  Color,
  DoubleSide,
  FrontSide,
  MathUtils,
  Mesh,
  MeshBasicMaterial,
  PerspectiveCamera,
  Scene,
  SRGBColorSpace,
  Vector3,
  WebGLRenderer,
  type BufferGeometry,
  type Material,
  type MeshStandardMaterial,
  type Texture,
} from "three";
import type { GLTF } from "three/addons/loaders/GLTFLoader.js";
import { createMinecraftSky } from "./minecraft-sky";

async function loadModel(
  url: string,
  onLoad: (gltf: GLTF) => Promise<void>,
  onProgress: (event: {
    loaded: number;
    total: number;
    lengthComputable: boolean;
  }) => void,
  onError: (error: unknown) => void,
) {
  try {
    const [{ GLTFLoader }, response] = await Promise.all([
      import("three/addons/loaders/GLTFLoader.js"),
      fetch(url),
    ]);
    if (!response.ok || !response.body)
      throw new Error(`Model download: HTTP ${response.status}`);
    // Encoded responses are transparently decompressed by fetch, so their
    // Content-Length cannot be compared with the decoded stream byte count.
    const decodedByBrowser = /br|gzip/.test(
      response.headers.get("content-encoding") ?? "",
    );
    const total = decodedByBrowser
      ? 0
      : Number(response.headers.get("content-length")) || 0;
    let loaded = 0;
    const measured = response.body.pipeThrough(
      new TransformStream<Uint8Array<ArrayBuffer>, BufferSource>({
        transform(chunk, controller) {
          loaded += chunk.byteLength;
          onProgress({ loaded, total, lengthComputable: total > 0 });
          controller.enqueue(chunk);
        },
      }),
    );
    const bytes = await new Response(measured).arrayBuffer();
    await onLoad(await new GLTFLoader().parseAsync(bytes, ""));
  } catch (error) {
    onError(error);
  }
}

export function startViewer() {
  const get = <T extends HTMLElement>(id: string) =>
    document.getElementById(id) as T;
  const canvas = get<HTMLCanvasElement>("scene");
  const loading = get<HTMLDivElement>("loading");
  const progress = get<HTMLProgressElement>("load-progress");
  const retry = get<HTMLButtonElement>("retry");
  const fly = get<HTMLButtonElement>("fly");
  const boost = get<HTMLButtonElement>("boost");
  const reset = get<HTMLButtonElement>("reset");
  const quality = get<HTMLSelectElement>("quality");
  const speed = get<HTMLInputElement>("speed");
  const twoSided = get<HTMLInputElement>("two-sided");
  get<HTMLSelectElement>("model-picker").addEventListener("change", (event) => {
    window.location.assign((event.target as HTMLSelectElement).value);
  });
  retry.addEventListener("click", () => window.location.reload());

  function fail(message: string) {
    loading.hidden = false;
    get("loading-title").textContent = message;
    progress.hidden = true;
    retry.hidden = false;
  }

  let renderer: WebGLRenderer;
  try {
    renderer = new WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: "high-performance",
    });
  } catch {
    fail(
      "This viewer needs WebGL 2. Try a browser with hardware acceleration enabled, or return to the post’s photos.",
    );
    return;
  }
  renderer.outputColorSpace = SRGBColorSpace;
  // Exported vertex colors already contain the Minecraft lighting. Basic
  // materials keep it intact without per-fragment lights or shadow passes.
  const scene = new Scene();
  scene.background = new Color("#78a7ff");
  const camera = new PerspectiveCamera(70, 1, 0.05, 10000);
  camera.rotation.order = "YXZ";
  const keys = new Set<string>();
  const direction = new Vector3();
  const home = new Vector3();
  const center = new Vector3();
  const materials = new Map<Material, MeshBasicMaterial>();
  let ready = false;
  let frame = 0;
  let previousTime = 0;
  let baseSpeed = 10;
  let modelRadius = 1;
  let drag: { id: number; x: number; y: number } | undefined;
  let disposed = false;
  let boosted = false;
  let freeLook = false;
  let sky: ReturnType<typeof createMinecraftSky> | undefined;
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
  let lastDraw = 0;

  function toggleBoost() {
    boosted = !boosted;
    boost.setAttribute("aria-pressed", String(boosted));
    boost.textContent = boosted ? "Boost: on (R)" : "Boost: off (R)";
    requestRender();
  }
  boost.addEventListener("click", toggleBoost);

  function setPlaying(playing: boolean) {
    document.body.classList.toggle("flying", playing);
    if (playing)
      document.querySelector<HTMLDetailsElement>(".controls-menu")!.open =
        false;
  }

  function requestRender() {
    if (!frame && !document.hidden && !disposed)
      frame = requestAnimationFrame(render);
  }
  function render(time: number) {
    frame = 0;
    // Clouds idle at 30fps; active flight uses the display refresh rate.
    if (
      !keys.size &&
      document.pointerLockElement !== canvas &&
      !freeLook &&
      time - lastDraw < 32
    ) {
      requestRender();
      return;
    }
    lastDraw = time;
    const delta = Math.min((time - previousTime) / 1000 || 0, 0.05);
    previousTime = time;
    if (ready && keys.size) {
      direction.set(
        Number(keys.has("KeyD")) - Number(keys.has("KeyA")),
        0,
        Number(keys.has("KeyS")) - Number(keys.has("KeyW")),
      );
      direction.applyQuaternion(camera.quaternion);
      direction.y +=
        Number(keys.has("Space")) -
        Number(keys.has("ShiftLeft") || keys.has("ShiftRight"));
      direction.normalize();
      camera.position.addScaledVector(
        direction,
        baseSpeed * Number(speed.value) * (boosted ? 3 : 1) * delta,
      );
    }
    sky?.update(camera, reducedMotion.matches ? 0 : delta);
    renderer.render(scene, camera);
    if (ready && (keys.size || !reducedMotion.matches)) requestRender();
  }
  function resize() {
    const wasAtHome = ready && camera.position.equals(home);
    renderer.setPixelRatio(
      quality.value === "sharp"
        ? window.devicePixelRatio
        : Math.min(window.devicePixelRatio, Number(quality.value)),
    );
    renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);
    camera.aspect = canvas.clientWidth / canvas.clientHeight;
    camera.updateProjectionMatrix();
    if (wasAtHome) resetView();
    requestRender();
  }
  function resetView() {
    keys.clear();
    const halfFov = Math.min(
      MathUtils.degToRad(camera.fov / 2),
      Math.atan(Math.tan(MathUtils.degToRad(camera.fov / 2)) * camera.aspect),
    );
    home
      .set(1, 0.65, 1)
      .normalize()
      .multiplyScalar((modelRadius / Math.sin(halfFov)) * 1.1);
    camera.position.copy(home);
    camera.lookAt(center);
    requestRender();
  }
  function look(x: number, y: number) {
    if (!ready) return;
    camera.rotation.y -= x * 0.003;
    camera.rotation.x = MathUtils.clamp(
      camera.rotation.x - y * 0.003,
      -Math.PI / 2 + 0.01,
      Math.PI / 2 - 0.01,
    );
    requestRender();
  }
  function releaseControls() {
    keys.clear();
    drag = undefined;
  }
  window.addEventListener("resize", resize);
  quality.addEventListener("change", resize);
  reset.addEventListener("click", resetView);
  twoSided.addEventListener("change", () => {
    materials.forEach((material) => {
      material.side =
        twoSided.checked || material.transparent ? DoubleSide : FrontSide;
      material.needsUpdate = true;
    });
    requestRender();
  });
  async function captureMouse() {
    if (document.pointerLockElement === canvas) {
      return;
    }
    canvas.focus({ preventScroll: true });
    try {
      await canvas.requestPointerLock();
    } catch {
      // Embedded browsers may deny pointer lock. Keep mouse-look available
      // within the viewport, with Escape restoring access to the menu.
      freeLook = true;
      setPlaying(true);
    }
  }
  fly.addEventListener("click", () => {
    if (document.pointerLockElement === canvas) document.exitPointerLock();
    else void captureMouse();
  });
  document.addEventListener("pointerlockchange", () => {
    const locked = document.pointerLockElement === canvas;
    freeLook = false;
    setPlaying(locked);
    fly.textContent = locked ? "Release mouse" : "Resume mouse-look";
    releaseControls();
  });
  document.addEventListener("pointerlockerror", () => {
    freeLook = true;
    setPlaying(true);
  });
  canvas.addEventListener("pointerdown", (event) => {
    if (event.button !== 0 || !ready) return;
    canvas.focus();
    canvas.setPointerCapture(event.pointerId);
    drag = { id: event.pointerId, x: event.clientX, y: event.clientY };
  });
  canvas.addEventListener("click", (event) => {
    if (ready && event.pointerType !== "touch") void captureMouse();
  });
  document.addEventListener("pointermove", (event) => {
    if (document.pointerLockElement === canvas || freeLook)
      look(event.movementX, event.movementY);
    else if (drag?.id === event.pointerId) {
      look(event.clientX - drag.x, event.clientY - drag.y);
      drag.x = event.clientX;
      drag.y = event.clientY;
    }
  });
  canvas.addEventListener("pointerup", () => {
    drag = undefined;
  });
  canvas.addEventListener("pointercancel", releaseControls);
  canvas.addEventListener("lostpointercapture", () => {
    drag = undefined;
  });
  canvas.addEventListener(
    "wheel",
    (event) => {
      event.preventDefault();
      if (!ready) return;
      camera.getWorldDirection(direction);
      camera.position.addScaledVector(
        direction,
        -Math.sign(event.deltaY) * baseSpeed * Number(speed.value) * 0.15,
      );
      requestRender();
    },
    { passive: false },
  );
  const movementKeys = [
    "KeyW",
    "KeyA",
    "KeyS",
    "KeyD",
    "Space",
    "KeyR",
    "ShiftLeft",
    "ShiftRight",
  ];
  document.addEventListener("keydown", (event) => {
    if (event.code === "Escape") {
      freeLook = false;
      releaseControls();
      setPlaying(false);
      return;
    }
    if (
      !ready ||
      !movementKeys.includes(event.code) ||
      (event.target instanceof HTMLElement &&
        event.target.closest("input, select, button, a, summary"))
    )
      return;
    event.preventDefault();
    if (event.code === "KeyR") {
      if (!event.repeat) toggleBoost();
      return;
    }
    keys.add(event.code);
    requestRender();
  });
  document.addEventListener("keyup", (event) => {
    keys.delete(event.code);
  });
  window.addEventListener("blur", () => {
    releaseControls();
    freeLook = false;
    if (document.pointerLockElement !== canvas) setPlaying(false);
  });
  document.addEventListener("visibilitychange", () => {
    releaseControls();
    if (document.hidden) {
      cancelAnimationFrame(frame);
      frame = 0;
    } else requestRender();
  });
  document
    .querySelectorAll<HTMLButtonElement>("[data-move]")
    .forEach((button) => {
      button.addEventListener("pointerdown", (event) => {
        if (!ready) return;
        event.preventDefault();
        button.setPointerCapture(event.pointerId);
        keys.add(button.dataset.move!);
        requestRender();
      });
      for (const event of ["pointerup", "pointercancel", "lostpointercapture"])
        button.addEventListener(event, () => {
          keys.delete(button.dataset.move!);
        });
    });
  canvas.addEventListener("webglcontextlost", (event) => {
    event.preventDefault();
    ready = false;
    releaseControls();
    cancelAnimationFrame(frame);
    frame = 0;
    fail(
      "The graphics connection was interrupted. Reload to reopen the structure.",
    );
  });
  resize();

  void loadModel(
    get("structure-viewer").dataset.modelUrl!,
    async (gltf) => {
      try {
        const model = gltf.scene;
        model.traverse((object) => {
          if (!(object instanceof Mesh)) return;
          object.frustumCulled = true;
          object.geometry.computeBoundingSphere();
          const convert = (source: MeshStandardMaterial) => {
            let material = materials.get(source);
            if (!material) {
              material = new MeshBasicMaterial({
                map: source.map,
                color: source.color,
                vertexColors: source.vertexColors,
                transparent: source.transparent,
                opacity: source.opacity,
                alphaTest: source.alphaTest,
                // Keep glass/water two-sided. Back-face culling on solid geometry
                // is optional for thin foliage, signs, and viewing from inside.
                side:
                  source.transparent || twoSided.checked
                    ? DoubleSide
                    : FrontSide,
                depthWrite: !source.transparent,
                forceSinglePass: true,
              });
              materials.set(source, material);
            }
            return material;
          };
          object.material = Array.isArray(object.material)
            ? object.material.map(convert)
            : convert(object.material);
        });
        // Keep the export's spatial chunks separate so frustum culling can skip
        // individual chunks; merging the world would defeat this optimization.
        const bounds = new Box3().setFromObject(model);
        bounds.getCenter(center);
        model.position.sub(center);
        center.set(0, 0, 0);
        const radius = Math.max(bounds.getSize(new Vector3()).length() / 2, 1);
        modelRadius = radius;
        baseSpeed = Math.max(radius * 0.5, 4);
        camera.near = Math.max(radius / 10000, 0.02);
        camera.far = Math.max(radius * 50, 1000);
        camera.updateProjectionMatrix();
        scene.add(model);
        sky = createMinecraftSky(scene, radius);
        model.updateMatrixWorld(true);
        model.traverse((object) => {
          object.matrixAutoUpdate = false;
        });
        resetView();
        get("loading-title").textContent = "Preparing model…";
        await renderer.compileAsync(scene, camera);
        ready = true;
        loading.hidden = true;
        fly.disabled = false;
        reset.disabled = false;
        document.body.classList.add("ready");
        canvas.focus({ preventScroll: true });
        requestRender();
      } catch (error) {
        console.error(error);
        fail("The model could not be prepared. Try reloading the viewer.");
      }
    },
    (event) => {
      if (event.lengthComputable) {
        progress.max = event.total;
        progress.value = event.loaded;
        progress.setAttribute(
          "aria-label",
          `Model download ${Math.round((event.loaded / event.total) * 100)}%`,
        );
      }
    },
    (error) => {
      console.error(error);
      fail("The model download failed. Check your connection and try again.");
    },
  );

  window.addEventListener("pagehide", (event) => {
    releaseControls();
    cancelAnimationFrame(frame);
    frame = 0;
    if (event.persisted) return;
    disposed = true;
    sky?.dispose();
    const geometries = new Set<BufferGeometry>();
    const textures = new Set<Texture>();
    scene.traverse((object) => {
      if (object instanceof Mesh) geometries.add(object.geometry);
    });
    geometries.forEach((geometry) => geometry.dispose());
    materials.forEach((material, original) => {
      if (material.map) textures.add(material.map);
      material.dispose();
      original.dispose();
    });
    textures.forEach((texture) => texture.dispose());
    renderer.dispose();
  });
  window.addEventListener("pageshow", requestRender);
}
