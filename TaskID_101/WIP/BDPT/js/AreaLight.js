// AreaLight.js - Area light management for path tracing

class AreaLight {
    constructor() {
        // Default area light properties
        this.position = new THREE.Vector3(0, 200, 0);
        this.rotation = new THREE.Euler(0, 0, 0);
        this.scale = new THREE.Vector3(50, 1, 50);
        this.color = [1.0, 0.7, 0.38];
        this.intensity = 20.0;
        
        // Computed vertices
        this.v0 = new THREE.Vector3();
        this.v1 = new THREE.Vector3();
        this.v2 = new THREE.Vector3();
        this.v3 = new THREE.Vector3();
        this.normal = new THREE.Vector3();
        this.emission = new THREE.Vector3();
        
        // Change flags
        this.positionChanged = true;
        this.rotationChanged = true;
        this.scaleChanged = true;
        this.colorChanged = true;
        this.intensityChanged = true;
    }
    
    /**
     * Update the area light's computed properties (vertices, normal, emission)
     */
    updateGeometry() {
        if (!this.positionChanged && !this.rotationChanged && 
            !this.scaleChanged && !this.colorChanged && !this.intensityChanged) {
            return false;
        }
        
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
        
        // Compute emission (color * intensity)
        this.emission.fromArray(this.color).multiplyScalar(this.intensity);
        
        // Reset flags
        this.positionChanged = false;
        this.rotationChanged = false;
        this.scaleChanged = false;
        this.colorChanged = false;
        this.intensityChanged = false;
        
        return true;
    }
    
    /**
     * Set position and mark as changed
     */
    setPosition(x, y, z) {
        this.position.set(x, y, z);
        this.positionChanged = true;
    }
    
    /**
     * Set rotation and mark as changed
     */
    setRotation(x, y, z) {
        this.rotation.set(x, y, z);
        this.rotationChanged = true;
    }
    
    /**
     * Set scale and mark as changed
     */
    setScale(x, y, z) {
        this.scale.set(x, y, z);
        this.scaleChanged = true;
    }
    
    /**
     * Set color and mark as changed
     */
    setColor(r, g, b) {
        this.color = [r, g, b];
        this.colorChanged = true;
    }
    
    /**
     * Set intensity and mark as changed
     */
    setIntensity(intensity) {
        this.intensity = intensity;
        this.intensityChanged = true;
    }
    
    /**
     * Check if any property has changed
     */
    hasChanged() {
        return this.positionChanged || this.rotationChanged || 
               this.scaleChanged || this.colorChanged || this.intensityChanged;
    }
}

/**
 * Manager for multiple area lights
 */
class AreaLightManager {
    constructor(maxLights = 8) {
        this.maxLights = maxLights;
        this.lights = [];
    }
    
    /**
     * Add a new area light
     */
    addLight(light) {
        if (this.lights.length >= this.maxLights) {
            console.warn(`Maximum number of area lights (${this.maxLights}) reached`);
            return false;
        }
        this.lights.push(light);
        return true;
    }
    
    /**
     * Remove an area light by index
     */
    removeLight(index) {
        if (index >= 0 && index < this.lights.length) {
            this.lights.splice(index, 1);
            return true;
        }
        return false;
    }
    
    /**
     * Get number of active lights
     */
    getCount() {
        return this.lights.length;
    }
    
    /**
     * Check if any light has changed
     */
    hasChanged() {
        return this.lights.some(light => light.hasChanged());
    }
    
    /**
     * Update all lights' geometry
     */
    updateAllGeometry() {
        let anyChanged = false;
        for (const light of this.lights) {
            if (light.updateGeometry()) {
                anyChanged = true;
            }
        }
        return anyChanged;
    }
    
    /**
     * Update shader uniforms with all area lights
     */
    updateUniforms(uniforms) {
        this.updateAllGeometry();

        // Update count
        uniforms.uAreaLightCount.value = this.lights.length;

        // Update each light's properties
        for (let i = 0; i < this.maxLights; i++) {
            if (i < this.lights.length) {
                const light = this.lights[i];
                uniforms.uAreaLightV0.value[i].copy(light.v0);
                uniforms.uAreaLightV1.value[i].copy(light.v1);
                uniforms.uAreaLightV2.value[i].copy(light.v2);
                uniforms.uAreaLightV3.value[i].copy(light.v3);
                uniforms.uAreaLightNormal.value[i].copy(light.normal);
                uniforms.uAreaLightEmission.value[i].copy(light.emission);
            } else {
                // Zero out unused lights
                uniforms.uAreaLightV0.value[i].set(0, 0, 0);
                uniforms.uAreaLightV1.value[i].set(0, 0, 0);
                uniforms.uAreaLightV2.value[i].set(0, 0, 0);
                uniforms.uAreaLightV3.value[i].set(0, 0, 0);
                uniforms.uAreaLightNormal.value[i].set(0, 0, 0);
                uniforms.uAreaLightEmission.value[i].set(0, 0, 0);
            }
        }
    }
    
    /**
     * Initialize shader uniforms (call once during setup)
     */
    initUniforms(uniforms) {
        uniforms.uAreaLightCount = { value: 0 };
        uniforms.uAreaLightV0 = { value: [] };
        uniforms.uAreaLightV1 = { value: [] };
        uniforms.uAreaLightV2 = { value: [] };
        uniforms.uAreaLightV3 = { value: [] };
        uniforms.uAreaLightNormal = { value: [] };
        uniforms.uAreaLightEmission = { value: [] };

        for (let i = 0; i < this.maxLights; i++) {
            uniforms.uAreaLightV0.value.push(new THREE.Vector3());
            uniforms.uAreaLightV1.value.push(new THREE.Vector3());
            uniforms.uAreaLightV2.value.push(new THREE.Vector3());
            uniforms.uAreaLightV3.value.push(new THREE.Vector3());
            uniforms.uAreaLightNormal.value.push(new THREE.Vector3());
            uniforms.uAreaLightEmission.value.push(new THREE.Vector3());
        }
    }
}

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { AreaLight, AreaLightManager };
}