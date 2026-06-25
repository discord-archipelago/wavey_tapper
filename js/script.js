const BPM = 112;
const Bar_Seconds = 15 / 7;
const Bit_Seconds = 5 / 448;
const Bit_Milliseconds = 625 / 56;

var HighlightMode = false;

var DeviceInfo = {
    innerW: innerWidth,
    innerH: innerHeight,
    outerW: outerWidth,
    outerH: outerHeight,
    screenX: screenX,
    screenY: screenY,

    popup: {},
    
    highlightSize: 0,

    calibrated: false,
    calibrateWindow: null,
    calibrate() {
        this.calibrateWindow = open('calibrate.html', '_blank', 'popup=true,width=200,height=200,top=0,left=0');

        this.calibrateWindow.onload = event => {
            this.calibrateWindow.postMessage('Calibrate');
        };
    },
    endCalibrate(data) {
        DeviceInfo.popup = data;
        DeviceInfo.calibrateWindow.close();
        
        var popup = this.popup;
        popup.padW = popup.outerW - popup.innerW;
        popup.padH = popup.outerH - popup.innerH;

        this.tabHeight = Math.max(popup.padW,popup.padH);

        var gap = this.tabHeight;
        this.gap = gap;

        this.screenMin = Math.min(screen.width, screen.height);

        //4x + 5*tabHeight = screen.height
        this.blockSize = Math.floor(0.25 * (this.screenMin - gap * 5));
        
        this.blockOffset = [
            (0.5 * (screen.width - this.screenMin)),
            (0.5 * (screen.height - this.screenMin)),
        ];
        
        if(HighlightMode){
            //highlight mode
            var highlightArea =  screen.height == this.screenMin
                ? screen.width - screen.height 
                : screen.height - screen.width;
            
            this.highlightSize = highlightArea - gap*2;
            
            this.highlightPosition = [
                0.5 * (screen.width  - (this.highlightSize + gap)),
                0.5 * (screen.height - (this.highlightSize + gap))
            ]
            if(screen.height == this.screenMin){
                this.highlightPosition[0] = screen.height + gap;
                this.blockOffset[0] = 0;
            }
            else{
                this.highlightPosition[1] = screen.width + gap;
                this.blockOffset[1] = 0;
            }
        }
        
        this.calibrated = true;
        UI.update();
    },

    getPopupPosition(x, y) {
        return [
            this.blockOffset[0] + (this.blockSize + this.gap) * x + this.gap,
            this.blockOffset[1] + (this.blockSize + this.gap) * y
        ];
    }
};

var Cube = {
    section: gebi('cube-section'),
    element: gebi('cube'),
    
    originalRotation: [Math.rad(-35.264389682754654),Math.rad(-45)],
    baseRotation: [0, 0],
    rotation: [0, 0],
    
    update(){
        this.element.style.transform = `rotateX(${Math.deg(this.originalRotation[0] + this.rotation[0])}deg) rotateY(${Math.deg(this.originalRotation[1] + this.rotation[1])}deg)`;
    },
    
    screenSize: 0,
    
    rotate(offsetX, offsetY){
        this.rotation[0] = this.baseRotation[0] + (offsetY / this.screenSize * -7);
        this.rotation[1] = this.baseRotation[1] + (offsetX / this.screenSize * 7);
        
        this.rotation[0] = Math.clamp(this.rotation[0], -0.9553166181245092, 2.186276035465284);
        
        this.update();
    },
    
    drag: false,
    mouseStartX: 0,
    mouseStartY: 0,
    
    mousedown(event){
        if(event.button != 0) return;
        
        this.drag = true;
        this.mouseStartX = event.pageX;
        this.mouseStartY = event.pageY;
        
        this.baseRotation[0] = this.rotation[0];
        this.baseRotation[1] = this.rotation[1];
    },
    mousemove(event){
        if(!Cube.drag) return;
        if(event.buttons == 0){
            this.mouseup(event);
        }
        
        this.rotate(event.pageX - Cube.mouseStartX, event.pageY - Cube.mouseStartY);
    },
    mouseup(){
        this.drag = false;
        
        this.rotate[1] = Math.mod(this.rotation[1] - Math.PI, Math.TAU) - Math.PI;
        this.idleFrames = 0;
    },
    mouseleave(event){
        if(this.drag) this.mouseup(event);
    },

    touchstart(event){
        event.pageX = event.changedTouches[0].pageX;
        event.pageY = event.changedTouches[0].pageY;
        this.mousedown(event);
    },
    touchmove(event){
        event.pageX = event.changedTouches[0].pageX;
        event.pageY = event.changedTouches[0].pageY;
        this.mousemove(event);
    },
    touchend(event){
        this.mouseup(event);
    },
    
    idleFrames: 0,
    maxIdleFrames: 120,
    smoothRotateBack(deltaTime){
        this.idleFrames++;
        if(this.idleFrames == this.maxIdleFrames){
            this.rotation[0] = 0;
            this.rotation[1] = 0;
        }else{
            this.rotation[0] *= Math.exp(-4 * deltaTime);
            this.rotation[1] *= Math.exp(-4 * deltaTime);
        }
        this.update();
    },
    
    animate(deltaTime){
        if(!this.drag && this.idleFrames <= this.maxIdleFrames) this.smoothRotateBack(deltaTime);
    },
    
    init(){
        this.screenSize = Math.min(innerWidth, innerHeight);
        
        this.section.addEventListener("mousedown", event => Cube.mousedown(event));
        this.section.addEventListener("mousemove", event => Cube.mousemove(event));
        this.section.addEventListener("mouseup",   event => Cube.mouseup(event));
        this.section.addEventListener("mouseleave",event => Cube.mouseleave(event));
        this.section.addEventListener("touchstart", event => Cube.touchstart(event));
        this.section.addEventListener("touchmove", event => Cube.touchmove(event));
        this.section.addEventListener("touchend", event => Cube.touchend(event));
        
        this.idleFrames = 0;
    },
}

var Blocks = {};

class Block {
    loaded = false;

    constructor(id, x, y) {
        this.id = id;
        this.x = x;
        this.y = y;

        this.size = DeviceInfo.blockSize;
        this.pos = DeviceInfo.getPopupPosition(this.x, this.y);
        this.window = open(`block/${id}.html`, '_blank', `popup=true,width=${this.size},height=${this.size},top=${this.pos[1]},left=${this.pos[0]}`);

        this.window.onload = event => {
            this.window.postMessage({ name: 'ping' });
        };
    }

    static addAsync(id,x,y){
        setTimeout(() => {
            Blocks.list[id] = new Block(id, x, y);
        }, 1);
    }
    
    resize(x, y, w, h){
        this.window.resizeTo(w + DeviceInfo.popup.padW, h);
        this.window.moveTo(x, y);
    }
    
    highlight(){
        var pos = DeviceInfo.highlightPosition,
            size = DeviceInfo.highlightSize;
        this.resize(pos[0], pos[1], size, size + DeviceInfo.tabHeight);
    }
    
    unhighlight(){
        var pos = this.pos,
            size = DeviceInfo.blockSize;
        this.resize(pos[0], pos[1], size, size + DeviceInfo.tabHeight);
    }
    
    send(data){
        this.window.postMessage(data);
    }

    close() {
        this.window.close();
    }
}

Blocks = {
    list: [],
    blocksLoaded: 0,
    loaded: false,
    ready: false,
    autoplay: false,

    load() {
        for (var i = 0; i < 4; i++) {
            for (var j = 0; j < 4; j++) {
                Block.addAsync(4 * i + j, j, i);
            }
        }
        
        this.loaded = true;
        UI.update();
    },

    blockLoaded(data){
        this.list[Number(data.source)].loaded = true;
        this.blocksLoaded++;

        if(this.blocksLoaded == 16){
            this.ready = true;
            UI.update();
            
            this.spin();
            
            if(this.autoplay){
                setTimeout(_ => {
                    Blocks.play();
                },1000);
            }
        }
    },
    
    sendAll(data){
        this.list.forEach(w =>{
            w.send(data);
        })
    },
    
    spin(){
        Blocks.sendAll({name:'spin'});
    },
    
    highlighted: null,
    highlight(id){
        var block = this.list[id];
        if(this.highlighted == id){
            block.unhighlight();
            this.highlighted = null;
            return;
        }
        
        if(this.highlighted != null) this.list[this.highlighted].unhighlight();
        block.highlight();
        this.highlighted = id;
    },

    terminate() {
        this.list.forEach(block => block.close());
        this.list = [];
        this.blocksLoaded = 0;
        this.loaded = false;
        this.ready = false;
        UI.update();
    },
    
    play(){
        this.sendAll({
            name:'play',
            time: performance.timeOrigin + performance.now()
        });
        
        setTimeout(() => {
            Blocks.terminate();
        }, 168142);
    },
    
    tickCompare: [],
    tick(){
        var time = performance.timeOrigin + performance.now();
        Blocks.sendAll({
            name:'tick',
            time: time
        });
        this.tickCompare = Array.make(16, i => [time + Bit_Milliseconds * 12 * i, null]);
    },
    
    test1(){
        Blocks.sendAll({name:'bar',time:new Date().getTime(),bar:10});
    },
    test2(){
        Blocks.sendAll({name:'bar',time:new Date().getTime(),bar:25});
    },
    test3(){
        Blocks.sendAll({name:'bar',time:new Date().getTime(),bar:40});
    },
    test4(){
        Blocks.sendAll({name:'bar',time:new Date().getTime(),bar:66});
    },
}

window.addEventListener("message", (event) => {
    var data = event.data;
    //if(!data._relay) log(data);

    if (data.name == 'calibrate') {
        DeviceInfo.endCalibrate(data);
    } else if (data.name == 'ping') {
        //eat the ping
    } else if (data.name == 'loaded'){
        Blocks.blockLoaded(data);
    } else if (data.name == 'tickInfo'){
        Blocks.tickCompare[data.id][1] = data.time;
    } else if (data.name == 'highlight'){
        if(HighlightMode) Blocks.highlight(data.id);
    }
    
    if(data._relay == true){
        Blocks.sendAll(data);
    }
    log(event);
});

var UI = {
    calibrate: gebi('calibrate'),
    highlightMode: gebi('highlightmode'),
    load: gebi('load'),
    autoplay: gebi('autoplay'),
    play: gebi('play'),
    terminate: gebi('terminate'),
    tick: gebi('tick'),
    spin: gebi('spin'),
    
    update(){
        var calibrated = DeviceInfo.calibrated,
            loaded = calibrated && Blocks.loaded,
            ready = loaded && Blocks.ready;
        
        this.load.disabled = !calibrated;
        this.play.disabled = !ready;
        this.terminate.disabled = !loaded;
        this.tick.disabled = !ready;
        this.spin.disabled = !ready;
    },
    
    init(){
        this.autoplay.addEventListener('input',event => {
            Blocks.autoplay = event.target.checked;
        });
        this.highlightMode.addEventListener('input',event => {
            HighlightMode = event.target.checked;
            DeviceInfo.calibrated = false;
            UI.update();
        })
    },
};

var lastTick = 0;
function animate(){
    const now = performance.now();
    const deltaTime = (performance.now() - lastTick) * 0.001;
    lastTick = now;
    
    Cube.animate(deltaTime);
    
    window.requestAnimationFrame(animate);
}

function load(){
    Cube.init();
    UI.init();
    animate();
};