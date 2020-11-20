import { Client, WebsocketMessage, WebsocketServer } from "./WebsocketServer";
interface Color {
	r: number;
	g: number;
	b: number;
	a?: number;
}

type CellState = "alive" | "dead";

interface Cell {
	state: CellState;
	color: Color;
	ownerId: string;
}

interface GameConfig {
	numSpawnPoints: number;
	cellSize: number;
	gridSize: number;
}

interface Player {
	color: Color,
	id: string,
	name: string
}

interface GameState {
	players: Player[];
	cells: Cell[][];
	currentTurn: string;
}

interface User {
	client: Client;
	color: Color;
	isHost: boolean;
	id: string;
	name: string;
}

const DEAD_COLOR = { r: 51, g: 51, b: 51 };
const MAX_SPAWN_ATTEMPTS = 10;
const SERVER_COLOR = "#0064f0";

function createColor(): Color {
	return {
		r: Math.floor(Math.random() * 255),
		g: Math.floor(Math.random() * 255),
		b: Math.floor(Math.random() * 255),
	}
}

class App {
	users: User[];
	server: WebsocketServer;
	haveHost = false;
	config: GameConfig;
	game: GameState;
	cells: Cell[][];
	constructor(server: WebsocketServer) {
		this.server = server;
		this.users = [];
		this.config = {
			numSpawnPoints: 10,
			cellSize: 25,
			gridSize: 25
		}
	}
	init() {
		this.server.on("connection", this.connect.bind(this));
		this.server.on("close", this.disconnect.bind(this));
		this.server.on("message", this.message.bind(this));
	}
	initCells() {
		this.cells = [];
		for (let i = 0; i < this.config.gridSize; i++) {
			this.cells[i] = [];
			for (let j = 0; j < this.config.gridSize; j++) {
				this.cells[i][j] = {
					state: "dead",
					ownerId: "",
					color: DEAD_COLOR
				}
			}
		}
	}
	spawnUser(user: User) {
		let attempts = 0;
		let foundSpawns = 0;
		while (foundSpawns < this.config.numSpawnPoints) {
			attempts++;
			if (attempts > MAX_SPAWN_ATTEMPTS) {
				throw new Error("Too many spawn attempts");
			}
			const userCell: Cell = {
				state: "alive",
				color: user.color,
				ownerId: user.id
			};
			const x = Math.floor(Math.random() * this.config.gridSize);
			const y = Math.floor(Math.random() * this.config.gridSize);
			let isValid = true;
			//To check if an area is clear, check if 4x4 is clear
			for (let i = 0; i <= 4; i++) {
				for (let j = 0; j <= 4; j++) {
					const checkX = x + j;
					const checkY = y + i;
					if (
						checkX < 0 ||
						checkX >= this.config.gridSize ||
						checkY < 0 ||
						checkY >= this.config.gridSize
					) {
						isValid = false;
						continue;
					}
					const cell = this.cells[checkY][checkX];
					if (cell.state == "alive") {
						//Bad spawn area, there is an alive cell
						isValid = false;
					}
				}
			}
			if (isValid) {

				let offset = 1;
				this.cells[y + offset][x + offset] = userCell;
				this.cells[y + offset][x + offset + 1] = userCell;
				this.cells[y + offset + 1][x + offset] = userCell;
				this.cells[y + offset + 1][x + offset + 1] = userCell;
				foundSpawns++;
				attempts = 0; //Attempts is per spawn
			}
		}
	}
	initUser(user: User) {
		user.color = createColor();
		this.spawnUser(user);
	}
	startGame() {
		try {
			this.initCells();
			this.users.forEach(user => {
				this.initUser(user);
			});
			this.sendGameState();
		} catch (e) {
			console.log(`${e.name}: ${e.message}`);
			this.server.sendToAll({ event: "chat", msg: "Server: Unable to start game", color: SERVER_COLOR });
		}

	}
	toPlayer(user: User): Player {
		return {
			name: user.name,
			color: user.color,
			id: user.id
		}
	}
	sendGameState() {
		const state: GameState = {
			players: this.users.map(this.toPlayer),
			cells: this.cells,
			currentTurn: ""
		}
		this.server.sendToAll({ event: "game", state: state });
	}
	connect(client: Client) {
		const newUser: User = {
			client: client,
			color: createColor(),
			isHost: false,
			id: client.id,
			name: ""
		}
		this.users.push(newUser);
		if (!this.haveHost) this.findNewHost();
	}
	disconnect(client: Client) {
		const user = this.users.find(user => user.id == client.id);
		this.users = this.users.filter(user => user.id != client.id);
		if (user.isHost) {
			this.haveHost = false;
			this.findNewHost();
		}
	}
	message(client: Client, message: WebsocketMessage) {
		const user = this.users.find(u => u.id == client.id);
		switch (message.event) {
			case "setName":
				user.name = message.name;
				console.log(`${client.id} set name to ${user.name}`)
				break;
			case "chat":
				if (!user.name || !message.msg) return;
				this.server.sendToAll({
					event: "chat",
					msg: `${user.name}: ${message.msg}`
				});
				console.log(`${user.name}: ${message.msg}`);
				break;
			case "start":
				if (!user.isHost) {
					console.log(`${user.id} attempted to start the game despite not being host`);
					return;
				}
				this.startGame();
				break;
		}
	}
	findNewHost() {
		if (this.haveHost) {
			console.log(`findNewHost called despite already having host`);
			return;
		}
		const randomUser = this.users[Math.floor(Math.random() * this.users.length)];
		if (randomUser) {
			//Tell client they are new host
			this.server.sendToAll({ event: "setHost", hostId: randomUser.id });
			this.haveHost = true;
			randomUser.isHost = true;
			console.log(`Assigned new host: ${randomUser.id}`);
		}
	}
}
type GameEvents = "setHost" | "setName" | "chat" | "game" | "start";
export { App, GameEvents, Cell };