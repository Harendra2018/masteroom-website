// Light.glsl - Enhanced lighting shader with support for multiple light types

// Maximum number of lights (must match JavaScript maxLights)
#define MAX_LIGHTS 8

// Light type constants
#define LIGHT_TYPE_POINT 0
#define LIGHT_TYPE_SPOT 1
#define LIGHT_TYPE_SPHERE 2
#define LIGHT_TYPE_DISK 3
#define LIGHT_TYPE_RECT 4

// Light uniforms
uniform int uLightCount;
uniform int uLightType[MAX_LIGHTS];
uniform vec3 uLightPosition[MAX_LIGHTS];
uniform vec3 uLightEmission[MAX_LIGHTS];
uniform float uLightRadius[MAX_LIGHTS];
uniform vec3 uLightDirection[MAX_LIGHTS];
uniform float uLightConeAngle[MAX_LIGHTS];
uniform float uLightPenumbraAngle[MAX_LIGHTS];
uniform vec3 uLightNormal[MAX_LIGHTS];
uniform vec3 uLightV0[MAX_LIGHTS];
uniform vec3 uLightV1[MAX_LIGHTS];
uniform vec3 uLightV2[MAX_LIGHTS];
uniform vec3 uLightV3[MAX_LIGHTS];

// Light structure
struct LightData {
    int type;
    vec3 position;
    vec3 emission;
    float radius;
    vec3 direction;
    float coneAngle;
    float penumbraAngle;
    vec3 normal;
    vec3 v0;
    vec3 v1;
    vec3 v2;
    vec3 v3;
};

// Light array
LightData lights[MAX_LIGHTS];
int numActiveLights;

/**
 * Initialize all lights from uniforms
 */
void SetupLights()
{
    numActiveLights = min(uLightCount, MAX_LIGHTS);
    
    for (int i = 0; i < MAX_LIGHTS; i++)
    {
        if (i < numActiveLights)
        {
            lights[i].type = uLightType[i];
            lights[i].position = uLightPosition[i];
            lights[i].emission = uLightEmission[i];
            lights[i].radius = uLightRadius[i];
            lights[i].direction = uLightDirection[i];
            lights[i].coneAngle = uLightConeAngle[i];
            lights[i].penumbraAngle = uLightPenumbraAngle[i];
            lights[i].normal = uLightNormal[i];
            lights[i].v0 = uLightV0[i];
            lights[i].v1 = uLightV1[i];
            lights[i].v2 = uLightV2[i];
            lights[i].v3 = uLightV3[i];
        }
        else
        {
            lights[i].type = -1;
        }
    }
}

/**
 * Sample a point on a sphere uniformly
 */
vec3 SampleSphere(vec3 center, float radius)
{
    float z = 2.0 * rng() - 1.0;
    float phi = 2.0 * PI * rng();
    float r = sqrt(1.0 - z * z);
    return center + radius * vec3(r * cos(phi), r * sin(phi), z);
}

/**
 * Sample a point on a disk uniformly
 */
vec3 SampleDisk(vec3 center, vec3 normal, float radius)
{
    float r = sqrt(rng()) * radius;
    float theta = 2.0 * PI * rng();
    
    // Create orthonormal basis
    vec3 tangent = abs(normal.y) < 0.999 ? cross(normal, vec3(0, 1, 0)) : cross(normal, vec3(1, 0, 0));
    tangent = normalize(tangent);
    vec3 bitangent = cross(normal, tangent);
    
    return center + r * cos(theta) * tangent + r * sin(theta) * bitangent;
}

/**
 * Sample a point on a rectangular light uniformly
 */
vec3 SampleRect(vec3 v0, vec3 v1, vec3 v2, vec3 v3)
{
    float u = rng();
    float v = rng();
    
    vec3 p0 = mix(v0, v1, u);
    vec3 p1 = mix(v3, v2, u);
    return mix(p0, p1, v);
}

/**
 * Sample a direction from a cone (for spot lights)
 */
vec3 SampleCone(vec3 direction, float angle)
{
    float cosAngle = cos(angle);
    float z = mix(cosAngle, 1.0, rng());
    float phi = 2.0 * PI * rng();
    float r = sqrt(1.0 - z * z);
    
    vec3 localDir = vec3(r * cos(phi), r * sin(phi), z);
    
    // Create basis aligned with direction
    vec3 tangent = abs(direction.y) < 0.999 ? cross(direction, vec3(0, 1, 0)) : cross(direction, vec3(1, 0, 0));
    tangent = normalize(tangent);
    vec3 bitangent = cross(direction, tangent);
    
    return localDir.x * tangent + localDir.y * bitangent + localDir.z * direction;
}

/**
 * Sample a random point on a random light
 * Returns the light position and sets lightIndex
 */
vec3 SampleLight(out int lightIndex, out vec3 lightNormal)
{
    if (numActiveLights == 0) {
        lightIndex = -1;
        return vec3(0);
    }
    
    // Select random light
    lightIndex = int(floor(rng() * float(numActiveLights)));
    lightIndex = clamp(lightIndex, 0, numActiveLights - 1);
    
    LightData light = lights[lightIndex];
    lightNormal = vec3(0, 1, 0);
    
    if (light.type == LIGHT_TYPE_POINT) {
        // Sample on sphere surface
        return SampleSphere(light.position, light.radius);
    }
    else if (light.type == LIGHT_TYPE_SPOT) {
        // Sample on sphere surface at light position
        return SampleSphere(light.position, light.radius);
    }
    else if (light.type == LIGHT_TYPE_SPHERE) {
        // Sample on sphere surface
        return SampleSphere(light.position, light.radius);
    }
    else if (light.type == LIGHT_TYPE_DISK) {
        // Sample on disk
        lightNormal = light.normal;
        return SampleDisk(light.position, light.normal, light.radius);
    }
    else if (light.type == LIGHT_TYPE_RECT) {
        // Sample on rectangle
        lightNormal = light.normal;
        return SampleRect(light.v0, light.v1, light.v2, light.v3);
    }
    
    return light.position;
}

/**
 * Sample a specific light by index
 */
vec3 SampleLightByIndex(int lightIndex, out vec3 lightNormal)
{
    if (lightIndex < 0 || lightIndex >= numActiveLights) {
        return vec3(0);
    }
    
    LightData light = lights[lightIndex];
    lightNormal = vec3(0, 1, 0);
    
    if (light.type == LIGHT_TYPE_POINT) {
        return SampleSphere(light.position, light.radius);
    }
    else if (light.type == LIGHT_TYPE_SPOT) {
        return SampleSphere(light.position, light.radius);
    }
    else if (light.type == LIGHT_TYPE_SPHERE) {
        return SampleSphere(light.position, light.radius);
    }
    else if (light.type == LIGHT_TYPE_DISK) {
        lightNormal = light.normal;
        return SampleDisk(light.position, light.normal, light.radius);
    }
    else if (light.type == LIGHT_TYPE_RECT) {
        lightNormal = light.normal;
        return SampleRect(light.v0, light.v1, light.v2, light.v3);
    }
    
    return light.position;
}

/**
 * Intersect ray with sphere
 */
float IntersectSphere(vec3 center, float radius, vec3 rayOrigin, vec3 rayDirection)
{
    vec3 oc = rayOrigin - center;
    float b = dot(oc, rayDirection);
    float c = dot(oc, oc) - radius * radius;
    float disc = b * b - c;
    
    if (disc > 0.0) {
        float t = -b - sqrt(disc);
        if (t > 0.0) return t;
        t = -b + sqrt(disc);
        if (t > 0.0) return t;
    }
    
    return INFINITY;
}

/**
 * Intersect ray with disk
 */
float IntersectDisk(vec3 center, vec3 normal, float radius, vec3 rayOrigin, vec3 rayDirection)
{
    float denom = dot(normal, rayDirection);
    if (abs(denom) < 0.0001) return INFINITY;
    
    float t = dot(center - rayOrigin, normal) / denom;
    if (t < 0.0) return INFINITY;
    
    vec3 hitPoint = rayOrigin + t * rayDirection;
    vec3 toHit = hitPoint - center;
    if (dot(toHit, toHit) > radius * radius) return INFINITY;
    
    return t;
}

/**
 * Intersect ray with all lights
 * Returns distance to nearest intersection
 */
float IntersectLights(vec3 rayOrigin, vec3 rayDirection, out vec3 hitNormal, out vec3 hitEmission, out int hitLightIndex)
{
    float minDist = INFINITY;
    hitLightIndex = -1;
    
    for (int i = 0; i < MAX_LIGHTS; i++)
    {
        if (i >= numActiveLights) break;
        
        LightData light = lights[i];
        float d = INFINITY;
        
        if (light.type == LIGHT_TYPE_POINT) {
            d = IntersectSphere(light.position, light.radius, rayOrigin, rayDirection);
            if (d < minDist) {
                minDist = d;
                hitNormal = normalize(rayOrigin + d * rayDirection - light.position);
                hitEmission = light.emission;
                hitLightIndex = i;
            }
        }
        else if (light.type == LIGHT_TYPE_SPOT) {
            d = IntersectSphere(light.position, light.radius, rayOrigin, rayDirection);
            if (d < minDist) {
                vec3 hitPoint = rayOrigin + d * rayDirection;
                vec3 toHit = normalize(hitPoint - light.position);
                float cosAngle = dot(toHit, light.direction);
                
                // Check if inside cone
                if (cosAngle > cos(light.coneAngle)) {
                    minDist = d;
                    hitNormal = normalize(hitPoint - light.position);
                    
                    // Compute falloff
                    float falloff = 1.0;
                    if (cosAngle < cos(light.penumbraAngle)) {
                        falloff = smoothstep(cos(light.coneAngle), cos(light.penumbraAngle), cosAngle);
                    }
                    
                    hitEmission = light.emission * falloff;
                    hitLightIndex = i;
                }
            }
        }
        else if (light.type == LIGHT_TYPE_SPHERE) {
            d = IntersectSphere(light.position, light.radius, rayOrigin, rayDirection);
            if (d < minDist) {
                minDist = d;
                hitNormal = normalize(rayOrigin + d * rayDirection - light.position);
                hitEmission = light.emission;
                hitLightIndex = i;
            }
        }
        else if (light.type == LIGHT_TYPE_DISK) {
            d = IntersectDisk(light.position, light.normal, light.radius, rayOrigin, rayDirection);
            if (d < minDist) {
                minDist = d;
                hitNormal = light.normal;
                hitEmission = light.emission;
                hitLightIndex = i;
            }
        }
        else if (light.type == LIGHT_TYPE_RECT) {
            d = QuadIntersect(light.v0, light.v1, light.v2, light.v3, rayOrigin, rayDirection, FALSE);
            if (d < minDist) {
                minDist = d;
                hitNormal = light.normal;
                hitEmission = light.emission;
                hitLightIndex = i;
            }
        }
    }
    
    return minDist;
}

/**
 * Get light emission by index
 */
vec3 GetLightEmission(int lightIndex)
{
    if (lightIndex < 0 || lightIndex >= numActiveLights) {
        return vec3(0);
    }
    return lights[lightIndex].emission;
}

/**
 * Get number of active lights
 */
int GetNumLights()
{
    return numActiveLights;
}

/**
 * Calculate spot light attenuation
 */
float GetSpotLightAttenuation(int lightIndex, vec3 direction)
{
    if (lightIndex < 0 || lightIndex >= numActiveLights) {
        return 0.0;
    }
    
    LightData light = lights[lightIndex];
    if (light.type != LIGHT_TYPE_SPOT) {
        return 1.0;
    }
    
    float cosAngle = dot(normalize(direction), light.direction);
    
    if (cosAngle < cos(light.coneAngle)) {
        return 0.0;
    }
    
    if (cosAngle > cos(light.penumbraAngle)) {
        return 1.0;
    }
    
    return smoothstep(cos(light.coneAngle), cos(light.penumbraAngle), cosAngle);
}
