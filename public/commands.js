var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import { encode } from "./network.js";
;
const commands = [
    {
        name: "help",
        helpMsg: "Shows the help",
        exec: function (args) {
            const helpMsgs = commands.map(command => `${command.name} - ${command.helpMsg}`);
            return { msg: helpMsgs.join('\n') };
        }
    },
    {
        name: "ping",
        helpMsg: "Pings the server to ensure it is still running",
        exec: function () {
            return __awaiter(this, void 0, void 0, function* () {
                const ping = yield this.ping();
                return { msg: `Round trip ping is ${ping}ms` };
            });
        }
    },
    {
        name: "name",
        helpMsg: "Sets your name",
        exec: function (args) {
            if (!args[1]) {
                return { msg: `Please supply a name: /name [new name]`, color: "#ff0000" };
            }
            this.socket.send(encode({ event: "setName", name: args[1] }));
            return { msg: `Set your name to ${args[1]}` };
        }
    },
    {
        name: "start",
        helpMsg: "Starts the game",
        exec: function (args) {
            if (!this.isHost) {
                return { msg: "You are not the lobby host", color: "#ff0000" };
            }
            this.socket.send(encode({ event: "start" }));
            return { msg: `Trying to start the game` };
        }
    },
    {
        name: "config",
        helpMsg: "Changes/displays the config. /config [option] [newValue]",
        exec: function (args) {
            if (!this.isHost) {
                return { msg: "You are not the lobby host", color: "#ff0000" };
            }
            const option = args[1];
            const value = parseInt(args[2]);
            const configOptions = Object.getOwnPropertyNames(this.app.gameConfig);
            if (!option) {
                const strs = [];
                configOptions.forEach(optionName => {
                    strs.push(`${optionName}: ${this.app.gameConfig[optionName]}`);
                });
                return { msg: `Current game config:\n${strs.join("\n")}` };
            }
            else {
                if (configOptions.includes(option)) {
                    this.app.gameConfig[option] = value;
                    this.socket.send(encode({ event: "config", config: this.app.gameConfig }));
                    return;
                }
                else {
                    return { msg: `The option "${option}" does not exist`, color: "#ff0000" };
                }
            }
        }
    }
];
export { commands };
