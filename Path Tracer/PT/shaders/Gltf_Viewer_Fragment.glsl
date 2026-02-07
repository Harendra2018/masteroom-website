#include <pathtracing_uniforms_and_defines>

uniform vec3 uSunDirection;
uniform sampler2D tTriangleTexture;
uniform sampler2D tAABBTexture;
uniform sampler2D tAlbedoTextures[8];
uniform sampler2D tHDRTexture;
uniform float uSkyLightIntensity;
uniform float uSunLightIntensity;
uniform vec3 uSunColor;
uniform float uRoughness;

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

float SceneIntersect( )
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
		hitEmission = vec3(1, 0, 1);
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

	return t;
}

vec3 Get_HDR_Color(vec3 rayDirection)
{
	vec2 sampleUV;
	sampleUV.x = atan(rayDirection.z, rayDirection.x) * ONE_OVER_TWO_PI + 0.5;
	sampleUV.y = asin(clamp(rayDirection.y, -1.0, 1.0)) * ONE_OVER_PI + 0.5;
	
	vec3 hdr = texture( tHDRTexture, sampleUV ).rgb;
	
	// Add sun disk for visibility in reflections and camera
	float sunCosAngle = dot(rayDirection, uSunDirection);
	float sunAngularSize = 0.02; // Sun disk size
	float sunIntensity = smoothstep(sunAngularSize, sunAngularSize * 0.995, acos(sunCosAngle));
	
	// Add sun to HDR with proper intensity
	if (sunIntensity > 0.0) {
		hdr += uSunColor * uSunLightIntensity * sunIntensity * 3.0;
	}
	
	return hdr;
}

// HDR without sun disk - for metallic surfaces in shadow
vec3 Get_HDR_Color_NoSun(vec3 rayDirection)
{
	vec2 sampleUV;
	sampleUV.x = atan(rayDirection.z, rayDirection.x) * ONE_OVER_TWO_PI + 0.5;
	sampleUV.y = asin(clamp(rayDirection.y, -1.0, 1.0)) * ONE_OVER_PI + 0.5;
	
	vec3 hdr = texture( tHDRTexture, sampleUV ).rgb;
	
	return hdr;
}

vec3 CalculateRadiance( out vec3 objectNormal, out vec3 objectColor, out float objectID, out float pixelSharpness )
{
	vec3 accumCol = vec3(0.0);
	vec3 mask = vec3(1.0);
	vec3 n, nl, x;

	float t = INFINITY;
	float epsIntersect = 0.001;

	int diffuseCount = 0;
	int previousIntersecType = -100;
	float previousOpacity = 1.0;
	float previousMetalness = 0.0;  // ADDED: Track previous metalness
	hitType = -100;
	int bounceIsSpecular = TRUE;

	for (int bounces = 0; bounces < 7; bounces++)
	{
		previousIntersecType = hitType;
		previousMetalness = hitMetalness;  // ADDED: Store metalness before intersection
		t = SceneIntersect();

		if (t < INFINITY) {
			previousOpacity = hitOpacity;
		}

		
		if (t == INFINITY)
{
    if (bounces == 0)
    {
        pixelSharpness = 1.0;
        accumCol += Get_HDR_Color(rayDirection);
        break;
    }

    // Sky contributions for bounced rays
    if ((previousIntersecType == DIFF && previousMetalness < 0.5) || previousOpacity < 0.99)
    {
        // Non-metallic diffuse or transparent materials use sky light intensity
        vec3 skyContribution = mask * Get_HDR_Color(rayDirection) * uSkyLightIntensity;
        accumCol += clamp(skyContribution, vec3(0.0), vec3(2.0));
    }
    else if (previousIntersecType == SPEC || previousMetalness >= 0.5)
    {
        // FIXED: Metallic surfaces - handle Fresnel-based brightness control
        // Calculate view angle to reduce over-bright grazing reflections
        float viewDot = abs(dot(normalize(rayDirection), hitNormal));
        float fresnelDamping = mix(0.3, 1.0, viewDot); // Reduce brightness at grazing angles
        
        vec3 skyContribution = mask * Get_HDR_Color(rayDirection) * fresnelDamping;
        
        // MORE AGGRESSIVE clamping for metallic reflections
        accumCol += clamp(skyContribution, vec3(0.0), vec3(1.5));
    }
    break;
}
		// Store first hit for edge detection
		n = hitNormal;
		nl = dot(n, rayDirection) < 0.0 ? n : -n;
		x = rayOrigin + rayDirection * t;

		if (bounces == 0)
		{
			objectNormal = n;
			objectColor = hitColor;
			objectID = hitObjectID;
		}

		// Store ALL surface properties immediately after intersection BEFORE any branching
		vec3 surfaceColor = hitColor;
		float surfaceMetalness = hitMetalness;
		float surfaceRoughness = hitRoughness;
		float surfaceOpacity = hitOpacity;
		int surfaceType = hitType;
		
		// TEXTURE SAMPLING - Must happen before any material logic
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
		
		// For transparent materials with very dark colors, brighten them so texture shows
		if (surfaceOpacity < 0.99 && length(surfaceColor) < 0.1) {
			surfaceColor = max(surfaceColor, vec3(0.9));
		}

		// === GLASS/TRANSPARENT MATERIAL HANDLING ===
		if (surfaceOpacity < 0.99)
		{
			bounceIsSpecular = TRUE;
			
			float ior = 1.5;
			float nc = 1.0;
			float nt = ior;
			
			vec3 glassN = nl;
			vec3 refractionNormal = n;
			bool entering = dot(n, -rayDirection) > 0.0;

			// Detect thin glass by checking if we immediately hit another surface
			bool isThinGlass = false;
			float glassThickness = 0.0;
			if (entering) {
				vec3 testRayOrigin = x - refractionNormal * epsIntersect;
				vec3 testRayDirection = rayDirection;
				vec3 savedOrigin = rayOrigin;
				vec3 savedDirection = rayDirection;
				
				rayOrigin = testRayOrigin;
				rayDirection = testRayDirection;
				float testT = SceneIntersect();
				
				rayOrigin = savedOrigin;
				rayDirection = savedDirection;
				
				if (testT < 0.05) {
					isThinGlass = true;
					glassThickness = testT;
				}
			}

			// Get roughness for glass
			float glassRoughness = clamp(surfaceRoughness + uRoughness, 0.0, 1.0);

			// Handle alpha transparency with proper color absorption
			float alphaRandom = rand();
			
			if (isThinGlass) {
				// Thin glass approximation
				float cosThetaI = abs(dot(-rayDirection, glassN));
				float Rs = (nc - nt) / (nc + nt);
				float reflectance = Rs * Rs + (1.0 - Rs * Rs) * pow(1.0 - cosThetaI, 5.0);
				
				// Mix reflectance with opacity for proper alpha blending
				float effectiveReflectance = mix(0.0, reflectance, surfaceOpacity);
				
				if (rand() < effectiveReflectance) {
					// Reflect with roughness
					vec3 reflectedDir = reflect(rayDirection, glassN);
					if (glassRoughness > 0.001) {
						reflectedDir = randomDirectionInSpecularLobe(reflectedDir, glassRoughness * glassRoughness);
					}
					rayDirection = normalize(reflectedDir);
					rayOrigin = x + glassN * epsIntersect;
					mask *= mix(vec3(1.0), surfaceColor, surfaceOpacity) * effectiveReflectance / max(effectiveReflectance, 0.001);
				} else {
					// Pass through with color absorption based on opacity and thickness
					vec3 transmittedDir = rayDirection;
					if (glassRoughness > 0.001) {
						transmittedDir = randomDirectionInSpecularLobe(transmittedDir, glassRoughness * glassRoughness * 0.5);
					}
					rayDirection = normalize(transmittedDir);
					rayOrigin = x + rayDirection * (epsIntersect * 3.0);
					
					// Beer's law absorption - more opacity = more color absorption
					float absorptionDistance = glassThickness * 100.0; // Scale factor
					vec3 absorption = exp(-absorptionDistance * (1.0 - surfaceColor) * (surfaceOpacity * 2.0));
					mask *= absorption;
				}
			}
			else {
				// Thick glass - full refraction model
				if (!entering) {
					float tmp = nc;
					nc = nt;
					nt = tmp;
				}
				
				float eta = nc / nt;
				float cosThetaI = abs(dot(rayDirection, glassN));
				float sin2ThetaT = eta * eta * (1.0 - cosThetaI * cosThetaI);

				if (sin2ThetaT > 1.0) {
					// Total internal reflection with roughness
					vec3 reflectedDir = reflect(rayDirection, glassN);
					if (glassRoughness > 0.001) {
						reflectedDir = randomDirectionInSpecularLobe(reflectedDir, glassRoughness * glassRoughness);
					}
					rayDirection = normalize(reflectedDir);
					rayOrigin = x + glassN * epsIntersect;
					mask *= mix(vec3(1.0), surfaceColor, surfaceOpacity);
				}
				else {
					// Fresnel
					float cosThetaT = sqrt(1.0 - sin2ThetaT);
					float Rs = (nc * cosThetaI - nt * cosThetaT) / (nc * cosThetaI + nt * cosThetaT);
					float Rp = (nt * cosThetaI - nc * cosThetaT) / (nt * cosThetaI + nc * cosThetaT);
					float reflectance = (Rs * Rs + Rp * Rp) * 0.5;
					
					// Mix reflectance with opacity
					float P = 0.25 + 0.5 * mix(0.0, reflectance, surfaceOpacity);

					if (rand() < P) {
						// Reflect with roughness
						vec3 reflectedDir = reflect(rayDirection, glassN);
						if (glassRoughness > 0.001) {
							reflectedDir = randomDirectionInSpecularLobe(reflectedDir, glassRoughness * glassRoughness);
						}
						rayDirection = normalize(reflectedDir);
						rayOrigin = x + glassN * epsIntersect;
						mask *= mix(vec3(1.0), surfaceColor, surfaceOpacity) * (reflectance / max(P, 0.001));
					}
					else {
						// Refract with roughness and color absorption
						vec3 refracted = refract(rayDirection, refractionNormal, eta);
						if (glassRoughness > 0.001) {
							refracted = randomDirectionInSpecularLobe(refracted, glassRoughness * glassRoughness);
						}
						rayDirection = normalize(refracted);
						rayOrigin = x - refractionNormal * epsIntersect;
						
						// Apply color absorption through glass based on opacity
						vec3 colorFilter = mix(vec3(1.0), surfaceColor, surfaceOpacity);
						mask *= colorFilter * ((1.0 - reflectance) / max((1.0 - P), 0.001));
					}
				}
			}
			continue;
		}		

		// === PRINCIPLED BSDF (for opaque materials) ===
		vec3 N = nl;
		vec3 V = -rayDirection;
		vec3 X = x;

		float rough = clamp(surfaceRoughness + uRoughness, 0.04, 1.0);
		vec3 F0 = mix(vec3(0.04), surfaceColor, surfaceMetalness);

		// Fresnel
		float VoN = max(dot(V, N), 0.0);
		vec3 F = F0 + (1.0 - F0) * pow(1.0 - VoN, 5.0);

		// Energy conservation
		vec3 kS = F;
		vec3 kD = (1.0 - kS) * (1.0 - surfaceMetalness);

		float specularProbability = clamp(max(max(F.r, F.g), F.b), 0.05, 0.95);
		
		// === NEXT EVENT ESTIMATION (Direct Sun Lighting) ===
		// Now applies to ALL surfaces - metals will use specular BRDF component
		vec3 L = uSunDirection;
		float LoN = max(dot(L, N), 0.0);
		
		if (LoN > 0.0 && uSunLightIntensity > 0.0)
		{
			// Save ray state
			vec3 savedRayOrigin = rayOrigin;
			vec3 savedRayDirection = rayDirection;

			// Cast shadow ray
			float shadowBias = epsIntersect * (surfaceMetalness > 0.5 ? 10.0 : 2.0);
			rayOrigin = X + N * (epsIntersect * 5.2);
			rayDirection = L;
			float shadowT = SceneIntersect();

			vec3 shadowTransmission = vec3(1.0);
			bool hitOpaqueSurface = false;
			bool pathClear = true;
			int maxTransparentBounces = 4;
			
			// First check: did we hit anything at all?
			if (shadowT >= INFINITY) {
				// Clear path to sun
				pathClear = true;
			} else {
				// We hit something - trace through transparent objects
				for (int i = 0; i < maxTransparentBounces; i++) {
					if (shadowT < INFINITY) {
						// Store current hit properties IMMEDIATELY
						float currentOpacity = hitOpacity;
						vec3 currentColor = hitColor;
						float currentT = shadowT;
						
						if (currentOpacity >= 0.99) {
							// Hit opaque surface - fully blocked
							hitOpaqueSurface = true;
							shadowTransmission = vec3(0.0);
							pathClear = false;
							break;
						} else {
							// Hit transparent surface
							if (currentOpacity < 0.01) {
								// Nearly invisible - full transmission
								shadowTransmission *= vec3(1.0);
							} else {
								// Calculate transmission with color filtering
								float transmissionAmount = 1.0 - (currentOpacity * 0.6);
								vec3 colorTint = mix(vec3(1.0), currentColor, currentOpacity * 0.7);
								shadowTransmission *= colorTint * transmissionAmount;
							}
							
							// Continue ray through transparent object
							vec3 hitPoint = rayOrigin + rayDirection * currentT;
							rayOrigin = hitPoint + rayDirection * (epsIntersect * 3.0);
							shadowT = SceneIntersect();
						}
					} else {
						// No more hits - reached the sun
						pathClear = true;
						break;
					}
				}
				
				// Safety check: if we exhausted all bounces and still hitting things
				if (shadowT < INFINITY) {
					// Either we hit too many transparent layers, or we're blocked
					if (hitOpacity >= 0.99) {
						hitOpaqueSurface = true;
						shadowTransmission = vec3(0.0);
						pathClear = false;
					} else {
						// Too many transparent layers - heavily attenuate
						shadowTransmission *= 0.1;
					}
				}
			}

			// Restore ray state
			rayOrigin = savedRayOrigin;
			rayDirection = savedRayDirection;

			// STRICT CHECK: Only add light if we have a clear path AND non-zero transmission
			if (pathClear && !hitOpaqueSurface && (shadowTransmission.r > 0.001 || shadowTransmission.g > 0.001 || shadowTransmission.b > 0.001))
			{
				vec3 H = normalize(V + L);
				float HoN = max(dot(H, N), 0.0);
				float HoV = max(dot(H, V), 0.0);

				// Diffuse BRDF (automatically zero for metals via kD)
				vec3 diffuseBRDF = kD * surfaceColor * ONE_OVER_PI;

				// Specular BRDF (GGX) - this is what metals need!
				float alpha = rough * rough;
				float alpha2 = alpha * alpha;
				float denom = (HoN * HoN) * (alpha2 - 1.0) + 1.0;
				float D = alpha2 / (PI * denom * denom);

				vec3 F_H = F0 + (1.0 - F0) * pow(1.0 - HoV, 5.0);

				float k = (rough + 1.0) * (rough + 1.0) / 8.0;
				float G_V = VoN / (VoN * (1.0 - k) + k);
				float G_L = LoN / (LoN * (1.0 - k) + k);
				float G = G_V * G_L;

				vec3 specularBRDF = (D * F_H * G) / max(4.0 * VoN * LoN, 0.001);

				// Combined BRDF - kD is already zero for metals due to energy conservation
				vec3 brdf = diffuseBRDF + specularBRDF;

				vec3 directContribution = mask * brdf * uSunColor * uSunLightIntensity * LoN * shadowTransmission;
				accumCol += clamp(directContribution, vec3(0.0), vec3(5.0));
			}
		}

		// === PATH CONTINUATION (Indirect Lighting) ===
		if (rand() < specularProbability)
		{
			// Specular bounce
			bounceIsSpecular = TRUE;
			vec3 R = reflect(-V, N);
			R = randomDirectionInSpecularLobe(R, rough * rough);
			rayDirection = normalize(R);
			rayOrigin = X + N * epsIntersect;
			
			// FIXED: Dampen mask for metals to prevent over-bright accumulation
			float energyConservation = (surfaceMetalness > 0.5) ? 0.85 : 1.0;
			mask *= kS * energyConservation / specularProbability;
		}
		else
		{
			// Diffuse bounce
			bounceIsSpecular = FALSE;
			diffuseCount++;
			vec3 D = randomCosWeightedDirectionInHemisphere(N);
			rayDirection = normalize(D);
			rayOrigin = X + N * epsIntersect;
			mask *= (kD * surfaceColor) / (1.0 - specularProbability);
		}
	}

	return max(vec3(0), accumCol);
}

void SetupScene(void)
{
	// Ground plane (thin box)
	box = Box( vec3(-100000, -1, -100000), vec3(100000, 0, 100000), vec3(0), vec3(0.45), DIFF);
}

#include <pathtracing_main>
