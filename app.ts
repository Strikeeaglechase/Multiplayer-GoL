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
	started: boolean;
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
	constructor(server: WebsocketServer) {
		this.server = server;
		this.users = [];
		this.config = {
			numSpawnPoints: 10,
			cellSize: 25,
			gridSize: 25
		};
		this.game = {
			cells: [],
			currentTurn: "",
			players: [],
			started: false
		}
	}
	init() {
		this.server.on("connection", this.connect.bind(this));
		this.server.on("close", this.disconnect.bind(this));
		this.server.on("message", this.message.bind(this));
	}
	initCells() {
		this.game.cells = [];
		for (let i = 0; i < this.config.gridSize; i++) {
			this.game.cells[i] = [];
			for (let j = 0; j < this.config.gridSize; j++) {
				this.game.cells[i][j] = {
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
					const cell = this.game.cells[checkY][checkX];
					if (cell.state == "alive") {
						//Bad spawn area, there is an alive cell
						isValid = false;
					}
				}
			}
			if (isValid) {
				this.game.cells[y + 1][x + 1] = userCell;
				this.game.cells[y + 1][x + 2] = userCell;
				this.game.cells[y + 2][x + 1] = userCell;
				this.game.cells[y + 2][x + 2] = userCell;
				foundSpawns++;
				attempts = 0; //Attempts is per spawn
			}
		}
	}
	initUser(user: User) {
		if (!user.name) {
			this.sendMsg("The game is starting, however as you have not yet set your name you will be a spectator for this round", user);
			return;
		};
		user.color = createColor();
		this.spawnUser(user);
		this.game.players.push(this.userToPlayer(user));
	}
	startGame() {
		try {
			this.initCells();
			this.game.players = [];
			this.users.forEach(user => {
				this.initUser(user);
			});
			if (this.game.players.length < 2) {
				this.sendMsg("The game has too few players to begin (min: 2)");
			}
			this.game.currentTurn = this.game.players[0].id;
			this.game.started = true;
			this.sendGameState();
			this.sendMsg("The game has started!");
		} catch (e) {
			console.log(`${e.name}: ${e.message}`);
			this.sendMsg("Unable to start game\n" + e.message);
		}
	}
	sendMsg(msg: string, user?: User) {
		const packet: WebsocketMessage = { event: "chat", msg: `Server: ${msg}`, color: SERVER_COLOR };
		if (user) {
			this.server.sendToClient(packet, user.id);
		} else {
			this.server.sendToAll(packet);
		}
	}
	userToPlayer(user: User): Player {
		return {
			name: user.name,
			color: user.color,
			id: user.id
		}
	}
	sendGameState(user?: User) {
		const packet: WebsocketMessage = { event: "game", state: this.game };
		if (user) {
			this.server.sendToClient(packet, user.id);
		} else {
			this.server.sendToAll(packet);
		}
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
		if (this.game.started) this.sendGameState(newUser);
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
export { App, GameEvents, Cell, GameState, Player };