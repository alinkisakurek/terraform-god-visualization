const ROWS = 30;
const COLS = 30;
const TILE = 16;
const SCALE = 2;
const DRAW_TILE = TILE * SCALE;

const canvas = document.getElementById("map");
const ctx = canvas.getContext("2d", { alpha: true });
ctx.imageSmoothingEnabled = false;

canvas.width = COLS * DRAW_TILE;
canvas.height = ROWS * DRAW_TILE;

// --- Element Selectors ---
const agentSprite = document.getElementById("agentSprite");
const annealingSprite = document.getElementById("annealingAgentSprite"); 
const agentPosEl = document.getElementById("agentPos");
const saPosEl = document.getElementById("saPos"); 
const saTempDisplay = document.getElementById("saTempDisplay");
const startAreaEl = document.getElementById("startArea");
const tempSlider = document.getElementById("tempSlider");
const tempLabel = document.getElementById("tempLabel");
const regenBtn = document.getElementById("regenBtn");
const startAiBtn = document.getElementById("startAiBtn");
const startSaBtn = document.getElementById("startSaBtn");
const statusText = document.getElementById("aiStatusText");

// --- Agent Variables ---
let agentX = 0;
let agentY = 0;
let annealingAgentX = 1; 
let annealingAgentY = 1;

// --- Map Data ---
const Z = { TRANSITION: 0, VILLAGE: 1, DROUGHT: 2, MOUNTAIN: 3 };
let zoneMap = [];
let villageCenters = [];
let smallHouses = [];
let mountainPositions = []; // Track mountain centers
let villagePosition = null; // Track main village position

// --- Helpers ---
function rand() { return Math.random(); }
function randInt(a, b) { return Math.floor(rand() * (b - a + 1)) + a; }
function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

function neighbors4(x, y) {
    const out = [];
    if (x > 0) out.push([x - 1, y]);
    if (x < COLS - 1) out.push([x + 1, y]);
    if (y > 0) out.push([x, y - 1]);
    if (y < ROWS - 1) out.push([x, y + 1]);
    return out;
}

function mulberry32(seed) {
    return function () {
        let t = (seed += 0x6D2B79F5);
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}
function cellNoise(x, y, seed = 1337) {
    const s = (x * 73856093) ^ (y * 19349663) ^ seed;
    return mulberry32(s >>> 0)();
}

// --- Assets ---
const ASSETS = {
    grassTex: new Image(),
    droughtTex: new Image(),
    mountain: new Image(),
    tree: new Image(),
    house: new Image(),
    deadTree: new Image(),
};

ASSETS.grassTex.src = "assets/grass03.png";
ASSETS.droughtTex.src = "assets/dessertplane.png";
ASSETS.mountain.src = "assets/mountain.png";
ASSETS.tree.src = "assets/tree.png";
ASSETS.house.src = "assets/house.png";
ASSETS.deadTree.src = "assets/DeadTree.png";

let grassPattern = null;
let droughtPattern = null;

function makeScaledPattern(img) {
    const o = document.createElement("canvas");
    o.width = DRAW_TILE;
    o.height = DRAW_TILE;
    const octx = o.getContext("2d");
    octx.imageSmoothingEnabled = false;
    octx.clearRect(0, 0, o.width, o.height);
    octx.drawImage(img, 0, 0, img.width, img.height, 0, 0, DRAW_TILE, DRAW_TILE);
    return ctx.createPattern(o, "repeat");
}

// --- POSITIONING LOGIC (SMART TRAPS) ---
function getSmartStartPos(isHillClimber) {
    // If it's Hill Climber, try to trap it near a mountain far from village
    if (isHillClimber && mountainPositions.length > 0 && villagePosition) {
        
        // Find mountains far from village
        const validMountains = mountainPositions.filter(m => {
            const dx = villagePosition.x - m.x;
            const dy = villagePosition.y - m.y;
            const dist = Math.sqrt(dx*dx + dy*dy);
            return dist > 10; // Must be at least 10 blocks away from village
        });

        if (validMountains.length > 0) {
            // Pick a random valid mountain
            const m = validMountains[randInt(0, validMountains.length - 1)];
            
            // Find a Transition spot next to it
            const neighbors = neighbors4(m.x, m.y);
            const candidates = neighbors.filter(([nx, ny]) => 
                zoneMap[ny][nx] === Z.TRANSITION
            );

            if (candidates.length > 0) {
                const c = candidates[randInt(0, candidates.length - 1)];
                return { x: c[0], y: c[1] };
            }
        }
    }

    // Fallback: Random position (or for SA agent)
    return {
        x: randInt(2, COLS - 3),
        y: randInt(2, ROWS - 3)
    };
}

// --- MAP GENERATION ---
function initMap() {
    zoneMap = Array.from({ length: ROWS }, () =>
        Array.from({ length: COLS }, () => Z.TRANSITION)
    );
    villageCenters = [];
    smallHouses = [];
    mountainPositions = [];
    villagePosition = null;
}

function findMountainCenters() {
    mountainPositions = [];
    const visited = Array.from({ length: ROWS }, () => Array(COLS).fill(false));
    
    for (let y = 0; y < ROWS; y++) {
        for (let x = 0; x < COLS; x++) {
            if (zoneMap[y][x] === Z.MOUNTAIN && !visited[y][x]) {
                const queue = [[x, y]];
                visited[y][x] = true;
                let sumX = 0, sumY = 0, count = 0;
                
                while (queue.length > 0) {
                    const [cx, cy] = queue.shift();
                    sumX += cx; sumY += cy; count++;
                    
                    for (const [nx, ny] of neighbors4(cx, cy)) {
                        if (zoneMap[ny][nx] === Z.MOUNTAIN && !visited[ny][nx]) {
                            visited[ny][nx] = true;
                            queue.push([nx, ny]);
                        }
                    }
                }
                if (count > 0) {
                    mountainPositions.push({ x: Math.round(sumX/count), y: Math.round(sumY/count) });
                }
            }
        }
    }
}

function growRegion(type, seeds, targetCount, bias = 0.78) {
    const frontier = [];
    for (const [sx, sy] of seeds) {
        zoneMap[sy][sx] = type;
        frontier.push([sx, sy]);
    }
    let count = seeds.length;

    while (frontier.length && count < targetCount) {
        const idx = randInt(0, frontier.length - 1);
        const [x, y] = frontier[idx];
        const nbs = neighbors4(x, y);
        const [nx, ny] = nbs[randInt(0, nbs.length - 1)];

        if (nx <= 1 || nx >= COLS-2 || ny <= 1 || ny >= ROWS-2) continue;

        const cur = zoneMap[ny][nx];
        const allow = (cur === Z.TRANSITION && rand() < bias) || (cur !== type && rand() < 0.05);
        
        if (allow) {
            zoneMap[ny][nx] = type;
            frontier.push([nx, ny]);
            count++;
        }
        if (rand() < 0.05) frontier.splice(idx, 1);
    }
}

function smoothMap(iter = 4) {
    for (let k = 0; k < iter; k++) {
        const copy = zoneMap.map((r) => r.slice());
        for (let y = 1; y < ROWS-1; y++) {
            for (let x = 1; x < COLS-1; x++) {
                const counts = { 0: 0, 1: 0, 2: 0, 3: 0 };
                for (let dy = -1; dy <= 1; dy++) {
                    for (let dx = -1; dx <= 1; dx++) {
                        const nx = x + dx, ny = y + dy;
                        counts[copy[ny][nx]]++;
                    }
                }
                
                let best = copy[y][x], bestC = -1;
                for (const t of [Z.TRANSITION, Z.VILLAGE, Z.DROUGHT, Z.MOUNTAIN]) {
                    // Small bias to keep current
                    let c = counts[t];
                    if(t === copy[y][x]) c += 0.5;
                    
                    if (c > bestC) { bestC = c; best = t; }
                }
                
                // Prevent mountains from disappearing too easily
                if (copy[y][x] === Z.MOUNTAIN && counts[Z.MOUNTAIN] >= 3) best = Z.MOUNTAIN;
                
                zoneMap[y][x] = best;
            }
        }
    }
}

function generateLayout() {
    initMap();

    // 1. COMPLEXITY: More Mountains scattered around
    const numMountains = 6; 
    for(let i=0; i<numMountains; i++) {
        const mx = randInt(2, COLS-3);
        const my = randInt(2, ROWS-3);
        // Varying sizes for mountains
        growRegion(Z.MOUNTAIN, [[mx, my]], randInt(15, 40), 0.70);
    }

    // 2. Calculate mountain centers immediately to help place Village
    findMountainCenters();

    // 3. VILLAGE: One main big village, far from existing mountains
    let villageSeed = null;
    for(let attempt=0; attempt<50; attempt++) {
        const vx = randInt(5, COLS-6);
        const vy = randInt(5, ROWS-6);
        
        // Check distance to all mountains
        let tooClose = false;
        for(const m of mountainPositions) {
            const d = Math.hypot(vx - m.x, vy - m.y);
            if(d < 8) { tooClose = true; break; }
        }
        
        if(!tooClose) {
            villageSeed = [[vx, vy]];
            break;
        }
    }
    // Fallback if no spot found
    if(!villageSeed) villageSeed = [[Math.floor(COLS/2), Math.floor(ROWS/2)]];
    
    // Grow Village
    growRegion(Z.VILLAGE, villageSeed, 110, 0.85);
    villagePosition = { x: villageSeed[0][0], y: villageSeed[0][1] };

    // 4. COMPLEXITY: More Drought patches
    const numDroughts = 5;
    for(let i=0; i<numDroughts; i++) {
        const dx = randInt(2, COLS-3);
        const dy = randInt(2, ROWS-3);
        growRegion(Z.DROUGHT, [[dx, dy]], randInt(10, 25), 0.60);
    }

    // 5. Smooth
    smoothMap(4);

    // 6. Finalize Objects
    villageCenters = findVillageCenters(2);
    smallHouses = placeSmallHouses(8); // More houses
    
    // Re-calculate mountain centers after smoothing for accurate agent placement
    findMountainCenters();
}

function fitsBigHouseAt(x, y) {
    if (x < 0 || y < 0 || x + 1 >= COLS || y + 1 >= ROWS) return false;
    return (
        zoneMap[y][x] === Z.VILLAGE &&
        zoneMap[y][x + 1] === Z.VILLAGE &&
        zoneMap[y + 1][x] === Z.VILLAGE &&
        zoneMap[y + 1][x + 1] === Z.VILLAGE
    );
}

function villageScore(x, y) {
    let s = 0;
    for (let dy = -2; dy <= 3; dy++) {
        for (let dx = -2; dx <= 3; dx++) {
            const nx = x + dx, ny = y + dy;
            if (nx < 0 || nx >= COLS || ny < 0 || ny >= ROWS) continue;
            if (zoneMap[ny][nx] === Z.VILLAGE) s += 1;
            if (zoneMap[ny][nx] === Z.DROUGHT || zoneMap[ny][nx] === Z.MOUNTAIN) s -= 0.5;
        }
    }
    return s;
}

function dist(a, b) {
    const dx = a.x - b.x, dy = a.y - b.y;
    return Math.sqrt(dx * dx + dy * dy);
}

function findVillageCenters(k = 2) {
    const candidates = [];
    for (let y = 0; y < ROWS - 1; y++) {
        for (let x = 0; x < COLS - 1; x++) {
            if (!fitsBigHouseAt(x, y)) continue;
            candidates.push({ x, y, score: villageScore(x, y) });
        }
    }
    candidates.sort((a, b) => b.score - a.score);

    const chosen = [];
    for (const c of candidates) {
        if (chosen.length === 0) chosen.push({ x: c.x, y: c.y });
        else if (chosen.length < k && dist(chosen[0], c) >= 8) chosen.push({ x: c.x, y: c.y });
        if (chosen.length >= k) break;
    }
    return chosen;
}

function isInsideBigHouseFootprint(x, y) {
    for (const c of villageCenters) {
        if (x >= c.x && x <= c.x + 1 && y >= c.y && y <= c.y + 1) return true;
    }
    return false;
}

function isOccupiedByAnyHouse(x, y) {
    if (isInsideBigHouseFootprint(x, y)) return true;
    return smallHouses.some(h => h.x === x && h.y === y);
}

function placeSmallHouses(maxCount = 6) {
    const list = [];
    const candidates = [];
    for (let y = 0; y < ROWS; y++) {
        for (let x = 0; x < COLS; x++) {
            if (x <= 2 && y <= 2) continue;
            if (zoneMap[y][x] !== Z.VILLAGE) continue;
            if (isInsideBigHouseFootprint(x, y)) continue;

            const s = cellNoise(x, y, 5011);
            if (s < 0.3) candidates.push({ x, y, s });
        }
    }
    candidates.sort((a, b) => a.s - b.s);

    for (const c of candidates) {
        if (list.length >= maxCount) break;
        const farFromBig = villageCenters.every(b => dist(b, c) >= 5);
        const farFromSmall = list.every(h => dist(h, c) >= 3);
        if (farFromBig && farFromSmall) list.push({ x: c.x, y: c.y });
    }
    return list;
}

const COLORS = { transition: "#E7DCA6", mountainBase: "#6B4F33" };

// --- DRAWING ---
function drawSoftGrid() {
    ctx.save();
    ctx.globalAlpha = 1;
    ctx.strokeStyle = "rgba(0,0,0,0.06)";
    ctx.lineWidth = 1;
    for (let x = 0; x <= COLS; x++) {
        const px = x * DRAW_TILE + 0.5;
        ctx.beginPath(); ctx.moveTo(px, 0); ctx.lineTo(px, canvas.height); ctx.stroke();
    }
    for (let y = 0; y <= ROWS; y++) {
        const py = y * DRAW_TILE + 0.5;
        ctx.beginPath(); ctx.moveTo(0, py); ctx.lineTo(canvas.width, py); ctx.stroke();
    }
    ctx.restore();
}

function drawTransitionTexture(x, y) {
    const px = x * DRAW_TILE;
    const py = y * DRAW_TILE;
    const n1 = cellNoise(x, y, 3001);
    const n2 = cellNoise(x, y, 3002);
    if (n1 < 0.55) {
        ctx.globalAlpha = 0.08; ctx.fillStyle = "rgba(255,255,255,0.35)";
        ctx.fillRect(px, py, DRAW_TILE, DRAW_TILE); ctx.globalAlpha = 1;
    }
    if (n2 < 0.35) {
        ctx.globalAlpha = 0.10; ctx.fillStyle = "rgba(0,0,0,0.20)";
        ctx.fillRect(px + randInt(3, DRAW_TILE - 5), py + randInt(3, DRAW_TILE - 5), 2, 2);
        ctx.globalAlpha = 1;
    }
}

function drawCellBackground(x, y) {
    const z = zoneMap[y][x];
    const px = x * DRAW_TILE;
    const py = y * DRAW_TILE;

    if (z === Z.VILLAGE && grassPattern) {
        ctx.fillStyle = grassPattern; ctx.fillRect(px, py, DRAW_TILE, DRAW_TILE);
        const n = cellNoise(x, y, 2026); ctx.globalAlpha = 0.05;
        ctx.fillStyle = n < 0.5 ? "rgba(0,0,0,0.18)" : "rgba(255,255,255,0.12)";
        ctx.fillRect(px, py, DRAW_TILE, DRAW_TILE); ctx.globalAlpha = 1; return;
    }
    if (z === Z.DROUGHT && droughtPattern) {
        ctx.fillStyle = droughtPattern; ctx.fillRect(px, py, DRAW_TILE, DRAW_TILE);
        const n = cellNoise(x, y, 2027); ctx.globalAlpha = 0.05;
        ctx.fillStyle = n < 0.5 ? "rgba(0,0,0,0.16)" : "rgba(255,255,255,0.10)";
        ctx.fillRect(px, py, DRAW_TILE, DRAW_TILE); ctx.globalAlpha = 1; return;
    }
    if (z === Z.MOUNTAIN) {
        ctx.fillStyle = COLORS.mountainBase; ctx.fillRect(px, py, DRAW_TILE, DRAW_TILE);
        const n = cellNoise(x, y, 8881); ctx.globalAlpha = 0.05;
        ctx.fillStyle = n < 0.5 ? "rgba(0,0,0,0.20)" : "rgba(255,255,255,0.10)";
        ctx.fillRect(px, py, DRAW_TILE, DRAW_TILE); ctx.globalAlpha = 1; return;
    }
    ctx.fillStyle = COLORS.transition; ctx.fillRect(px, py, DRAW_TILE, DRAW_TILE);
    drawTransitionTexture(x, y);
}

// --- GÜNCELLENEN DAĞ ÇİZİMİ (SEYREK VE BÜYÜK) ---
function drawMountainsPerTile() {
    if (!ASSETS.mountain.complete) return;

    for (let y = 0; y < ROWS; y++) {
        for (let x = 0; x < COLS; x++) {
            if (zoneMap[y][x] === Z.MOUNTAIN) {
                // Rastgelelik ekle (Seyreklik)
                const n = cellNoise(x, y, 9999); 
                
                // Sadece %20 ihtimalle dağ çiz (Daha seyrek)
                // Bu sayede kahverengi zemin de görünür ve dağlar tek tek seçilir
                if (n < 0.20) {
                    // DAHA BÜYÜK BOYUT: 2.5 KAT
                    const scale = 2.5; 
                    const w = DRAW_TILE * scale;
                    const h = DRAW_TILE * scale;

                    // Konum Ayarlama: Ortalama ve biraz yukarı
                    const drawX = (x * DRAW_TILE) - ((w - DRAW_TILE) / 2);
                    const drawY = (y * DRAW_TILE) - (h - DRAW_TILE) + (DRAW_TILE * 0.2); 

                    ctx.drawImage(ASSETS.mountain, drawX, drawY, w, h);
                }
            }
        }
    }
}

function drawRoads() {
    if (!villageCenters.length) return;
    const nodes = [{ x: 0, y: 0 }, ...villageCenters.map(v => ({ x: v.x, y: v.y }))];
    function drawPath(a, b) {
        ctx.save(); ctx.globalAlpha = 0.25; ctx.fillStyle = "rgba(120, 92, 58, 1)";
        let x = a.x, y = a.y;
        while (x !== b.x) {
            ctx.fillRect(x * DRAW_TILE + DRAW_TILE * 0.32, y * DRAW_TILE + DRAW_TILE * 0.32, DRAW_TILE * 0.36, DRAW_TILE * 0.36);
            x += (b.x > x) ? 1 : -1;
        }
        while (y !== b.y) {
            ctx.fillRect(x * DRAW_TILE + DRAW_TILE * 0.32, y * DRAW_TILE + DRAW_TILE * 0.32, DRAW_TILE * 0.36, DRAW_TILE * 0.36);
            y += (b.y > y) ? 1 : -1;
        }
        ctx.restore();
    }
    if (nodes.length >= 3) drawPath(nodes[1], nodes[2]);
}

function drawHouses() {
    if (!ASSETS.house.complete) return;
    for (const c of villageCenters) ctx.drawImage(ASSETS.house, c.x * DRAW_TILE, c.y * DRAW_TILE, DRAW_TILE * 2, DRAW_TILE * 2);
    for (const h of smallHouses) ctx.drawImage(ASSETS.house, h.x * DRAW_TILE, h.y * DRAW_TILE, DRAW_TILE, DRAW_TILE);
}

function drawTreesAndDeadTrees() {
    for (let y = 0; y < ROWS; y++) {
        for (let x = 0; x < COLS; x++) {
            if (x <= 5 && y <= 5) continue;
            if (isOccupiedByAnyHouse(x, y)) continue;
            const z = zoneMap[y][x]; const n = cellNoise(x, y, 9090);
            if (z === Z.VILLAGE) {
                if (ASSETS.tree.complete && n < 0.35) ctx.drawImage(ASSETS.tree, x * DRAW_TILE, y * DRAW_TILE, DRAW_TILE, DRAW_TILE);
            }
            if (z === Z.DROUGHT) {
                if (ASSETS.deadTree.complete && n < 0.15) ctx.drawImage(ASSETS.deadTree, x * DRAW_TILE, y * DRAW_TILE, DRAW_TILE, DRAW_TILE);
            }
        }
    }
}

function drawVignette() {
    const cx = canvas.width / 2; const cy = canvas.height / 2;
    const grd = ctx.createRadialGradient(cx, cy, 160, cx, cy, 560);
    grd.addColorStop(0, "rgba(255,255,255,0.00)"); grd.addColorStop(1, "rgba(0,0,0,0.12)");
    ctx.fillStyle = grd; ctx.fillRect(0, 0, canvas.width, canvas.height);
}

// ===================== RENDER & UI =====================
function renderAll() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) drawCellBackground(x, y);
    drawRoads();
    
    // GÜNCELLENMİŞ DAĞ ÇİZİMİ
    drawMountainsPerTile();
    
    drawHouses();
    drawTreesAndDeadTrees();
    drawSoftGrid();
    drawVignette();

    // UI Update
    updateAgentUI();
    
    // Sprite Position Updates
    forceMoveSprite();          // Hill Climber
    forceMoveAnnealingSprite(); // Simulated Annealing
}

function updateAgentUI() {
    if(agentPosEl) agentPosEl.textContent = `(${agentX}, ${agentY})`;
    if(startAreaEl) startAreaEl.textContent = (agentX <= 5 && agentY <= 5) ? "Transition" : zoneName(zoneMap[agentY][agentX]);
}

function zoneName(z) {
    if (z === Z.VILLAGE) return "Village";
    if (z === Z.DROUGHT) return "Drought";
    if (z === Z.MOUNTAIN) return "Mountain";
    return "Transition";
}

// Slider Event
tempSlider.addEventListener("input", () => {
    tempLabel.textContent = tempSlider.value;
    if(saTempDisplay) saTempDisplay.textContent = tempSlider.value;
});

// Init
function waitForAssets(cb) {
    const imgs = Object.values(ASSETS);
    let done = 0;
    const finish = () => { done++; if (done === imgs.length) cb(); };
    imgs.forEach((im) => { im.onload = finish; im.onerror = finish; });
}

// ==========================================
// CONTROL LOGIC (HILL CLIMBING & SA)
// ==========================================

// --- VARIABLES ---
let myAgent = null;         // Hill Climbing Agent Object
let aiInterval = null;      // Hill Climbing Loop
let saAgentObj = null;      // Simulated Annealing Agent Object
let saInterval = null;      // SA Loop

// --- VISUAL UPDATES ---
function forceMoveSprite() {
    const TILE_SIZE = 32;
    if (agentSprite) {
        agentSprite.style.left = (agentX * TILE_SIZE) + "px";
        agentSprite.style.top = (agentY * TILE_SIZE) + "px";
    }
}

function forceMoveAnnealingSprite() {
    const TILE_SIZE = 32;
    if (annealingSprite) {
        annealingSprite.style.left = (annealingAgentX * TILE_SIZE) + "px";
        annealingSprite.style.top = (annealingAgentY * TILE_SIZE) + "px";
        annealingSprite.style.width = `${DRAW_TILE}px`;
        annealingSprite.style.height = `${DRAW_TILE}px`;
    }
}

// --- 1. HILL CLIMBING LOGIC ---
function stopHillClimbing() {
    if (aiInterval) { clearInterval(aiInterval); aiInterval = null; }
}

if(startAiBtn) {
    startAiBtn.addEventListener("click", () => {
        stopHillClimbing();
        
        // Use smart start position for Hill Climber (High chance of trap)
        const startPos = getSmartStartPos(true);
        agentX = startPos.x;
        agentY = startPos.y;
        
        myAgent = new CivilizationAgent(agentX, agentY, zoneMap);
        
        if (statusText) {
            statusText.innerText = "Hill Climbing Started...";
            statusText.style.color = "#d9534f"; // Red
        }
        
        // Immediate UI Update
        forceMoveSprite();
        if(agentPosEl) agentPosEl.innerText = `(${agentX}, ${agentY})`;

        aiInterval = setInterval(() => {
            myAgent.update();
            agentX = myAgent.x;
            agentY = myAgent.y;
            
            forceMoveSprite();
            if(agentPosEl) agentPosEl.innerText = `(${agentX}, ${agentY})`;

            if (myAgent.isStuck) {
                stopHillClimbing();
                if(statusText) statusText.innerText = "HC: Stuck at Local Maxima!";
                alert("Hill Climber Stuck!");
            }
        }, 150);
    });
}

// --- 2. SIMULATED ANNEALING LOGIC ---
function stopAnnealing() {
    if (saInterval) { clearInterval(saInterval); saInterval = null; }
}

if(startSaBtn) {
    startSaBtn.addEventListener("click", () => {
        stopAnnealing();
        
        // SA Start Position can be random (or use smart pos with 'false')
        const startPos = getSmartStartPos(false);
        annealingAgentX = startPos.x;
        annealingAgentY = startPos.y;

        let sliderValue = parseInt(tempSlider.value); 
        
        saAgentObj = new AnnealingAgent(annealingAgentX, annealingAgentY, zoneMap, sliderValue);
        
        if (statusText) {
            statusText.innerText = "Simulated Annealing Started...";
            statusText.style.color = "#1f78d1"; // Blue
        }

        // Immediate UI Update
        forceMoveAnnealingSprite();
        if(saPosEl) saPosEl.innerText = `(${annealingAgentX}, ${annealingAgentY})`;

        saInterval = setInterval(() => {
            saAgentObj.update();
            let currentTemp = saAgentObj.temperature;

            tempSlider.value = Math.floor(currentTemp);
            if(tempLabel) tempLabel.textContent = Math.floor(currentTemp);
            if(saTempDisplay) saTempDisplay.textContent = currentTemp.toFixed(1);

            annealingAgentX = saAgentObj.x;
            annealingAgentY = saAgentObj.y;
            
            forceMoveAnnealingSprite();
            if(saPosEl) saPosEl.innerText = `(${annealingAgentX}, ${annealingAgentY})`;
            
        }, 100); 
    });
}

// --- 3. REGENERATE ---
if(regenBtn) {
    regenBtn.addEventListener("click", () => {
        // A. Döngüleri Öldür
        stopHillClimbing(); // FIX: Replaced stopAI with correct function
        stopAnnealing();    // FIX: Replaced stopAI with correct function

        // B. Haritayı yeniden oluştur
        generateLayout();
        
        // C. Konumları RASTGELE SEÇ
        const hcPos = getSmartStartPos(true);
        agentX = hcPos.x; agentY = hcPos.y;
        
        const saPos = getSmartStartPos(false);
        annealingAgentX = saPos.x; annealingAgentY = saPos.y;

        // D. Görselleri yeni konuma taşı ve haritayı çiz
        forceMoveSprite();
        forceMoveAnnealingSprite();
        renderAll();

        // E. Durum Yazısını Güncelle
        if(statusText) {
            statusText.innerText = "Map Regenerated. Agents Ready.";
            statusText.style.color = "green";
        }
        if(agentPosEl) agentPosEl.innerText = `(${agentX}, ${agentY})`;
        if(saPosEl) saPosEl.innerText = `(${annealingAgentX}, ${annealingAgentY})`;
        
        console.log("Regenerate clicked.");
    });
}

// --- INIT ---
init = function() {
    generateLayout();
    
    // Initial positions
    const hcPos = getSmartStartPos(true);
    agentX = hcPos.x; agentY = hcPos.y;
    
    const saPos = getSmartStartPos(false);
    annealingAgentX = saPos.x; annealingAgentY = saPos.y;

    waitForAssets(() => {
        if (ASSETS.grassTex.complete) grassPattern = makeScaledPattern(ASSETS.grassTex);
        if (ASSETS.droughtTex.complete) droughtPattern = makeScaledPattern(ASSETS.droughtTex);
        renderAll();
        
        forceMoveSprite();
        forceMoveAnnealingSprite();
        if(saTempDisplay) saTempDisplay.textContent = tempSlider.value;
    });
}

init();