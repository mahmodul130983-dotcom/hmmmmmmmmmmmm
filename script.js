// Video
const videoElement = document.querySelector(".input_video");

// Canvas
const bgCanvas = document.getElementById("bgCanvas");
const effectCanvas = document.getElementById("effectCanvas");

const bgCtx = bgCanvas.getContext("2d");
const ctx = effectCanvas.getContext("2d");

// UI
const fpsUI = document.getElementById("fps");
const handsUI = document.getElementById("handsCount");
const gestureUI = document.getElementById("gestureName");
const energyUI = document.getElementById("energyValue");

const loadingScreen = document.getElementById("loadingScreen");
const startBtn = document.getElementById("startBtn");

let width = window.innerWidth;
let height = window.innerHeight;

bgCanvas.width = width;
bgCanvas.height = height;

effectCanvas.width = width;
effectCanvas.height = height;

// =======================================
// GLOBAL VARIABLES
// =======================================

let currentHands = [];
let particles = [];
let shockwaves = [];
let stars = [];

let animationTime = 0;

let fpsCounter = 0;
let fps = 0;
let lastFPSUpdate = performance.now();

let portalEnergy = 0;

let audioCtx = null;

const FINGER_TIPS = [4, 8, 12, 16, 20];

// =======================================
// THEMES
// =======================================

const THEMES = {

    cosmic: {
        primary: "#8c6fff",
        secondary: "#00d9ff",
        glow: "#a78bff"
    },

    ice: {
        primary: "#4cc9f0",
        secondary: "#caf0f8",
        glow: "#90e0ef"
    },

    fire: {
        primary: "#ff4d4d",
        secondary: "#ffb703",
        glow: "#ff7b00"
    },

    matrix: {
        primary: "#00ff66",
        secondary: "#00ffcc",
        glow: "#66ff99"
    }

};

let currentTheme = "cosmic";

// =======================================
// WINDOW RESIZE
// =======================================

function resizeCanvas() {

    width = window.innerWidth;
    height = window.innerHeight;

    bgCanvas.width = width;
    bgCanvas.height = height;

    effectCanvas.width = width;
    effectCanvas.height = height;

}

window.addEventListener("resize", resizeCanvas);

// =======================================
// THEME SWITCHING
// =======================================

document.querySelectorAll(".theme").forEach(button => {

    button.addEventListener("click", () => {

        document
            .querySelectorAll(".theme")
            .forEach(btn => btn.classList.remove("active"));

        button.classList.add("active");

        currentTheme = button.dataset.theme;

    });

});

// =======================================
// UTILITY FUNCTIONS
// =======================================

function mapPoint(point) {

    return {
        x: point.x * width,
        y: point.y * height
    };

}

function distance(a, b) {

    const dx = a.x - b.x;
    const dy = a.y - b.y;

    return Math.sqrt(dx * dx + dy * dy);

}

function random(min, max) {

    return Math.random() * (max - min) + min;

}

// =======================================
// STARFIELD BACKGROUND
// =======================================

function createStars() {

    stars = [];

    for (let i = 0; i < 200; i++) {

        stars.push({

            x: Math.random() * width,
            y: Math.random() * height,

            size: Math.random() * 2.5,

            speed: Math.random() * 0.8 + 0.1,

            alpha: Math.random()

        });

    }

}

createStars();

// =======================================
// AUDIO ENGINE
// =======================================

function initAudio() {

    try {

        audioCtx =
            new (
                window.AudioContext ||
                window.webkitAudioContext
            )();

    } catch (err) {

        console.log(err);

    }

}

// =======================================
// MEDIA PIPE HANDS
// =======================================

let hands;
async function startCamera() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: "user" },
            audio: false
        });

        videoElement.srcObject = stream;
        await videoElement.play();

        console.log("Camera Started");

    } catch (err) {
        console.error(err);
    }
}
async function initHandTracking() {

    hands = new Hands({

        locateFile: (file) => {

            return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;

        }

    });

    hands.setOptions({

        maxNumHands: 2,

        modelComplexity: 1,

        minDetectionConfidence: 0.7,

        minTrackingConfidence: 0.7

    });

    hands.onResults(onResults);

    const camera = new Camera(videoElement, {

        onFrame: async () => {

            await hands.send({

                image: videoElement

            });

        },

        width: 1280,
        height: 720

    });

    camera.start();

}

// =======================================
// MEDIAPIPE RESULTS
// =======================================

function onResults(results) {

    currentHands = [];

    if (results.multiHandLandmarks) {

        results.multiHandLandmarks.forEach(hand => {

            currentHands.push(hand);

        });

    }

    handsUI.textContent = currentHands.length;

}

// =======================================
// START BUTTON
// =======================================

startBtn.addEventListener("click", async () => {

    loadingScreen.style.display = "none";

    document.getElementById("hud").classList.add("show");
    document.getElementById("themes").classList.add("show");

    initAudio();

    await startCamera(); 
    await initHandTracking();

});
let currentGesture = "None";

let pinchActive = false;
let openPalmActive = false;

let leftHandCenter = null;
let rightHandCenter = null;

// =======================================
// HAND CENTER
// =======================================

function getHandCenter(hand) {

    let x = 0;
    let y = 0;

    hand.forEach(point => {

        x += point.x;
        y += point.y;

    });

    return {

        x: x / hand.length,
        y: y / hand.length

    };

}

// =======================================
// PINCH DETECTION
// Thumb Tip = 4
// Index Tip = 8
// =======================================

function detectPinch(hand) {

    const thumb = hand[4];
    const index = hand[8];

    const pinchDistance =
        distance(thumb, index);

    return pinchDistance < 0.05;

}

// =======================================
// OPEN PALM DETECTION
// =======================================

function detectOpenPalm(hand) {

    const wrist = hand[0];

    const indexTip = hand[8];
    const middleTip = hand[12];
    const ringTip = hand[16];
    const pinkyTip = hand[20];

    const d1 = distance(wrist, indexTip);
    const d2 = distance(wrist, middleTip);
    const d3 = distance(wrist, ringTip);
    const d4 = distance(wrist, pinkyTip);

    return (
        d1 > 0.22 &&
        d2 > 0.24 &&
        d3 > 0.22 &&
        d4 > 0.20
    );

}

// =======================================
// FIST DETECTION
// =======================================

function detectFist(hand) {

    const wrist = hand[0];

    const indexTip = hand[8];
    const middleTip = hand[12];
    const ringTip = hand[16];
    const pinkyTip = hand[20];

    const avg = (

        distance(wrist, indexTip) +
        distance(wrist, middleTip) +
        distance(wrist, ringTip) +
        distance(wrist, pinkyTip)

    ) / 4;

    return avg < 0.15;

}

// =======================================
// ENERGY CALCULATION
// =======================================

function calculateEnergy() {

    if (!currentHands.length) {

        portalEnergy *= 0.96;

        return;
    }

    let totalSpread = 0;

    currentHands.forEach(hand => {

        const thumb = hand[4];
        const pinky = hand[20];

        totalSpread +=
            distance(thumb, pinky);

    });

    portalEnergy =
        Math.min(
            totalSpread * 120,
            100
        );

}

// =======================================
// UPDATE GESTURES
// =======================================

function updateGestures() {

    if (currentHands.length === 0) {

        currentGesture = "No Hand";

        gestureUI.textContent =
            currentGesture;

        return;
    }

    let detected = "Tracking";

    currentHands.forEach(hand => {

        if (detectPinch(hand)) {

            detected = "Pinch";

            pinchActive = true;

        }

        else {

            pinchActive = false;

        }

        if (detectOpenPalm(hand)) {

            detected = "Open Palm";

            openPalmActive = true;

        }

        else {

            openPalmActive = false;

        }

        if (detectFist(hand)) {

            detected = "Fist";

        }

    });

    currentGesture = detected;

    gestureUI.textContent =
        currentGesture;

}

// =======================================
// TWO HAND ANALYSIS
// =======================================

let twoHandDistance = 0;

function updateTwoHands() {

    if (
        currentHands.length < 2
    ) {

        twoHandDistance = 0;

        return;

    }

    leftHandCenter =
        getHandCenter(
            currentHands[0]
        );

    rightHandCenter =
        getHandCenter(
            currentHands[1]
        );

    twoHandDistance =
        distance(
            leftHandCenter,
            rightHandCenter
        );

}

// =======================================
// ENERGY DISPLAY
// =======================================

function updateEnergyUI() {

    energyUI.textContent =
        Math.floor(
            portalEnergy
        ) + "%";

}

// =======================================
// UPDATE FPS
// =======================================

function updateFPS(timestamp) {

    fpsCounter++;

    if (
        timestamp >
        lastFPSUpdate + 1000
    ) {

        fps = fpsCounter;

        fpsCounter = 0;

        lastFPSUpdate =
            timestamp;

        fpsUI.textContent =
            fps;

    }

}

// =======================================
// MASTER UPDATE
// =======================================

function updateSystem(timestamp) {

    updateFPS(timestamp);

    calculateEnergy();

    updateGestures();

    updateTwoHands();

    updateEnergyUI();

}
function createParticle(x, y, color) {

    particles.push({

        x,
        y,

        vx: random(-2.5, 2.5),
        vy: random(-2.5, 2.5),

        size: random(2, 6),

        life: 1,

        color

    });

}

// ---------------------------------------
// PARTICLE BURST
// ---------------------------------------

function createBurst(x, y, color) {

    for (let i = 0; i < 25; i++) {

        particles.push({

            x,
            y,

            vx: random(-6, 6),
            vy: random(-6, 6),

            size: random(2, 8),

            life: 1,

            color

        });

    }

}

// ---------------------------------------
// SHOCKWAVE
// ---------------------------------------

function createShockwave(x, y, color) {

    shockwaves.push({

        x,
        y,

        radius: 0,

        maxRadius: random(
            120,
            260
        ),

        life: 1,

        color

    });

}

// ---------------------------------------
// ENERGY RING
// ---------------------------------------

function drawEnergyRing(x, y, radius) {

    const theme =
        THEMES[currentTheme];

    ctx.save();

    ctx.beginPath();

    ctx.arc(
        x,
        y,
        radius,
        0,
        Math.PI * 2
    );

    ctx.strokeStyle =
        theme.secondary;

    ctx.lineWidth = 4;

    ctx.shadowBlur = 25;

    ctx.shadowColor =
        theme.secondary;

    ctx.stroke();

    ctx.restore();

}

// ---------------------------------------
// FINGER PARTICLES
// ---------------------------------------

function generateFingerParticles() {

    if (!currentHands.length)
        return;

    const theme =
        THEMES[currentTheme];

    currentHands.forEach(hand => {

        FINGER_TIPS.forEach(index => {

            const point =
                mapPoint(
                    hand[index]
                );

            if (
                Math.random() > 0.4
            ) {

                createParticle(

                    point.x,
                    point.y,

                    theme.secondary

                );

            }

        });

    });

}

// ---------------------------------------
// PINCH EFFECT
// ---------------------------------------

let previousPinch = false;

function updatePinchEffects() {

    let pinchNow = false;

    currentHands.forEach(hand => {

        if (
            detectPinch(hand)
        ) {

            pinchNow = true;

            const thumb =
                mapPoint(
                    hand[4]
                );

            const index =
                mapPoint(
                    hand[8]
                );

            const centerX =
                (
                    thumb.x +
                    index.x
                ) / 2;

            const centerY =
                (
                    thumb.y +
                    index.y
                ) / 2;

            if (
                !previousPinch
            ) {

                const theme =
                    THEMES[
                        currentTheme
                    ];

                createBurst(

                    centerX,
                    centerY,

                    theme.primary

                );

                createShockwave(

                    centerX,
                    centerY,

                    theme.secondary

                );

            }

        }

    });

    previousPinch =
        pinchNow;

}

// ---------------------------------------
// PORTAL EFFECT
// ---------------------------------------

function drawPortal() {

    if (
        currentHands.length < 2
    )
        return;

    const theme =
        THEMES[currentTheme];

    const centerX =
        (
            mapPoint(
                leftHandCenter
            ).x +

            mapPoint(
                rightHandCenter
            ).x
        ) / 2;

    const centerY =
        (
            mapPoint(
                leftHandCenter
            ).y +

            mapPoint(
                rightHandCenter
            ).y
        ) / 2;

    const portalSize =
        Math.max(
            40,
            350 -
            (
                twoHandDistance *
                300
            )
        );

    ctx.save();

    ctx.beginPath();

    ctx.arc(

        centerX,
        centerY,

        portalSize,

        0,
        Math.PI * 2

    );

    ctx.strokeStyle =
        theme.primary;

    ctx.lineWidth = 6;

    ctx.shadowBlur = 40;

    ctx.shadowColor =
        theme.primary;

    ctx.stroke();

    ctx.restore();

    drawEnergyRing(

        centerX,
        centerY,

        portalSize + 20

    );

}

// ---------------------------------------
// UPDATE PARTICLES
// ---------------------------------------

function updateParticles() {

    for (

        let i =
            particles.length - 1;

        i >= 0;

        i--

    ) {

        const p =
            particles[i];

        p.x += p.vx;
        p.y += p.vy;

        p.life -= 0.02;

        p.size *= 0.99;

        if (
            p.life <= 0
        ) {

            particles.splice(
                i,
                1
            );

            continue;
        }

        ctx.save();

        ctx.globalAlpha =
            p.life;

        ctx.beginPath();

        ctx.arc(

            p.x,
            p.y,

            p.size,

            0,
            Math.PI * 2

        );

        ctx.fillStyle =
            p.color;

        ctx.shadowBlur = 20;

        ctx.shadowColor =
            p.color;

        ctx.fill();

        ctx.restore();

    }

}

// ---------------------------------------
// UPDATE SHOCKWAVES
// ---------------------------------------

function updateShockwaves() {

    for (

        let i =
            shockwaves.length - 1;

        i >= 0;

        i--

    ) {

        const s =
            shockwaves[i];

        s.radius += 8;

        s.life -= 0.02;

        if (
            s.life <= 0
        ) {

            shockwaves.splice(
                i,
                1
            );

            continue;
        }

        ctx.save();

        ctx.globalAlpha =
            s.life;

        ctx.beginPath();

        ctx.arc(

            s.x,
            s.y,

            s.radius,

            0,
            Math.PI * 2

        );

        ctx.lineWidth = 5;

        ctx.strokeStyle =
            s.color;

        ctx.shadowBlur = 30;

        ctx.shadowColor =
            s.color;

        ctx.stroke();

        ctx.restore();

    }

}

// ---------------------------------------
// DRAW HAND GLOW
// ---------------------------------------

function drawFingerGlow() {

    const theme =
        THEMES[currentTheme];

    currentHands.forEach(hand => {

        FINGER_TIPS.forEach(index => {

            const point =
                mapPoint(
                    hand[index]
                );

            ctx.save();

            ctx.beginPath();

            ctx.arc(

                point.x,
                point.y,

                12,

                0,
                Math.PI * 2

            );

            ctx.fillStyle =
                theme.secondary;

            ctx.shadowBlur = 35;

            ctx.shadowColor =
                theme.secondary;

            ctx.fill();

            ctx.restore();

        });

    });

}

// =======================================
// EFFECT UPDATE
// =======================================

function updateEffects() {

    generateFingerParticles();

    updatePinchEffects();

    updateParticles();

    updateShockwaves();

    drawFingerGlow();

    drawPortal();

}

function drawBackground() {

    bgCtx.fillStyle = "rgba(4,6,15,0.25)";
    bgCtx.fillRect(
        0,
        0,
        width,
        height
    );

    const theme =
        THEMES[currentTheme];

    stars.forEach(star => {

        star.y += star.speed;

        if (
            star.y > height
        ) {

            star.y = -10;
            star.x =
                Math.random() *
                width;

        }

        bgCtx.save();

        bgCtx.globalAlpha =
            star.alpha;

        bgCtx.beginPath();

        bgCtx.arc(

            star.x,
            star.y,

            star.size,

            0,
            Math.PI * 2

        );

        bgCtx.fillStyle =
            theme.secondary;

        bgCtx.shadowBlur = 12;

        bgCtx.shadowColor =
            theme.secondary;

        bgCtx.fill();

        bgCtx.restore();

    });

}

// ---------------------------------------
// AUDIO REACTOR
// ---------------------------------------

let humOscillator = null;
let humGain = null;

function startHumSound() {

    if (!audioCtx)
        return;

    humOscillator =
        audioCtx.createOscillator();

    humGain =
        audioCtx.createGain();

    humOscillator.type =
        "sine";

    humOscillator.frequency.value =
        100;

    humGain.gain.value =
        0.01;

    humOscillator.connect(
        humGain
    );

    humGain.connect(
        audioCtx.destination
    );

    humOscillator.start();

}

function updateAudio() {

    if (
        !humOscillator ||
        !humGain
    )
        return;

    const freq =
        80 +
        portalEnergy * 4;

    const volume =
        0.01 +
        (
            portalEnergy / 100
        ) * 0.08;

    humOscillator.frequency
        .setTargetAtTime(

            freq,

            audioCtx.currentTime,

            0.1

        );

    humGain.gain
        .setTargetAtTime(

            volume,

            audioCtx.currentTime,

            0.1

        );

}

// ---------------------------------------
// HAND CONNECTIONS
// ---------------------------------------

function drawHandConnections() {

    const theme =
        THEMES[currentTheme];

    currentHands.forEach(hand => {

        for (

            let i = 0;

            i < FINGER_TIPS.length;

            i++

        ) {

            const p1 =
                mapPoint(
                    hand[0]
                );

            const p2 =
                mapPoint(
                    hand[
                        FINGER_TIPS[i]
                    ]
                );

            ctx.save();

            ctx.beginPath();

            ctx.moveTo(
                p1.x,
                p1.y
            );

            ctx.lineTo(
                p2.x,
                p2.y
            );

            ctx.strokeStyle =
                theme.primary;

            ctx.lineWidth = 2;

            ctx.shadowBlur = 15;

            ctx.shadowColor =
                theme.primary;

            ctx.stroke();

            ctx.restore();

        }

    });

}

// ---------------------------------------
// ENERGY FIELD
// ---------------------------------------

function drawEnergyField() {

    if (
        currentHands.length === 0
    )
        return;

    const theme =
        THEMES[currentTheme];

    currentHands.forEach(hand => {

        const center =
            mapPoint(
                getHandCenter(
                    hand
                )
            );

        const radius =
            40 +
            portalEnergy;

        ctx.save();

        const gradient =
            ctx.createRadialGradient(

                center.x,
                center.y,
                10,

                center.x,
                center.y,
                radius

            );

        gradient.addColorStop(
            0,
            theme.secondary
        );

        gradient.addColorStop(
            1,
            "transparent"
        );

        ctx.globalAlpha =
            0.15;

        ctx.fillStyle =
            gradient;

        ctx.beginPath();

        ctx.arc(

            center.x,
            center.y,

            radius,

            0,
            Math.PI * 2

        );

        ctx.fill();

        ctx.restore();

    });

}

// ---------------------------------------
// MAIN DRAW
// ---------------------------------------

function drawFrame() {

    ctx.clearRect(
        0,
        0,
        width,
        height
    );

    drawEnergyField();

    drawHandConnections();

    updateEffects();

}

// ---------------------------------------
// MAIN LOOP
// ---------------------------------------

function animate(timestamp) {

    animationTime += 0.01;

    drawBackground();

    updateSystem(
        timestamp
    );

    updateAudio();

    drawFrame();

    requestAnimationFrame(
        animate
    );

}

// ---------------------------------------
// START EVERYTHING
// ---------------------------------------

function launchExperience() {

    startHumSound();

    requestAnimationFrame(
        animate
    );

}

// ---------------------------------------
// START BUTTON EXTENSION
// ---------------------------------------

startBtn.addEventListener(
    "click",

    () => {

        setTimeout(() => {

            launchExperience();

        }, 1000);

    }

);
