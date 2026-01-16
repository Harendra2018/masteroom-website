precision highp float;
precision highp int;
precision highp sampler2D;

#include <pathtracing_uniforms_and_defines>

uniform sampler2D tTriangleTexture;
uniform sampler2D tAABBTexture;
uniform sampler2D tAlbedoTextures[8];
uniform float uRoughness;

// UPDATED: Multiple area light uniforms (up to 8 lights)
uniform int uAreaLightCount;
uniform vec3 uAreaLightV0[8];
uniform vec3 uAreaLightV1[8];
uniform vec3 uAreaLightV2[8];
uniform vec3 uAreaLightV3[8];
uniform vec3 uAreaLightNormal[8];
uniform vec3 uAreaLightEmission[8];

#define INV_TEXTURE_WIDTH 0.00048828125

vec3 rayOrigin, rayDirection;
vec3 hitNormal, hitEmission, hitColor;
vec2 hitUV;
float hitObjectID = -INFINITY;
float hitOpacity;
float hitMetalness;
float hitRoughness;
int hitType = -100;
int hitAlbedoTextureID;

struct Box { vec3 minCorner; vec3 maxCorner; vec3 emission; vec3 color; int type; };
Box box;

#include <pathtracing_random_functions>

#include <pathtracing_quad_intersect>

// AreaLight.glsl - Area light shader code for MULTIPLE lights

// Area light constants
#define MAX_AREA_LIGHTS 8
#define AREA_LIGHT_TYPE 3

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

// Area light array - now supports multiple lights
Quad quads[MAX_AREA_LIGHTS];
int activeAreaLightCount;

/**
 * Initialize all area lights from uniforms
 * Call this at the beginning of your path tracing setup
 */
void SetupAreaLight()
{
    vec3 z = vec3(0);
    activeAreaLightCount = uAreaLightCount;
    
    // Initialize all active lights
    for (int i = 0; i < MAX_AREA_LIGHTS; i++)
    {
        if (i >= activeAreaLightCount) break;
        
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
}

/**
 * Sample a random point on a random area light
 * Returns the position on the light surface
 */
vec3 SampleAreaLight(out int lightIndex)
{
    lightIndex = int(floor(rng() * float(activeAreaLightCount)));
    lightIndex = clamp(lightIndex, 0, activeAreaLightCount - 1);

    float u = rng();
    float v = rng();

    vec3 v0 = quads[lightIndex].v0;
    vec3 edge1 = quads[lightIndex].v1 - quads[lightIndex].v0;
    vec3 edge2 = quads[lightIndex].v3 - quads[lightIndex].v0;

    return v0 + u * edge1 + v * edge2;
}

/**
 * Intersect ray with all area lights
 * Returns distance to nearest intersection or INFINITY if no hit
 */
float IntersectAreaLight(vec3 rayOrigin, vec3 rayDirection, out vec3 hitNormal, out vec3 hitEmission)
{
    float closestT = INFINITY;
    
    for (int i = 0; i < MAX_AREA_LIGHTS; i++)
    {
        if (i >= activeAreaLightCount) break;
        
        float d = QuadIntersect(
            quads[i].v0,
            quads[i].v1,
            quads[i].v2,
            quads[i].v3,
            rayOrigin,
            rayDirection,
            FALSE
        );

        if (d < closestT)
        {
            closestT = d;
            hitNormal = quads[i].normal;
            hitEmission = quads[i].emission;
        }
    }

    return closestT;
}

/**
 * Get total power from all area lights (for importance sampling)
 */
float GetTotalAreaLightPower()
{
    float totalPower = 0.0;
    for (int i = 0; i < MAX_AREA_LIGHTS; i++)
    {
        if (i >= activeAreaLightCount) break;
        totalPower += length(quads[i].emission);
    }
    return totalPower;
}

#include <pathtracing_calc_fresnel_reflectance>

#include <pathtracing_sphere_intersect>

#include <pathtracing_box_intersect>

#include <pathtracing_boundingbox_intersect>

#include <pathtracing_bvhTriangle_intersect>

vec2 stackLevels[28];

void GetBoxNodeData(const in float i, inout vec4 boxNodeData0, inout vec4 boxNodeData1)
{
	float ix2 = i * 2.0;
	ivec2 uv0 = ivec2( mod(ix2 + 0.0, 2048.0), (ix2 + 0.0) * INV_TEXTURE_WIDTH );
	ivec2 uv1 = ivec2( mod(ix2 + 1.0, 2048.0), (ix2 + 1.0) * INV_TEXTURE_WIDTH );
	boxNodeData0 = texelFetch(tAABBTexture, uv0, 0);
	boxNodeData1 = texelFetch(tAABBTexture, uv1, 0);
}

// UPDATED: Added sampleLight parameter
float SceneIntersect(int sampleLight)
{
	vec4 currentBoxNodeData0, nodeAData0, nodeBData0, tmpNodeData0;
	vec4 currentBoxNodeData1, nodeAData1, nodeBData1, tmpNodeData1;
	vec4 vd0, vd1, vd2, vd3, vd4, vd5, vd6, vd7;
	vec3 inverseDir = 1.0 / rayDirection;
	vec3 normal, n;
	vec2 currentStackData, stackDataA, stackDataB, tmpStackData;
	ivec2 uv0, uv1, uv2, uv3, uv4, uv5, uv6, uv7;

	float d;
	float t = INFINITY;
	float stackptr = 0.0;
	float id = 0.0;
	float tu, tv;
	float triangleID = 0.0;
	float triangleU = 0.0;
	float triangleV = 0.0;
	float triangleW = 0.0;

	int objectCount = 0;
	hitObjectID = -INFINITY;
	int skip = FALSE;
	int triangleLookupNeeded = FALSE;
	int isRayExiting = FALSE;

	// BVH Traversal
	GetBoxNodeData(stackptr, currentBoxNodeData0, currentBoxNodeData1);
	currentStackData = vec2(stackptr, BoundingBoxIntersect(currentBoxNodeData0.yzw, currentBoxNodeData1.yzw, rayOrigin, inverseDir));
	stackLevels[0] = currentStackData;
	skip = (currentStackData.y < t) ? TRUE : FALSE;

	while (true)
	{
		if (skip == FALSE) 
		{
			if (--stackptr < 0.0)
				break;
			currentStackData = stackLevels[int(stackptr)];
			if (currentStackData.y >= t)
				continue;
			GetBoxNodeData(currentStackData.x, currentBoxNodeData0, currentBoxNodeData1);
		}
		skip = FALSE;
		
		if (currentBoxNodeData0.x < 0.0)
		{
			GetBoxNodeData(currentStackData.x + 1.0, nodeAData0, nodeAData1);
			GetBoxNodeData(currentBoxNodeData1.x, nodeBData0, nodeBData1);
			stackDataA = vec2(currentStackData.x + 1.0, BoundingBoxIntersect(nodeAData0.yzw, nodeAData1.yzw, rayOrigin, inverseDir));
			stackDataB = vec2(currentBoxNodeData1.x, BoundingBoxIntersect(nodeBData0.yzw, nodeBData1.yzw, rayOrigin, inverseDir));
			
			if (stackDataB.y < stackDataA.y)
			{
				tmpStackData = stackDataB;
				stackDataB = stackDataA;
				stackDataA = tmpStackData;
				tmpNodeData0 = nodeBData0; tmpNodeData1 = nodeBData1;
				nodeBData0 = nodeAData0; nodeBData1 = nodeAData1;
				nodeAData0 = tmpNodeData0; nodeAData1 = tmpNodeData1;
			}

			if (stackDataB.y < t)
			{
				currentStackData = stackDataB;
				currentBoxNodeData0 = nodeBData0;
				currentBoxNodeData1 = nodeBData1;
				skip = TRUE;
			}
			if (stackDataA.y < t)
			{
				if (skip == TRUE)
					stackLevels[int(stackptr++)] = stackDataB;
				currentStackData = stackDataA;
				currentBoxNodeData0 = nodeAData0; 
				currentBoxNodeData1 = nodeAData1;
				skip = TRUE;
			}
			continue;
		}

		// Leaf node - triangle intersection
		id = 8.0 * currentBoxNodeData0.x;
		uv0 = ivec2( mod(id + 0.0, 2048.0), (id + 0.0) * INV_TEXTURE_WIDTH );
		uv1 = ivec2( mod(id + 1.0, 2048.0), (id + 1.0) * INV_TEXTURE_WIDTH );
		uv2 = ivec2( mod(id + 2.0, 2048.0), (id + 2.0) * INV_TEXTURE_WIDTH );
		
		vd0 = texelFetch(tTriangleTexture, uv0, 0);
		vd1 = texelFetch(tTriangleTexture, uv1, 0);
		vd2 = texelFetch(tTriangleTexture, uv2, 0);

		d = BVH_TriangleIntersect( vec3(vd0.xyz), vec3(vd0.w, vd1.xy), vec3(vd1.zw, vd2.x), rayOrigin, rayDirection, tu, tv );

		if (d < t)
		{
			t = d;
			triangleID = id;
			triangleU = tu;
			triangleV = tv;
			triangleLookupNeeded = TRUE;
		}
	}

	// Full triangle data lookup
	if (triangleLookupNeeded == TRUE)
	{
		uv0 = ivec2( mod(triangleID + 0.0, 2048.0), floor((triangleID + 0.0) * INV_TEXTURE_WIDTH) );
		uv1 = ivec2( mod(triangleID + 1.0, 2048.0), floor((triangleID + 1.0) * INV_TEXTURE_WIDTH) );
		uv2 = ivec2( mod(triangleID + 2.0, 2048.0), floor((triangleID + 2.0) * INV_TEXTURE_WIDTH) );
		uv3 = ivec2( mod(triangleID + 3.0, 2048.0), floor((triangleID + 3.0) * INV_TEXTURE_WIDTH) );
		uv4 = ivec2( mod(triangleID + 4.0, 2048.0), floor((triangleID + 4.0) * INV_TEXTURE_WIDTH) );
		uv5 = ivec2( mod(triangleID + 5.0, 2048.0), floor((triangleID + 5.0) * INV_TEXTURE_WIDTH) );
		uv6 = ivec2( mod(triangleID + 6.0, 2048.0), floor((triangleID + 6.0) * INV_TEXTURE_WIDTH) );
		uv7 = ivec2( mod(triangleID + 7.0, 2048.0), floor((triangleID + 7.0) * INV_TEXTURE_WIDTH) );
		
		vd0 = texelFetch(tTriangleTexture, uv0, 0);
		vd1 = texelFetch(tTriangleTexture, uv1, 0);
		vd2 = texelFetch(tTriangleTexture, uv2, 0);
		vd3 = texelFetch(tTriangleTexture, uv3, 0);
		vd4 = texelFetch(tTriangleTexture, uv4, 0);
		vd5 = texelFetch(tTriangleTexture, uv5, 0);
		vd6 = texelFetch(tTriangleTexture, uv6, 0);
		vd7 = texelFetch(tTriangleTexture, uv7, 0);

		triangleW = 1.0 - triangleU - triangleV;
		hitNormal = normalize(triangleW * vec3(vd2.yzw) + triangleU * vec3(vd3.xyz) + triangleV * vec3(vd3.w, vd4.xy));
		hitEmission = vec3(0);
		hitColor = vd6.yzw;
		hitOpacity = vd7.y;
		hitUV = triangleW * vec2(vd4.zw) + triangleU * vec2(vd5.xy) + triangleV * vec2(vd5.zw);
		hitType = int(vd6.x);
		hitAlbedoTextureID = int(vd7.x);
		hitObjectID = float(objectCount);
		hitMetalness = vd7.z;
		hitRoughness = vd7.w;
	}
	objectCount++;

	// Ground plane intersection
	d = BoxIntersect( box.minCorner, box.maxCorner, rayOrigin, rayDirection, n, isRayExiting );
	if (d < t)
	{
		t = d;
		hitNormal = normalize(n);
		hitEmission = box.emission;
		hitColor = box.color;
		hitType = box.type;
		hitObjectID = float(objectCount);
		hitMetalness = 0.0;
		hitRoughness = 1.0;
		hitOpacity = 1.0;
		hitAlbedoTextureID = -1;
	}
	objectCount++;

	// UPDATED: Only intersect area lights for camera rays and specular reflections
	// Don't intersect when shooting shadow rays (sampleLight == TRUE)
	if (sampleLight == FALSE)
	{
		vec3 alNormal, alEmission;
		d = IntersectAreaLight(rayOrigin, rayDirection, alNormal, alEmission);
		if (d < t)
		{
			t = d;
			hitNormal = alNormal;
			hitEmission = alEmission;
			hitColor = vec3(0);
			hitType = AREA_LIGHT_TYPE;
			hitObjectID = float(objectCount);
		}
	}
	objectCount++;
	
	return t;
}


vec3 CalculateRadiance( out vec3 objectNormal, out vec3 objectColor, out float objectID, out float pixelSharpness )
{
	vec3 accumCol = vec3(0.0);
	vec3 mask = vec3(1.0);
	vec3 reflectionMask = vec3(1.0);
	vec3 reflectionRayOrigin = vec3(0);
	vec3 reflectionRayDirection = vec3(0);
	vec3 n, nl, x;

	float t = INFINITY;
	float epsIntersect = 0.001;
	float lightHitDistance = INFINITY;
	float weight;
	float previousObjectID;

	int diffuseCount = 0;
	int previousIntersecType = -100;
	float previousOpacity = 1.0;
	hitType = -100;
	int bounceIsSpecular = TRUE;
	int sampleLight = FALSE;
	int ableToJoinPaths = FALSE;
	int willNeedReflectionRay = FALSE;
	int isReflectionTime = FALSE;

	// === LIGHT PATH TRACING (from Light source) ===
	// UPDATED: Sample from a random light
	int selectedLightIndex;
	vec3 randPointOnLight = SampleAreaLight(selectedLightIndex);
	vec3 lightHitEmission = quads[selectedLightIndex].emission;
	vec3 lightHitPos = randPointOnLight;
	vec3 lightNormal = quads[selectedLightIndex].normal;
	
	// Account for selecting one light among many (probability adjustment)
	float lightSelectionProbability = 1.0 / float(activeAreaLightCount);
	lightHitEmission /= lightSelectionProbability;
	
	// Store original camera ray
	vec3 originalRayOrigin = rayOrigin;
	vec3 originalRayDirection = rayDirection;
	
	// Shoot ray from light
	rayDirection = randomCosWeightedDirectionInHemisphere(lightNormal);
	rayOrigin = randPointOnLight + lightNormal * epsIntersect;
	
	t = SceneIntersect(sampleLight);
	
	// If light ray hits diffuse surface, store the position
	if (hitType == DIFF && t < INFINITY)
	{
		lightHitPos = rayOrigin + rayDirection * t;
		weight = max(0.0, dot(-rayDirection, normalize(hitNormal)));
		lightHitEmission *= hitColor * weight;
	}
	
	// Reset to camera ray for eye path tracing
	rayOrigin = originalRayOrigin;
	rayDirection = originalRayDirection;
	hitType = -100;
	hitObjectID = -100.0;

	// === EYE PATH TRACING (from Camera) ===
	for (int bounces = 0; bounces < 10; bounces++)
	{
		previousIntersecType = hitType;
		previousObjectID = hitObjectID;

		t = SceneIntersect(sampleLight);

		if (t < INFINITY) {
			previousOpacity = hitOpacity;
		}

		// Hit light directly
		if (hitType == AREA_LIGHT_TYPE)
		{
			if (diffuseCount == 0 && isReflectionTime == FALSE)
				pixelSharpness = 1.0;

			if (isReflectionTime == TRUE && bounceIsSpecular == TRUE)
			{
				objectNormal += nl;
				objectID += hitObjectID;
			}
			
			if (bounceIsSpecular == TRUE || sampleLight == TRUE)
				accumCol += mask * hitEmission;

			if (willNeedReflectionRay == TRUE)
			{
				mask = reflectionMask;
				rayOrigin = reflectionRayOrigin;
				rayDirection = reflectionRayDirection;

				willNeedReflectionRay = FALSE;
				bounceIsSpecular = TRUE;
				sampleLight = FALSE;
				isReflectionTime = TRUE;
				continue;
			}
			break;
		}

		if (t == INFINITY)
		{
			break;
		}

		// Store useful data
		n = hitNormal;
		nl = dot(n, rayDirection) < 0.0 ? n : -n;
		x = rayOrigin + rayDirection * t;

		if (bounces == 0)
		{
			objectNormal = n;
			objectColor = hitColor;
			objectID = hitObjectID;
		}

		// === PATH CONNECTION: Check if we can join with light path ===
		if (hitType == DIFF && sampleLight == TRUE)
		{
			ableToJoinPaths = abs(t - lightHitDistance) < 0.5 ? TRUE : FALSE;
			
			if (ableToJoinPaths == TRUE)
			{
				weight = max(0.0, dot(n, -rayDirection));
				accumCol += mask * lightHitEmission * weight;
			}

			if (willNeedReflectionRay == TRUE)
			{
				mask = reflectionMask;
				rayOrigin = reflectionRayOrigin;
				rayDirection = reflectionRayDirection;

				willNeedReflectionRay = FALSE;
				bounceIsSpecular = TRUE;
				sampleLight = FALSE;
				isReflectionTime = TRUE;
				continue;
			}
			break;
		}

		// Shadow ray failed to find light (occluded)
		if (sampleLight == TRUE)
		{
			if (willNeedReflectionRay == TRUE)
			{
				mask = reflectionMask;
				rayOrigin = reflectionRayOrigin;
				rayDirection = reflectionRayDirection;

				willNeedReflectionRay = FALSE;
				bounceIsSpecular = TRUE;
				sampleLight = FALSE;
				isReflectionTime = TRUE;
				continue;
			}
			break;
		}

		// Store surface properties before branching
		vec3 surfaceColor = hitColor;
		float surfaceMetalness = hitMetalness;
		float surfaceRoughness = hitRoughness;
		float surfaceOpacity = hitOpacity;
		int surfaceType = hitType;
		
		// TEXTURE SAMPLING
		if (hitAlbedoTextureID >= 0 && hitAlbedoTextureID < 8) {
			if (hitAlbedoTextureID == 0) surfaceColor *= texture(tAlbedoTextures[0], hitUV).rgb;
			else if (hitAlbedoTextureID == 1) surfaceColor *= texture(tAlbedoTextures[1], hitUV).rgb;
			else if (hitAlbedoTextureID == 2) surfaceColor *= texture(tAlbedoTextures[2], hitUV).rgb;
			else if (hitAlbedoTextureID == 3) surfaceColor *= texture(tAlbedoTextures[3], hitUV).rgb;
			else if (hitAlbedoTextureID == 4) surfaceColor *= texture(tAlbedoTextures[4], hitUV).rgb;
			else if (hitAlbedoTextureID == 5) surfaceColor *= texture(tAlbedoTextures[5], hitUV).rgb;
			else if (hitAlbedoTextureID == 6) surfaceColor *= texture(tAlbedoTextures[6], hitUV).rgb;
			else if (hitAlbedoTextureID == 7) surfaceColor *= texture(tAlbedoTextures[7], hitUV).rgb;
		}
		
		if (surfaceOpacity < 0.99 && length(surfaceColor) < 0.1) {
			surfaceColor = max(surfaceColor, vec3(0.9));
		}

		// === GLASS/TRANSPARENT MATERIAL ===
		if (surfaceOpacity < 0.99)
		{
			bounceIsSpecular = TRUE;
			
			float ior = 1.5;
			float nc = 1.0;
			float nt = ior;
			
			vec3 glassN = nl;
			vec3 refractionNormal = n;
			bool entering = dot(n, -rayDirection) > 0.0;

			// Thin glass detection
			bool isThinGlass = false;
			if (entering) {
				vec3 testRayOrigin = x - refractionNormal * epsIntersect;
				vec3 testRayDirection = rayDirection;
				vec3 savedOrigin = rayOrigin;
				vec3 savedDirection = rayDirection;
				
				rayOrigin = testRayOrigin;
				rayDirection = testRayDirection;
				float testT = SceneIntersect(sampleLight);
				
				rayOrigin = savedOrigin;
				rayDirection = savedDirection;
				
				if (testT < 0.05) {
					isThinGlass = true;
				}
			}

			if (isThinGlass) {
				float cosThetaI = abs(dot(-rayDirection, glassN));
				float Rs = (nc - nt) / (nc + nt);
				float reflectance = Rs * Rs + (1.0 - Rs * Rs) * pow(1.0 - cosThetaI, 5.0);
				
				if (rand() < reflectance) {
					rayDirection = reflect(rayDirection, glassN);
					rayOrigin = x + glassN * epsIntersect;
					mask *= surfaceColor * reflectance;
				} else {
					rayDirection = rayDirection;
					rayOrigin = x + rayDirection * (epsIntersect * 3.0);
					mask *= surfaceColor * (1.0 - reflectance);
				}
			}
			else {
				if (!entering) {
					float tmp = nc;
					nc = nt;
					nt = tmp;
				}

				float eta = nc / nt;
				float cosThetaI = abs(dot(rayDirection, glassN));
				float sin2ThetaT = eta * eta * (1.0 - cosThetaI * cosThetaI);

				if (sin2ThetaT > 1.0) {
					rayDirection = reflect(rayDirection, glassN);
					rayOrigin = x + glassN * epsIntersect;
					mask *= surfaceColor;
				}
				else {
					float cosThetaT = sqrt(1.0 - sin2ThetaT);
					float Rs = (nc * cosThetaI - nt * cosThetaT) / (nc * cosThetaI + nt * cosThetaT);
					float Rp = (nt * cosThetaI - nc * cosThetaT) / (nt * cosThetaI + nc * cosThetaT);
					float reflectance = (Rs * Rs + Rp * Rp) * 0.5;
					float P = 0.25 + 0.5 * reflectance;

					if (rand() < P) {
						rayDirection = reflect(rayDirection, glassN);
						rayOrigin = x + glassN * epsIntersect;
						mask *= surfaceColor * (reflectance / P);
					}
					else {
						vec3 refracted = refract(rayDirection, refractionNormal, eta);
						rayDirection = refracted;
						rayOrigin = x - refractionNormal * epsIntersect;
						mask *= surfaceColor * ((1.0 - reflectance) / (1.0 - P));
					}
				}
			}
			continue;
		}

		// === PRINCIPLED BSDF (Opaque materials) ===
		vec3 N = nl;
		vec3 V = -rayDirection;
		vec3 X = x;

		float rough = clamp(surfaceRoughness + uRoughness, 0.04, 1.0);
		vec3 F0 = mix(vec3(0.04), surfaceColor, surfaceMetalness);

		float VoN = max(dot(V, N), 0.0);
		vec3 F = F0 + (1.0 - F0) * pow(1.0 - VoN, 5.0);

		vec3 kS = F;
		vec3 kD = (1.0 - kS) * (1.0 - surfaceMetalness);

		float specularProbability = clamp(max(max(F.r, F.g), F.b), 0.05, 0.95);

		// Russian roulette path selection
		if (rand() < specularProbability)
		{
			// Specular bounce
			bounceIsSpecular = TRUE;
			vec3 R = reflect(-V, N);
			R = randomDirectionInSpecularLobe(R, rough * rough);
			rayDirection = normalize(R);
			rayOrigin = X + N * epsIntersect;
			mask *= kS / specularProbability;
		}
		else
		{
			// Diffuse bounce - shoot shadow ray to light
			bounceIsSpecular = FALSE;
			diffuseCount++;

			mask *= (kD * surfaceColor) / (1.0 - specularProbability);

			// Store reflection ray if first diffuse bounce
			if (diffuseCount == 1 && hitObjectID != previousObjectID)
			{
				reflectionMask = mask;
				reflectionRayOrigin = X + N * epsIntersect;
				reflectionRayDirection = randomCosWeightedDirectionInHemisphere(N);
				willNeedReflectionRay = TRUE;
			}

			// Shadow ray to light
			rayOrigin = X + N * epsIntersect;
			rayDirection = normalize(lightHitPos - X);
			weight = max(0.0, dot(N, rayDirection));
			mask *= weight;
			lightHitDistance = distance(rayOrigin, lightHitPos);
			sampleLight = TRUE;
		}
	}

	return max(vec3(0), accumCol);
}

void SetupScene(void)
{
	// Ground plane
	box = Box( vec3(-100000, -1, -100000), vec3(100000, 0, 100000), vec3(0), vec3(0.45), DIFF);

	// Initialize all area lights
	SetupAreaLight();
}

#include <pathtracing_main>