// Load properties and display them
let currentProperties = [...properties];
let filteredProperties = [...properties];

function formatPrice(price) {
  return '$' + price.toLocaleString();
}

function createPropertyCard(property) {
  return `
    <div class="property-card" data-property="${property.id}">
      <div class="property-image">
        <img src="${property.image}" alt="${property.name}">
        <div class="property-overlay">
          <button class="tour-button" onclick="open3DTour('${property.id}')">3D Tour</button>
        </div>
      </div>
      <div class="property-info">
        <h3>${property.name}</h3>
        <div class="property-price">${formatPrice(property.price)}</div>
        <div class="property-location">${property.location}</div>
        <p>${property.description}</p>
        <div class="property-details">
          <span>${property.bedrooms} Beds</span>
          <span>${property.bathrooms} Baths</span>
          <span>${property.size.toLocaleString()} sq ft</span>
        </div>
      </div>
    </div>
  `;
}

function displayProperties(properties) {
  const grid = document.getElementById('propertiesGrid');
  const noResults = document.getElementById('noResults');

  if (properties.length === 0) {
    grid.innerHTML = '';
    noResults.style.display = 'block';
  } else {
    grid.innerHTML = properties.map(createPropertyCard).join('');
    noResults.style.display = 'none';
  }
}

function applyFilters() {
  const priceMin = parseInt(document.getElementById('priceMin').value) || 0;
  const priceMax = parseInt(document.getElementById('priceMax').value) || Infinity;
  const location = document.getElementById('location').value;
  const bedrooms = document.getElementById('bedrooms').value;
  const sizeMin = parseInt(document.getElementById('sizeMin').value) || 0;
  const sizeMax = parseInt(document.getElementById('sizeMax').value) || Infinity;

  filteredProperties = properties.filter(property => {
    return property.price >= priceMin &&
           property.price <= priceMax &&
           (location === '' || property.location === location) &&
           (bedrooms === '' || property.bedrooms >= parseInt(bedrooms)) &&
           property.size >= sizeMin &&
           property.size <= sizeMax;
  });

  displayProperties(filteredProperties);
}

function clearFilters() {
  document.getElementById('priceMin').value = '';
  document.getElementById('priceMax').value = '';
  document.getElementById('location').value = '';
  document.getElementById('bedrooms').value = '';
  document.getElementById('sizeMin').value = '';
  document.getElementById('sizeMax').value = '';
  filteredProperties = [...properties];
  displayProperties(filteredProperties);
}

function searchProperties(query) {
  if (!query) {
    filteredProperties = [...properties];
  } else {
    filteredProperties = properties.filter(property =>
      property.name.toLowerCase().includes(query.toLowerCase())
    );
  }
  displayProperties(filteredProperties);
}

// Modal functionality for 3D tours
function close3DTour() {
  const modal = document.getElementById('tourModal');
  const tourFrame = document.getElementById('tourFrame');

  modal.style.display = 'none';
  document.body.style.overflow = 'auto';
  tourFrame.src = '';
}

function open3DTour(propertyId) {
  const modal = document.getElementById('tourModal');
  const tourFrame = document.getElementById('tourFrame');
  const tourButton = event.target;

  const property = properties.find(p => p.id === propertyId);
  if (!property) return;

  const taskFolder = property.taskId;

  const originalText = tourButton.textContent;
  tourButton.textContent = 'Loading 3D Tour...';
  tourButton.disabled = true;
  tourButton.style.opacity = '0.7';

  tourFrame.src = '';

  modal.style.display = 'block';
  document.body.style.overflow = 'hidden';

  setTimeout(() => {
    tourFrame.src = `3DViewer_v1_5_3/index.html?taskId=${taskFolder}`;

    tourFrame.onload = function() {
      tourButton.textContent = originalText;
      tourButton.disabled = false;
      tourButton.style.opacity = '1';
    };

    tourFrame.onerror = function() {
      tourButton.textContent = 'Error loading tour';
      tourButton.disabled = false;
      tourButton.style.opacity = '1';
      setTimeout(() => {
        close3DTour();
        alert('Failed to load 3D tour. Please try again.');
      }, 2000);
    };
  }, 300);
}

// Hamburger menu functionality
document.addEventListener('DOMContentLoaded', function() {
  const hamburger = document.querySelector('.hamburger');
  const navMenu = document.querySelector('.nav-menu');

  if (hamburger && navMenu) {
    hamburger.addEventListener('click', function() {
      navMenu.classList.toggle('active');
      hamburger.classList.toggle('active');
    });

    const navLinks = navMenu.querySelectorAll('a');
    navLinks.forEach(link => {
      link.addEventListener('click', function() {
        navMenu.classList.remove('active');
        hamburger.classList.remove('active');
      });
    });
  }

  // Load initial properties
  displayProperties(properties);

  // Apply filters button
  document.getElementById('applyFilters').addEventListener('click', applyFilters);

  // Clear filters button
  document.getElementById('clearFilters').addEventListener('click', clearFilters);

  // Search from URL params
  const urlParams = new URLSearchParams(window.location.search);
  const searchQuery = urlParams.get('search');
  if (searchQuery) {
    document.getElementById('searchInput').value = searchQuery;
    searchProperties(searchQuery);
  }

  // Search form submission
  document.getElementById('searchForm').addEventListener('submit', function(e) {
    e.preventDefault();
    const query = document.getElementById('searchInput').value.trim();
    searchProperties(query);
    // Update URL
    const newUrl = query ? `${window.location.pathname}?search=${encodeURIComponent(query)}` : window.location.pathname;
    window.history.pushState({}, '', newUrl);
  });
});

// Close modal when clicking outside
window.onclick = function(event) {
  const modal = document.getElementById('tourModal');
  if (event.target === modal) {
    close3DTour();
  }
}