import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import * as THREE from 'three';

// 🔹 Import advanced line utilities
import { Line2 } from 'three/examples/jsm/lines/Line2.js';
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';
import { LineGeometry } from 'three/examples/jsm/lines/LineGeometry.js';

export class FloorManager {
  constructor(scene) {
    this.scene = scene;
    this.floors = {};
    this.allRotNodes = [];
    this.currentFloorView = 'all';
    this.loader = new GLTFLoader();
    this.loadingCallbacks = [];

    this.defaultFloorHeight = 3.3; // Height between floors
  }

  async initializeFloors(floorConfigs) {
    this.clearFloors();

    if (!Array.isArray(floorConfigs) || floorConfigs.length === 0) {
      throw new Error('Floor configurations must be a non-empty array');
    }

    floorConfigs.forEach((config, index) => {
      if (!config.name || !config.modelPath) {
        throw new Error(`Floor config at index ${index} must have 'name' and 'modelPath' properties`);
      }

      const defaultPosition = {
        x: 0,
        y: config.position?.y !== undefined ? config.position.y : index * this.defaultFloorHeight,
        z: 0
      };

      this.floors[config.name] = {
        model: null,
        wireframe: null,
        hotspotNodes: [],
        modelPath: config.modelPath,
        position: config.position || defaultPosition,
        loaded: false,
        config: config
      };
    });

    this.currentFloorView = Object.keys(this.floors).length === 1 ? Object.keys(this.floors)[0] : 'all';
    await this.loadAllFloors();
  }

  async loadAllFloors() {
    const loadPromises = Object.keys(this.floors).map(floorKey => this.loadFloor(floorKey));

    try {
      await Promise.all(loadPromises);
      console.log('All floors loaded successfully');
      setTimeout(() => this.onAllFloorsLoaded(), 100);
    } catch (error) {
      console.error('Error loading floors:', error);
      throw error;
    }
  }

  loadFloor(floorKey) {
    return new Promise((resolve, reject) => {
      const floor = this.floors[floorKey];
      if (!floor) {
        reject(new Error(`Floor '${floorKey}' not found`));
        return;
      }

      console.log(`Loading floor: ${floorKey} from ${floor.modelPath}`);

      this.loader.load(
        floor.modelPath,
        (gltf) => {
          floor.model = gltf.scene;
          floor.model.position.set(floor.position.x, floor.position.y, floor.position.z);
          floor.model.userData.floorKey = floorKey;

          this.processFloorModel(floorKey);
          floor.loaded = true;
          console.log(`Floor ${floorKey} loaded successfully`);
          resolve(gltf);
        },
        (progress) => {
          const percent = Math.round((progress.loaded / progress.total) * 100);
          console.log(`Loading ${floorKey}: ${percent}%`);
        },
        (error) => {
          console.error(`Error loading floor ${floorKey}:`, error);
          reject(error);
        }
      );
    });
  }

  processFloorModel(floorKey) {
    const floor = this.floors[floorKey];
    const rotNodes = [];

    floor.model.traverse(child => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
        if (child.material) child.material.side = THREE.BackSide;
      }
      if (child.name) {
        const lower = child.name.toLowerCase();
        if (lower !== "scene" && !lower.includes("empty") && !lower.includes("plane")) {
          child.userData.floor = floorKey;
          rotNodes.push(child);
        }
      }
    });

    floor.hotspotNodes = rotNodes;
    this.allRotNodes = this.allRotNodes.concat(rotNodes);
    this.scene.add(floor.model);

    this.createWireframeForFloor(floorKey);
  }

  /**
   * Create cross-section wireframe for floor plan view
   */
  createWireframeForFloor(floorKey, cutHeight = 1.6) {
    const floor = this.floors[floorKey];
    if (!floor.model) return;

    if (floor.wireframe) {
      this.scene.remove(floor.wireframe);
    }
    floor.wireframe = new THREE.Group();

    const box = new THREE.Box3().setFromObject(floor.model);
    const floorLevel = box.min.y;
    const sliceHeight = floorLevel + cutHeight;
    const plane = new THREE.Plane(new THREE.Vector3(0, -1, 0), sliceHeight);

    floor.model.traverse(child => {
      if (child.isMesh && child.geometry) {
        const geometry = child.geometry;
        const posAttr = geometry.attributes.position;
        const matrixWorld = child.matrixWorld;
        const segments = [];

        if (geometry.index) {
          const indices = geometry.index.array;
          for (let i = 0; i < indices.length; i += 3) {
            const a = new THREE.Vector3().fromBufferAttribute(posAttr, indices[i]).applyMatrix4(matrixWorld);
            const b = new THREE.Vector3().fromBufferAttribute(posAttr, indices[i + 1]).applyMatrix4(matrixWorld);
            const c = new THREE.Vector3().fromBufferAttribute(posAttr, indices[i + 2]).applyMatrix4(matrixWorld);

            this.addEdgeIntersection(a, b, plane, segments);
            this.addEdgeIntersection(b, c, plane, segments);
            this.addEdgeIntersection(c, a, plane, segments);
          }
        }

        // Build lines for each intersection segment
        segments.forEach(([p1, p2]) => {
          const lineGeom = new LineGeometry();
          lineGeom.setPositions([p1.x, p1.y, p1.z, p2.x, p2.y, p2.z]);

          const lineMat = new LineMaterial({
            color: 0x4287F5, //FLOOR PLAN COLOR////////////////////////////////////////////////////////////////////////////
            linewidth: 4, // adjust thickness
          });
          lineMat.resolution.set(window.innerWidth, window.innerHeight);

          const line = new Line2(lineGeom, lineMat);
          line.computeLineDistances();
          floor.wireframe.add(line);
        });
      }
    });

    floor.wireframe.position.copy(floor.model.position);
    this.scene.add(floor.wireframe);
    floor.wireframe.visible = false;
  }

  /**
   * Add intersection point of edge with slicing plane (stores pairs)
   */
  addEdgeIntersection(v1, v2, plane, segments) {
    const d1 = plane.distanceToPoint(v1);
    const d2 = plane.distanceToPoint(v2);

    if ((d1 >= 0 && d2 <= 0) || (d1 <= 0 && d2 >= 0)) {
      const t = d1 / (d1 - d2);
      const intersect = new THREE.Vector3().lerpVectors(v1, v2, t);

      // store as a segment
      segments.push([v1.clone(), intersect.clone()]);
      segments.push([intersect.clone(), v2.clone()]);
    }
  }

  onAllFloorsLoaded() {
    this.loadingCallbacks.forEach(callback => {
      try {
        callback(this.allRotNodes, this.floors);
      } catch (error) {
        console.error('Error in loading callback:', error);
      }
    });
  }

  onLoaded(callback) {
    if (typeof callback !== 'function') throw new Error('Callback must be a function');
    this.loadingCallbacks.push(callback);
  }

  updateFloorVisibility(floorPlanView = false) {
    Object.keys(this.floors).forEach(floorKey => {
      const floor = this.floors[floorKey];
      if (floor.model && floor.wireframe) {
        switch (this.currentFloorView) {
          case 'all':
            floor.model.visible = true;
            floor.wireframe.visible = floorPlanView;
            break;
          case floorKey:
            floor.model.visible = true;
            floor.wireframe.visible = floorPlanView;
            break;
          default:
            floor.model.visible = false;
            floor.wireframe.visible = false;
            break;
        }
      }
    });
  }

  setFloorView(view) {
    if (view === 'all' || this.floors[view]) {
      this.currentFloorView = view;
      return true;
    }
    return false;
  }

  getFloorCameraConfig() {
    const floorKeys = Object.keys(this.floors);
    const configs = {};

    if (this.currentFloorView === 'all') {
      const positions = floorKeys.map(key => this.floors[key].position.y);
      const minY = Math.min(...positions);
      const maxY = Math.max(...positions);
      const centerY = (minY + maxY) / 2;

      configs.camera = { x: 10, y: centerY + 5, z: 10 };
      configs.target = { x: 0, y: centerY, z: 0 };
      configs.orthoY = centerY + 15;
    } else if (this.floors[this.currentFloorView]) {
      const floorY = this.floors[this.currentFloorView].position.y;
      configs.camera = { x: 8, y: floorY + 5, z: 8 };
      configs.target = { x: 0, y: floorY + 1, z: 0 };
      configs.orthoY = floorY + 8;
    }

    return configs;
  }

  getFloorKeys() {
    return Object.keys(this.floors);
  }
  getCurrentFloorView() {
    return this.currentFloorView;
  }
  getAllRotNodes() {
    return this.allRotNodes;
  }
  getFloors() {
    return this.floors;
  }

  clearFloors() {
    Object.values(this.floors).forEach(floor => {
      if (floor.model) this.scene.remove(floor.model);
      if (floor.wireframe) this.scene.remove(floor.wireframe);
    });
    this.floors = {};
    this.allRotNodes = [];
  }

  dispose() {
    this.clearFloors();
    this.loadingCallbacks = [];
  }
}

// 🔹 Example configs (now dynamic based on PANO_BASE_PATH)
const BASE_PATH = window.PANO_BASE_PATH || "panos/";

export const FloorConfigurations = {
  SINGLE_FLOOR: [
    { name: 'floor 1', modelPath: `${BASE_PATH}floor1.glb`, position: { x: 0, y: 0, z: 0 } }
  ],
  TWO_FLOORS: [
    { name: 'floor 1', modelPath: `${BASE_PATH}floor1.glb`, position: { x: 0, y: 0, z: 0 } },
    { name: 'floor 2', modelPath: `${BASE_PATH}floor2.glb`, position: { x: 0, y: 3.3, z: 0 } }
  ],
  THREE_FLOORS: [
    { name: 'floor 1', modelPath: `${BASE_PATH}floor1.glb`, position: { x: 0, y: 0, z: 0 } },
    { name: 'floor 2', modelPath: `${BASE_PATH}floor2.glb`, position: { x: 0, y: 3.3, z: 0 } },
    { name: 'floor 3', modelPath: `${BASE_PATH}floor3.glb`, position: { x: 0, y: 5.5, z: 0 } }
  ]
};

