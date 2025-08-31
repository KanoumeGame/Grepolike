import Phaser from 'phaser';

const TILE_SIZE = 32;
const MINIMAP_SIZE = 150;

class MinimapScene extends Phaser.Scene {
    constructor() {
        super({ key: 'MinimapScene' });
        this.mainScene = null;
        this.minimap = null;
        this.minimapUI = null; // For border and crosshair
        this.minimapIslands = null;
        this.minimapCities = null;
        this.minimapRuins = null;
        this.minimapCircle = null;
        this.isCreated = false;
        this.needsToIgnoreObjects = true;
        this.needsToIgnoreOnMain = true;
    }

    init(data) {
        this.mainScene = data.mainScene;
    }

    create() {
        // This listener will receive props from the main scene.
        this.mainScene.events.on('updateMinimapProps', (props) => {
            this.props = props;
            
            // If the minimap hasn't been created yet and we have the necessary data, create it.
            if (!this.isCreated && props.worldState) {
                this.createMinimap();
                this.isCreated = true;
            }

            // After creation, always redraw elements when props update.
            if (this.isCreated) {
                this.drawMapElements();
            }
        });
    }

    update() {
        if (this.isCreated) {
             this.updateMinimapCamera();

             // Defer ignoring main scene objects on the minimap camera until they exist
             if (this.needsToIgnoreObjects && this.mainScene.tooltip) {
                const objectsToIgnore = [
                    ...Array.from(this.mainScene.mapObjects.values()),
                    ...Array.from(this.mainScene.movementObjects.values()),
                    this.mainScene.tooltip
                ].filter(Boolean);

                if (objectsToIgnore.length > 0) {
                    this.minimap.ignore(objectsToIgnore);
                }
                this.needsToIgnoreObjects = false; // Ensure this only runs once
             }
             
             // Defer ignoring minimap graphics on the main camera until they exist
             if (this.needsToIgnoreOnMain && this.mainScene.cameras.main) {
                this.mainScene.cameras.main.ignore([
                    this.minimapIslands,
                    this.minimapRuins,
                    this.minimapCities,
                    this.minimapCircle,
                    this.minimapUI
                ]);
                this.needsToIgnoreOnMain = false; // Ensure this only runs once
             }
        }
    }

    // # Creates the minimap camera, mask, and graphics objects
    createMinimap() {
        if (!this.mainScene.props.worldState) return;
    
        const minimapX = 10;
        const minimapY = 70;
        const minimapRadius = MINIMAP_SIZE / 2;
    
        // # New zoom logic for a "radar" style view
        const minimapZoom = 0.1; // # Zoom out to show a portion of the map
    
        this.minimap = this.cameras.add(minimapX, minimapY, MINIMAP_SIZE, MINIMAP_SIZE)
            .setZoom(minimapZoom)
            .setName('minimap')
            .setBackgroundColor(0x1e3a8a);
    
        this.minimapCircle = this.add.graphics({ x: minimapX, y: minimapY }).setDepth(100).setScrollFactor(0);
        this.minimapCircle.fillStyle(0xffffff);
        this.minimapCircle.fillCircle(minimapRadius, minimapRadius, minimapRadius);
        const mask = this.minimapCircle.createGeometryMask();
        this.minimap.setMask(mask);
        
        // # UI elements like border, fixed on screen
        this.minimapUI = this.add.graphics().setDepth(101).setScrollFactor(0);
        
        // # Map elements that will be scrolled by the minimap camera
        this.minimapIslands = this.add.graphics({ x: 0, y: 0 }).setDepth(0);
        this.minimapRuins = this.add.graphics({ x: 0, y: 0 }).setDepth(1); 
        this.minimapCities = this.add.graphics({ x: 0, y: 0 }).setDepth(2); 
    }
    
    // # Updates the minimap camera to follow the main camera and draws UI elements
    updateMinimapCamera() {
        if (!this.minimap || !this.mainScene.cameras.main) return;
    
        const mainCam = this.mainScene.cameras.main;

        // # Center the minimap on the main camera's center and adjust zoom
        this.minimap.centerOn(mainCam.worldView.centerX, mainCam.worldView.centerY);
        this.minimap.setZoom(mainCam.zoom * 0.1); // Base zoom of 0.1, adjusted by main camera's zoom
        
        const minimapX = 10;
        const minimapY = 70;
        const minimapRadius = MINIMAP_SIZE / 2;
    
        this.minimapUI.clear();
        
        const centerX = minimapX + minimapRadius;
        const centerY = minimapY + minimapRadius;

        // # Draw a metallic-style border
        // Outer shadow
        this.minimapUI.lineStyle(2, 0x000000, 0.3);
        this.minimapUI.strokeCircle(centerX, centerY, minimapRadius + 1);

        // Main silver part
        this.minimapUI.lineStyle(4, 0xC0C0C0, 1); // Silver color
        this.minimapUI.strokeCircle(centerX, centerY, minimapRadius);

        // Inner highlight
        this.minimapUI.lineStyle(1.5, 0xFFFFFF, 0.8);
        this.minimapUI.strokeCircle(centerX, centerY, minimapRadius - 2);

        // Inner shadow
        this.minimapUI.lineStyle(1, 0x808080, 0.7);
        this.minimapUI.strokeCircle(centerX, centerY, minimapRadius - 3);
    }
    
    // # Draws all the static elements on the minimap
    drawMapElements() {
        if (!this.props || !this.props.worldState) return;

        // Draw Islands
        this.minimapIslands.clear();
        this.minimapIslands.fillStyle(0x228B22, 1);
        this.props.worldState.islands.forEach(island => {
            this.minimapIslands.fillCircle(island.x * TILE_SIZE, island.y * TILE_SIZE, island.radius * TILE_SIZE);
        });

        // Draw Ruins
        this.minimapRuins.clear();
        Object.values(this.props.ruins).forEach(ruin => {
            const color = (ruin.ownerId && ruin.ownerId !== 'ruins') ? 0x9400D3 : 0x808080;
            this.minimapRuins.lineStyle(1, 0x000000, 0.8);
            this.minimapRuins.fillStyle(color, 1);
            this.minimapRuins.fillCircle(ruin.x * TILE_SIZE + TILE_SIZE / 2, ruin.y * TILE_SIZE + TILE_SIZE / 2, TILE_SIZE * 0.9);
            this.minimapRuins.strokeCircle(ruin.x * TILE_SIZE + TILE_SIZE / 2, ruin.y * TILE_SIZE + TILE_SIZE / 2, TILE_SIZE * 0.9);
        });

        // Draw Cities
        this.minimapCities.clear();
        Object.values(this.props.combinedSlots).forEach(slot => {
            if (slot.ownerId) {
                let color = 0xffa500; // Neutral
                if (slot.ownerId === this.mainScene.auth.currentUser.uid) {
                    color = 0xffff00; // Your city
                } else if (this.props.playerAlliance?.diplomacy?.allies?.some(a => a.tag === slot.alliance) || (this.props.playerAlliance && slot.alliance === this.props.playerAlliance.tag)) {
                    color = 0x00ff00; // Ally
                } else if (this.props.playerAlliance?.diplomacy?.enemies?.some(e => e.tag === slot.alliance)) {
                    color = 0xff0000; // Enemy
                }
                this.minimapCities.lineStyle(1, 0x000000, 0.8);
                this.minimapCities.fillStyle(color, 1);
                this.minimapCities.fillCircle(slot.x * TILE_SIZE + TILE_SIZE / 2, slot.y * TILE_SIZE + TILE_SIZE / 2, TILE_SIZE * 0.8);
                this.minimapCities.strokeCircle(slot.x * TILE_SIZE + TILE_SIZE / 2, slot.y * TILE_SIZE + TILE_SIZE / 2, TILE_SIZE * 0.8);
            }
        });
    }
}

export default MinimapScene;

