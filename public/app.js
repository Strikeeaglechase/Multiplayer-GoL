const RULES = {
    alive: ["dead", "dead", "alive", "alive", "dead", "dead", "dead", "dead", "dead"],
    dead: ["dead", "dead", "dead", "alive", "dead", "dead", "dead", "dead", "dead"]
};
const CELL_BUFFER = 1;
const DEAD_COLOR = { r: 51, g: 51, b: 51 };
class App {
    constructor(options) {
        this.rules = RULES;
        this.mouseX = 0;
        this.mouseY = 0;
        this.ctx = options.canvas.getContext("2d");
        this.cellSize = options.cellSize;
        this.size = options.size;
        this.initCells();
        this.createHandlers();
        this.initNabs();
    }
    initCells() {
        this.cells = [];
        for (let i = 0; i < this.size; i++) {
            this.cells[i] = [];
            for (let j = 0; j < this.size; j++) {
                this.cells[i][j] = {
                    state: "dead",
                    neighbours: [],
                    ownerId: "",
                    color: DEAD_COLOR,
                    next: {
                        state: "dead",
                        ownerId: "",
                        color: DEAD_COLOR
                    }
                };
            }
        }
    }
    createHandlers() {
        const self = this;
        window.addEventListener("keydown", (e) => {
            if (e.key == " ") {
                self.step();
                self.draw();
            }
        });
        window.addEventListener("mousemove", (e) => {
            self.mouseX = e.clientX;
            self.mouseY = e.clientY;
        });
    }
    loadServerCells(cells) {
        cells.forEach((row, i) => {
            row.forEach((cell, j) => {
                this.cells[j][i].color = cell.color;
                this.cells[j][i].ownerId = cell.ownerId;
                this.cells[j][i].state = cell.state;
            });
        });
    }
    iterrate(handler) {
        this.cells.forEach((row, yIdx) => {
            row.forEach((cell, xIdx) => {
                handler(cell, xIdx, yIdx);
            });
        });
    }
    inBounds(x, y) {
        return !(x < 0 || x >= this.size || y < 0 || y >= this.size);
    }
    initNabs() {
        this.iterrate((cell, xIdx, yIdx) => {
            for (let i = yIdx - 1; i <= yIdx + 1; i++) {
                for (let j = xIdx - 1; j <= xIdx + 1; j++) {
                    if (i == yIdx && j == xIdx)
                        continue; //Don't add self as nab 
                    if (!this.inBounds(j, i))
                        continue; // Don't add invald nabs
                    cell.neighbours.push(this.cells[i][j]);
                }
            }
        });
    }
    updateNextCellStates() {
        this.iterrate((cell) => {
            const numNabs = cell.neighbours.reduce((acc, cur) => {
                return acc + (cur.state == "alive" ? 1 : 0);
            }, 0);
            // if (numNabs > 0) debugger;
            cell.next.state = this.rules[cell.state][numNabs];
            if (cell.next.state == "alive")
                cell.next.color = cell.color;
            //Handle new cell condition for color mode
            if (cell.next.state == "alive" && cell.state == "dead") {
                const colorCounts = [];
                cell.neighbours.forEach(nabCell => {
                    if (nabCell.state == "alive") {
                        let counter = colorCounts.find(lookup => lookup.id == nabCell.ownerId);
                        if (!counter) {
                            counter = {
                                count: 0,
                                color: nabCell.color,
                                id: nabCell.ownerId
                            };
                            colorCounts.push(counter);
                        }
                        counter.count++;
                    }
                });
                const mostCount = colorCounts.sort((a, b) => b.count - a.count)[0];
                cell.next.color = mostCount.color;
                cell.next.ownerId = mostCount.id;
            }
        });
    }
    setCellStates() {
        this.iterrate((cell) => {
            cell.state = cell.next.state;
            cell.color = cell.next.color;
            cell.ownerId = cell.next.ownerId;
        });
    }
    step() {
        this.updateNextCellStates();
        this.setCellStates();
    }
    draw() {
        this.updateNextCellStates();
        this.render();
        this.renderNextStates();
        const cellXIdx = Math.floor(this.mouseX / (this.cellSize + CELL_BUFFER));
        const cellYIdx = Math.floor(this.mouseY / (this.cellSize + CELL_BUFFER));
        if (this.inBounds(cellXIdx, cellYIdx)) {
            const x = cellXIdx * (this.cellSize + CELL_BUFFER);
            const y = cellYIdx * (this.cellSize + CELL_BUFFER);
            this.rect(x, y, this.cellSize, this.cellSize, { r: 255, g: 255, b: 255, a: 0.25 });
        }
    }
    renderNextStates() {
        this.iterrate((cell, xIdx, yIdx) => {
            const subCellSize = this.cellSize * 0.35;
            const x = xIdx * (this.cellSize + CELL_BUFFER);
            const y = yIdx * (this.cellSize + CELL_BUFFER);
            const subX = x + this.cellSize / 2 - subCellSize / 2;
            const subY = y + this.cellSize / 2 - subCellSize / 2;
            let fill;
            fill = cell.next.state == "alive" ? cell.next.color : DEAD_COLOR;
            this.rect(subX, subY, subCellSize, subCellSize, fill);
        });
    }
    render() {
        //Clear out background
        this.rect(0, 0, this.ctx.canvas.width, this.ctx.canvas.height, { r: 0, g: 0, b: 0 });
        this.iterrate((cell, xIdx, yIdx) => {
            const x = xIdx * (this.cellSize + CELL_BUFFER);
            const y = yIdx * (this.cellSize + CELL_BUFFER);
            let fill;
            fill = cell.state == "alive" ? cell.color : DEAD_COLOR;
            this.rect(x, y, this.cellSize, this.cellSize, fill);
        });
    }
    rect(x, y, w, h, fill, stroke) {
        this.ctx.beginPath();
        this.ctx.rect(x, y, w, h);
        if (stroke) {
            this.ctx.strokeStyle = stroke;
            this.ctx.stroke();
        }
        if (fill) {
            let colorStr;
            if (fill.a) {
                colorStr = `rgba(${fill.r},${fill.g},${fill.b},${fill.a})`;
            }
            else {
                colorStr = `rgb(${fill.r},${fill.g},${fill.b})`;
            }
            this.ctx.fillStyle = colorStr;
            this.ctx.fill();
        }
    }
}
export { App };
