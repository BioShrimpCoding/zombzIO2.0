import * as THREE from 'three';
import { CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import type { GridSpec, Unit, Vec2 } from '../core/types';
import { tileToWorld } from './scene';

export interface UnitView {
  id: string;
  root: THREE.Group;
  mesh: THREE.Mesh;
  ring: THREE.Mesh;
  hpFill: HTMLElement;
  label: CSS2DObject;
}

const PARTY_COLOR = 0x4f9dff;
const ENEMY_COLOR = 0xd9534f;

export function createUnitView(grid: GridSpec, unit: Unit): UnitView {
  const root = new THREE.Group();
  const color = unit.faction === 'party' ? PARTY_COLOR : ENEMY_COLOR;

  let mesh: THREE.Mesh;
  if (unit.faction === 'party') {
    // hero: capsule
    mesh = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.28, 0.5, 4, 12),
      new THREE.MeshStandardMaterial({ color, roughness: 0.5 }),
    );
    mesh.position.y = 0.55;
  } else {
    // goblin: squat box with a "head"
    mesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.5, 0.55, 0.5),
      new THREE.MeshStandardMaterial({ color, roughness: 0.6 }),
    );
    mesh.position.y = 0.3;
    const head = new THREE.Mesh(
      new THREE.SphereGeometry(0.18, 12, 10),
      new THREE.MeshStandardMaterial({ color: 0x8fbf4d, roughness: 0.6 }),
    );
    head.position.y = 0.42;
    head.castShadow = true;
    mesh.add(head);
  }
  mesh.castShadow = true;
  root.add(mesh);

  // active-turn ring (hidden by default)
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.34, 0.44, 32),
    new THREE.MeshBasicMaterial({ color: 0xffe066, side: THREE.DoubleSide }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.03;
  ring.visible = false;
  root.add(ring);

  // DOM HP bar above head
  const bar = document.createElement('div');
  bar.className = 'hp-bar';
  const fill = document.createElement('div');
  fill.className = `hp-fill ${unit.faction}`;
  bar.appendChild(fill);
  const name = document.createElement('div');
  name.className = 'unit-name';
  name.textContent = unit.name;
  const wrap = document.createElement('div');
  wrap.className = 'unit-label';
  wrap.appendChild(name);
  wrap.appendChild(bar);

  const label = new CSS2DObject(wrap);
  label.position.set(0, 1.25, 0);
  root.add(label);

  root.position.copy(tileToWorld(grid, unit.pos));
  return { id: unit.id, root, mesh, ring, hpFill: fill, label };
}

export function updateHpBar(view: UnitView, hp: number, maxHp: number): void {
  view.hpFill.style.width = `${Math.max(0, (hp / maxHp) * 100)}%`;
}

export function spawnFloatingText(
  grid: GridSpec,
  scene: THREE.Scene,
  pos: Vec2,
  text: string,
  cls: string,
): void {
  const el = document.createElement('div');
  el.className = `float-text ${cls}`;
  el.textContent = text;
  const obj = new CSS2DObject(el);
  obj.position.copy(tileToWorld(grid, pos, 1.4));
  scene.add(obj);
  // animate up and fade via CSS, then remove
  requestAnimationFrame(() => el.classList.add('float-up'));
  setTimeout(() => scene.remove(obj), 1200);
}
