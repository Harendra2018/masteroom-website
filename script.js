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

// Pricing plan monthly/annual toggle
document.addEventListener('DOMContentLoaded', function() {
    const pricingToggle = document.getElementById('pricingToggle');

    function syncPricingCtaLinks(period) {
        document.querySelectorAll('.pricing-cta[data-plan]').forEach(link => {
            const plan = link.dataset.plan;
            link.href = `checkout.html?plan=${plan}&period=${period}`;
        });
    }

    // Set initial links to match the default (monthly) toggle state
    syncPricingCtaLinks('monthly');

    if (pricingToggle) {
        pricingToggle.addEventListener('click', function(e) {
            const btn = e.target.closest('button[data-period]');
            if (!btn) return;

            const period = btn.dataset.period;

            pricingToggle.querySelectorAll('button').forEach(b => {
                b.classList.toggle('active', b === btn);
            });

            document.querySelectorAll('.pricing-card .price').forEach(priceEl => {
                priceEl.style.display = (priceEl.dataset.period === period) ? 'block' : 'none';
            });

            syncPricingCtaLinks(period);
        });
    }
});

// Click-to-load demo canvases (avoids loading heavy WebGL contexts on page load),
// with a Stop button to unload them again and free up GPU/CPU.
document.addEventListener('DOMContentLoaded', function() {

    function setupClickToLoadDemo({ wrapId, posterId, playBtnId, stopBtnId, title, getSrc }) {
        const wrap = document.getElementById(wrapId);
        const poster = document.getElementById(posterId);
        const playBtn = document.getElementById(playBtnId);
        const stopBtn = document.getElementById(stopBtnId);
        if (!wrap || !poster || !playBtn) return null;

        let iframe = null;

        function load() {
            if (iframe) return; // already loaded
            iframe = document.createElement('iframe');
            iframe.className = 'demo-frame';
            iframe.title = title;
            iframe.src = getSrc();
            wrap.appendChild(iframe);
            poster.style.display = 'none';
            if (stopBtn) stopBtn.hidden = false;
        }

        function unload() {
            if (!iframe) return;
            iframe.remove();
            iframe = null;
            poster.style.display = 'flex';
            if (stopBtn) stopBtn.hidden = true;
        }

        playBtn.addEventListener('click', load);
        if (stopBtn) stopBtn.addEventListener('click', unload);

        return {
            isLoaded: () => !!iframe,
            updateSrc: () => { if (iframe) iframe.src = getSrc(); }
        };
    }

    // 3D Viewer demo
    setupClickToLoadDemo({
        wrapId: 'viewerFrameWrap',
        posterId: 'viewerPoster',
        playBtnId: 'viewerPlayBtn',
        stopBtnId: 'viewerStopBtn',
        title: 'MetaRoom3D 3D Viewer Demo',
        getSrc: () => document.getElementById('viewerFrameWrap').dataset.src
    });

    // Path Tracer demo (PT/BDPT mode selectable before AND after loading)
    let ptMode = 'pt';
    const ptWrap = document.getElementById('ptFrameWrap');
    const ptToggle = document.getElementById('ptToggle');

    const ptDemo = setupClickToLoadDemo({
        wrapId: 'ptFrameWrap',
        posterId: 'ptPoster',
        playBtnId: 'ptPlayBtn',
        stopBtnId: 'ptStopBtn',
        title: 'MetaRoom3D Path Tracer Demo',
        getSrc: () => ptMode === 'bdpt' ? ptWrap.dataset.srcBdpt : ptWrap.dataset.srcPt
    });

    if (ptToggle && ptDemo) {
        ptToggle.addEventListener('click', function(e) {
            const btn = e.target.closest('button[data-mode]');
            if (!btn) return;

            ptMode = btn.dataset.mode;
            ptToggle.querySelectorAll('button').forEach(b => {
                b.classList.toggle('active', b === btn);
            });

            // If already loaded, switch it live; otherwise the chosen mode
            // is remembered for when Play is clicked.
            ptDemo.updateSrc();
        });
    }
});

// Scroll-reveal: fade/slide elements in the first time they enter the viewport
document.addEventListener('DOMContentLoaded', function() {
    const revealEls = document.querySelectorAll('.scroll-reveal');
    if (!revealEls.length) return;

    if (!('IntersectionObserver' in window)) {
        // Fallback: just show everything if the browser can't observe
        revealEls.forEach(el => el.classList.add('is-visible'));
        return;
    }

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('is-visible');
                observer.unobserve(entry.target);
            }
        });
    }, { threshold: 0.2, rootMargin: '0px 0px -60px 0px' });

    revealEls.forEach(el => observer.observe(el));
});

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

// Hero animation is now a <video> (assets/logo-hero.webm / .mp4).
// The old 192-frame PNG canvas loader was removed — it fired 192
// image requests on load and ran requestAnimationFrame forever.

// Close modal when clicking outside the content
window.onclick = function(event) {
    const modal = document.getElementById('tourModal');
    if (event.target === modal) {
        close3DTour();
    }
}