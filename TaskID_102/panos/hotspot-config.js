// Generated Hotspot Configuration
// This file contains hotspot data created with the Hotspot Editor

// Panorama Hotspots Data Configuration
export const hotspotData = [
  {
    theta: -3.0995,
    phi: 1.8640,
    radius: 480,
    color: 0xff6600,
    name: 'Hallway',
    panoramaImage: 'panos/Hallway.jpg',
    fromRoom: 'Bathroom'
  },
  {
    theta: 1.3184,
    phi: 1.8898,
    radius: 480,
    color: 0xff6600,
    name: 'Bathroom',
    panoramaImage: 'panos/Bathroom.jpg',
    fromRoom: 'Hallway'
  },
  {
    theta: -0.1168,
    phi: 1.7695,
    radius: 480,
    color: 0xff6600,
    name: 'Living Room',
    panoramaImage: 'panos/Living Room.jpg',
    fromRoom: 'Hallway'
  },
  {
    theta: -1.8582,
    phi: 1.7130,
    radius: 480,
    color: 0xff6600,
    name: 'Hallway',
    panoramaImage: 'panos/Hallway.jpg',
    fromRoom: 'Living Room'
  },
  {
    theta: 3.1414,
    phi: 1.8507,
    radius: 480,
    color: 0xff6600,
    name: 'Bedroom 1',
    panoramaImage: 'panos/Bedroom 1.jpg',
    fromRoom: 'Hallway'
  },
  {
    theta: -2.4687,
    phi: 1.7602,
    radius: 480,
    color: 0xff6600,
    name: 'Hallway',
    panoramaImage: 'panos/Hallway.jpg',
    fromRoom: 'Bedroom 1'
  },
  {
    theta: -2.2517,
    phi: 1.8796,
    radius: 480,
    color: 0xff6600,
    name: 'Bedroom 2',
    panoramaImage: 'panos/Bedroom 2.jpg',
    fromRoom: 'Hallway'
  },
  {
    theta: -2.7200,
    phi: 1.8061,
    radius: 480,
    color: 0xff6600,
    name: 'Hallway',
    panoramaImage: 'panos/Hallway.jpg',
    fromRoom: 'Bedroom 2'
  },
  {
    theta: -2.8743,
    phi: 1.7825,
    radius: 480,
    color: 0xff6600,
    name: 'Living Room',
    panoramaImage: 'panos/Living Room.jpg',
    fromRoom: 'Breakfast Nook'
  },
  {
    theta: 2.7977,
    phi: 1.7681,
    radius: 480,
    color: 0xff6600,
    name: 'Breakfast Nook',
    panoramaImage: 'panos/Breakfast Nook.jpg',
    fromRoom: 'Living Room'
  },
  {
    theta: 1.8644,
    phi: 1.8045,
    radius: 480,
    color: 0xff6600,
    name: 'Kitchen',
    panoramaImage: 'panos/Kitchen.jpg',
    fromRoom: 'Breakfast Nook'
  },
  {
    theta: 1.7201,
    phi: 1.8631,
    radius: 480,
    color: 0xff6600,
    name: 'Breakfast Nook',
    panoramaImage: 'panos/Breakfast Nook.jpg',
    fromRoom: 'Kitchen'
  }
];

// Room adjacency system
export const roomConnections = {
  'Bathroom': ['Hallway'],
  'Bedroom 1': ['Hallway'],
  'Bedroom 2': ['Hallway'],
  'Breakfast Nook': ['Living Room', 'Kitchen'],
  'Closet': [],
  'Hallway': ['Bathroom', 'Living Room', 'Bedroom 1', 'Bedroom 2'],
  'Kitchen': ['Breakfast Nook'],
  'Living Room': ['Hallway', 'Breakfast Nook']
};

// Available panorama images
export const availablePanoramas = [
  'panos/Bathroom.jpg',
  'panos/Bedroom 1.jpg',
  'panos/Bedroom 2.jpg',
  'panos/Breakfast Nook.jpg',
  'panos/Closet.jpg',
  'panos/Hallway.jpg',
  'panos/Kitchen.jpg',
  'panos/Living Room.jpg'
];

// 3D Model to Panorama Mapping Configuration
export const modelToPanoramaMapping = [
  {
    nodeNamePatterns: ['bathroom'],
    fallbackIndex: 0,
    panoramaImage: 'panos/Bathroom.jpg',
    displayName: 'Bathroom'
  },
  {
    nodeNamePatterns: ['bedroom_1'],
    fallbackIndex: 1,
    panoramaImage: 'panos/Bedroom 1.jpg',
    displayName: 'Bedroom 1'
  },
  {
    nodeNamePatterns: ['bedroom_2'],
    fallbackIndex: 2,
    panoramaImage: 'panos/Bedroom 2.jpg',
    displayName: 'Bedroom 2'
  },
  {
    nodeNamePatterns: ['breakfast_nook'],
    fallbackIndex: 3,
    panoramaImage: 'panos/Breakfast Nook.jpg',
    displayName: 'Breakfast Nook'
  },
  {
    nodeNamePatterns: ['closet'],
    fallbackIndex: 4,
    panoramaImage: 'panos/Closet.jpg',
    displayName: 'Closet'
  },
  {
    nodeNamePatterns: ['hallway'],
    fallbackIndex: 5,
    panoramaImage: 'panos/Hallway.jpg',
    displayName: 'Hallway'
  },
  {
    nodeNamePatterns: ['kitchen'],
    fallbackIndex: 6,
    panoramaImage: 'panos/Kitchen.jpg',
    displayName: 'Kitchen'
  },
  {
    nodeNamePatterns: ['living_room'],
    fallbackIndex: 7,
    panoramaImage: 'panos/Living Room.jpg',
    displayName: 'Living Room'
  }
];