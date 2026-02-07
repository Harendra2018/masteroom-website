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
          <button class="tour-button" onclick="open3DTour('${property.id}')">Real 3D Tour</button>
          <button class="tour-button photoreal-button" onclick="openPhotorealView('${property.id}')">Photoreal 3D View</button>
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

function openPhotorealView(propertyId) {
  const property = properties.find(p => p.id === propertyId);
  if (!property) return;

  const taskFolder = property.taskId;

  // Show dialog for PT/BDPT selection
  showRendererDialog(taskFolder);
}

function showRendererDialog(taskFolder) {
  // Create dialog if it doesn't exist
  let dialog = document.getElementById('rendererDialog');
  if (!dialog) {
    dialog = document.createElement('div');
    dialog.id = 'rendererDialog';
    dialog.className = 'renderer-dialog';
    dialog.innerHTML = `
      <div class="renderer-dialog-content">
        <h2>Choose 3D View Type</h2>
        <p>Select how you want to view the property:</p>
        <div class="renderer-options">
          <button class="renderer-btn pt-btn" onclick="openPTView('${taskFolder}')">
            <span class="renderer-icon">☀️</span>
            <span class="renderer-title">Daylight View</span>
            <span class="renderer-desc">Path Tracer (PT)</span>
          </button>
          <button class="renderer-btn bdpt-btn" onclick="openBDPTView('${taskFolder}')">
            <span class="renderer-icon">🌙</span>
            <span class="renderer-title">Night Time View</span>
            <span class="renderer-desc">Bidirectional Path Tracer (BDPT)</span>
          </button>
        </div>
        <button class="renderer-cancel" onclick="closeRendererDialog()">Cancel</button>
      </div>
    `;
    document.body.appendChild(dialog);

    // Add styles
    const style = document.createElement('style');
    style.textContent = `
      .renderer-dialog {
        display: none;
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.7);
        z-index: 10000;
        justify-content: center;
        align-items: center;
      }
      .renderer-dialog.active {
        display: flex;
      }
      .renderer-dialog-content {
        background: white;
        padding: 30px;
        border-radius: 12px;
        text-align: center;
        max-width: 500px;
        width: 90%;
      }
      .renderer-dialog-content h2 {
        margin: 0 0 10px 0;
        color: #333;
      }
      .renderer-dialog-content p {
        color: #666;
        margin-bottom: 25px;
      }
      .renderer-options {
        display: flex;
        gap: 15px;
        justify-content: center;
        margin-bottom: 20px;
      }
      .renderer-btn {
        flex: 1;
        padding: 20px 15px;
        border: 2px solid #e0e0e0;
        border-radius: 10px;
        background: white;
        cursor: pointer;
        transition: all 0.3s ease;
      }
      .renderer-btn:hover {
        border-color: #007bff;
        transform: translateY(-3px);
        box-shadow: 0 5px 15px rgba(0, 0, 0, 0.1);
      }
      .pt-btn:hover {
        border-color: #ffc107;
      }
      .bdpt-btn:hover {
        border-color: #6f42c1;
      }
      .renderer-icon {
        display: block;
        font-size: 32px;
        margin-bottom: 10px;
      }
      .renderer-title {
        display: block;
        font-size: 16px;
        font-weight: bold;
        color: #333;
        margin-bottom: 5px;
      }
      .renderer-desc {
        display: block;
        font-size: 12px;
        color: #888;
      }
      .renderer-cancel {
        padding: 10px 30px;
        border: none;
        background: #f0f0f0;
        border-radius: 5px;
        cursor: pointer;
        font-size: 14px;
        color: #666;
      }
      .renderer-cancel:hover {
        background: #e0e0e0;
      }
    `;
    document.head.appendChild(style);
  }

  // Update task folder in dialog
  dialog.querySelector('.pt-btn').setAttribute('onclick', `openPTView('${taskFolder}')`);
  dialog.querySelector('.bdpt-btn').setAttribute('onclick', `openBDPTView('${taskFolder}')`);

  dialog.classList.add('active');
}

function closeRendererDialog() {
  const dialog = document.getElementById('rendererDialog');
  if (dialog) {
    dialog.classList.remove('active');
  }
}

function openPTView(taskFolder) {
  closeRendererDialog();
  window.location.href = `Path Tracer/PT/Path Traycer.html?taskId=${taskFolder}`;
}

function openBDPTView(taskFolder) {
  closeRendererDialog();
  window.location.href = `Path Tracer/BDPT/Path Traycer.html?taskId=${taskFolder}`;
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
    const searchInput = document.getElementById('searchInput');
    if (searchInput) searchInput.value = searchQuery;
    const mobileSearchInput = document.getElementById('mobile-search-input');
    if (mobileSearchInput) mobileSearchInput.value = searchQuery;
    searchProperties(searchQuery);
  }

  // Search form submission
  const searchForm = document.getElementById('searchForm');
  if (searchForm) {
    searchForm.addEventListener('submit', function(e) {
      e.preventDefault();
      const query = document.getElementById('searchInput').value.trim();
      searchProperties(query);
      // Update URL
      const newUrl = query ? `${window.location.pathname}?search=${encodeURIComponent(query)}` : window.location.pathname;
      window.history.pushState({}, '', newUrl);
    });
  }

  // Mobile search form submission
  const mobileSearchForm = document.getElementById('mobile-search-form');
  if (mobileSearchForm) {
    mobileSearchForm.addEventListener('submit', function(e) {
      e.preventDefault();
      const query = document.getElementById('mobile-search-input').value.trim();
      searchProperties(query);
      // Update URL
      const newUrl = query ? `${window.location.pathname}?search=${encodeURIComponent(query)}` : window.location.pathname;
      window.history.pushState({}, '', newUrl);
    });
  }
});

// Close modal when clicking outside
window.onclick = function(event) {
  const modal = document.getElementById('tourModal');
  if (event.target === modal) {
    close3DTour();
  }
}