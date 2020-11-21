import { Player, GameState, GameConfig, Cell as ServerCell } from "../app.js";
import { Network } from "./network.js";
interface Color {
	r: number;
	g: number;
	b: number;
	a?: number;
}

type CellState = "alive" | "dead";

interface Rules {
	alive: [CellState, CellState, CellState, CellState, CellState, CellState, CellState, CellState, CellState];
	dead: [CellState, CellState, CellState, CellState, CellState, CellState, CellState, CellState, CellState]
}

interface Cell {
	state: CellState;
	color: Color;
	ownerId: string;
	next?: Cell;
	neighbours?: Cell[];
}

interface AppOptions {
	size: number;
	cellSize: number;
	canvas?: HTMLCanvasElement;
}

const RULES: Rules = {
	alive: ["dead", "dead", "alive", "alive", "dead", "dead", "dead", "dead", "dead"],
	dead: ["dead", "dead", "dead", "alive", "dead", "dead", "dead", "dead", "dead"]
};
const CELL_BUFFER = 1;
const DEAD_COLOR = { r: 51, g: 51, b: 51 };

class App {
	cellSize: number;
	size: number;
	ctx: CanvasRenderingContext2D;
	cells: Cell[][];
	network: Network;
	players: Player[] = [];
	isOurTurn: boolean;
	hasTakenTurn: boolean;
	turnAction: { x: number, y: number, oldColor: Color }
	gameConfig: GameConfig = {
		numSpawnPoints: 2,
		cellSize: 25,
		gridSize: 25
	};
	rules = RULES;
	mouseX = 0;
	mouseY = 0;
	constructor(options: AppOptions) {
		this.ctx = options.canvas.getContext("2d");
		this.cellSize = options.cellSize;
		this.size = options.size;
		this.initCells();
		this.initNabs();
		this.createHandlers();
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
				}
			}
		}
	}
	createHandlers() {
		const self: App = this;
		window.addEventListener("keydown", (e) => {
			if (e.target == document.body && this.isOurTurn) {
				if (e.key == " ") {
					self.step();
				} else if (e.key == "z" && this.hasTakenTurn) {
					const cell = this.cells[this.turnAction.y][this.turnAction.x];
					cell.state = cell.state == "alive" ? "dead" : "alive";
					cell.color = this.turnAction.oldColor;
					this.hasTakenTurn = false;
				}
			}
		});
		window.addEventListener("mousemove", (e) => {
			self.mouseX = e.clientX;
			self.mouseY = e.clientY;
		});
		window.addEventListener("mousedown", () => {
			if (!this.isOurTurn || this.hasTakenTurn) return;
			const mouse = this.getMouseCell();
			if (!this.inBounds(mouse.x, mouse.y)) return;
			this.hasTakenTurn = true;
			const cell = this.cells[mouse.y][mouse.x];
			const myColor = this.players.find(p => p.id == this.network.id).color;
			cell.state = cell.state == "alive" ? "dead" : "alive";
			this.turnAction = {
				x: mouse.x,
				y: mouse.y,
				oldColor: cell.color
			};
			cell.color = myColor;
		});
	}
	loadState(state: GameState) {
		state.cells.forEach((row, i) => {
			row.forEach((cell, j) => {
				this.cells[i][j].color = cell.color;
				this.cells[i][j].ownerId = cell.ownerId;
				this.cells[i][j].state = cell.state;
			});
		});
		this.players = state.players;
		if (state.currentTurn == this.network.id) {
			this.network.addMsgToChat("It is now your turn");
			this.isOurTurn = true;
		} else {
			this.isOurTurn = false;
		}
	}
	loadConfig(config: GameConfig) {
		this.gameConfig = config;
		this.size = config.gridSize;
		this.cellSize = config.cellSize;
		this.initCells();
		this.initNabs();
	}
	iterrate(handler: Function) {
		this.cells.forEach((row, yIdx) => {
			row.forEach((cell, xIdx) => {
				handler(cell, xIdx, yIdx);
			});
		});
	}
	inBounds(x: number, y: number): boolean {
		return !(x < 0 || x >= this.size || y < 0 || y >= this.size)
	}
	initNabs() {
		this.iterrate((cell: Cell, xIdx: number, yIdx: number) => {
			for (let i = yIdx - 1; i <= yIdx + 1; i++) {
				for (let j = xIdx - 1; j <= xIdx + 1; j++) {
					if (i == yIdx && j == xIdx) continue; //Don't add self as nab 
					if (!this.inBounds(j, i)) continue; // Don't add invald nabs
					cell.neighbours.push(this.cells[i][j]);
				}
			}
		});
	}
	updateNextCellStates() {
		this.iterrate((cell: Cell) => {
			const numNabs = cell.neighbours.reduce((acc, cur) => {
				return acc + (cur.state == "alive" ? 1 : 0);
			}, 0);
			// if (numNabs > 0) debugger;
			cell.next.state = this.rules[cell.state][numNabs];
			if (cell.next.state == "alive") cell.next.color = cell.color;
			//Handle new cell condition for color mode
			if (cell.next.state == "alive" && cell.state == "dead") {
				const colorCounts: { id: string, color: Color, count: number }[] = [];
				cell.neighbours.forEach(nabCell => {
					if (nabCell.state == "alive") {
						let counter = colorCounts.find(lookup => lookup.id == nabCell.ownerId);
						if (!counter) {
							counter = {
								count: 0,
								color: nabCell.color,
								id: nabCell.ownerId
							}
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
		this.iterrate((cell: Cell) => {
			cell.state = cell.next.state;
			cell.color = cell.next.color;
			cell.ownerId = cell.next.ownerId;
		});
	}
	getServerCells(): ServerCell[][] {
		return this.cells.map(row => row.map(cell => {
			return {
				state: cell.state,
				color: cell.color,
				ownerId: cell.ownerId
			}
		}));
	}
	step() {
		this.hasTakenTurn = false;
		this.updateNextCellStates();
		this.setCellStates();
		this.isOurTurn = false;
		this.network.finishTurn();
	}
	getMouseCell(): { x: number, y: number } {
		return {
			x: Math.floor(this.mouseX / (this.cellSize + CELL_BUFFER)),
			y: Math.floor(this.mouseY / (this.cellSize + CELL_BUFFER))
		}
	}
	draw() {
		this.updateNextCellStates();
		this.render();
		this.renderNextStates();
		this.showCurrentPlayers();
		const mouse = this.getMouseCell();
		if (this.inBounds(mouse.x, mouse.y)) {
			const x = mouse.x * (this.cellSize + CELL_BUFFER);
			const y = mouse.y * (this.cellSize + CELL_BUFFER);
			this.rect(x, y, this.cellSize, this.cellSize, { r: 255, g: 255, b: 255, a: 0.25 });
		}
	}
	showCurrentPlayers() {
		const startX = (this.size + 2) * (this.cellSize + CELL_BUFFER);
		const startY = window.innerHeight - (this.cellSize * 2);
		this.players.forEach((player, idx) => {
			const x = startX;
			const y = startY - idx * (this.cellSize + CELL_BUFFER);
			this.rect(x, y, this.cellSize, this.cellSize, player.color);
			this.ctx.fillStyle = "whitesmoke";
			this.ctx.font = "18px monospace";
			this.ctx.fillText(player.name, x + this.cellSize + 5, y + this.cellSize / 2 + 4);
		});
	}
	renderNextStates() {
		this.iterrate((cell: Cell, xIdx: number, yIdx: number) => {
			const subCellSize = this.cellSize * 0.35;
			const x = xIdx * (this.cellSize + CELL_BUFFER);
			const y = yIdx * (this.cellSize + CELL_BUFFER);
			const subX = x + this.cellSize / 2 - subCellSize / 2;
			const subY = y + this.cellSize / 2 - subCellSize / 2;
			let fill: Color;
			fill = cell.next.state == "alive" ? cell.next.color : DEAD_COLOR;
			this.rect(subX, subY, subCellSize, subCellSize, fill);
		});
	}
	render() {
		//Clear out background
		this.rect(0, 0, this.ctx.canvas.width, this.ctx.canvas.height, { r: 0, g: 0, b: 0 });

		this.iterrate((cell: Cell, xIdx: number, yIdx: number) => {
			const x = xIdx * (this.cellSize + CELL_BUFFER);
			const y = yIdx * (this.cellSize + CELL_BUFFER);
			let fill: Color;
			fill = cell.state == "alive" ? cell.color : DEAD_COLOR;
			this.rect(x, y, this.cellSize, this.cellSize, fill);
		});
	}
	rect(x: number, y: number, w: number, h: number, fill?: Color | null, stroke?: string | null) {
		this.ctx.beginPath();
		this.ctx.rect(x, y, w, h);
		if (stroke) {
			this.ctx.strokeStyle = stroke;
			this.ctx.stroke();
		}
		if (fill) {
			let colorStr: string;
			if (fill.a) {
				colorStr = `rgba(${fill.r},${fill.g},${fill.b},${fill.a})`;
			} else {
				colorStr = `rgb(${fill.r},${fill.g},${fill.b})`;
			}
			this.ctx.fillStyle = colorStr;
			this.ctx.fill();
		}
	}
}
export { App, Cell };