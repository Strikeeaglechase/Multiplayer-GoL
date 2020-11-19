import { App } from "./app.js";
import { Network } from "./network.js";
let app;
let network;
function init() {
    const canvas = document.createElement("canvas");
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    document.body.appendChild(canvas);
    app = new App({
        size: 25,
        cellSize: 25,
        canvas: canvas,
    });
    network = new Network(app);
    network.init();
    console.log("App ready");
    // @ts-ignore
    window.app = app;
    // @ts-ignore
    window.network = network;
    const chatInput = document.getElementById("chat-input");
    chatInput.addEventListener("keydown", (e) => {
        if (e.key === 'Enter') {
            console.log(chatInput.value);
        }
    });
    run();
}
window.onload = init;
function run() {
    app.draw();
    requestAnimationFrame(run);
}
