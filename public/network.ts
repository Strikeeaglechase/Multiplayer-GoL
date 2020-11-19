import { App } from "./app";
import { WebsocketMessage } from "../WebsocketServer";

function encode(data: WebsocketMessage): string {
	return JSON.stringify(data);
}

function decode(data: MessageEvent): WebsocketMessage {
	try {
		return JSON.parse(data.toString());
	} catch (e) {
		console.log(`Error decoding network packet: ${data}`);
	}
}

class Network {
	app: App;
	socket: WebSocket;
	isHost = false;
	id: string;
	constructor(app: App) {
		this.app = app;
	}
	init() {
		this.socket = new WebSocket("ws://localhost:8090");
		this.socket.addEventListener("open", () => {
			console.log("Socket connected!");
		});
		this.socket.addEventListener("close", () => {
			console.log("Socket disconnected");
			setTimeout(this.init.bind(this), 1000);
		});
		this.socket.addEventListener("error", (e) => {
			console.log(e);
		});
		this.socket.addEventListener("message", (message) => {
			// console.log(message);
			const data = decode(message.data);
			if (!data) return;
			switch (data.event) {
				case "heartbeat":
					this.socket.send(encode({ event: "heartbeat" }));
					break;
				case "assignId":
					this.id = data.id;
					console.log(`We now have the ID of ${this.id}`);
					break;
				case "setHost":
					if (data.hostId == this.id) {
						console.log(`We are the new host`);
						this.isHost = true;
					} else {
						this.isHost = false;
						console.log(`There is a new host: ${data.hostId}`);
					}
			}
		});
	}
}
export { Network };