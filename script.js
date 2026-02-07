// Modal functionality for 3D tours

function close3DTour() {
  const modal = document.getElementById('tourModal');
  const tourFrame = document.getElementById('tourFrame');

  // Hide the modal
  modal.style.display = 'none';

  // Restore body scroll
  document.body.style.overflow = 'auto';

  // Clear the iframe source to stop the 3D viewer
  tourFrame.src = '';
}

// Enhanced tour opening with loading state
function open3DTour(propertyId) {
  const modal = document.getElementById('tourModal');
  const tourFrame = document.getElementById('tourFrame');
  const tourButton = event.target;

  // Find property by ID
  const property = properties.find(p => p.id === propertyId);
  const taskFolder = property ? property.taskId : "TaskID_default";

    // Show loading state
    const originalText = tourButton.textContent;
    tourButton.textContent = 'Loading 3D Tour...';
    tourButton.disabled = true;
    tourButton.style.opacity = '0.7';

    // Clear any existing iframe content
    tourFrame.src = '';

    // Show the modal with loading state
    modal.style.display = 'block';

    // Prevent body scroll when modal is open
    document.body.style.overflow = 'hidden';

    // Add a small delay to ensure modal is visible before loading iframe
    setTimeout(() => {
        // Pass taskFolder as query param to the viewer
        tourFrame.src = `3DViewer_v1_5_3/index.html?taskId=${taskFolder}`;

        // Restore button when iframe loads
        tourFrame.onload = function() {
            tourButton.textContent = originalText;
            tourButton.disabled = false;
            tourButton.style.opacity = '1';
        };

        // Handle iframe load errors
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

        // Close menu when clicking on a link
        const navLinks = navMenu.querySelectorAll('a');
        navLinks.forEach(link => {
            link.addEventListener('click', function() {
                navMenu.classList.remove('active');
                hamburger.classList.remove('active');
            });
        });
    }
});

// Hero image slideshow
let currentImageIndex = 0;
const heroImageElement = document.querySelector('.hero-image');
const slides = document.querySelectorAll('.slide');
const paginationDots = document.querySelectorAll('.pagination-dot');
const totalImages = 5;
let autoSlideInterval;

function updateActiveDot() {
    // Update pagination dots
    paginationDots.forEach((dot, index) => {
        dot.classList.toggle('active', index === currentImageIndex);
    });
}

function changeHeroImage(newIndex = null) {
    // Remove active class from current slide
    slides[currentImageIndex].classList.remove('active');

    if (newIndex !== null) {
        currentImageIndex = newIndex;
    } else {
        currentImageIndex = (currentImageIndex + 1) % totalImages;
    }

    // Add active class to new slide
    slides[currentImageIndex].classList.add('active');

    // Update transform
    heroImageElement.style.transform = `translateX(-${currentImageIndex * 20}%)`;

    // Update active dot
    updateActiveDot();
}

function startAutoSlide() {
    autoSlideInterval = setInterval(() => {
        changeHeroImage();
    }, 5000);
}

function stopAutoSlide() {
    if (autoSlideInterval) {
        clearInterval(autoSlideInterval);
        autoSlideInterval = null;
    }
}

function resetAutoSlide() {
    stopAutoSlide();
    startAutoSlide();
}

// Add click event listeners to pagination dots
paginationDots.forEach((dot, index) => {
    dot.addEventListener('click', () => {
        if (index !== currentImageIndex) {
            changeHeroImage(index);
            resetAutoSlide(); // Reset timer when manually navigating
        }
    });
});

// Initialize
updateActiveDot();
startAutoSlide();

// Close modal when clicking outside the content
window.onclick = function(event) {
    const modal = document.getElementById('tourModal');
    if (event.target === modal) {
        close3DTour();
    }
}
