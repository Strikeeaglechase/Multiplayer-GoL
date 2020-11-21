var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import { commands } from "./commands.js";
function encode(data) {
    return JSON.stringify(data);
}
function decode(data) {
    try {
        return JSON.parse(data.toString());
    }
    catch (e) {
        console.log(`Error decoding network packet: ${data}`);
    }
}
const SERVER_COLOR = "#0064f0";
class Network {
    constructor(app) {
        this.isHost = false;
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
            if (!data)
                return;
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
                        this.addMsgToChat(`Server: You are now the host`, SERVER_COLOR);
                    }
                    else {
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
    ping() {
        return __awaiter(this, void 0, void 0, function* () {
            const startTime = Date.now();
            this.socket.send(encode({ event: "ping", time: startTime }));
            yield new Promise(res => {
                this.pingCallback = res;
            });
            return Date.now() - startTime;
        });
    }
    addMsgToChat(text, color) {
        const newElm = document.createElement("p");
        newElm.innerText = text;
        if (color)
            newElm.style.color = color;
        const chatBox = document.getElementById("chat-text");
        chatBox.insertBefore(newElm, chatBox.children[0]);
    }
    handleUserCommand(msg) {
        return __awaiter(this, void 0, void 0, function* () {
            const args = msg.substring(1).split(" ");
            const command = commands.find(c => c.name == args[0]);
            if (command) {
                const ret = yield command.exec.call(this, args);
                if (ret)
                    this.addMsgToChat(ret.msg, ret.color);
            }
            else {
                this.addMsgToChat(`Unknown command "${args[0]}"`, "#ff0000");
            }
        });
    }
    handleUserMsg(msg) {
        if (msg[0] == "/") {
            this.handleUserCommand(msg);
        }
        else {
            this.socket.send(encode({ event: "chat", msg: msg }));
        }
    }
}
export { Network, encode, decode };
