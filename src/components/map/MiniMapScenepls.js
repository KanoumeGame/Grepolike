import Phaser from 'phaser';

const TILE_SIZE = 32;
const MINIMAP_SIZE = 150;

class MinimapScene extends Phaser.Scene {
    constructor() {
        super({ key: 'MinimapScene' });
        this.mainScene = null;
        this.minimapRect = null;
        this.minimapIslands = null;
        this.minimapCities = null;
        this.minimapCircle = null;
    }

    init(data) {
        this.mainScene = data.mainScene;
    }

    create() {
        this.createMinimap();

        this.mainScene.events.on('updateMinimapProps', (props) => {
            this.props = props;
            this.drawMinimapIslands();
            this.drawMinimapCities();
        });
    }

    update() {
        if (this.props) {
             this.updateMinimap();
        }
    }

    createMinimap() {
        if (!this.mainScene.props.worldState) return;

        const { worldState } = this.mainScene.props;
        const worldWidth = worldState.width * TILE_SIZE;
        const worldHeight = worldState.height * TILE_SIZE;
        
        const minimapX = 10;
        const minimapY = 10;
        const minimapRadius = MINIMAP_SIZE / 2;

        const zoomX = MINIMAP_SIZE / worldWidth;
        const zoomY = MINIMAP_SIZE / worldHeight;
        const minimapZoom = Math.min(zoomX, zoomY);

        this.minimap = this.cameras.add(minimapX, minimapY, MINIMAP_SIZE, MINIMAP_SIZE)
            .setZoom(minimapZoom)
            .setName('minimap')
            .setBackgroundColor(0x002244)
            .setScroll(
                (worldWidth / 2) - (MINIMAP_SIZE / minimapZoom / 2),
                (worldHeight / 2) - (MINIMAP_SIZE / minimapZoom / 2)
            );

        this.minimapCircle = this.add.graphics().setDepth(100);
        this.minimapCircle.fillStyle(0xffffff);
        this.minimapCircle.fillCircle(minimapX + minimapRadius, minimapY + minimapRadius, minimapRadius);
        const mask = this.minimapCircle.createGeometryMask();
        this.minimap.setMask(mask);
        
        this.minimapRect = this.add.graphics().setDepth(101);
        this.minimapIslands = this.add.graphics({ x: 0, y: 0 }).setDepth(0);
        this.minimapCities = this.add.graphics({ x: 0, y: 0 }).setDepth(1);
        
        this.minimap.ignore([this.mainScene.mapObjects, this.mainScene.movementObjects, this.mainScene.tooltip, this.minimapRect]);
    }
    
    updateMinimap() {
        if (!this.minimap || !this.mainScene.cameras.main) return;

        const minimapX = this.minimap.x;
        const minimapY = this.minimap.y;
        const minimapRadius = MINIMAP_SIZE / 2;

        this.minimapRect.clear();
        
        this.minimapRect.lineStyle(2, 0xffffff, 0.7);
        this.minimapRect.strokeCircle(minimapX + minimapRadius, minimapY + minimapRadius, minimapRadius);

        const mainCam = this.mainScene.cameras.main;
        const minimapZoom = this.minimap.zoom;
        const rectX = this.minimap.x + (mainCam.worldView.x - this.minimap.worldView.x) * minimapZoom;
        const rectY = this.minimap.y + (mainCam.worldView.y - this.minimap.worldView.y) * minimapZoom;
        const rectWidth = mainCam.worldView.width * minimapZoom;
        const rectHeight = mainCam.worldView.height * minimapZoom;
        this.minimapRect.lineStyle(1, 0xffffff, 1).strokeRect(rectX, rectY, rectWidth, rectHeight);
    }
    
    drawMinimapIslands() {
        if (!this.minimapIslands || !this.props || !this.props.worldState) return;
        this.minimapIslands.clear();
        this.minimapIslands.fillStyle(0x228B22, 1);
        this.props.worldState.islands.forEach(island => {
            this.minimapIslands.fillCircle(island.x * TILE_SIZE, island.y * TILE_SIZE, island.radius * TILE_SIZE);
        });
    }

    drawMinimapCities() {
        if (!this.minimapCities || !this.props || !this.props.combinedSlots || !this.mainScene.auth) return;
        this.minimapCities.clear();

        Object.values(this.props.combinedSlots).forEach(slot => {
            if (slot.ownerId) {
                let color = 0xffa500;
                if (slot.ownerId === this.mainScene.auth.currentUser.uid) {
                    color = 0xffff00;
                } else if (this.props.playerAlliance?.diplomacy?.allies?.some(a => a.tag === slot.alliance) || (this.props.playerAlliance && slot.alliance === this.props.playerAlliance.tag)) {
                    color = 0x00ff00;
                } else if (this.props.playerAlliance?.diplomacy?.enemies?.some(e => e.tag === slot.alliance)) {
                    color = 0xff0000;
                }
                this.minimapCities.fillStyle(color, 1);
                this.minimapCities.fillCircle(slot.x * TILE_SIZE + TILE_SIZE / 2, slot.y * TILE_SIZE + TILE_SIZE / 2, TILE_SIZE * 0.8);
            }
        });
    }
}

export default MinimapScene;
