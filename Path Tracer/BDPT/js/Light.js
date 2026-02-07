// Light.js - Enhanced light management for path tracing with multiple light types

/**
 * Light Types
 */
const LightType = {
    POINT: 0,
    SPOT: 1,
    SPHERE: 2,
    DISK: 3,
    RECT: 4  // Rectangular area light
};

/**
 * Base Light Class
 */
class Light {
    constructor(type) {
        this.type = type;
        this.position = new THREE.Vector3(0, 0, 0);
        this.color = [1.0, 1.0, 1.0];
        this.intensity = 1.0;
        this.emission = new THREE.Vector3();
        
        // Change flags
        this.positionChanged = true;
        this.colorChanged = true;
        this.intensityChanged = true;
    }
    
    setPosition(x, y, z) {
        this.position.set(x, y, z);
        this.positionChanged = true;
    }
    
    setColor(r, g, b) {
        this.color = [r, g, b];
        this.colorChanged = true;
    }
    
    setIntensity(intensity) {
        this.intensity = intensity;
        this.intensityChanged = true;
    }
    
    updateEmission() {
        this.emission.fromArray(this.color).multiplyScalar(this.intensity);
    }
    
    hasChanged() {
        return this.positionChanged || this.colorChanged || this.intensityChanged;
    }
    
    resetFlags() {
        this.positionChanged = false;
        this.colorChanged = false;
        this.intensityChanged = false;
    }
}

/**
 * Point Light - Omnidirectional light source
 */
class PointLight extends Light {
    constructor() {
        super(LightType.POINT);
        this.radius = 0.1; // Physical size for soft shadows
        this.radiusChanged = true;
    }
    
    setRadius(radius) {
        this.radius = radius;
        this.radiusChanged = true;
    }
    
    hasChanged() {
        return super.hasChanged() || this.radiusChanged;
    }
    
    resetFlags() {
        super.resetFlags();
        this.radiusChanged = false;
    }
    
    update() {
        if (!this.hasChanged()) return false;
        this.updateEmission();
        this.resetFlags();
        return true;
    }
}

/**
 * Spot Light - Cone-shaped directional light
 */
class SpotLight extends Light {
    constructor() {
        super(LightType.SPOT);
        this.direction = new THREE.Vector3(0, -1, 0);
        this.coneAngle = Math.PI / 4; // 45 degrees
        this.penumbraAngle = Math.PI / 6; // Soft edge
        this.radius = 0.1;
        
        this.directionChanged = true;
        this.coneAngleChanged = true;
        this.penumbraAngleChanged = true;
        this.radiusChanged = true;
    }
    
    setDirection(x, y, z) {
        this.direction.set(x, y, z).normalize();
        this.directionChanged = true;
    }
    
    setConeAngle(angle) {
        this.coneAngle = angle;
        this.coneAngleChanged = true;
    }
    
    setPenumbraAngle(angle) {
        this.penumbraAngle = angle;
        this.penumbraAngleChanged = true;
    }
    
    setRadius(radius) {
        this.radius = radius;
        this.radiusChanged = true;
    }
    
    hasChanged() {
        return super.hasChanged() || this.directionChanged || 
               this.coneAngleChanged || this.penumbraAngleChanged || this.radiusChanged;
    }
    
    resetFlags() {
        super.resetFlags();
        this.directionChanged = false;
        this.coneAngleChanged = false;
        this.penumbraAngleChanged = false;
        this.radiusChanged = false;
    }
    
    update() {
        if (!this.hasChanged()) return false;
        this.updateEmission();
        this.resetFlags();
        return true;
    }
}

/**
 * Sphere Light - Spherical area light
 */
class SphereLight extends Light {
    constructor() {
        super(LightType.SPHERE);
        this.radius = 1.0;
        this.radiusChanged = true;
    }
    
    setRadius(radius) {
        this.radius = radius;
        this.radiusChanged = true;
    }
    
    hasChanged() {
        return super.hasChanged() || this.radiusChanged;
    }
    
    resetFlags() {
        super.resetFlags();
        this.radiusChanged = false;
    }
    
    update() {
        if (!this.hasChanged()) return false;
        this.updateEmission();
        this.resetFlags();
        return true;
    }
}

/**
 * Disk Light - Circular area light
 */
class DiskLight extends Light {
    constructor() {
        super(LightType.DISK);
        this.rotation = new THREE.Euler(0, 0, 0);
        this.radius = 1.0;
        this.normal = new THREE.Vector3(0, 1, 0);
        
        this.rotationChanged = true;
        this.radiusChanged = true;
    }
    
    setRotation(x, y, z) {
        this.rotation.set(x, y, z);
        this.rotationChanged = true;
    }
    
    setRadius(radius) {
        this.radius = radius;
        this.radiusChanged = true;
    }
    
    updateGeometry() {
        // Compute normal from rotation
        const matrix = new THREE.Matrix4().makeRotationFromEuler(this.rotation);
        this.normal.set(0, 1, 0).applyMatrix4(matrix).normalize();
    }
    
    hasChanged() {
        return super.hasChanged() || this.rotationChanged || this.radiusChanged;
    }
    
    resetFlags() {
        super.resetFlags();
        this.rotationChanged = false;
        this.radiusChanged = false;
    }
    
    update() {
        if (!this.hasChanged()) return false;
        this.updateEmission();
        this.updateGeometry();
        this.resetFlags();
        return true;
    }
}

/**
 * Rectangular Area Light - Quad-shaped area light
 */
class RectLight extends Light {
    constructor() {
        super(LightType.RECT);
        this.rotation = new THREE.Euler(0, 0, 0);
        this.scale = new THREE.Vector3(1, 1, 1);
        
        // Computed vertices
        this.v0 = new THREE.Vector3();
        this.v1 = new THREE.Vector3();
        this.v2 = new THREE.Vector3();
        this.v3 = new THREE.Vector3();
        this.normal = new THREE.Vector3();
        
        this.rotationChanged = true;
        this.scaleChanged = true;
    }
    
    setRotation(x, y, z) {
        this.rotation.set(x, y, z);
        this.rotationChanged = true;
    }
    
    setScale(x, y, z) {
        this.scale.set(x, y, z);
        this.scaleChanged = true;
    }
    
    updateGeometry() {
        // Base vertices of a unit quad (Y-up)
        const baseV0 = new THREE.Vector3(-0.5, 0, -0.5);
        const baseV1 = new THREE.Vector3(0.5, 0, -0.5);
        const baseV2 = new THREE.Vector3(0.5, 0, 0.5);
        const baseV3 = new THREE.Vector3(-0.5, 0, 0.5);
        
        // Build transformation matrix
        const matrix = new THREE.Matrix4();
        matrix.makeTranslation(this.position.x, this.position.y, this.position.z);
        matrix.multiply(new THREE.Matrix4().makeRotationFromEuler(this.rotation));
        matrix.multiply(new THREE.Matrix4().makeScale(this.scale.x, this.scale.y, this.scale.z));
        
        // Transform vertices
        this.v0.copy(baseV0).applyMatrix4(matrix);
        this.v1.copy(baseV1).applyMatrix4(matrix);
        this.v2.copy(baseV2).applyMatrix4(matrix);
        this.v3.copy(baseV3).applyMatrix4(matrix);
        
        // Compute normal
        const edge1 = new THREE.Vector3().subVectors(this.v1, this.v0);
        const edge2 = new THREE.Vector3().subVectors(this.v3, this.v0);
        this.normal.crossVectors(edge1, edge2).normalize();
    }
    
    hasChanged() {
        return super.hasChanged() || this.rotationChanged || this.scaleChanged;
    }
    
    resetFlags() {
        super.resetFlags();
        this.rotationChanged = false;
        this.scaleChanged = false;
    }
    
    update() {
        if (!this.hasChanged()) return false;
        this.updateEmission();
        this.updateGeometry();
        this.resetFlags();
        return true;
    }
}

/**
 * Light Manager - Manages multiple lights of different types
 */
class LightManager {
    constructor(maxLights = 8) {
        this.maxLights = maxLights;
        this.lights = [];
    }
    
    addLight(light) {
        if (this.lights.length >= this.maxLights) {
            console.warn(`Maximum number of lights (${this.maxLights}) reached`);
            return false;
        }
        this.lights.push(light);
        return true;
    }
    
    removeLight(index) {
        if (index >= 0 && index < this.lights.length) {
            this.lights.splice(index, 1);
            return true;
        }
        return false;
    }
    
    getCount() {
        return this.lights.length;
    }
    
    hasChanged() {
        return this.lights.some(light => light.hasChanged());
    }
    
    updateAll() {
        let anyChanged = false;
        for (const light of this.lights) {
            if (light.update()) {
                anyChanged = true;
            }
        }
        return anyChanged;
    }
    
    /**
     * Initialize shader uniforms
     */
    initUniforms(uniforms) {
        uniforms.uLightCount = { value: 0 };
        uniforms.uLightType = { value: [] };
        uniforms.uLightPosition = { value: [] };
        uniforms.uLightEmission = { value: [] };
        
        // Point/Spot specific
        uniforms.uLightRadius = { value: [] };
        
        // Spot specific
        uniforms.uLightDirection = { value: [] };
        uniforms.uLightConeAngle = { value: [] };
        uniforms.uLightPenumbraAngle = { value: [] };
        
        // Rect/Disk specific
        uniforms.uLightNormal = { value: [] };
        
        // Rect specific
        uniforms.uLightV0 = { value: [] };
        uniforms.uLightV1 = { value: [] };
        uniforms.uLightV2 = { value: [] };
        uniforms.uLightV3 = { value: [] };
        
        for (let i = 0; i < this.maxLights; i++) {
            uniforms.uLightType.value.push(0);
            uniforms.uLightPosition.value.push(new THREE.Vector3());
            uniforms.uLightEmission.value.push(new THREE.Vector3());
            uniforms.uLightRadius.value.push(0);
            uniforms.uLightDirection.value.push(new THREE.Vector3(0, -1, 0));
            uniforms.uLightConeAngle.value.push(0);
            uniforms.uLightPenumbraAngle.value.push(0);
            uniforms.uLightNormal.value.push(new THREE.Vector3(0, 1, 0));
            uniforms.uLightV0.value.push(new THREE.Vector3());
            uniforms.uLightV1.value.push(new THREE.Vector3());
            uniforms.uLightV2.value.push(new THREE.Vector3());
            uniforms.uLightV3.value.push(new THREE.Vector3());
        }
    }
    
    /**
     * Update shader uniforms with all lights
     */
    updateUniforms(uniforms) {
        this.updateAll();
        
        uniforms.uLightCount.value = this.lights.length;
        
        for (let i = 0; i < this.maxLights; i++) {
            if (i < this.lights.length) {
                const light = this.lights[i];
                
                uniforms.uLightType.value[i] = light.type;
                uniforms.uLightPosition.value[i].copy(light.position);
                uniforms.uLightEmission.value[i].copy(light.emission);
                
                // Type-specific properties
                switch (light.type) {
                    case LightType.POINT:
                        uniforms.uLightRadius.value[i] = light.radius;
                        break;
                        
                    case LightType.SPOT:
                        uniforms.uLightDirection.value[i].copy(light.direction);
                        uniforms.uLightConeAngle.value[i] = light.coneAngle;
                        uniforms.uLightPenumbraAngle.value[i] = light.penumbraAngle;
                        uniforms.uLightRadius.value[i] = light.radius;
                        break;
                        
                    case LightType.SPHERE:
                        uniforms.uLightRadius.value[i] = light.radius;
                        break;
                        
                    case LightType.DISK:
                        uniforms.uLightRadius.value[i] = light.radius;
                        uniforms.uLightNormal.value[i].copy(light.normal);
                        break;
                        
                    case LightType.RECT:
                        uniforms.uLightV0.value[i].copy(light.v0);
                        uniforms.uLightV1.value[i].copy(light.v1);
                        uniforms.uLightV2.value[i].copy(light.v2);
                        uniforms.uLightV3.value[i].copy(light.v3);
                        uniforms.uLightNormal.value[i].copy(light.normal);
                        break;
                }
            } else {
                // Zero out unused lights
                uniforms.uLightType.value[i] = -1;
                uniforms.uLightPosition.value[i].set(0, 0, 0);
                uniforms.uLightEmission.value[i].set(0, 0, 0);
            }
        }
    }
}

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { 
        LightType, 
        Light,
        PointLight, 
        SpotLight,
        SphereLight,
        DiskLight,
        RectLight, 
        LightManager 
    };
}
