// Core JS Application for Conveyor 3D Scroll Parallax

// 1. Configuration & Keyframes
const TOTAL_FRAMES = 300;
const IMAGE_DIR = './toWEBP (2)/';
const FRAME_PREFIX = 'ezgif-frame-';
const FRAME_PADDING = 3; // e.g. 001, 010, 100

// Hotspot coordinate configurations
// Coordinates are represented as percentages of the original image dimensions (0 to 100)
// We define keyframes and linear-interpolate between them as scroll progresses
const hotspotSpecs = {
    footpads: {
        id: 'hotspot-footpads',
        lineId: 'line-footpads',
        cardId: 'card-footpads',
        sectionId: 'section-footpads',
        side: 'left', // Which side the card is on
        startFrame: 40,
        endFrame: 130,
        keyframes: [
            { frame: 40, x: 28.5, y: 72.8 },
            { frame: 85, x: 42.1, y: 76.5 },
            { frame: 130, x: 58.2, y: 79.4 }
        ]
    },
    rail: {
        id: 'hotspot-rail',
        lineId: 'line-rail',
        cardId: 'card-rail',
        sectionId: 'section-rail',
        side: 'right',
        startFrame: 120,
        endFrame: 210,
        keyframes: [
            { frame: 120, x: 55.4, y: 52.1 },
            { frame: 165, x: 48.2, y: 50.8 },
            { frame: 210, x: 38.6, y: 49.3 }
        ]
    },
    motor: {
        id: 'hotspot-motor',
        lineId: 'line-motor',
        cardId: 'card-motor',
        sectionId: 'section-motor',
        side: 'left',
        startFrame: 195,
        endFrame: 280,
        keyframes: [
            { frame: 195, x: 72.1, y: 35.6 },
            { frame: 235, x: 64.8, y: 32.4 },
            { frame: 280, x: 55.2, y: 30.1 }
        ]
    }
};

// 2. Global Variables
const images = [];
let currentFrameIndex = 0;
let currentImageRenderRect = { x: 0, y: 0, width: 0, height: 0 };
let isCalibratorActive = false;
let loggedCoordinates = []; // Save custom clicked coordinates for easy export

// DOM Elements
const canvas = document.getElementById('scroll-canvas');
const ctx = canvas.getContext('2d');
const loader = document.getElementById('loader');
const loaderBar = document.getElementById('loader-bar');
const loaderStatus = document.getElementById('loader-status');
const frameVal = document.getElementById('frame-val');
const percentVal = document.getElementById('percent-val');
const scrollProgress = document.getElementById('scroll-progress');

// Calibrator DOM Elements
const calibrator = document.getElementById('calibrator');
const calFrame = document.getElementById('cal-frame');
const calX = document.getElementById('cal-x');
const calY = document.getElementById('cal-y');
const btnCopyCoords = document.getElementById('btn-copy-coords');

// Helper to pad numbers (e.g., 1 -> "001", 12 -> "012")
function padNumber(num, size) {
    let s = num + "";
    while (s.length < size) s = "0" + s;
    return s;
}

// 3. Image Preloader
function preloadImages() {
    let loadedCount = 0;
    
    return new Promise((resolve, reject) => {
        for (let i = 1; i <= TOTAL_FRAMES; i++) {
            const img = new Image();
            const filename = `${FRAME_PREFIX}${padNumber(i, FRAME_PADDING)}.jpg`;
            img.src = `${IMAGE_DIR}${filename}`;
            
            img.onload = () => {
                loadedCount++;
                const progress = Math.round((loadedCount / TOTAL_FRAMES) * 100);
                loaderBar.style.width = `${progress}%`;
                loaderStatus.innerText = `Loading Assets: ${progress}%`;
                
                if (loadedCount === TOTAL_FRAMES) {
                    // Preloading complete
                    setTimeout(() => {
                        loader.classList.add('fade-out');
                        resolve();
                    }, 500);
                }
            };
            
            img.onerror = (err) => {
                console.error(`Error loading frame ${i}:`, err);
                // Continue loading other frames
                loadedCount++;
                if (loadedCount === TOTAL_FRAMES) {
                    resolve();
                }
            };
            
            images.push(img);
        }
    });
}

// 4. Draw Image on Canvas (Contain Mode)
function drawImageOnCanvas(img) {
    if (!img) return;
    
    const canvasWidth = canvas.width;
    const canvasHeight = canvas.height;
    const imgWidth = img.width;
    const imgHeight = img.height;
    
    ctx.clearRect(0, 0, canvasWidth, canvasHeight);
    
    // Scale to fill canvas (cover logic)
    const imgRatio = imgWidth / imgHeight;
    const canvasRatio = canvasWidth / canvasHeight;
    let drawWidth, drawHeight, drawX, drawY;
    
    if (imgRatio < canvasRatio) {
        drawWidth = canvasWidth;
        drawHeight = canvasWidth / imgRatio;
        drawX = 0;
        drawY = (canvasHeight - drawHeight) / 2;
    } else {
        drawWidth = canvasHeight * imgRatio;
        drawHeight = canvasHeight;
        drawX = (canvasWidth - drawWidth) / 2;
        drawY = 0;
    }
    
    ctx.drawImage(img, drawX, drawY, drawWidth, drawHeight);
    
    // Store rect for coordinate mapping
    currentImageRenderRect = {
        x: drawX,
        y: drawY,
        width: drawWidth,
        height: drawHeight
    };
}

// Coordinate Interpolator between Keyframes
function getCoordinateForFrame(hotspotId, frame) {
    const spec = hotspotSpecs[hotspotId];
    if (frame < spec.startFrame || frame > spec.endFrame) return null;
    
    const keyframes = spec.keyframes;
    if (keyframes.length === 0) return null;
    
    // Boundary check
    let prev = keyframes[0];
    let next = keyframes[keyframes.length - 1];
    
    if (frame <= prev.frame) return { x: prev.x, y: prev.y };
    if (frame >= next.frame) return { x: next.x, y: next.y };
    
    // Find enclosing keyframes
    for (let i = 0; i < keyframes.length - 1; i++) {
        if (frame >= keyframes[i].frame && frame <= keyframes[i+1].frame) {
            prev = keyframes[i];
            next = keyframes[i+1];
            break;
        }
    }
    
    // Linear interpolation
    const t = (frame - prev.frame) / (next.frame - prev.frame);
    const x = prev.x + (next.x - prev.x) * t;
    const y = prev.y + (next.y - prev.y) * t;
    
    return { x, y };
}

// 5. Update Hotspot UI Positions and Connector SVGs
function updateOverlayPositions() {
    Object.keys(hotspotSpecs).forEach(key => {
        const spec = hotspotSpecs[key];
        const hotspotEl = document.getElementById(spec.id);
        const pathEl = document.getElementById(spec.lineId);
        const cardEl = document.getElementById(spec.cardId);
        
        const coords = getCoordinateForFrame(key, currentFrameIndex);
        
        if (!coords) {
            // Deactivate hotspot & path
            hotspotEl.classList.remove('active');
            pathEl.classList.remove('active');
            cardEl.classList.remove('visible');
            pathEl.setAttribute('d', '');
            return;
        }
        
        // Active
        hotspotEl.classList.add('active');
        cardEl.classList.add('visible');
        
        // Convert image percentage coordinates to canvas client coordinates
        const hx = currentImageRenderRect.x + (coords.x / 100) * currentImageRenderRect.width;
        const hy = currentImageRenderRect.y + (coords.y / 100) * currentImageRenderRect.height;
        
        // Position hotspot element
        hotspotEl.style.left = `${hx}px`;
        hotspotEl.style.top = `${hy}px`;
        
        // Find connecting point on card
        const cardRect = cardEl.getBoundingClientRect();
        let cx, cy;
        
        if (spec.side === 'left') {
            cx = cardRect.right;
            cy = cardRect.top + cardRect.height / 2;
        } else {
            cx = cardRect.left;
            cy = cardRect.top + cardRect.height / 2;
        }
        
        // Construct SVG path: horizontal to mid, vertical to card height, horizontal to card
        const midX = hx + (cx - hx) * 0.4;
        const pathData = `M ${hx} ${hy} L ${midX} ${hy} L ${midX} ${cy} L ${cx} ${cy}`;
        
        pathEl.setAttribute('d', pathData);
        pathEl.classList.add('active');
    });
}

// 6. Handle Scroll Trigger Animation
function initScrollAnimation() {
    gsap.registerPlugin(ScrollTrigger);
    
    // Main scrolling controller using scroll progress
    const scrollObj = { frame: 0 };
    
    // We bind the frame variable to scroll triggers
    gsap.to(scrollObj, {
        frame: TOTAL_FRAMES - 1,
        ease: "none",
        scrollTrigger: {
            trigger: ".scroll-sections",
            start: "top top",
            end: "bottom bottom",
            scrub: 0.2, // buttery-smooth frame changes
            onUpdate: (self) => {
                const newFrame = Math.round(scrollObj.frame);
                if (newFrame !== currentFrameIndex) {
                    currentFrameIndex = newFrame;
                    
                    // Render frame on canvas
                    drawImageOnCanvas(images[currentFrameIndex]);
                    
                    // Update numbers in indicator (if elements exist)
                    if (frameVal) frameVal.innerText = padNumber(currentFrameIndex + 1, 3);
                    if (percentVal) percentVal.innerText = `${Math.round(self.progress * 100)}%`;
                    if (scrollProgress) scrollProgress.style.width = `${self.progress * 100}%`;
                    
                    // Update overlay and connectors
                    updateOverlayPositions();
                    
                    // If calibration tool is active
                    if (isCalibratorActive) {
                        calFrame.innerText = currentFrameIndex + 1;
                    }
                }
            }
        }
    });

    // Animate Intro block out as scroll begins
    gsap.to('#intro-content', {
        opacity: 0,
        y: -50,
        scrollTrigger: {
            trigger: '#section-intro',
            start: 'top top',
            end: 'bottom top',
            scrub: true
        }
    });

    // Animate background overlay opacity (darken canvas) when scrolling into outro
    gsap.to('#canvas-overlay', {
        opacity: 1,
        scrollTrigger: {
            trigger: '#section-outro',
            start: 'top 85%',
            end: 'top 40%',
            scrub: true
        }
    });

    // Animate Outro block in near the end
    gsap.fromTo('#outro-content', 
        { opacity: 0, y: 50 },
        {
            opacity: 1,
            y: 0,
            scrollTrigger: {
                trigger: '#section-outro',
                start: 'top 80%',
                end: 'bottom bottom',
                scrub: true
            }
        }
    );
}

// 7. Click Hotspots to Scroll Smoothly to their Section
function setupInteractions() {
    Object.keys(hotspotSpecs).forEach(key => {
        const spec = hotspotSpecs[key];
        const hotspotEl = document.getElementById(spec.id);
        const sectionEl = document.getElementById(spec.sectionId);
        
        hotspotEl.addEventListener('click', () => {
            sectionEl.scrollIntoView({ behavior: 'smooth' });
        });
        
        // Hover glows card and line
        hotspotEl.addEventListener('mouseenter', () => {
            const cardEl = document.getElementById(spec.cardId);
            cardEl.style.borderColor = 'rgba(255, 255, 255, 0.35)';
            cardEl.style.boxShadow = '0 20px 40px rgba(0, 0, 0, 0.7), 0 0 40px rgba(14, 56, 236, 0.05)';
            
            const pathEl = document.getElementById(spec.lineId);
            pathEl.style.strokeWidth = '2.5';
            pathEl.style.filter = 'drop-shadow(0 0 8px #0E38EC)';
        });
        
        hotspotEl.addEventListener('mouseleave', () => {
            const cardEl = document.getElementById(spec.cardId);
            cardEl.style.borderColor = '';
            cardEl.style.boxShadow = '';
            
            const pathEl = document.getElementById(spec.lineId);
            pathEl.style.strokeWidth = '';
            pathEl.style.filter = '';
        });
    });
}

// 8. Responsive Canvas Scaling
function resizeCanvas() {
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;
    
    if (images[currentFrameIndex]) {
        drawImageOnCanvas(images[currentFrameIndex]);
    }
    updateOverlayPositions();
}

window.addEventListener('resize', resizeCanvas);

// 9. Coordinate Calibrator & Dev Tools
// Double click screen or press 'D' to toggle
function toggleCalibrator() {
    isCalibratorActive = !isCalibratorActive;
    if (isCalibratorActive) {
        calibrator.classList.add('active');
        calFrame.innerText = currentFrameIndex + 1;
    } else {
        calibrator.classList.remove('active');
    }
}

window.addEventListener('dblclick', toggleCalibrator);
window.addEventListener('keydown', (e) => {
    if (e.key.toLowerCase() === 'd') {
        toggleCalibrator();
    }
    
    // Left & Right arrow keys nudge scroll for frame-by-frame calibration
    if (isCalibratorActive) {
        if (e.key === 'ArrowRight') {
            window.scrollBy({ top: 15, behavior: 'instant' });
        } else if (e.key === 'ArrowLeft') {
            window.scrollBy({ top: -15, behavior: 'instant' });
        }
    }
});

// Canvas click logger
canvas.addEventListener('click', (e) => {
    if (!isCalibratorActive) return;
    
    const rect = canvas.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;
    
    // Map to percentage within the RENDERED IMAGE RECTANGLE
    const imgX = ((clickX - currentImageRenderRect.x) / currentImageRenderRect.width) * 100;
    const imgY = ((clickY - currentImageRenderRect.y) / currentImageRenderRect.height) * 100;
    
    // Restrict coordinates to 1 decimal place
    const roundedX = Math.round(imgX * 10) / 10;
    const roundedY = Math.round(imgY * 10) / 10;
    
    calX.innerText = `${roundedX}%`;
    calY.innerText = `${roundedY}%`;
    
    const coordObj = { frame: currentFrameIndex + 1, x: roundedX, y: roundedY };
    loggedCoordinates.push(coordObj);
    console.log(`Calibrated Point:`, coordObj);
});

btnCopyCoords.addEventListener('click', () => {
    const codeString = JSON.stringify(loggedCoordinates, null, 2);
    navigator.clipboard.writeText(codeString)
        .then(() => alert(`Copied ${loggedCoordinates.length} coordinates to clipboard!`))
        .catch(err => console.error("Could not copy:", err));
});

// 10. Initialization
async function init() {
    try {
        await preloadImages();
        
        // Initial drawing
        resizeCanvas();
        
        // Bind scroll updates
        initScrollAnimation();
        
        // Setup click & hover triggers
        setupInteractions();
        
    } catch (err) {
        console.error("Initialization failed:", err);
        loaderStatus.innerText = "Error loading files. Check network console.";
    }
}

// Start
window.addEventListener('DOMContentLoaded', init);
