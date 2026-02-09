// lights.js - Light Configuration for Tasks
// Copy this file to your task's models folder (e.g., MetaRoom3D/TaskID_101/models/lights.js)
// and customize the lights for that specific task

/**
 * Configure lights for the scene
 * @param {LightManager} lightManager - The light manager instance
 * @returns {Object} - References to lights for GUI controls
 */
function configureLights(lightManager) {
   
    let keyLight = new RectLight();
    keyLight.setPosition(-33, 80, 50);
    keyLight.setRotation(1.2,0,0);
    keyLight.setScale(60,0,60);
    keyLight.setColor(0.4, 0.7, 01); 
    keyLight.setIntensity(18.0);
    lightManager.addLight(keyLight);


    
    //let orbLight = new SphereLight();
    //orbLight.setPosition(-60, 80, -60);
    //orbLight.setRadius(5.0);
   // orbLight.setColor(0.0, 0.2, 1); 
   // orbLight.setIntensity(6.0);
   // lightManager.addLight(orbLight);

    
    let panelLight = new DiskLight();
    panelLight.setPosition(80, 80.1, 0);
    panelLight.setRotation(0,0,-7.8);
    panelLight.setRadius(40.0);
    panelLight.setColor(0.3, 0.7, 0.9);
    panelLight.setIntensity(10);
    lightManager.addLight(panelLight);

    // Return references for GUI controls
    return {
        keyLight: keyLight,
		//orbLight: orbLight,
		panelLight,panelLight
		
	 };
}	
    









