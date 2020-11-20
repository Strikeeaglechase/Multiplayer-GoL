import { encode } from "./network.js";
interface Command {
	name: string;
	helpMsg: string;
	exec: (args?: string[]) => CommandReturn | Promise<CommandReturn>;
};
interface CommandReturn {
	msg: string;
	color?: string;
}
const commands: Command[] = [
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
		exec: async function () {
			const ping = await this.ping();
			return { msg: `Round trip ping is ${ping}ms` };
		}
	},
	{
		name: "name",
		helpMsg: "Sets your name",
		exec: function (args) {
			if (!args[1]) {
				return { msg: `Please supply a name: /name [new name]`, color: "#ff0000" };
			}
			this.socket.send(encode({ event: "setName", name: args[1] }))
			return { msg: `Set your name to ${args[1]}` };
		}
	},
	{
		name: "start",
		helpMsg: "Starts the game",
		exec: function (args) {
			if (!this.isHost) {
				return { msg: "You are not the lobby host", color: "#ff0000" }
			}
			this.socket.send(encode({ event: "start" }));
			return { msg: `Trying to start the game` };
		}
	}
];
export { commands, CommandReturn }