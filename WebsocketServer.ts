import WebSocket from "ws";
import { v4 as uuidv4 } from "uuid";
import { GameEvents } from "./app";
const TIMEOUT = 10 * 1000;
const HEARTBEAT_RATE = 2.5 * 1000;
interface Client {
	socket: WebSocket;
	lastPing: number;
	dead: boolean;
	id: string;
}
type NetworkEvent = "heartbeat" | "assignId" | GameEvents;
interface WebsocketMessage {
	event: NetworkEvent;
	[propName: string]: any;
}

type WebsocketServerEvent = "connection" | "close" | "message";

interface WebsocketEvents {
	connection: Function[];
	close: Function[];
	message: Function[];
}

function encode(data: WebsocketMessage): string {
	return JSON.stringify(data);
}

function decode(data: WebSocket.Data): WebsocketMessage {
	try {
		return JSON.parse(data.toString());
	} catch (e) {
		console.log(`Error decoding network packet: ${data}`);
	}
}

class WebsocketServer {
	server: WebSocket.Server;
	clients: Client[];
	eventListeners: WebsocketEvents;
	constructor(port: number) {
		this.server = new WebSocket.Server({
			port: port
		});
		this.eventListeners = {
			connection: [],
			close: [],
			message: [],
		}
		this.clients = [];
		this.server.on("connection", this.setupConnection.bind(this));
		setInterval(this.heartbeat.bind(this), HEARTBEAT_RATE);
	}
	setupConnection(socket: WebSocket) {
		const self = this;
		const client: Client = {
			socket: socket,
			lastPing: Date.now(),
			dead: false,
			id: uuidv4()
		};
		this.clients.push(client);
		socket.on("message", function (message) {
			// console.log(`Recivied packet: ${message}`);
			const data = decode(message);
			if (!data) return;
			switch (data.event) {
				case "heartbeat":
					client.lastPing = Date.now();
					break;
				default:
					// console.log(`Unknown packet type: ${data.event}`);
					self.emit("message", client, data);
			}
		});
		socket.on("close", function () {
			client.dead = true;
			self.emit("close", client);
		});
		socket.send(encode({ event: "assignId", id: client.id }))
		console.log(`New client connected, id: ${client.id}.  ${this.clients.length} client(s) currently connected`);
		self.emit("connection", client);
	}
	heartbeat() {
		this.clients = this.clients.filter((client) => {
			if (client.dead) {
				console.log(`Client ${client.id} no longer alive, removing instance.  ${this.clients.length - 1}  client(s) currently connected`);
				return false;
			}
			return true;
		});
		this.clients.forEach((client) => {
			// console.log(`Emitting heartbeat to ${client.id}`)
			client.socket.send(encode({ event: "heartbeat" }));
			const dt = Date.now() - client.lastPing;
			if (dt > TIMEOUT) {
				client.socket.terminate();
			}
		});
	}
	sendToClient(data: WebsocketMessage, clientId: string) {
		const client = this.clients.find(client => client.id == clientId);
		client.socket.send(encode(data));
	}
	sendToAll(data: WebsocketMessage) {
		const message = encode(data);
		this.clients.forEach(client => {
			client.socket.send(message);
		});
	}
	on(event: WebsocketServerEvent, callback: Function) {
		this.eventListeners[event].push(callback);
	}
	emit(event: WebsocketServerEvent, client: Client, ...args: any) {
		this.eventListeners[event].forEach((handler) =>
			handler.apply(null, [client, ...args])
		);
	}
}
export { WebsocketServer, WebsocketServerEvent, WebsocketMessage, Client }