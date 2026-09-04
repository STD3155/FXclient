import { getSettings } from "./settings.js";
import { getVar } from "./gameInterface.js";
import { requireElementById } from "./dom.js";

const hoveringTooltip = new (function() {
    let lastShown = 0;
    this.display = () => {}; // this gets populated by the modified game script
    this.active = false;
    this.canvasPixelScale = 1;
    function handler(e) {
        const now = performance.now();
        if (!getSettings().hoveringTooltip || !getVar("gameState") || now - lastShown < 100) return;
        let x, y;
        // https://stackoverflow.com/a/61732450
        if (e.type.includes(`touch`)) {
            const { touches, changedTouches } = e.originalEvent ?? e;
            const touch = touches[0] ?? changedTouches[0];
            x = touch.pageX;
            y = touch.pageY;
        } else if (e.type.includes(`mouse`)) {
            x = e.clientX;
            y = e.clientY;
        }

        lastShown = now;
        try {
            this.active = true;
            this.display(this.canvasPixelScale * x, this.canvasPixelScale * y);
        } catch (e) {
            console.error(e);
        } finally {
            this.active = false;
        }
    }
    const canvas = requireElementById("canvasA");
    canvas.addEventListener("mousemove", handler.bind(this));
    canvas.addEventListener("touchstart", handler.bind(this));
});
export default hoveringTooltip
