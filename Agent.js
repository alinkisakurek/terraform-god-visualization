// Agent.js - Pure Hill Climbing Logic (with Plateau Support)

class CivilizationAgent {
    constructor(x, y, gridMap) {
        this.x = x;
        this.y = y;
        this.gridMap = gridMap;
        this.isStuck = false;

        // We can keep track of the last 10 moves to prevent infinite loops (Optional but recommended)
        this.pathHistory = [];
    }

    // Convert map types to scores
    getScoreFromType(type) {
        // According to game logic:
        // 1 (Village) = 100
        // 3 (Mountain) = 80
        // 0 (Flatland/Plain) = 50
        // 2 (Drought) = 10
        if (type === 1) return 100;
        if (type === 3) return 80;
        if (type === 0) return 50;
        if (type === 2) return 10;
        return 0;
    }

    getElevation(x, y) {
        if (y >= 0 && y < this.gridMap.length && x >= 0 && x < this.gridMap[0].length) {
            let zoneType = this.gridMap[y][x];
            return this.getScoreFromType(zoneType);
        }
        return -999; // Out of map bounds
    }

    update() {
        if (this.isStuck) return;

        const currentScore = this.getElevation(this.x, this.y);

        // Scan 4 Directions
        const directions = [
            { dx: 0, dy: -1 }, { dx: 0, dy: 1 },
            { dx: -1, dy: 0 }, { dx: 1, dy: 0 }
        ];

        let bestScoreFound = -Infinity;
        let bestCandidates = []; // List of neighbors with the best score

        // STEP 1: Visit all neighbors and find the highest score
        for (let dir of directions) {
            const nx = this.x + dir.dx;
            const ny = this.y + dir.dy;

            // Do not go out of map bounds
            if (nx < 0 || nx >= this.gridMap[0].length || ny < 0 || ny >= this.gridMap.length) continue;

            const neighborScore = this.getElevation(nx, ny);

            // If this neighbor is better than the best found so far, reset the list
            if (neighborScore > bestScoreFound) {
                bestScoreFound = neighborScore;
                bestCandidates = [{ x: nx, y: ny }];
            }
            // If this neighbor is equal to the best, add to list (for random selection)
            else if (neighborScore === bestScoreFound) {
                bestCandidates.push({ x: nx, y: ny });
            }
        }

        // STEP 2: Decide (Hill Climbing Logic)

        // If the best place around is worse than where I am -> I AM AT PEAK (Stuck)
        if (bestScoreFound < currentScore) {
            this.isStuck = true;
            console.log("Local Maxima: Everywhere around me is worse than here.");
        }
        // If the best place around is better than me OR equal (Plateau) -> MOVE
        else {
            // Randomly select one of the equal or better candidates (To avoid bias towards Right/Left)
            const move = bestCandidates[Math.floor(Math.random() * bestCandidates.length)];

            // If the selected place has the same score but different position, go there
            // (Note: We allow wandering on plateaus)
            this.x = move.x;
            this.y = move.y;
            this.isStuck = false;
        }
    }
}
class AnnealingAgent {
    constructor(x, y, gridMap, startTemp) {
        this.x = x;
        this.y = y;
        this.gridMap = gridMap;
        this.startTemp = startTemp;
        this.currentScore = this.getElevation(x, y);
        this.temperature = startTemp;
        this.coolingRate = 0.99; // Cooling rate per update
    }

    // Score mapping function
    getScoreFromType(type) {
        if (type === 1) return 100; // Village (Green)
        if (type === 3) return 80;  // Mountain (Brown)
        if (type === 0) return 50;  // Transition (Yellow)
        if (type === 2) return 10;  // Drought (Orange)
        return 0;
    }

    getElevation(x, y) {
        if (y >= 0 && y < this.gridMap.length && x >= 0 && x < this.gridMap[0].length) {
            let zoneType = this.gridMap[y][x];
            return this.getScoreFromType(zoneType);
        }
        return -999; // Out of bounds
    }

    update() {
        const currentScore = this.getElevation(this.x, this.y);

        const directions = [
            { dx: 0, dy: -1 }, { dx: 0, dy: 1 },
            { dx: -1, dy: 0 }, { dx: 1, dy: 0 }
        ];

        const randomDir = directions[Math.floor(Math.random() * directions.length)];
        const nx = this.x + randomDir.dx;
        const ny = this.y + randomDir.dy;

        if (nx < 0 || nx >= this.gridMap[0].length || ny < 0 || ny >= this.gridMap.length) {
            return;
        }

        const nextScore = this.getElevation(nx, ny);
        const delta = nextScore - currentScore;

        let shouldMove = false;

        if (delta > 0) {
            shouldMove = true;
        } else {
            // Kendi içindeki this.temperature değerini kullanır
            if (this.temperature > 0.1) {
                const probability = Math.exp(delta / this.temperature);
                if (Math.random() < probability) {
                    shouldMove = true;
                }
            }
        }

        if (shouldMove) {
            this.x = nx;
            this.y = ny;
            this.currentScore = nextScore;
        }

        // --- YENİ: OTOMATİK SOĞUMA ---
        // Ajan her hareket denemesinde biraz soğur
        if (this.temperature > 0.1) {
            this.temperature *= this.coolingRate;
        } else {
            this.temperature = 0;
        }
    }

}

