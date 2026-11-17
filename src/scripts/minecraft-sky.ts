import {
  BackSide,
  BoxGeometry,
  BufferAttribute,
  InstancedMesh,
  Mesh,
  MeshBasicMaterial,
  Object3D,
  ShaderMaterial,
  SphereGeometry,
  type Camera,
  type Scene,
} from "three";

/** Procedural sky and low-cost, block-shaped clouds. No texture downloads. */
export function createMinecraftSky(scene: Scene, radius: number) {
  const sky = new Mesh(
    new SphereGeometry(1, 20, 12),
    new ShaderMaterial({
      side: BackSide,
      depthWrite: false,
      vertexShader: `varying vec3 direction;
        void main() { direction = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: `varying vec3 direction;
        void main() {
          float height = normalize(direction).y;
          vec3 horizon = vec3(0.73, 0.84, 1.0);
          vec3 zenith = vec3(0.47, 0.65, 1.0);
          vec3 below = vec3(0.86, 0.92, 1.0);
          vec3 color = height > 0.0 ? mix(horizon, zenith, smoothstep(0.0, 0.65, height)) : mix(horizon, below, smoothstep(0.0, 0.8, -height));
          gl_FragColor = vec4(color, 1.0);
        }`,
    }),
  );
  sky.frustumCulled = false;
  sky.renderOrder = -10;
  sky.scale.setScalar(radius * 40);
  scene.add(sky);

  const geometry = new BoxGeometry(1, 1, 1);
  const normals = geometry.getAttribute("normal");
  const colors = new Float32Array(normals.count * 3);
  for (let i = 0; i < normals.count; i++) {
    const shade = normals.getY(i) > 0 ? 1 : normals.getY(i) < 0 ? 0.77 : 0.91;
    colors.set([shade, shade, shade], i * 3);
  }
  geometry.setAttribute("color", new BufferAttribute(colors, 3));
  const material = new MeshBasicMaterial({ vertexColors: true });
  const clouds = new InstancedMesh(geometry, material, 192);
  const transform = new Object3D();
  // Deterministic clusters: four rectangles form each stepped silhouette.
  for (let cluster = 0; cluster < 48; cluster++) {
    const angle = cluster * 2.399963;
    const distance = radius * (5 + (cluster % 9) * 1.8);
    const y = radius * (cluster % 3 === 0 ? -3.5 : 4 + (cluster % 4) * 0.7);
    for (let part = 0; part < 4; part++) {
      transform.position.set(
        Math.cos(angle) * distance + part * radius * 0.6,
        y,
        Math.sin(angle) * distance + (part % 2) * radius * 0.5,
      );
      transform.scale.set(
        radius * (1.4 + (cluster % 3) * 0.4),
        radius * 0.16,
        radius * (0.7 + (part % 3) * 0.35),
      );
      transform.updateMatrix();
      clouds.setMatrixAt(cluster * 4 + part, transform.matrix);
    }
  }
  clouds.computeBoundingSphere();
  scene.add(clouds);
  let elapsed = 0;
  return {
    update(camera: Camera, delta: number) {
      sky.position.copy(camera.position);
      elapsed += delta;
      clouds.position.x = Math.sin(elapsed / 180) * radius * 2;
      clouds.position.z = Math.sin(elapsed / 240) * radius;
    },
    dispose() {
      sky.geometry.dispose();
      sky.material.dispose();
      clouds.dispose();
      geometry.dispose();
      material.dispose();
    },
  };
}
