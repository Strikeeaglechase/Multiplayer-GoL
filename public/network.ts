import { App } from "./app";
import { WebsocketMessage } from "../WebsocketServer";
import { commands, CommandReturn } from "./commands.js";

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
const SERVER_COLOR = "#0064f0";

class Network {
	app: App;
	socket: WebSocket;
	isHost = false;
	id: string;
	name: string;
	pingCallback: () => void;
	constructor(app: App) {
		this.app = app;
		this.app.network = this;
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
				case "ping":
					if (this.pingCallback) {
						this.pingCallback();
					}
					break;
				case "chat":
					this.addMsgToChat(data.msg, data.color);
					break;
				case "setHost":
					if (data.hostId == this.id) {
						console.log(`We are the new host`);
						this.isHost = true;
						this.addMsgToChat(`Server: You are now the host`, SERVER_COLOR)
					} else {
						this.isHost = false;
						console.log(`There is a new host: ${data.hostId}`);
					}
					break;
				case "game":
					this.app.loadState(data.state);
					break;
				case "config":
					this.app.loadConfig(data.config);
					break;
			}
		});
	}
	finishTurn() {
		const cells = this.app.getServerCells();
		this.socket.send(encode({ event: "game", cells: cells }));
	}
	async ping() {
		const startTime = Date.now();
		this.socket.send(encode({ event: "ping", time: startTime }));
		await new Promise<void>(res => {
			this.pingCallback = res;
		});
		return Date.now() - startTime;
	}
	addMsgToChat(text: string, color?: string) {
		const newElm = document.createElement("p");
		newElm.innerText = text;
		if (color) newElm.style.color = color;
		const chatBox = document.getElementById("chat-text");
		chatBox.insertBefore(newElm, chatBox.children[0]);
	}
	async handleUserCommand(msg: string) {
		const args = msg.substring(1).split(" ");
		const command = commands.find(c => c.name == args[0]);
		if (command) {
			const ret: CommandReturn = await command.exec.call(this, args);
			if (ret) this.addMsgToChat(ret.msg, ret.color);
		} else {
			this.addMsgToChat(`Unknown command "${args[0]}"`, "#ff0000")
		}
	}
	handleUserMsg(msg: string) {
		if (msg[0] == "/") {
			this.handleUserCommand(msg);
		} else {
			this.socket.send(encode({ event: "chat", msg: msg }));
		}
	}
}
export { Network, encode, decode };