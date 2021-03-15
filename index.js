// Server ports: 	10112
// 					10113
import express from "express";
import { WebsocketServer } from "./WebsocketServer.js";
import { App } from "./app.js";
const app = express();
const port = 10112;
app.use(express.static('public'));
app.listen(port, () => {
    console.log(`Server open on port ${port}`);
});
const wss = new WebsocketServer(10113);
const golApp = new App(wss);
golApp.init();
