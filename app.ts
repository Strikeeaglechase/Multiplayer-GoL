import { Client, WebsocketMessage, WebsocketServer } from "./WebsocketServer";

interface Color {
	r: number;
	g: number;
	b: number;
	a?: number;
}

interface User {
	client: Client;
	color: Color;
	isHost: boolean;
	id: string;
}

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
	constructor(server: WebsocketServer) {
		this.server = server;
		this.users = [];
	}
	init() {
		this.server.on("connection", this.connect.bind(this));
		this.server.on("close", this.disconnect.bind(this));
		this.server.on("message", this.message.bind(this));
	}
	connect(client: Client) {
		const newUser: User = {
			client: client,
			color: createColor(),
			isHost: false,
			id: client.id
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
	message(client: Client, message: WebsocketMessage) { }
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
type GameEvents = "setHost";
export { App, GameEvents };