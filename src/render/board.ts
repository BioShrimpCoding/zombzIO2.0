import * as THREE from 'three';
import { tileKey } from '../core/grid';
import type { GridSpec, Vec2 } from '../core/types';
import { TILE, tileToWorld } from './scene';

export interface Board {
  group: THREE.Group;
  tileMeshes: THREE.Mesh[];
  /** show translucent overlays on the given tiles */
  setHighlights(tiles: Vec2[], color: number): void;
  clearHighlights(): void;
  tileAt(object: THREE.Object3D): Vec2 | null;
}

export function createBoard(grid: GridSpec): Board {
  const group = new THREE.Group();
  const tileMeshes: THREE.Mesh[] = [];

  const tileGeo = new THREE.BoxGeometry(TILE * 0.96, 0.1, TILE * 0.96);
  const matA = new THREE.MeshStandardMaterial({ color: 0x3d3d4f, roughness: 0.9 });
  const matB = new THREE.MeshStandardMaterial({ color: 0x34344a, roughness: 0.9 });
  const blockMat = new THREE.MeshStandardMaterial({ color: 0x6b5a45, roughness: 0.8 });
  const blockGeo = new THREE.BoxGeometry(TILE * 0.8, 0.9, TILE * 0.8);

  for (let x = 0; x < grid.width; x++) {
    for (let y = 0; y < grid.height; y++) {
      const p = { x, y };
      const mesh = new THREE.Mesh(tileGeo, (x + y) % 2 === 0 ? matA : matB);
      mesh.position.copy(tileToWorld(grid, p, -0.05));
      mesh.receiveShadow = true;
      mesh.userData.tile = p;
      group.add(mesh);
      tileMeshes.push(mesh);

      if (grid.blocked.has(tileKey(p))) {
        const block = new THREE.Mesh(blockGeo, blockMat);
        block.position.copy(tileToWorld(grid, p, 0.45));
        block.castShadow = true;
        block.receiveShadow = true;
        group.add(block);
      }
    }
  }

  // highlight overlays (reused pool)
  const highlightGeo = new THREE.PlaneGeometry(TILE * 0.9, TILE * 0.9);
  highlightGeo.rotateX(-Math.PI / 2);
  const highlights: THREE.Mesh[] = [];

  function clearHighlights() {
    for (const h of highlights) group.remove(h);
    highlights.length = 0;
  }

  function setHighlights(tiles: Vec2[], color: number) {
    for (const t of tiles) {
      const mat = new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.35,
        depthWrite: false,
      });
      const h = new THREE.Mesh(highlightGeo, mat);
      h.position.copy(tileToWorld(grid, t, 0.02));
      h.userData.tile = t;
      group.add(h);
      highlights.push(h);
    }
  }

  function tileAt(object: THREE.Object3D): Vec2 | null {
    return (object.userData.tile as Vec2 | undefined) ?? null;
  }

  return { group, tileMeshes, setHighlights, clearHighlights, tileAt };
}
