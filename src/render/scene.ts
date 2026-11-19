import * as THREE from 'three';
import { CSS2DRenderer } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import type { GridSpec, Vec2 } from '../core/types';

export const TILE = 1;

/** grid tile -> world position (center of tile, on the floor plane) */
export function tileToWorld(grid: GridSpec, p: Vec2, y = 0): THREE.Vector3 {
  return new THREE.Vector3(
    (p.x - grid.width / 2 + 0.5) * TILE,
    y,
    (p.y - grid.height / 2 + 0.5) * TILE,
  );
}

export interface SceneContext {
  scene: THREE.Scene;
  camera: THREE.OrthographicCamera;
  renderer: THREE.WebGLRenderer;
  labelRenderer: CSS2DRenderer;
  raycaster: THREE.Raycaster;
}

export function createScene(container: HTMLElement): SceneContext {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x12121a);

  // Isometric-style orthographic camera: 45° azimuth, ~35° elevation.
  const frustum = 9;
  const aspect = window.innerWidth / window.innerHeight;
  const camera = new THREE.OrthographicCamera(
    -frustum * aspect,
    frustum * aspect,
    frustum,
    -frustum,
    0.1,
    100,
  );
  camera.position.set(12, 14, 12);
  camera.lookAt(0, 0, 0);

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  container.appendChild(renderer.domElement);

  // DOM-based labels (HP bars, floating damage numbers)
  const labelRenderer = new CSS2DRenderer();
  labelRenderer.setSize(window.innerWidth, window.innerHeight);
  labelRenderer.domElement.style.position = 'absolute';
  labelRenderer.domElement.style.top = '0';
  labelRenderer.domElement.style.pointerEvents = 'none';
  container.appendChild(labelRenderer.domElement);

  // lighting: warm key light + cool ambient, torch-lit dungeon vibe
  const ambient = new THREE.AmbientLight(0x8888aa, 0.7);
  scene.add(ambient);

  const sun = new THREE.DirectionalLight(0xffdbb0, 2.2);
  sun.position.set(8, 16, 4);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -12;
  sun.shadow.camera.right = 12;
  sun.shadow.camera.top = 12;
  sun.shadow.camera.bottom = -12;
  scene.add(sun);

  const rim = new THREE.DirectionalLight(0x6688ff, 0.5);
  rim.position.set(-6, 8, -8);
  scene.add(rim);

  window.addEventListener('resize', () => {
    const a = window.innerWidth / window.innerHeight;
    camera.left = -frustum * a;
    camera.right = frustum * a;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    labelRenderer.setSize(window.innerWidth, window.innerHeight);
  });

  return { scene, camera, renderer, labelRenderer, raycaster: new THREE.Raycaster() };
}
