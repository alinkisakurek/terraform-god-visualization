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

const agentSprite = document.getElementById("agentSprite");
const agentPosEl = document.getElementById("agentPos");
const startAreaEl = document.getElementById("startArea");
const tempSlider = document.getElementById("tempSlider");
const tempLabel = document.getElementById("tempLabel");
const regenBtn = document.getElementById("regenBtn");

let agentX = 0;
let agentY = 0;

const Z = { TRANSITION: 0, VILLAGE: 1, DROUGHT: 2, MOUNTAIN: 3 };
let zoneMap = [];
let villageCenters = [];
let smallHouses = [];

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

// Pattern’ı 32x32’e ölçekle
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


function initMap() {
    zoneMap = Array.from({ length: ROWS }, () =>
        Array.from({ length: COLS }, () => Z.TRANSITION)
    );
    villageCenters = [];
    smallHouses = [];
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


        if (nx <= 5 && ny <= 5) continue;

        const cur = zoneMap[ny][nx];
        const allow =
            (cur === Z.TRANSITION && rand() < bias) || (cur !== type && rand() < 0.03);
        if (allow) {
            zoneMap[ny][nx] = type;
            frontier.push([nx, ny]);
            count++;
        }
        if (rand() < 0.02) frontier.splice(idx, 1);
    }
}

function smoothMap(iter = 6) {
    for (let k = 0; k < iter; k++) {
        const copy = zoneMap.map((r) => r.slice());
        for (let y = 0; y < ROWS; y++) {
            for (let x = 0; x < COLS; x++) {
                if (x <= 5 && y <= 5) {
                    zoneMap[y][x] = Z.TRANSITION;
                    continue;
                }

                const counts = { 0: 0, 1: 0, 2: 0, 3: 0 };
                for (let dy = -1; dy <= 1; dy++) {
                    for (let dx = -1; dx <= 1; dx++) {
                        const nx = x + dx, ny = y + dy;
                        if (nx < 0 || nx >= COLS || ny < 0 || ny >= ROWS) continue;
                        counts[copy[ny][nx]]++;
                    }
                }

                let best = copy[y][x], bestC = -1;
                for (const t of [Z.TRANSITION, Z.VILLAGE, Z.DROUGHT, Z.MOUNTAIN]) {
                    if (counts[t] > bestC) {
                        bestC = counts[t];
                        best = t;
                    }
                }

                // mountain not too thin
                if (best === Z.MOUNTAIN && counts[Z.MOUNTAIN] < 5) best = copy[y][x];
                zoneMap[y][x] = best;
            }
        }
    }
}

function generateLayout() {
    initMap();


    for (let y = 0; y <= 5; y++)
        for (let x = 0; x <= 5; x++)
            zoneMap[y][x] = Z.TRANSITION;

    const village1 = [[randInt(7, 12), randInt(7, 11)]];
    const village2 = [[randInt(18, 23), randInt(18, 23)]];
    const drought1 = [[randInt(20, 26), randInt(4, 9)]];
    const drought2 = [[randInt(6, 11), randInt(20, 26)]];
    const mountain = [[randInt(14, 18), randInt(12, 16)]];


    growRegion(Z.VILLAGE, village1, 135);
    growRegion(Z.VILLAGE, village2, 150);
    growRegion(Z.DROUGHT, drought1, 170);
    growRegion(Z.DROUGHT, drought2, 160);
    growRegion(Z.MOUNTAIN, mountain, 78, 0.65);

    smoothMap(6);


    for (let y = 0; y <= 5; y++)
        for (let x = 0; x <= 5; x++)
            zoneMap[y][x] = Z.TRANSITION;

    villageCenters = findVillageCenters(2);   // 2 big houses max
    smallHouses = placeSmallHouses(6);        // a few small houses
}


function fitsBigHouseAt(x, y) {
    if (x < 0 || y < 0 || x + 1 >= COLS || y + 1 >= ROWS) return false;
    if (x <= 5 && y <= 5) return false;
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
        else if (chosen.length < k && dist(chosen[0], c) >= 10) chosen.push({ x: c.x, y: c.y });
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
            if (x <= 5 && y <= 5) continue;
            if (zoneMap[y][x] !== Z.VILLAGE) continue;
            if (isInsideBigHouseFootprint(x, y)) continue;

            const s = cellNoise(x, y, 5011);
            if (s < 0.12) candidates.push({ x, y, s });
        }
    }

    candidates.sort((a, b) => a.s - b.s);

    for (const c of candidates) {
        if (list.length >= maxCount) break;


        const farFromBig = villageCenters.every(b => dist(b, c) >= 6);
        const farFromSmall = list.every(h => dist(h, c) >= 3.5);

        if (farFromBig && farFromSmall) list.push({ x: c.x, y: c.y });
    }
    return list;
}


const COLORS = {
    transition: "#E7DCA6",
    mountainBase: "#6B4F33",
};


function drawSoftGrid() {
    ctx.save();
    ctx.globalAlpha = 1;
    ctx.strokeStyle = "rgba(0,0,0,0.06)";
    ctx.lineWidth = 1;

    for (let x = 0; x <= COLS; x++) {
        const px = x * DRAW_TILE + 0.5;
        ctx.beginPath();
        ctx.moveTo(px, 0);
        ctx.lineTo(px, canvas.height);
        ctx.stroke();
    }
    for (let y = 0; y <= ROWS; y++) {
        const py = y * DRAW_TILE + 0.5;
        ctx.beginPath();
        ctx.moveTo(0, py);
        ctx.lineTo(canvas.width, py);
        ctx.stroke();
    }
    ctx.restore();
}


function drawTransitionTexture(x, y) {
    const px = x * DRAW_TILE;
    const py = y * DRAW_TILE;
    const n1 = cellNoise(x, y, 3001);
    const n2 = cellNoise(x, y, 3002);

    if (n1 < 0.55) {
        ctx.globalAlpha = 0.08;
        ctx.fillStyle = "rgba(255,255,255,0.35)";
        ctx.fillRect(px, py, DRAW_TILE, DRAW_TILE);
        ctx.globalAlpha = 1;
    }
    if (n2 < 0.35) {
        ctx.globalAlpha = 0.10;
        ctx.fillStyle = "rgba(0,0,0,0.20)";
        ctx.fillRect(px + randInt(3, DRAW_TILE - 5), py + randInt(3, DRAW_TILE - 5), 2, 2);
        ctx.globalAlpha = 1;
    }
}

function drawCellBackground(x, y) {
    const z = zoneMap[y][x];
    const px = x * DRAW_TILE;
    const py = y * DRAW_TILE;

    if (z === Z.VILLAGE && grassPattern) {
        ctx.fillStyle = grassPattern;
        ctx.fillRect(px, py, DRAW_TILE, DRAW_TILE);


        const n = cellNoise(x, y, 2026);
        ctx.globalAlpha = 0.05;
        ctx.fillStyle = n < 0.5 ? "rgba(0,0,0,0.18)" : "rgba(255,255,255,0.12)";
        ctx.fillRect(px, py, DRAW_TILE, DRAW_TILE);
        ctx.globalAlpha = 1;
        return;
    }

    if (z === Z.DROUGHT && droughtPattern) {
        ctx.fillStyle = droughtPattern;
        ctx.fillRect(px, py, DRAW_TILE, DRAW_TILE);

        const n = cellNoise(x, y, 2027);
        ctx.globalAlpha = 0.05;
        ctx.fillStyle = n < 0.5 ? "rgba(0,0,0,0.16)" : "rgba(255,255,255,0.10)";
        ctx.fillRect(px, py, DRAW_TILE, DRAW_TILE);
        ctx.globalAlpha = 1;
        return;
    }

    if (z === Z.MOUNTAIN) {
        // base (mountain soil)
        ctx.fillStyle = COLORS.mountainBase;
        ctx.fillRect(px, py, DRAW_TILE, DRAW_TILE);

        // a tiny highlight noise so it won't be flat
        const n = cellNoise(x, y, 8881);
        ctx.globalAlpha = 0.05;
        ctx.fillStyle = n < 0.5 ? "rgba(0,0,0,0.20)" : "rgba(255,255,255,0.10)";
        ctx.fillRect(px, py, DRAW_TILE, DRAW_TILE);
        ctx.globalAlpha = 1;
        return;
    }

    ctx.fillStyle = COLORS.transition;
    ctx.fillRect(px, py, DRAW_TILE, DRAW_TILE);
    drawTransitionTexture(x, y);
}


function buildMountainClipPath() {
    ctx.beginPath();
    for (let y = 0; y < ROWS; y++) {
        for (let x = 0; x < COLS; x++) {
            if (zoneMap[y][x] !== Z.MOUNTAIN) continue;
            ctx.rect(x * DRAW_TILE, y * DRAW_TILE, DRAW_TILE, DRAW_TILE);
        }
    }
}

function getMountainBounds() {
    let minX = COLS, minY = ROWS, maxX = -1, maxY = -1;
    for (let y = 0; y < ROWS; y++) {
        for (let x = 0; x < COLS; x++) {
            if (zoneMap[y][x] !== Z.MOUNTAIN) continue;
            if (x < minX) minX = x;
            if (y < minY) minY = y;
            if (x > maxX) maxX = x;
            if (y > maxY) maxY = y;
        }
    }
    if (maxX === -1) return null;
    return {
        x: minX * DRAW_TILE,
        y: minY * DRAW_TILE,
        w: (maxX - minX + 1) * DRAW_TILE,
        h: (maxY - minY + 1) * DRAW_TILE,
    };
}

function drawMountainMass() {
    if (!ASSETS.mountain.complete) return;

    const b = getMountainBounds();
    if (!b) return;

    ctx.save();


    buildMountainClipPath();
    ctx.clip();


    ctx.globalAlpha = 0.92;
    ctx.imageSmoothingEnabled = false;


    ctx.shadowColor = "rgba(0,0,0,0.35)";
    ctx.shadowBlur = 10;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 6;


    const img = ASSETS.mountain;
    const targetW = b.w * 1.15;
    const scale = targetW / img.width;
    const targetH = img.height * scale;

    const dx = b.x + (b.w - targetW) * 0.5;
    const dy = b.y + (b.h - targetH) * 0.45;

    ctx.drawImage(img, dx, dy, targetW, targetH);


    ctx.shadowBlur = 0;
    ctx.globalAlpha = 0.35;
    ctx.drawImage(img, dx + 30, dy - 18, targetW * 0.92, targetH * 0.92);

    ctx.restore();
    ctx.globalAlpha = 1;
}


function drawRoads() {

    if (!villageCenters.length) return;

    const nodes = [{ x: 0, y: 0 }, ...villageCenters.map(v => ({ x: v.x, y: v.y }))];

    function drawPath(a, b) {
        ctx.save();
        ctx.globalAlpha = 0.25;
        ctx.fillStyle = "rgba(120, 92, 58, 1)";

        let x = a.x, y = a.y;
        while (x !== b.x) {
            ctx.fillRect(
                x * DRAW_TILE + DRAW_TILE * 0.32,
                y * DRAW_TILE + DRAW_TILE * 0.32,
                DRAW_TILE * 0.36,
                DRAW_TILE * 0.36
            );
            x += (b.x > x) ? 1 : -1;
        }
        while (y !== b.y) {
            ctx.fillRect(
                x * DRAW_TILE + DRAW_TILE * 0.32,
                y * DRAW_TILE + DRAW_TILE * 0.32,
                DRAW_TILE * 0.36,
                DRAW_TILE * 0.36
            );
            y += (b.y > y) ? 1 : -1;
        }
        ctx.restore();
    }


    let nearest = nodes[1];
    let bestD = 1e9;
    for (let i = 1; i < nodes.length; i++) {
        const d = (nodes[i].x) ** 2 + (nodes[i].y) ** 2;
        if (d < bestD) { bestD = d; nearest = nodes[i]; }
    }
    drawPath(nodes[0], nearest);


    if (nodes.length >= 3) drawPath(nodes[1], nodes[2]);
}


function drawHouses() {
    if (!ASSETS.house.complete) return;


    for (const c of villageCenters) {
        ctx.drawImage(
            ASSETS.house,
            c.x * DRAW_TILE,
            c.y * DRAW_TILE,
            DRAW_TILE * 2,
            DRAW_TILE * 2
        );
    }


    for (const h of smallHouses) {
        ctx.drawImage(
            ASSETS.house,
            h.x * DRAW_TILE,
            h.y * DRAW_TILE,
            DRAW_TILE,
            DRAW_TILE
        );
    }
}

function drawTreesAndDeadTrees() {
    for (let y = 0; y < ROWS; y++) {
        for (let x = 0; x < COLS; x++) {
            if (x <= 5 && y <= 5) continue;
            if (isOccupiedByAnyHouse(x, y)) continue;

            const z = zoneMap[y][x];
            const n = cellNoise(x, y, 9090);

            if (z === Z.VILLAGE) {

                if (ASSETS.tree.complete && n < 0.20) {
                    ctx.drawImage(ASSETS.tree, x * DRAW_TILE, y * DRAW_TILE, DRAW_TILE, DRAW_TILE);
                }
            }

            if (z === Z.DROUGHT) {

                if (ASSETS.deadTree.complete && n < 0.08) {
                    ctx.drawImage(ASSETS.deadTree, x * DRAW_TILE, y * DRAW_TILE, DRAW_TILE, DRAW_TILE);
                }
            }
        }
    }
}

function drawVignette() {
    const cx = canvas.width / 2;
    const cy = canvas.height / 2;
    const grd = ctx.createRadialGradient(cx, cy, 160, cx, cy, 560);
    grd.addColorStop(0, "rgba(255,255,255,0.00)");
    grd.addColorStop(1, "rgba(0,0,0,0.12)");
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
}

// ===================== Render
function renderAll() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // background cells
    for (let y = 0; y < ROWS; y++)
        for (let x = 0; x < COLS; x++)
            drawCellBackground(x, y);

    // roads to reduce "empty" feeling
    drawRoads();

    // mountain overlay (clipped, visible, no spill)
    drawMountainMass();

    // objects
    drawHouses();
    drawTreesAndDeadTrees();

    // subtle grid (optional)
    drawSoftGrid();

    // vignette
    drawVignette();

    // UI + agent
    updateAgentUI();
    positionAgentSprite();
}

function updateAgentUI() {
    agentPosEl.textContent = `(${agentX}, ${agentY})`;
    startAreaEl.textContent = (agentX <= 5 && agentY <= 5) ? "Transition" : zoneName(zoneMap[agentY][agentX]);
}

function zoneName(z) {
    if (z === Z.VILLAGE) return "Village";
    if (z === Z.DROUGHT) return "Drought";
    if (z === Z.MOUNTAIN) return "Mountain";
    return "Transition";
}

function positionAgentSprite() {
    agentSprite.style.left = `${agentX * DRAW_TILE}px`;
    agentSprite.style.top = `${agentY * DRAW_TILE}px`;
    agentSprite.style.width = `${DRAW_TILE}px`;
    agentSprite.style.height = `${DRAW_TILE}px`;
}

// ===================== Movement (simple for demo)
function tryMove(dx, dy) {
    const nx = clamp(agentX + dx, 0, COLS - 1);
    const ny = clamp(agentY + dy, 0, ROWS - 1);

    // if you want mountains to be blocked, uncomment:
    // if (zoneMap[ny][nx] === Z.MOUNTAIN) return;

    agentX = nx;
    agentY = ny;
    updateAgentUI();
    positionAgentSprite();
}

window.addEventListener("keydown", (e) => {
    const k = e.key.toLowerCase();
    if (k === "w" || e.key === "ArrowUp") tryMove(0, -1);
    if (k === "s" || e.key === "ArrowDown") tryMove(0, 1);
    if (k === "a" || e.key === "ArrowLeft") tryMove(-1, 0);
    if (k === "d" || e.key === "ArrowRight") tryMove(1, 0);
});

// ===================== Events
tempSlider.addEventListener("input", () => {
    tempLabel.textContent = tempSlider.value;
});
regenBtn.addEventListener("click", () => {
    generateLayout();
    renderAll();
});

// ===================== Init
function waitForAssets(cb) {
    const imgs = Object.values(ASSETS);
    let done = 0;
    const finish = () => { done++; if (done === imgs.length) cb(); };
    imgs.forEach((im) => { im.onload = finish; im.onerror = finish; });
}

function init() {
    agentX = 0;
    agentY = 0;
    generateLayout();

    waitForAssets(() => {
        if (ASSETS.grassTex.complete) grassPattern = makeScaledPattern(ASSETS.grassTex);
        if (ASSETS.droughtTex.complete) droughtPattern = makeScaledPattern(ASSETS.droughtTex);
        renderAll();
    });
}

init();
