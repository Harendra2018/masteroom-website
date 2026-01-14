// scene/demo-specific variables go here

// Rendering variables
let triangleDataTexture, aabbDataTexture;

// Environment variables

// Area lights - now using AreaLightManager
let areaLightManager = new AreaLightManager(8);

// Main area light
let mainAreaLight = new AreaLight();
mainAreaLight.setPosition(29.4, 77.1, 38.2);
mainAreaLight.setRotation(0,0.19,0);
mainAreaLight.setScale(4,1,4);
mainAreaLight.setColor(1, 0.6, 0.4); // Red-tinted
mainAreaLight.setIntensity(18.0);
areaLightManager.addLight(mainAreaLight);

// Add a second area light
let secondAreaLight = new AreaLight();
secondAreaLight.setPosition(-10, 38.1, 45.2);
secondAreaLight.setRotation(0,0.19,0);
secondAreaLight.setScale(4,1,4);
secondAreaLight.setColor(1, 0.6, 0.4); // Red-tinted
secondAreaLight.setIntensity(18.0);
areaLightManager.addLight(secondAreaLight);

// Add a third area light
let thirdAreaLight = new AreaLight();
thirdAreaLight.setPosition(-10, 90.1, 63.2);
thirdAreaLight.setRotation(0,0.19,0);
thirdAreaLight.setScale(4,1,4);
thirdAreaLight.setColor(1, 0.6, 0.4); // Red-tinted
thirdAreaLight.setIntensity(18.0);
areaLightManager.addLight(thirdAreaLight);

// Geometry variables
let meshes = [];
let triangleMaterialMarkers = [];
let pathTracingMaterialList = [];
let uniqueMaterialTextures = [];
let aabb_array;

// Constants
const loadingSpinner = document.querySelector("#loadingSpinner");
let isLoading = false;
let loadingTimerId = null;

// NEW: Add these variables for request tracking
let pendingReload = false;
let activeLoadRequest = null;
let reloadDebounceTimer = null;

/////////////////
// Model setup //
/////////////////

// Define available floor models - add more floors here as needed
const availableFloors = [
	{ name: "Floor 1", path: "models/f1.glb" },
	{ name: "Floor 2", path: "models/f2.glb" }
	// Add more floors here: { name: "Floor 3", path: "models/f3.glb" }
];

// Roof model
const roofModel = "models/roof.glb";

// Model/scene variables
let modelScale = 10.0;
let modelRotationY = .2
let modelPositionOffset = new THREE.Vector3();

// Loaders
let gltfLoader = new GLTFLoader();
let modelLoadedCount = 0;

// GUI menu variables
// Area light GUI variables

let areaLight_ColorController, areaLight_ColorObject;
let areaLightColorChanged = false;
let areaLight_IntensityController, areaLight_IntensityObject;
let areaLightIntensityChanged = false;

// Second area light GUI variables
let secondAreaLight_ColorController, secondAreaLight_ColorObject;
let secondAreaLightColorChanged = false;
let secondAreaLight_IntensityController, secondAreaLight_IntensityObject;
let secondAreaLightIntensityChanged = false;

// Third area light GUI variables
let thirdAreaLight_ColorController, thirdAreaLight_ColorObject;
let thirdAreaLightColorChanged = false;
let thirdAreaLight_IntensityController, thirdAreaLight_IntensityObject;
let thirdAreaLightIntensityChanged = false;


let floor_Controller;
let roof_Controller;
let roofChanged = false;
let aperture_Controller, aperture_Object;
let apertureChanged = false;
let focus_Controller, focus_Object;
let focusChanged = false;
let cameraSpeed_Controller, cameraSpeed_Object;
let cameraSpeedChanged = false;

// Initialize floor and roof objects early so they can be accessed before GUI is created
let floor_Object = {
	floor: "All Floors"
};
let roof_Object = {
	showRoof: true
};


function init_GUI()
{

	aperture_Object = {
		apertureSize: 0.0
	}
	focus_Object = {
		focusDistance: 100.0
	}
	cameraSpeed_Object = {
		cameraFlightSpeed: 60
	}


	// Area light controls - now controls the main light (first light in manager)

	areaLight_ColorObject = {
		areaLightColor: mainAreaLight.color
	}
	areaLight_ColorController = gui.addColor(areaLight_ColorObject, 'areaLightColor').onChange(() => {
		mainAreaLight.setColor(areaLight_ColorObject.areaLightColor[0], areaLight_ColorObject.areaLightColor[1], areaLight_ColorObject.areaLightColor[2]);
	});

	areaLight_IntensityObject = {
		areaLightIntensity: mainAreaLight.intensity
	}
	areaLight_IntensityController = gui.add(areaLight_IntensityObject, 'areaLightIntensity', 0, 100).step(0.1).onChange(() => {
		mainAreaLight.setIntensity(areaLight_IntensityObject.areaLightIntensity);
	});

	// Second area light controls
	secondAreaLight_ColorObject = {
		secondAreaLightColor: secondAreaLight.color
	}
	secondAreaLight_ColorController = gui.addColor(secondAreaLight_ColorObject, 'secondAreaLightColor').name('Second Light Color').onChange(() => {
		secondAreaLight.setColor(secondAreaLight_ColorObject.secondAreaLightColor[0], secondAreaLight_ColorObject.secondAreaLightColor[1], secondAreaLight_ColorObject.secondAreaLightColor[2]);
	});

	secondAreaLight_IntensityObject = {
		secondAreaLightIntensity: secondAreaLight.intensity
	}
	secondAreaLight_IntensityController = gui.add(secondAreaLight_IntensityObject, 'secondAreaLightIntensity', 0, 100).step(0.1).name('Second Light Intensity').onChange(() => {
		secondAreaLight.setIntensity(secondAreaLight_IntensityObject.secondAreaLightIntensity);
	});

	// Third area light controls
	thirdAreaLight_ColorObject = {
		thirdAreaLightColor: thirdAreaLight.color
	}
	thirdAreaLight_ColorController = gui.addColor(thirdAreaLight_ColorObject, 'thirdAreaLightColor').name('Third Light Color').onChange(() => {
		thirdAreaLight.setColor(thirdAreaLight_ColorObject.thirdAreaLightColor[0], thirdAreaLight_ColorObject.thirdAreaLightColor[1], thirdAreaLight_ColorObject.thirdAreaLightColor[2]);
	});

	thirdAreaLight_IntensityObject = {
		thirdAreaLightIntensity: thirdAreaLight.intensity
	}
	thirdAreaLight_IntensityController = gui.add(thirdAreaLight_IntensityObject, 'thirdAreaLightIntensity', 0, 100).step(0.1).name('Third Light Intensity').onChange(() => {
		thirdAreaLight.setIntensity(thirdAreaLight_IntensityObject.thirdAreaLightIntensity);
	});
	
	
	//Aperture Controls

	aperture_Controller = gui.add(aperture_Object, 'apertureSize', 0, 100).step(0.1).onChange(() =>
	{
		apertureChanged = true;
	});
	focus_Controller = gui.add(focus_Object, 'focusDistance', 1, 1000).step(1).onChange(() =>
	{
		focusChanged = true;
	});
	cameraSpeed_Controller = gui.add(cameraSpeed_Object, 'cameraFlightSpeed', 1, 100).step(1).onChange(() =>
	{
		cameraSpeedChanged = true;
	});

	// Floor selection - dynamically create options from availableFloors
	const floorOptions = availableFloors.map(f => f.name).concat(["All Floors"]);
	floor_Controller = gui.add(floor_Object, 'floor', floorOptions).onChange((value) => {
		console.log("Floor changed to: " + value);
		reloadModels();
	});

	// Roof toggle
	roof_Controller = gui.add(roof_Object, 'showRoof').name('Show Roof').onChange((value) => {
		console.log("Roof toggled: " + value);
		reloadModels();
	});

} // end function init_GUI()


// Helper function to get currently selected model paths
function getSelectedModelPaths() {
	let paths = [];
	
	// Add selected floor(s)
	const selectedFloor = floor_Object.floor;
	if (selectedFloor === "All Floors") {
		// Load all floors
		paths = availableFloors.map(f => f.path);
	} else {
		// Load specific floor
		const floor = availableFloors.find(f => f.name === selectedFloor);
		if (floor) {
			paths.push(floor.path);
		}
	}
	
	// Add roof if enabled
	if (roof_Object.showRoof) {
		paths.push(roofModel);
	}
	
	return paths;
}


// UPDATED: Helper function to reload models based on current GUI settings
function reloadModels() {
	// Clear any existing debounce timer
	if (reloadDebounceTimer) {
		clearTimeout(reloadDebounceTimer);
	}
	
	// If already loading, just mark that we need to reload after completion
	if (isLoading) {
		console.log("Load in progress, queueing reload request");
		pendingReload = true;
		return;
	}
	
	// Debounce rapid changes (wait 200ms for user to finish clicking)
	reloadDebounceTimer = setTimeout(() => {
		reloadDebounceTimer = null;
		// Always get fresh paths when actually starting the load
		const paths = getSelectedModelPaths();
		console.log("Reloading with paths:", paths);
		loadModels(paths);
	}, 200);
}

// NEW: Helper function to handle queued reloads
function checkPendingReload() {
	if (pendingReload) {
		console.log("Processing pending reload request with current GUI state");
		pendingReload = false;
		
		// Clear any existing debounce timer
		if (reloadDebounceTimer) {
			clearTimeout(reloadDebounceTimer);
			reloadDebounceTimer = null;
		}
		
		// Use setTimeout to avoid immediate recursion and allow GUI to update
		setTimeout(() => {
			if (!isLoading) {
				// Get fresh paths based on CURRENT GUI state
				const paths = getSelectedModelPaths();
				console.log("Starting queued reload with paths:", paths);
				loadModels(paths);
			}
		}, 150);
	}
}


function MaterialObject(material, pathTracingMaterialList)
{
	// Base color
	this.color = material.color ? material.color.clone() : new THREE.Color(1, 1, 1);

	// glTF PBR values
	this.metalness = material.metalness !== undefined ? material.metalness : 0.0;
	this.roughness = material.roughness !== undefined ? material.roughness : 0.0;
	this.opacity = material.opacity !== undefined ? material.opacity : 1.0;

	console.log("Material metalness:", this.metalness, "roughness:", this.roughness, "opacity:", this.opacity);

	this.albedoTextureID = -1; // which diffuse map to use for model's color, '-1' = no textures are used

	// =========================
	// MATERIAL TYPE MAPPING
	// =========================
	// 1 = DIFF
	// 2 = REFR
	// 3 = SPEC (METAL)

	if (this.metalness > 0.5) {
		this.type = 3; // METAL
	}
	else if (this.opacity < 1.0) {
		this.type = 2; // GLASS
	}
	else {
		this.type = 1; // DIFFUSE
	}

	pathTracingMaterialList.push(this);
}



// UPDATED: loadModels function with race condition fixes
function loadModels(modelPaths)
{
	console.log("Starting to load models: " + modelPaths);
	
	// Clear any pending debounce timer since we're starting a load now
	if (reloadDebounceTimer) {
		clearTimeout(reloadDebounceTimer);
		reloadDebounceTimer = null;
	}
	
	// If already loading, return (reloadModels will queue it)
	if (isLoading) {
		console.log("Already loading, request ignored");
		return;
	}
	
	isLoading = true;
	pendingReload = false; // Clear any pending reload since we're loading now
	
	// Generate unique ID for this load request
	activeLoadRequest = Date.now();
	const currentLoadRequest = activeLoadRequest;

	loadingTimerId = "LoadingGltf_" + currentLoadRequest;
	console.time(loadingTimerId);
	console.log(`Load request ID: ${currentLoadRequest}`);
	
	// Show the loading spinner
	loadingSpinner.classList.remove("hidden");
	
	// RESET the model loaded count
	modelLoadedCount = 0;

	meshes = [];
	pathTracingMaterialList = [];
	triangleMaterialMarkers = [];
	uniqueMaterialTextures = [];

	// Handle empty model list
	if (modelPaths.length === 0) {
		console.warn("No models to load - clearing scene");
		loadingSpinner.classList.add("hidden");
		isLoading = false;
		
		// Clear any timers
		if (reloadDebounceTimer) {
			clearTimeout(reloadDebounceTimer);
			reloadDebounceTimer = null;
		}
		
		// Clear the scene
		if (typeof pathTracingUniforms !== 'undefined') {
			// Create empty textures
			const emptyArray = new Float32Array(2048 * 2048 * 4);
			const emptyTexture = new THREE.DataTexture(
				emptyArray, 2048, 2048, THREE.RGBAFormat, THREE.FloatType
			);
			emptyTexture.needsUpdate = true;
			
			pathTracingUniforms.tTriangleTexture.value = emptyTexture;
			pathTracingUniforms.tAABBTexture.value = emptyTexture;
			pathTracingUniforms.tAlbedoTextures.value = [];
			
			sampleCounter = 0;
			cameraIsMoving = true;
		}
		
		checkPendingReload();
		return;
	}

	for (let i = 0; i < modelPaths.length; i++)
	{
		let modelPath = modelPaths[i];
		console.log(`Loading model ${modelPath}`);

		gltfLoader.load(modelPath, function (meshGroup)
		{
			console.log(`Callback received for ${modelPath} (request ${currentLoadRequest}, active: ${activeLoadRequest})`);
			
			// Check if this load request is still active
			if (currentLoadRequest !== activeLoadRequest) {
				console.log(`Ignoring callback for cancelled request ${currentLoadRequest}`);
				return;
			}
			
			console.log(`Processing model: ${modelPath}`);
			if (meshGroup.scene)
				meshGroup = meshGroup.scene;

			let matrixStack = [];
			let parent;
			matrixStack.push(new THREE.Matrix4());
			meshGroup.traverse(function (child)
			{
				if (child.isMesh)
				{
					if (parent !== undefined && parent.name !== child.parent.name)
					{
						matrixStack.pop();
						parent = undefined;
					}

					child.geometry.applyMatrix4(child.matrix.multiply(matrixStack[matrixStack.length - 1]));

					if (child.material.length > 0)
					{
						for (let i = 0; i < child.material.length; i++)
							new MaterialObject(child.material[i], pathTracingMaterialList);
					} else
					{
						new MaterialObject(child.material, pathTracingMaterialList);
					}

					if (child.geometry.groups.length > 0)
					{
						for (let i = 0; i < child.geometry.groups.length; i++)
						{
							triangleMaterialMarkers.push((triangleMaterialMarkers.length > 0 ? triangleMaterialMarkers[triangleMaterialMarkers.length - 1] : 0) + child.geometry.groups[i].count / 3);
						}
					} else
					{
						triangleMaterialMarkers.push((triangleMaterialMarkers.length > 0 ? triangleMaterialMarkers[triangleMaterialMarkers.length - 1] : 0) + child.geometry.index.count / 3);
					}

					meshes.push(child);
				} else if (child.isObject3D)
				{
					if (parent !== undefined)
						matrixStack.pop();

					let matrixPeek = new THREE.Matrix4().copy(matrixStack[matrixStack.length - 1]).multiply(child.matrix);
					matrixStack.push(matrixPeek);
					parent = child;
				}
			}); // end meshGroup.traverse(function (child)

			modelLoadedCount++;

			if (modelLoadedCount == modelPaths.length)
			{
				// Double-check this is still the active request
				if (currentLoadRequest !== activeLoadRequest) {
					console.log(`Load request ${currentLoadRequest} cancelled during completion (current: ${activeLoadRequest})`);
					isLoading = false;
					loadingSpinner.classList.add("hidden");
					return;
				}
				
				console.log(`All ${modelLoadedCount} models loaded for request ${currentLoadRequest}`);
				
				var flattenedMeshList = [].concat.apply([], meshes);
				
				try {
					// Prepare geometry for path tracing
					prepareGeometryForPT(flattenedMeshList, pathTracingMaterialList, triangleMaterialMarkers);

					// Only call init() the first time, otherwise just update the scene
					if (typeof renderer === 'undefined') {
						console.log("First load - calling init()");
						init();
					} else {
						console.log("Updating existing scene with new geometry");
						// Force update uniforms for the new geometry
						if (pathTracingUniforms.tTriangleTexture) {
							pathTracingUniforms.tTriangleTexture.value = triangleDataTexture;
							pathTracingUniforms.tTriangleTexture.value.needsUpdate = true;
						}
						if (pathTracingUniforms.tAABBTexture) {
							pathTracingUniforms.tAABBTexture.value = aabbDataTexture;
							pathTracingUniforms.tAABBTexture.value.needsUpdate = true;
						}
						if (pathTracingUniforms.tAlbedoTextures) {
							pathTracingUniforms.tAlbedoTextures.value = uniqueMaterialTextures;
						}
					}
					
					// Reset rendering
					sampleCounter = 0;
					cameraIsMoving = true;
					
					console.log(`Load request ${currentLoadRequest} completed successfully`);
				} catch (error) {
					console.error(`Error preparing geometry for request ${currentLoadRequest}:`, error);
				}

				// Hide loading spinner and show menu
				loadingSpinner.classList.add("hidden");
				gui.domElement.classList.remove("hidden");
				isLoading = false;
				
				// Check if there's a pending reload request
				console.log(`Checking for pending reloads (pending: ${pendingReload})`);
				checkPendingReload();
			}
			
		}, undefined, function (error) {
			console.error(`Error loading model ${modelPath} for request ${currentLoadRequest}:`, error);
			
			// Check if this load request is still active
			if (currentLoadRequest !== activeLoadRequest) {
				console.log(`Ignoring error for cancelled request ${currentLoadRequest}`);
				return;
			}
			
			// Still increment counter to avoid hanging
			modelLoadedCount++;
			if (modelLoadedCount == modelPaths.length) {
				console.log(`All models processed (with errors) for request ${currentLoadRequest}`);
				loadingSpinner.classList.add("hidden");
				isLoading = false;
				checkPendingReload();
			}
		}); // end gltfLoader.load()

	} // end for (let i = 0; i < modelPaths.length; i++)

} // end function loadModels(modelPaths)






function prepareGeometryForPT(meshList, pathTracingMaterialList, triangleMaterialMarkers)
{
	// Gather all geometry from the mesh list that now contains loaded models
	let geoList = [];
	for (let i = 0; i < meshList.length; i++)
		geoList.push(meshList[i].geometry);

	// Merge geometry from all models into one new mesh
	let modelMesh = new THREE.Mesh(mergeGeometries(geoList));
	if (modelMesh.geometry.index)
		modelMesh.geometry = modelMesh.geometry.toNonIndexed(); // why do we need NonIndexed geometry?

	// divide by 9 because of nonIndexed geometry (each triangle has 3 floats with each float constisting of 3 components)
	let total_number_of_triangles = modelMesh.geometry.attributes.position.array.length / 9;

	// Gather all textures from materials
	for (let i = 0; i < meshList.length; i++)
	{
		if (meshList[i].material.length > 0)
		{
			for (let j = 0; j < meshList[i].material.length; j++)
			{
				if (meshList[i].material[j].map)
					uniqueMaterialTextures.push(meshList[i].material[j].map);
			}
		} else if (meshList[i].material.map)
		{
			uniqueMaterialTextures.push(meshList[i].material.map);
		}
	}

	// Remove duplicate entries
	uniqueMaterialTextures = Array.from(new Set(uniqueMaterialTextures));

	// Assign textures to the path tracing material with the correct id
	for (let i = 0; i < meshList.length; i++)
	{
		if (meshList[i].material.length > 0)
		{
			for (let j = 0; j < meshList[i].material.length; j++)
			{
				if (meshList[i].material[j].map)
				{
					for (let k = 0; k < uniqueMaterialTextures.length; k++)
					{
						if (meshList[i].material[j].map.image.src === uniqueMaterialTextures[k].image.src)
						{
							pathTracingMaterialList[i].albedoTextureID = k;
						}
					}
				}
			}
		} else if (meshList[i].material.map)
		{
			for (let j = 0; j < uniqueMaterialTextures.length; j++)
			{
				if (meshList[i].material.map.image.src === uniqueMaterialTextures[j].image.src)
				{
					pathTracingMaterialList[i].albedoTextureID = j;
				}
			}
		}
	}

	console.log(`Loaded ${modelLoadedCount} model(s) consisting of ${total_number_of_triangles} total triangles that are using ${uniqueMaterialTextures.length} textures.`);

	console.timeEnd(loadingTimerId);



	modelMesh.geometry.rotateY(modelRotationY);

	let totalWork = new Uint32Array(total_number_of_triangles);

	// Initialize triangle and aabb arrays where 2048 = width and height of texture and 4 are the r, g, b and a components
	let triangle_array = new Float32Array(2048 * 2048 * 4);
	aabb_array = new Float32Array(2048 * 2048 * 4);

	var triangle_b_box_min = new THREE.Vector3();
	var triangle_b_box_max = new THREE.Vector3();
	var triangle_b_box_centroid = new THREE.Vector3();

	var vpa = new Float32Array(modelMesh.geometry.attributes.position.array);
	if (modelMesh.geometry.attributes.normal === undefined)
		modelMesh.geometry.computeVertexNormals();
	var vna = new Float32Array(modelMesh.geometry.attributes.normal.array);

	var modelHasUVs = false;
	if (modelMesh.geometry.attributes.uv !== undefined)
	{
		var vta = new Float32Array(modelMesh.geometry.attributes.uv.array);
		modelHasUVs = true;
	}

	let materialNumber = 0;
	for (let i = 0; i < total_number_of_triangles; i++)
	{

		triangle_b_box_min.set(Infinity, Infinity, Infinity);
		triangle_b_box_max.set(-Infinity, -Infinity, -Infinity);

		let vt0 = new THREE.Vector3();
		let vt1 = new THREE.Vector3();
		let vt2 = new THREE.Vector3();
		// record vertex texture coordinates (UVs)
		if (modelHasUVs)
		{
			vt0.set(vta[6 * i + 0], vta[6 * i + 1]);
			vt1.set(vta[6 * i + 2], vta[6 * i + 3]);
			vt2.set(vta[6 * i + 4], vta[6 * i + 5]);
		} else
		{
			vt0.set(-1, -1);
			vt1.set(-1, -1);
			vt2.set(-1, -1);
		}

		// record vertex normals
		let vn0 = new THREE.Vector3(vna[9 * i + 0], vna[9 * i + 1], vna[9 * i + 2]).normalize();
		let vn1 = new THREE.Vector3(vna[9 * i + 3], vna[9 * i + 4], vna[9 * i + 5]).normalize();
		let vn2 = new THREE.Vector3(vna[9 * i + 6], vna[9 * i + 7], vna[9 * i + 8]).normalize();

		// record vertex positions
		let vp0 = new THREE.Vector3(vpa[9 * i + 0], vpa[9 * i + 1], vpa[9 * i + 2]);
		let vp1 = new THREE.Vector3(vpa[9 * i + 3], vpa[9 * i + 4], vpa[9 * i + 5]);
		let vp2 = new THREE.Vector3(vpa[9 * i + 6], vpa[9 * i + 7], vpa[9 * i + 8]);

		vp0.multiplyScalar(modelScale);
		vp1.multiplyScalar(modelScale);
		vp2.multiplyScalar(modelScale);

		vp0.add(modelPositionOffset);
		vp1.add(modelPositionOffset);
		vp2.add(modelPositionOffset);

		//slot 0
		triangle_array[32 * i + 0] = vp0.x; // r or x
		triangle_array[32 * i + 1] = vp0.y; // g or y
		triangle_array[32 * i + 2] = vp0.z; // b or z
		triangle_array[32 * i + 3] = vp1.x; // a or w

		//slot 1
		triangle_array[32 * i + 4] = vp1.y; // r or x
		triangle_array[32 * i + 5] = vp1.z; // g or y
		triangle_array[32 * i + 6] = vp2.x; // b or z
		triangle_array[32 * i + 7] = vp2.y; // a or w

		//slot 2
		triangle_array[32 * i + 8] = vp2.z; // r or x
		triangle_array[32 * i + 9] = vn0.x; // g or y
		triangle_array[32 * i + 10] = vn0.y; // b or z
		triangle_array[32 * i + 11] = vn0.z; // a or w

		//slot 3
		triangle_array[32 * i + 12] = vn1.x; // r or x
		triangle_array[32 * i + 13] = vn1.y; // g or y
		triangle_array[32 * i + 14] = vn1.z; // b or z
		triangle_array[32 * i + 15] = vn2.x; // a or w

		//slot 4
		triangle_array[32 * i + 16] = vn2.y; // r or x
		triangle_array[32 * i + 17] = vn2.z; // g or y
		triangle_array[32 * i + 18] = vt0.x; // b or z
		triangle_array[32 * i + 19] = vt0.y; // a or w

		//slot 5
		triangle_array[32 * i + 20] = vt1.x; // r or x
		triangle_array[32 * i + 21] = vt1.y; // g or y
		triangle_array[32 * i + 22] = vt2.x; // b or z
		triangle_array[32 * i + 23] = vt2.y; // a or w

		// the remaining slots are used for PBR material properties

		if (i >= triangleMaterialMarkers[materialNumber])
			materialNumber++;

		//slot 6
		triangle_array[32 * i + 24] = pathTracingMaterialList[materialNumber].type; // r or x
		triangle_array[32 * i + 25] = pathTracingMaterialList[materialNumber].color.r; // g or y
		triangle_array[32 * i + 26] = pathTracingMaterialList[materialNumber].color.g; // b or z
		triangle_array[32 * i + 27] = pathTracingMaterialList[materialNumber].color.b; // a or w

		//slot 7
		triangle_array[32 * i + 28] = pathTracingMaterialList[materialNumber].albedoTextureID; // r or x
		triangle_array[32 * i + 29] = pathTracingMaterialList[materialNumber].opacity; // g or y
		triangle_array[32 * i + 30] = pathTracingMaterialList[materialNumber].metalness; // b or z
		triangle_array[32 * i + 31] = pathTracingMaterialList[materialNumber].roughness; // a or w

		triangle_b_box_min.copy(triangle_b_box_min.min(vp0));
		triangle_b_box_max.copy(triangle_b_box_max.max(vp0));
		triangle_b_box_min.copy(triangle_b_box_min.min(vp1));
		triangle_b_box_max.copy(triangle_b_box_max.max(vp1));
		triangle_b_box_min.copy(triangle_b_box_min.min(vp2));
		triangle_b_box_max.copy(triangle_b_box_max.max(vp2));

		triangle_b_box_centroid.copy(triangle_b_box_min).add(triangle_b_box_max).multiplyScalar(0.5);
		//triangle_b_box_centroid.copy(vp0).add(vp1).add(vp2).multiplyScalar(0.3333);

		aabb_array[9 * i + 0] = triangle_b_box_min.x;
		aabb_array[9 * i + 1] = triangle_b_box_min.y;
		aabb_array[9 * i + 2] = triangle_b_box_min.z;
		aabb_array[9 * i + 3] = triangle_b_box_max.x;
		aabb_array[9 * i + 4] = triangle_b_box_max.y;
		aabb_array[9 * i + 5] = triangle_b_box_max.z;
		aabb_array[9 * i + 6] = triangle_b_box_centroid.x;
		aabb_array[9 * i + 7] = triangle_b_box_centroid.y;
		aabb_array[9 * i + 8] = triangle_b_box_centroid.z;

		totalWork[i] = i;

	} // end for (let i = 0; i < total_number_of_triangles; i++)

	console.time("BvhGeneration");
	console.log("BvhGeneration...");

	// Build the BVH acceleration structure, which places a bounding box ('root' of the tree) around all of the
	// triangles of the entire mesh, then subdivides each box into 2 smaller boxes.  It continues until it reaches 1 triangle,
	// which it then designates as a 'leaf'
	BVH_Build_Iterative(totalWork, aabb_array);
	//console.log(buildnodes);

	console.timeEnd("BvhGeneration");

	triangleDataTexture = new THREE.DataTexture(triangle_array,
		2048,
		2048,
		THREE.RGBAFormat,
		THREE.FloatType,
		THREE.Texture.DEFAULT_MAPPING,
		THREE.ClampToEdgeWrapping,
		THREE.ClampToEdgeWrapping,
		THREE.NearestFilter,
		THREE.NearestFilter,
		1,
		THREE.NoColorSpace
	);

	triangleDataTexture.flipY = false;
	triangleDataTexture.generateMipmaps = false;
	triangleDataTexture.needsUpdate = true;

	aabbDataTexture = new THREE.DataTexture(aabb_array,
		2048,
		2048,
		THREE.RGBAFormat,
		THREE.FloatType,
		THREE.Texture.DEFAULT_MAPPING,
		THREE.ClampToEdgeWrapping,
		THREE.ClampToEdgeWrapping,
		THREE.NearestFilter,
		THREE.NearestFilter,
		1,
		THREE.NoColorSpace
	);

aabbDataTexture.flipY = false;
	aabbDataTexture.generateMipmaps = false;
	aabbDataTexture.needsUpdate = true;

	// Update uniforms with new textures
	if (!pathTracingUniforms.tTriangleTexture) {
		pathTracingUniforms.tTriangleTexture = { value: triangleDataTexture };
	} else {
		pathTracingUniforms.tTriangleTexture.value = triangleDataTexture;
	}
	if (!pathTracingUniforms.tAABBTexture) {
		pathTracingUniforms.tAABBTexture = { value: aabbDataTexture };
	} else {
		pathTracingUniforms.tAABBTexture.value = aabbDataTexture;
	}
	if (!pathTracingUniforms.tAlbedoTextures) {
		pathTracingUniforms.tAlbedoTextures = { value: uniqueMaterialTextures };
	} else {
		pathTracingUniforms.tAlbedoTextures.value = uniqueMaterialTextures;
	}
} // end function prepareGeometryForPT(meshList, pathTracingMaterialList, triangleMaterialMarkers)


// called automatically from within initTHREEjs() function (located in InitCommon.js file)
function initSceneData() 
{
	demoFragmentShaderFileName = 'Gltf_Viewer_Fragment.glsl';

	// scene/demo-specific three.js objects setup goes here
	sceneIsDynamic = false;
	edgeSharpenSpeed = 0.01;
	cameraFlightSpeed = 60;

	// pixelRatio is resolution - range: 0.5(half resolution) to 1.0(full resolution)
	pixelRatio = mouseControl ? 0.8 : 0.7; // less demanding on battery-powered mobile devices

	EPS_intersect = 0.001;

	// set camera's field of view
	worldCamera.fov = 50;
	focusDistance = 100.0;

	// position and orient camera
	cameraControlsObject.position.set(150, 20, 150);
	// turn right
	cameraControlsPitchObject.rotation.x = 0.15;
	// look downward
	cameraControlsYawObject.rotation.y = Math.PI / 4;

	// add this demo's custom menu items to the GUI
	init_GUI();

	// scene/demo-specific uniforms go here
	pathTracingUniforms.uRoughness = { value: 0.0 };

	// Initialize area light manager uniforms (replaces single light initialization)
	areaLightManager.initUniforms(pathTracingUniforms);

	// jumpstart the gui variables so that when the demo starts, all the uniforms are up to date
	apertureChanged = focusChanged = cameraSpeedChanged = true;
	// Area lights will be updated via hasChanged in the manager
} // end function initSceneData()


// called automatically from within the animate() function (located in InitCommon.js file)
function updateVariablesAndUniforms()
{
	if (apertureChanged)
	{
		apertureSize = aperture_Controller.getValue();
		pathTracingUniforms.uApertureSize.value = apertureSize;
		cameraIsMoving = true;
		apertureChanged = false;
	}

	if (focusChanged)
	{
		focusDistance = focus_Controller.getValue();
		pathTracingUniforms.uFocusDistance.value = focusDistance;
		cameraIsMoving = true;
		focusChanged = false;
	}

	if (cameraSpeedChanged)
	{
		cameraFlightSpeed = cameraSpeed_Controller.getValue();
		cameraSpeedChanged = false;
	}

	// Update area light manager instead of single light
	if (areaLightManager.hasChanged())
	{
		areaLightManager.updateUniforms(pathTracingUniforms);
		cameraIsMoving = true;
	}

	// INFO
	cameraInfoElement.innerHTML = "FOV: " + worldCamera.fov + " / Aperture: " + apertureSize.toFixed(2) + " / FocusDistance: " + focusDistance + "<br>" + "Samples: " + sampleCounter;
} // end function updateVariablesAndUniforms()


// now that the HDR image has loaded, we can load the models
const initialPaths = getSelectedModelPaths();
loadModels(initialPaths); // load models, init app, and start animating