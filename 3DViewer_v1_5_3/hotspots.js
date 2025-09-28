import * as THREE from 'three';

// Hotspot config placeholders
let roomConnections = [];
let hotspotData = [];
let modelToPanoramaMapping = [];
let availablePanoramas = [];

/**
 * Dynamically load hotspot-config.js from the correct task's pano folder
 */
export async function loadHotspotConfig(panoramaManager = null) {
  try {
    const basePath = window.PANO_BASE_PATH || './panos/';
    const module = await import(`${basePath}hotspot-config.js`);

    roomConnections = module.roomConnections || [];
    hotspotData = module.hotspotData || [];
    modelToPanoramaMapping = module.modelToPanoramaMapping || [];
    availablePanoramas = module.availablePanoramas || [];

    // Share hotspot data with PanoramaManager if provided
    if (panoramaManager && typeof panoramaManager.setHotspotData === 'function') {
      panoramaManager.setHotspotData(hotspotData);
    }

    console.log(`✅ Hotspot config loaded from: ${basePath}hotspot-config.js`);
  } catch (err) {
    console.error('❌ Failed to load hotspot-config.js:', err);
  }
}

// Export getters for configs
export function getHotspotConfig() {
  return { roomConnections, hotspotData, modelToPanoramaMapping, availablePanoramas };
}

export class HotspotManager {
  constructor(scene, panoramaManager = null) {
    this.scene = scene;
    this.rotHotspots = [];
    this.labels = [];
    this.hotspots = [];
    this.panoramaManager = panoramaManager;
    this.alphaMap = null; // Preloaded alpha map texture

    // Load hotspot configuration
    this.loadConfig();
  }

  async loadConfig() {
    await loadHotspotConfig(this.panoramaManager);
  }

  setAlphaMap(texture) {
    this.alphaMap = texture;
  }

  // Create blue circle texture with white arrow
  createArrowTexture(size = 256) {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');

    ctx.clearRect(0, 0, size, size);

    // Blue circle
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size / 2 - 10, 0, Math.PI * 2);
    ctx.fillStyle = '#1249ff';
    ctx.fill();
    ctx.strokeStyle = '#2E5D8F';
    ctx.lineWidth = 3;
    ctx.stroke();

    // White arrow
    ctx.fillStyle = '#FFFFFF';
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 12;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    const centerX = size / 2;
    const centerY = size / 2;
    const arrowSize = size / 4;

    ctx.beginPath();
    ctx.moveTo(centerX, centerY + arrowSize / 2);
    ctx.lineTo(centerX, centerY - arrowSize / 2);
    ctx.moveTo(centerX - arrowSize / 3, centerY - arrowSize / 6);
    ctx.lineTo(centerX, centerY - arrowSize / 2);
    ctx.lineTo(centerX + arrowSize / 3, centerY - arrowSize / 6);
    ctx.stroke();

    return new THREE.CanvasTexture(canvas);
  }

  // Cylinder hotspots at ROT empties with HTML labels
  createRotHotspots(rotNodes) {
    this.rotHotspots.forEach(h => {
      if (h.parent) h.parent.remove(h);
      h.geometry.dispose();
      h.material.dispose();
    });
    this.rotHotspots = [];

    this.labels.forEach(label => {
      if (label.element?.parentNode) {
        label.element.parentNode.removeChild(label.element);
      }
    });
    this.labels = [];

    let alphaMap;
    if (this.alphaMap) {
      alphaMap = this.alphaMap;
    } else {
      const loader = new THREE.TextureLoader();
      alphaMap = loader.load('textures/transparent.png');
    }

    rotNodes.forEach((node, index) => {
      const geometry = new THREE.CylinderGeometry(0.3, 0.3, 2.0, 16, 1, true);
      const material = new THREE.MeshLambertMaterial({
        color: 0xffffff,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.9,
        emissive: 0xffffff,
        alphaMap: alphaMap
      });

      const cylinder = new THREE.Mesh(geometry, material);
      node.add(cylinder);
      cylinder.position.set(0, 0, 0.28);
      cylinder.rotation.set(-Math.PI / 2, 0, 0);
      cylinder.name = `rot-hotspot-${index}`;
      cylinder.userData.floor = node.userData.floor;

      const nodeName = node.name.toLowerCase();
      const displayName = node.name.replace(/_/g, ' ');
      let panoramaImagePath = '';

      const mapping = modelToPanoramaMapping.find(config =>
        config.nodeNamePatterns.some(pattern => nodeName.includes(pattern))
      );

      if (mapping) {
        panoramaImagePath = mapping.panoramaImage;
      } else {
        const fallback = modelToPanoramaMapping.find(config => config.fallbackIndex === index);
        if (fallback) {
          panoramaImagePath = fallback.panoramaImage;
        } else {
          panoramaImagePath = availablePanoramas[index % availablePanoramas.length];
        }
      }

      cylinder.userData.panoramaImage = panoramaImagePath;
      this.rotHotspots.push(cylinder);

      // HTML label
      const div = document.createElement('div');
      div.className = 'hotspot-label';
      div.textContent = displayName;
      Object.assign(div.style, {
        position: 'absolute',
        background: 'rgba(0, 0, 0, 0.4)',
        backdropFilter: 'blur(10px)',
        padding: '0.5rem 1rem',
        borderRadius: '0.5rem',
        boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
        color: 'white',
        fontSize: '12px',
        fontWeight: 'bold',
        textAlign: 'center',
        whiteSpace: 'nowrap',
        transform: 'translate(-50%, -50%)',
        pointerEvents: 'none',
        zIndex: '100',
        transition: 'opacity 0.2s ease, visibility 0.2s ease'
      });
      document.body.appendChild(div);

      const labelPosition = new THREE.Vector3(0, 1, 0);
      const referencePoint = new THREE.Object3D();
      referencePoint.position.copy(labelPosition);
      cylinder.add(referencePoint);

      this.labels.push({
        position: labelPosition,
        element: div,
        parent: cylinder,
        floor: node.userData.floor
      });
    });
  }

  updateRotTextFacing(camera, isFloorPlanView = false) {
    if (!this.labels.length) return;
    const tempVector = new THREE.Vector3();

    this.labels.forEach(label => {
      if (!label.element || !label.parent) return;
      if (label.element.style.display === 'none') return;

      const worldPosition = new THREE.Vector3();
      label.parent.getWorldPosition(worldPosition);
      worldPosition.add(label.position);

      const distance = camera.position.distanceTo(worldPosition);
      let scaleFactor;

      if (isFloorPlanView) {
        scaleFactor = 0.9;
      } else {
        const baseDistance = 10;
        const minScale = 0.3;
        const maxScale = 2.0;
        scaleFactor = baseDistance / distance;
        scaleFactor = Math.max(minScale, Math.min(maxScale, scaleFactor));
      }

      tempVector.copy(worldPosition);
      tempVector.project(camera);

      const x = (tempVector.x * 0.5 + 0.5) * window.innerWidth;
      const y = (-tempVector.y * 0.5 + 0.5) * window.innerHeight;

      const isBehindCamera = tempVector.z > 1;
      const isOutsideScreen =
        x < -100 || x > window.innerWidth + 100 || y < -100 || y > window.innerHeight + 100;

      if (isBehindCamera || isOutsideScreen) {
        label.element.style.visibility = 'hidden';
      } else {
        label.element.style.visibility = 'visible';
        label.element.style.left = `${x}px`;
        label.element.style.top = `${y}px`;
        label.element.style.transform = `translate(-50%, -50%) scale(${scaleFactor})`;
      }
    });
  }

  clearPanoramaHotspots() {
    if (this.hotspots) {
      this.hotspots.forEach(group => {
        group.children.forEach(child => {
          if (child.geometry) child.geometry.dispose();
          if (child.material) {
            if (child.material.map) child.material.map.dispose();
            child.material.dispose();
          }
        });
        this.scene.remove(group);
      });
    }
    this.hotspots = [];
  }

  createPanoramaHotspots(hotspotData) {
    this.clearPanoramaHotspots();

    const loader = new THREE.TextureLoader();
    const hotspotTexture = loader.load('textures/hotspot.png');

    hotspotData.forEach((data, index) => {
      const x = -data.radius * Math.sin(data.phi) * Math.cos(data.theta);
      const y = data.radius * Math.cos(data.phi);
      const z = data.radius * Math.sin(data.phi) * Math.sin(data.theta);

      const hotspotGroup = new THREE.Group();

      const circleGeometry = new THREE.PlaneGeometry(40, 40);
      const circleMaterial = new THREE.MeshBasicMaterial({
        map: hotspotTexture,
        transparent: true,
        opacity: 1,
        side: THREE.DoubleSide,
        depthTest: false,
        depthWrite: false
      });
      const circleMesh = new THREE.Mesh(circleGeometry, circleMaterial);

      const textTexture = this.createTextTexture(data.name, 1024);
      const textGeometry = new THREE.PlaneGeometry(120, 60);
      const textMaterial = new THREE.MeshBasicMaterial({
        map: textTexture,
        transparent: true,
        opacity: 1,
        side: THREE.DoubleSide,
        depthTest: false,
        depthWrite: false
      });
      const textMesh = new THREE.Mesh(textGeometry, textMaterial);
      textMesh.position.set(0, 35, 0); //Pano Lable POS

      hotspotGroup.add(circleMesh);
      hotspotGroup.add(textMesh);

      hotspotGroup.position.set(x, y, z);
      hotspotGroup.name = `pano-hotspot-${index}`;
      hotspotGroup.lookAt(0, 0, 0);

      hotspotGroup.userData = {
        originalScale: 1.3,
        pulseSpeed: 0.005,
        info: data,
        circleMesh,
        textMesh
      };

      this.scene.add(hotspotGroup);
      this.hotspots.push(hotspotGroup);
    });
  }

  createTextTexture(text, size = 1024) {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size / 2;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.font = 'bold 120px Arial';
    ctx.fillStyle = '#FFFFFF';
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 4;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    ctx.strokeText(text, centerX, centerY);
    ctx.fillText(text, centerX, centerY);

    return new THREE.CanvasTexture(canvas);
  }

  animateHotspots() {
    if (!this.hotspots) return;
    this.hotspots.forEach(group => {
      const userData = group.userData;
      const time = Date.now() * userData.pulseSpeed;

      if (userData.circleMesh) {
        const scale = userData.originalScale + Math.sin(time) * 0.1;
        userData.circleMesh.scale.setScalar(scale);
      }
      group.lookAt(0, 0, 0);
    });
  }

  getRotHotspots() {
    return this.rotHotspots;
  }
  getPanoramaHotspots() {
    return this.hotspots || [];
  }

  hideLabels() {
    this.labels.forEach(label => {
      if (label.element) {
        label.element.style.display = 'none';
      }
    });
  }

  showLabels() {
    this.labels.forEach(label => {
      if (label.element) {
        label.element.style.display = 'block';
        label.element.style.visibility = 'visible';
      }
    });
  }

  showLabelsForFloor(floorKey) {
    this.labels.forEach(label => {
      if (label.element) {
        if (label.floor === floorKey) {
          label.element.style.display = 'block';
          label.element.style.visibility = 'visible';
        } else {
          label.element.style.display = 'none';
        }
      }
    });
  }
}
