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
const totalImages = 4;

function changeHeroImage() {
    // Remove active class from current slide
    slides[currentImageIndex].classList.remove('active');

    currentImageIndex = (currentImageIndex + 1) % totalImages;

    // Add active class to new slide
    slides[currentImageIndex].classList.add('active');

    heroImageElement.style.transform = `translateX(-${currentImageIndex * 25}%)`;
}

// Change image every 5 seconds
setInterval(changeHeroImage, 5000);

// Close modal when clicking outside the content
window.onclick = function(event) {
    const modal = document.getElementById('tourModal');
    if (event.target === modal) {
        close3DTour();
    }
}
