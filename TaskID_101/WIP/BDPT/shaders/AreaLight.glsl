// AreaLight.glsl - Area light shader code with multiple light support

// Maximum number of area lights (must match JavaScript maxLights)
#define MAX_AREA_LIGHTS 8
#define AREA_LIGHT_TYPE 3

// Area light uniforms (arrays for multiple lights)
uniform int uNumAreaLights;
uniform vec3 uAreaLightV0[MAX_AREA_LIGHTS];
uniform vec3 uAreaLightV1[MAX_AREA_LIGHTS];
uniform vec3 uAreaLightV2[MAX_AREA_LIGHTS];
uniform vec3 uAreaLightV3[MAX_AREA_LIGHTS];
uniform vec3 uAreaLightNormal[MAX_AREA_LIGHTS];
uniform vec3 uAreaLightEmission[MAX_AREA_LIGHTS];

// Area light structure
struct Quad { 
    vec3 normal; 
    vec3 v0; 
    vec3 v1; 
    vec3 v2; 
    vec3 v3; 
    vec3 emission; 
    vec3 color; 
    int type; 
};

// Area light array
Quad quads[MAX_AREA_LIGHTS];
int numActiveQuads;

/**
 * Initialize area lights from uniforms
 * Call this at the beginning of your path tracing setup
 */
void SetupAreaLights()
{
    vec3 z = vec3(0);
    numActiveQuads = min(uNumAreaLights, MAX_AREA_LIGHTS);
    
    for (int i = 0; i < MAX_AREA_LIGHTS; i++)
    {
        if (i < numActiveQuads)
        {
            quads[i] = Quad(
                uAreaLightNormal[i], 
                uAreaLightV0[i], 
                uAreaLightV1[i], 
                uAreaLightV2[i], 
                uAreaLightV3[i], 
                uAreaLightEmission[i], 
                z, 
                AREA_LIGHT_TYPE
            );
        }
        else
        {
            // Initialize unused lights with zeros
            quads[i] = Quad(z, z, z, z, z, z, z, 0);
        }
    }
}

/**
 * Sample a random point on a random area light
 * Returns the position on the light surface
 */
vec3 SampleAreaLight()
{
    if (numActiveQuads == 0) return vec3(0);
    
    // Select random light
    int lightIndex = int(floor(rng() * float(numActiveQuads)));
    lightIndex = clamp(lightIndex, 0, numActiveQuads - 1);
    
    vec3 randPointOnLight;
    randPointOnLight.x = mix(quads[lightIndex].v0.x, quads[lightIndex].v1.x, rng());
    randPointOnLight.y = mix(quads[lightIndex].v0.y, quads[lightIndex].v3.y, rng());
    randPointOnLight.z = mix(quads[lightIndex].v0.z, quads[lightIndex].v1.z, rng());
    return randPointOnLight;
}

/**
 * Sample a specific area light by index
 * Returns the position on the light surface
 */
vec3 SampleAreaLightByIndex(int lightIndex)
{
    if (lightIndex < 0 || lightIndex >= numActiveQuads) return vec3(0);
    
    vec3 randPointOnLight;
    randPointOnLight.x = mix(quads[lightIndex].v0.x, quads[lightIndex].v1.x, rng());
    randPointOnLight.y = mix(quads[lightIndex].v0.y, quads[lightIndex].v3.y, rng());
    randPointOnLight.z = mix(quads[lightIndex].v0.z, quads[lightIndex].v1.z, rng());
    return randPointOnLight;
}

/**
 * Intersect ray with all area lights
 * Returns distance to nearest intersection or INFINITY if no hit
 * Also returns which light was hit via hitLightIndex
 */
float IntersectAreaLights(vec3 rayOrigin, vec3 rayDirection, out vec3 hitNormal, out vec3 hitEmission, out int hitLightIndex)
{
    float minDist = INFINITY;
    hitLightIndex = -1;
    
    for (int i = 0; i < MAX_AREA_LIGHTS; i++)
    {
        if (i >= numActiveQuads) break;
        
        float d = QuadIntersect(
            quads[i].v0, 
            quads[i].v1, 
            quads[i].v2, 
            quads[i].v3, 
            rayOrigin, 
            rayDirection, 
            FALSE
        );
        
        if (d < minDist)
        {
            minDist = d;
            hitNormal = quads[i].normal;
            hitEmission = quads[i].emission;
            hitLightIndex = i;
        }
    }
    
    return minDist;
}

/**
 * Intersect ray with specific area light
 * Returns distance to intersection or INFINITY if no hit
 */
float IntersectAreaLightByIndex(int lightIndex, vec3 rayOrigin, vec3 rayDirection, out vec3 hitNormal, out vec3 hitEmission)
{
    if (lightIndex < 0 || lightIndex >= numActiveQuads)
    {
        return INFINITY;
    }
    
    float d = QuadIntersect(
        quads[lightIndex].v0, 
        quads[lightIndex].v1, 
        quads[lightIndex].v2, 
        quads[lightIndex].v3, 
        rayOrigin, 
        rayDirection, 
        FALSE
    );
    
    if (d < INFINITY)
    {
        hitNormal = quads[lightIndex].normal;
        hitEmission = quads[lightIndex].emission;
    }
    
    return d;
}

/**
 * Get area light emission by index
 */
vec3 GetAreaLightEmission(int lightIndex)
{
    if (lightIndex < 0 || lightIndex >= numActiveQuads)
    {
        return vec3(0);
    }
    return quads[lightIndex].emission;
}

/**
 * Get area light normal by index
 */
vec3 GetAreaLightNormal(int lightIndex)
{
    if (lightIndex < 0 || lightIndex >= numActiveQuads)
    {
        return vec3(0, 1, 0);
    }
    return quads[lightIndex].normal;
}

/**
 * Get total number of active area lights
 */
int GetNumAreaLights()
{
    return numActiveQuads;
}

/**
 * Calculate combined illumination from all area lights at a point
 * Useful for direct lighting calculations
 */
vec3 GetTotalAreaLightContribution(vec3 point, vec3 normal)
{
    vec3 totalLight = vec3(0);
    
    for (int i = 0; i < MAX_AREA_LIGHTS; i++)
    {
        if (i >= numActiveQuads) break;
        
        // Sample point on this light
        vec3 lightPoint = SampleAreaLightByIndex(i);
        vec3 toLight = lightPoint - point;
        float distSq = dot(toLight, toLight);
        vec3 lightDir = normalize(toLight);
        
        // Basic diffuse contribution (you may want to add shadow rays)
        float NdotL = max(0.0, dot(normal, lightDir));
        float lightNdotL = max(0.0, -dot(quads[i].normal, lightDir));
        
        // Geometric attenuation
        vec3 contribution = quads[i].emission * NdotL * lightNdotL / distSq;
        totalLight += contribution;
    }
    
    return totalLight;
}