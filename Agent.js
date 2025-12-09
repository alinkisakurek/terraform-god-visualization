// Agent.js - Core Logic (İlayda)

class CivilizationAgent {
    constructor(x, y, gridMap) {
        this.x = x;          // Grid üzerindeki X koordinatı
        this.y = y;          // Grid üzerindeki Y koordinatı
        this.gridMap = gridMap; // Harita verisi (2D Array)
        
        this.isStuck = false; // True olduğunda Local Maxima'dadır
        this.color = "red";   // Hareket halindeyken kırmızı
    }

    // Bulunduğu yerin yüksekliğini döndürür
    getCurrentElevation() {
        // Harita sınırlarını kontrol et
        if (this.x >= 0 && this.x < this.gridMap.length && 
            this.y >= 0 && this.y < this.gridMap[0].length) {
            return this.gridMap[this.x][this.y];
        }
        return -1; // Hata durumu
    }

    // HILL CLIMBING ALGORİTMASI
    // Her çağrıldığında 1 adım atar.
    update() {
        // Eğer sıkıştıysa hareket etme (Daha sonra buraya Sim. Annealing eklenecek)
        if (this.isStuck) return;

        const currentHeight = this.getCurrentElevation();
        let bestHeight = currentHeight;
        let bestMove = null;

        // 4 Yönlü Hareket (Yukarı, Aşağı, Sol, Sağ)
        const directions = [
            { dx: 0, dy: -1 }, // Yukarı
            { dx: 0, dy: 1 },  // Aşağı
            { dx: -1, dy: 0 }, // Sol
            { dx: 1, dy: 0 }   // Sağ
        ];

        // 1. Komşuları Tara (Scan Neighbors)
        for (let dir of directions) {
            const newX = this.x + dir.dx;
            const newY = this.y + dir.dy;

            // Sınır kontrolü
            if (newX >= 0 && newX < this.gridMap.length && 
                newY >= 0 && newY < this.gridMap[0].length) {
                
                const neighborHeight = this.gridMap[newX][newY];

                // 2. Sadece daha yüksekse git (Greedy Approach)
                if (neighborHeight > bestHeight) {
                    bestHeight = neighborHeight;
                    bestMove = { x: newX, y: newY };
                }
            }
        }

        // 3. Karar Ver (Move or Stuck)
        if (bestMove) {
            this.x = bestMove.x;
            this.y = bestMove.y;
            this.isStuck = false;
            this.color = "red"; // Tırmanıyor
        } else {
            // Gidecek daha yüksek yer yok
            this.isStuck = true;
            this.color = "yellow"; // Sıkıştı (Local Maxima)
            console.log("Ajan Local Maxima'da sıkıştı.");
        }
    }

    // Çizim fonksiyonu (Nisanur'un Canvas'ına entegre edilecek)
    draw(ctx, cellSize) {
        ctx.fillStyle = this.color;
        ctx.beginPath();
        // Kare merkezine daire çiz
        ctx.arc(
            this.x * cellSize + cellSize / 2, 
            this.y * cellSize + cellSize / 2, 
            cellSize / 3, 
            0, 
            Math.PI * 2
        );
        ctx.fill();
    }
}