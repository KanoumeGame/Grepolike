import React, { useEffect, useRef} from 'react';
import Phaser from 'phaser';
import { useAuth } from '../../contexts/AuthContext';

// # Import images needed for the map
import island1 from '../../images/islands/island_1.png';
import island2 from '../../images/islands/island_2.png';
import citySpriteSheet from '../../images/city_modal.png';
import villageSpriteSheet from '../../images/villages.png';
import ruinSpriteSheet from '../../images/ruins.png';
import godTownImage from '../../images/god-town.png';
import constructingWonderImage from '../../images/special_buildings/alliance_wonders.jpg';
import wreckImage from '../../images/wreck.png';
import waterImage from '../../images/water.png'; 

const TILE_SIZE = 32;
const MINIMAP_WIDTH = 200;
const MINIMAP_HEIGHT = 150;

// # The main Phaser Scene for our map
class MapScene extends Phaser.Scene {
    constructor() {
        super({ key: 'MapScene' });
        this.props = {};
        this.mapObjects = new Map();
        this.movementObjects = new Map();
        this.tooltip = null;
        this.auth = {};
        this.DOTS_ZOOM_THRESHOLD = 0.25; // # Zoom level to switch to dots view
        this.initialResizeDone = false; // # Flag to handle initial camera setup
        this.minimapRect = null;
        this.minimapIslands = null;
        this.minimapCities = null;
        // # Centralized settings for icon sizes. Adjust these values to resize map icons.
        this.iconScales = {
            city: 0.3,
            village: 0.5,
            ruin: 0.25,
            god_town: 0.5,
            constructing_wonder: 0.5,
            wreckage: 0.5,
            alliance_wonders: 0.5
        };
    }

    // # Initialize scene with data from React
    init(data) {
        this.props = data.props;
        this.auth = data.auth;
    }

    // # Load all our images and assets
    preload() {
        this.load.image('island1', island1);
        this.load.image('island2', island2);
        this.load.spritesheet('citySprite', citySpriteSheet, { frameWidth: 220, frameHeight: 150 });
        this.load.spritesheet('villageSprite', villageSpriteSheet, { frameWidth: 80, frameHeight: 60 });
        this.load.spritesheet('ruinSprite', ruinSpriteSheet, { frameWidth: 220, frameHeight: 190 });
        this.load.image('godTown', godTownImage);
        this.load.image('constructingWonder', constructingWonderImage, { frameWidth: 50, frameHeight: 40 });
        this.load.image('wreck', wreckImage);
        this.load.image('water', waterImage); // Load water texture
        this.load.image('arrow', 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAoAAAAMCAQAAAAAdtPUAAAADklEQVR42mNkgANGQgwAANLQIwU7/zf2AAAAAElFTkSuQmCC');
    }

    // # Create game objects and set up controls
    create() {
        // # Generate textures for movement arrows
        this.generateArrowTextures();
        this.setupCameraControls();

        this.minimapRect = this.add.graphics().setDepth(101);
        this.minimapIslands = this.add.graphics().setDepth(0);
        this.minimapCities = this.add.graphics().setDepth(1);
        
        // # Simple tooltip for hovering over map objects
        this.tooltip = this.add.text(0, 0, '', {
            font: '14px Inter', fill: '#ffffff', backgroundColor: 'rgba(0,0,0,0.7)',
            padding: { x: 8, y: 4 }, borderRadius: 4, align: 'center',
            wordWrap: { width: 200, useAdvancedWrap: true }
        }).setOrigin(0.5, 1).setDepth(100).setVisible(false);
        
        // # Listen for prop updates from React
        this.game.events.on('updateProps', (newProps) => {
            const isInitialUpdate = !this.props.worldState && newProps.worldState;
            this.props = newProps;
            if (isInitialUpdate) {
                // # This is the first time we're getting real props, so run the initial setup
                const { worldState } = this.props;
                this.add.tileSprite(0, 0, worldState.width * TILE_SIZE, worldState.height * TILE_SIZE, 'water')
                    .setOrigin(0, 0)
                    .setDepth(-1);
                this.cameras.main.setBounds(0, 0, worldState.width * TILE_SIZE, worldState.height * TILE_SIZE);
                this.scale.on('resize', this.resize, this);
                this.resize(this.scale.gameSize);
                this.createMinimap();
                this.drawMinimapIslands(); // Draw static islands once
            }
            this.drawMap();
        });

        // # Add a listener to redraw the map when zoom changes
        this.cameras.main.on('zoom', this.drawMap, this);
    }

    // # Creates the minimap camera and its viewport rectangle
    createMinimap() {
        const { worldState } = this.props;
        if (!worldState) return;

        const worldWidth = worldState.width * TILE_SIZE;
        const worldHeight = worldState.height * TILE_SIZE;

        // Calculate zoom to fit the entire world into the minimap dimensions
        const zoomX = MINIMAP_WIDTH / worldWidth;
        const zoomY = MINIMAP_HEIGHT / worldHeight;
        const minimapZoom = Math.min(zoomX, zoomY);

        this.minimap = this.cameras.add(10, 10, MINIMAP_WIDTH, MINIMAP_HEIGHT)
            .setZoom(minimapZoom)
            .setName('minimap')
            .setBackgroundColor(0x002244)
            .setScroll(
                (worldWidth / 2) - (MINIMAP_WIDTH / minimapZoom / 2),
                (worldHeight / 2) - (MINIMAP_HEIGHT / minimapZoom / 2)
            );

        this.cameras.main.ignore([this.minimapRect, this.minimapIslands, this.minimapCities]);
        this.minimap.ignore([this.tooltip, this.minimapRect]);
    }

    // # Updates the minimap border and viewport rectangle
    updateMinimap() {
        if (!this.minimap || !this.cameras.main) return;

        this.minimapRect.clear();
        
        // # Draw border for minimap
        this.minimapRect.lineStyle(2, 0xffffff, 0.7);
        this.minimapRect.strokeRect(this.minimap.x, this.minimap.y, this.minimap.width, this.minimap.height);

        // # Draw main camera viewport on minimap
        const mainCam = this.cameras.main;
        const minimapZoom = this.minimap.zoom;
        const rectX = this.minimap.x + (mainCam.worldView.x - this.minimap.worldView.x) * minimapZoom;
        const rectY = this.minimap.y + (mainCam.worldView.y - this.minimap.worldView.y) * minimapZoom;
        const rectWidth = mainCam.worldView.width * minimapZoom;
        const rectHeight = mainCam.worldView.height * minimapZoom;
        this.minimapRect.lineStyle(1, 0xffffff, 1).strokeRect(rectX, rectY, rectWidth, rectHeight);
    }


    // # Generate custom textures needed for the scene
    generateArrowTextures() {
        // # Movement arrow texture
        const arrowGraphics = this.make.graphics({ x: 0, y: 0 }, false);
        arrowGraphics.fillStyle(0xffffff);
        arrowGraphics.beginPath();
        arrowGraphics.moveTo(0, -4);
        arrowGraphics.lineTo(4, 4);
        arrowGraphics.lineTo(-4, 4);
        arrowGraphics.closePath();
        arrowGraphics.fillPath();
        arrowGraphics.generateTexture('arrow_texture', 8, 8);
        arrowGraphics.destroy();
    }

    // # Handle camera resizing to prevent showing black bars
    resize(gameSize) {
        this.cameras.main.width = gameSize.width;
        this.cameras.main.height = gameSize.height;
    
        const { worldState } = this.props;
        if (worldState) {
            const worldWidth = worldState.width * TILE_SIZE;
            const worldHeight = worldState.height * TILE_SIZE;
            // # Calculate the minimum zoom to ensure the map always fills the viewport
            const minZoom = Math.max(gameSize.width / worldWidth, gameSize.height / worldHeight);
            this.cameras.main.minZoom = minZoom;
    
            // # On the very first resize/load, fit the map to the screen.
            if (!this.initialResizeDone) {
                this.cameras.main.setZoom(minZoom);
                this.initialResizeDone = true;
            }
            // # If the window is resized and zoom is now too low, adjust it
            else if (this.cameras.main.zoom < minZoom) {
                this.cameras.main.setZoom(minZoom);
            }
        }
    }
    
    // # Game loop for continuous updates
    update() {
        this.updateMovements();
        this.updateMinimap();
    }

    // # gets a color based on happiness
    getHappinessColor(happiness) {
        if (happiness === undefined || happiness === null) happiness = 100;
        const h = Phaser.Math.Clamp(happiness, 0, 100) / 100;

        // # Interpolate from red (h=0) to yellow (h=0.5) to green (h=1)
        let red, green;
        if (h < 0.5) {
            // # from red to yellow
            red = 255;
            green = Math.floor(255 * (h * 2));
        } else {
            // # from yellow to green
            red = Math.floor(255 * (2 * (1 - h)));
            green = 255;
        }
        const blue = 0;

        // # Combine into a single hex value for Phaser tint
        return (red << 16) + (green << 8) + blue;
    }
    
    // # Draws static island shapes on the minimap
    drawMinimapIslands() {
        if (!this.minimapIslands || !this.props.worldState) return;
        this.minimapIslands.clear();
        this.minimapIslands.fillStyle(0x228B22, 1); // Forest Green
        this.props.worldState.islands.forEach(island => {
            this.minimapIslands.fillCircle(island.x * TILE_SIZE, island.y * TILE_SIZE, island.radius * TILE_SIZE);
        });
    }

    // # Draws dynamic city dots on the minimap
    drawMinimapCities() {
        if (!this.minimapCities || !this.props.combinedSlots) return;
        this.minimapCities.clear();

        Object.values(this.props.combinedSlots).forEach(slot => {
            if (slot.ownerId) {
                let color = 0xffa500; // Neutral (Orange)
                if (slot.ownerId === this.auth.currentUser.uid) {
                    color = 0xffff00; // Own city (Yellow)
                } else if (this.props.playerAlliance?.diplomacy?.allies?.some(a => a.tag === slot.alliance) || (this.props.playerAlliance && slot.alliance === this.props.playerAlliance.tag)) {
                    color = 0x00ff00; // Ally/Same Alliance (Green)
                } else if (this.props.playerAlliance?.diplomacy?.enemies?.some(e => e.tag === slot.alliance)) {
                    color = 0xff0000; // Enemy (Red)
                }
                this.minimapCities.fillStyle(color, 1);
                this.minimapCities.fillCircle(slot.x * TILE_SIZE + TILE_SIZE / 2, slot.y * TILE_SIZE + TILE_SIZE / 2, TILE_SIZE * 0.8);
            }
        });
    }


    // # Main function to draw everything on the map, handles both detailed and dot views
    drawMap() {
        this.mapObjects.forEach(obj => obj.destroy());
        this.mapObjects.clear();
        
        const { worldState, combinedSlots, villages, ruins, godTowns, wonderSpots, allWonders, visibleWreckages } = this.props;

        if (!worldState) return;

        // # Draw minimap cities
        this.drawMinimapCities();

        // # Always draw islands first so they are in the background
        worldState.islands.forEach(island => {
            const islandImageKey = island.imageName === 'island_2.png' ? 'island2' : 'island1';
            const islandSprite = this.add.image(island.x * TILE_SIZE, island.y * TILE_SIZE, islandImageKey)
                .setDisplaySize(island.radius * 2 * TILE_SIZE, island.radius * 2 * TILE_SIZE)
                .setOrigin(0.5).setDepth(0);
            this.mapObjects.set(`island-${island.id}`, islandSprite);
            if (this.minimap) this.minimap.ignore(islandSprite);
        });

        const isDotsView = this.cameras.main.zoom < this.DOTS_ZOOM_THRESHOLD;

        const createFakeEvent = (pointer) => ({
            currentTarget: { getBoundingClientRect: () => ({ left: pointer.x, top: pointer.y, right: pointer.x, bottom: pointer.y, width: 0, height: 0 }) },
            stopPropagation: () => {},
        });

        if (isDotsView) {
            // # Draw circles for occupied cities only
            Object.values(combinedSlots || {}).forEach(slot => {
                if (slot.ownerId) {
                    const key = `dot-${slot.id}`;
                    const x = slot.x * TILE_SIZE + TILE_SIZE / 2;
                    const y = slot.y * TILE_SIZE + TILE_SIZE / 2;
                    const dot = this.add.graphics({ x: x, y: y });

                    let color = 0xffa500; // # Neutral (Brown/Orange)
                    if (slot.ownerId === this.auth.currentUser.uid) {
                        color = 0xffff00; // # Own city (Yellow)
                    } else if (this.props.playerAlliance?.diplomacy?.allies?.some(a => a.tag === slot.alliance) || (this.props.playerAlliance && slot.alliance === this.props.playerAlliance.tag)) {
                        color = 0x00ff00; // # Ally/Same Alliance (Green)
                    } else if (this.props.playerAlliance?.diplomacy?.enemies?.some(e => e.tag === slot.alliance)) {
                        color = 0xff0000; // # Enemy (Red)
                    }
                    
                    dot.fillStyle(color, 0.9);
                    dot.fillCircle(0, 0, TILE_SIZE * 0.4);
                    dot.setInteractive(new Phaser.Geom.Circle(0, 0, TILE_SIZE * 0.4), Phaser.Geom.Circle.Contains).setDepth(2);

                    const tooltipText = `${slot.cityName}\nOwner: ${slot.ownerUsername || 'Unclaimed'}`;
                    dot.on('pointerdown', (pointer) => this.props.onCitySlotClick(createFakeEvent(pointer), slot));
                    dot.on('pointerover', (pointer) => {
                        this.tooltip.setText(tooltipText).setPosition(pointer.worldX, pointer.worldY - 20).setVisible(true);
                    });
                    dot.on('pointerout', () => this.tooltip.setVisible(false));
                    this.mapObjects.set(key, dot);
                    if (this.minimap) this.minimap.ignore(dot);
                }
            });
        } else {
            // # Draw detailed map objects
            Object.values(combinedSlots || {}).forEach(slot => this.drawMapObject(slot, 'city'));
            Object.values(villages || {}).forEach(village => this.drawMapObject(village, 'village'));
            Object.values(ruins || {}).forEach(ruin => this.drawMapObject(ruin, 'ruin'));
            Object.values(godTowns || {}).forEach(town => this.drawMapObject(town, 'god_town'));
            Object.values(wonderSpots || {}).forEach(spot => this.drawMapObject(spot, 'wonder_spot'));
            Object.values(allWonders || {}).forEach(wonder => this.drawMapObject(wonder, 'constructing_wonder'));
            Object.values(visibleWreckages || {}).forEach(wreckage => this.drawMapObject(wreckage, 'wreckage'));
        }
    }

    // # Helper to draw a single map object
    drawMapObject(data, type) {
        if (!data) return;
        const key = `${type}-${data.id}`;
        const x = data.x * TILE_SIZE + TILE_SIZE / 2;
        const y = data.y * TILE_SIZE + TILE_SIZE / 2;
        let gameObject;
        let tooltipText = '';

        const baseProps = { key, x, y, details: data };

        const createFakeEvent = (pointer) => ({
            currentTarget: { getBoundingClientRect: () => ({ left: pointer.x, top: pointer.y, right: pointer.x, bottom: pointer.y, width: 0, height: 0 }) },
            stopPropagation: () => {},
        });

        switch (type) {
            case 'city':
                if (data.ownerId) {
                    const points = this.props.cityPoints[data.slotId] || 0;
                    // # Determine city frame based on points for a visual progression
                    let frame = 0;
                    if (points >= 10000) {
                        frame = 4;
                    } else if (points >= 7500) {
                        frame = 3;
                    } else if (points >= 3000) {
                        frame = 2;
                    } else if (points >= 1000) {
                        frame = 1;
                    }
                    gameObject = this.add.sprite(baseProps.x, baseProps.y, 'citySprite', frame).setInteractive().setScale(this.iconScales.city);
                    
                    tooltipText = `${data.cityName}\nOwner: ${data.ownerUsername || 'Unclaimed'}\nPoints: ${points.toLocaleString()}`;
                    
                    if (data.ownerId === this.auth.currentUser.uid) {
                        gameObject.setTint(0xffff00);
                    } else if (this.props.playerAlliance && data.alliance === this.props.playerAlliance.tag) {
                        gameObject.setTint(0x00ff00); // # Changed to Green for same alliance
                    } else if (this.props.playerAlliance?.diplomacy?.allies?.some(a => a.tag === data.alliance)) {
                        gameObject.setTint(0x00ff00);
                    } else if (this.props.playerAlliance?.diplomacy?.enemies?.some(e => e.tag === data.alliance)) {
                        gameObject.setTint(0xff0000);
                    } else {
                        gameObject.setTint(0xffa500); // # Neutral is Brown/Orange
                    }
                } else {
                    gameObject = this.add.graphics({ x: baseProps.x, y: baseProps.y });
                    gameObject.fillStyle(0xcccccc, 0.6);
                    gameObject.fillCircle(0, 0, TILE_SIZE / 3);
                    gameObject.lineStyle(1, 0xffffff, 0.8);
                    gameObject.strokeCircle(0, 0, TILE_SIZE / 3);
                    gameObject.setInteractive(new Phaser.Geom.Circle(0, 0, TILE_SIZE / 3), Phaser.Geom.Circle.Contains).setDepth(1);
                    tooltipText = `Empty Plot (${data.x}, ${data.y})`;
                }
                gameObject.on('pointerdown', (pointer) => this.props.onCitySlotClick(createFakeEvent(pointer), data));
                break;
            case 'village':
                // # Correctly determine the village level, especially for conquered villages
                const isConquered = this.props.conqueredVillages && this.props.conqueredVillages[data.id];
                const villageInfo = isConquered ? this.props.conqueredVillages[data.id] : data;
                const level = villageInfo.level || 1;
                
                // # Set the sprite frame based on the village level (frame index is level - 1)
                gameObject = this.add.sprite(baseProps.x, baseProps.y, 'villageSprite', level - 1).setInteractive().setScale(this.iconScales.village);
                
                if (isConquered) {
                    const happiness = villageInfo.happiness !== undefined ? villageInfo.happiness : 100;
                    gameObject.setTint(this.getHappinessColor(happiness));
                    tooltipText = `Your Village: ${data.name}\nHappiness: ${Math.floor(happiness)}%`;
                } else {
                    tooltipText = `Village: ${data.name}\nLevel: ${level}`;
                }
                gameObject.on('pointerdown', (pointer) => this.props.onVillageClick(createFakeEvent(pointer), data));
                break;
            default:
                 // # Logic for other types remains the same as original
                if (type === 'ruin') {
                    const isOccupied = data.ownerId && data.ownerId !== 'ruins';
                    gameObject = this.add.sprite(baseProps.x, baseProps.y, 'ruinSprite', isOccupied ? 1 : 0).setInteractive().setScale(this.iconScales.ruin);
                    tooltipText = isOccupied ? `Conquered Ruin\nOwner: ${data.ownerUsername}` : `Ruin: ${data.name}`;
                    gameObject.on('pointerdown', (pointer) => this.props.onRuinClick(createFakeEvent(pointer), data));
                } else if (type === 'god_town') {
                    gameObject = this.add.image(baseProps.x, baseProps.y, 'godTown').setInteractive().setScale(this.iconScales.god_town);
                    tooltipText = data.stage === 'ruins' ? `Strange Ruins` : `God Town: ${data.name}`;
                    gameObject.on('pointerdown', () => this.props.onGodTownClick(data.id));
                } else if (type === 'wonder_spot') {
                    gameObject = this.add.graphics({ x: baseProps.x, y: baseProps.y });
                    gameObject.fillStyle(0xFFFF00, 0.5);
                    gameObject.fillCircle(0, 0, TILE_SIZE / 2);
                    gameObject.setInteractive(new Phaser.Geom.Circle(0, 0, TILE_SIZE / 2), Phaser.Geom.Circle.Contains);
                    tooltipText = "Build an Alliance Wonder";
                    gameObject.on('pointerdown', () => this.props.onWonderSpotClick(data));
                } else if (type === 'constructing_wonder') {
                    gameObject = this.add.image(baseProps.x, baseProps.y, 'constructingWonder').setInteractive().setScale(this.iconScales.constructing_wonder);
                    tooltipText = `Constructing Wonder\nAlliance: ${data.allianceName}`;
                    gameObject.on('pointerdown', () => this.props.onConstructingWonderClick(data));
                } else if (type === 'wreckage') {
                    gameObject = this.add.image(baseProps.x, baseProps.y, 'wreck').setInteractive().setScale(this.iconScales.wreckage);
                    const resourceType = Object.keys(data.resources)[0];
                    tooltipText = `Sea Resources\n${resourceType}: ${data.resources[resourceType].toLocaleString()}`;
                    gameObject.on('pointerdown', (pointer) => this.props.onWreckageClick(createFakeEvent(pointer), data));
                }
                break;
        }

        if (gameObject) {
            gameObject.setData('details', data);
            gameObject.on('pointerover', (pointer) => {
                this.tooltip.setText(tooltipText);
                this.tooltip.setPosition(pointer.worldX, pointer.worldY - 30);
                this.tooltip.setVisible(true);
            });
            gameObject.on('pointerout', () => this.tooltip.setVisible(false));
            this.mapObjects.set(key, gameObject);
            if (this.minimap) this.minimap.ignore(gameObject);
        }
    }
    
    // # Update positions of movement indicators
    updateMovements() {
        const now = Date.now();
        const existingMovementIds = new Set();
        const movementColors = {
            attack: 0xff4141, // red
            attack_village: 0xff4141,
            attack_ruin: 0xff4141,
            attack_god_town: 0xff4141,
            reinforce: 0x4169ff, // blue
            trade: 0x41ff7b, // green
            scout: 0xba41ff, // purple
            return: 0xcccccc, // grey
            found_city: 0xfff341, // yellow
            rescue_hero: 0xffa500, // orange
            collect_wreckage: 0x00ced1, // dark turquoise
            default: 0xffffff // white
        };

        (this.props.movements || []).forEach(movement => {
            existingMovementIds.add(movement.id);

            const departureTime = movement.departureTime?.toDate().getTime() || now;
            const arrivalTime = movement.arrivalTime?.toDate().getTime() || now;
            let progress = (now - departureTime) / (arrivalTime - departureTime);
            progress = Phaser.Math.Clamp(progress, 0, 1);

            const originCoords = movement.originCoords;
            const targetCoords = movement.targetCoords;
            if (!originCoords || !targetCoords) return;

            const origin = { x: originCoords.x * TILE_SIZE + TILE_SIZE / 2, y: originCoords.y * TILE_SIZE + TILE_SIZE / 2 };
            const target = { x: targetCoords.x * TILE_SIZE + TILE_SIZE / 2, y: targetCoords.y * TILE_SIZE + TILE_SIZE / 2 };

            let movementObject = this.movementObjects.get(movement.id);
            const angle = Phaser.Math.Angle.Between(origin.x, origin.y, target.x, target.y);
            const color = movementColors[movement.type] || movementColors.default;

            if (!movementObject) {
                const swordIcon = this.add.text(0, 0, '⚔️', { fontSize: '16px' }).setOrigin(0.5);
                swordIcon.setColor(Phaser.Display.Color.ValueToColor(color).rgba);
                const path = new Phaser.Curves.Line(new Phaser.Math.Vector2(origin.x, origin.y), new Phaser.Math.Vector2(target.x, target.y));
                const arrowsGroup = this.add.group();

                movementObject = { swordIcon, arrowsGroup, path, color };
                this.movementObjects.set(movement.id, movementObject);
                if (this.minimap) {
                    this.minimap.ignore(swordIcon);
                    this.minimap.ignore(arrowsGroup);
                }
            }

            const { swordIcon, arrowsGroup, path } = movementObject;

            const totalDistance = path.getLength();
            const currentPos = path.getPoint(progress);

            swordIcon.setPosition(currentPos.x, currentPos.y);
            swordIcon.setRotation(angle + Math.PI / 2);
            swordIcon.setDepth(51);

            const spacing = 35;
            const animationSpeed = 40;
            const offset = (this.time.now / 1000 * animationSpeed) % spacing;

            const numArrowsNeeded = Math.ceil(totalDistance / spacing);
            let currentArrows = arrowsGroup.getChildren();

            if (currentArrows.length < numArrowsNeeded) {
                for (let i = currentArrows.length; i < numArrowsNeeded; i++) {
                    const arrow = this.add.image(0, 0, 'arrow_texture').setScale(0.7).setDepth(50);
                    arrow.setRotation(angle + Math.PI / 2);
                    arrow.setTint(color);
                    arrowsGroup.add(arrow);
                }
                currentArrows = arrowsGroup.getChildren();
            }

            currentArrows.forEach((arrow, index) => {
                const distOnPath = index * spacing + offset;
                if (distOnPath <= totalDistance) {
                    const point = path.getPoint(distOnPath / totalDistance);
                    arrow.setPosition(point.x, point.y);
                    arrow.setVisible(true);
                } else {
                    arrow.setVisible(false);
                }
            });
        });

        this.movementObjects.forEach((obj, id) => {
            if (!existingMovementIds.has(id)) {
                obj.swordIcon.destroy();
                obj.arrowsGroup.destroy(true, true);
                this.movementObjects.delete(id);
            }
        });
    }

    // # Set up camera panning and zooming
    setupCameraControls() {
        const cam = this.cameras.main;
        
        this.input.on('wheel', (pointer, gameObjects, deltaX, deltaY, deltaZ) => {
            const newZoom = cam.zoom - deltaY * 0.001;
            cam.zoom = Phaser.Math.Clamp(newZoom, cam.minZoom, 2.0);
        });
        
        let isPanning = false;
        this.input.on('pointerdown', (pointer) => {
            if (pointer.button === 0 && this.input.manager.hitTest(pointer, Array.from(this.mapObjects.values()), cam).length === 0) {
                isPanning = true;
                this.game.canvas.style.cursor = 'grabbing';
            }
        });
        this.input.on('pointerup', () => { isPanning = false; this.game.canvas.style.cursor = 'grab'; });
        this.input.on('pointermove', (pointer) => {
            if (isPanning && pointer.isDown) {
                cam.scrollX -= (pointer.x - pointer.prevPosition.x) / cam.zoom;
                cam.scrollY -= (pointer.y - pointer.prevPosition.y) / cam.zoom;
            }
        });
        this.game.canvas.style.cursor = 'grab';
    }
}

// # This is the React component that will contain our Phaser game
const PhaserMap = (props) => {
    const gameRef = useRef(null);
    const { currentUser } = useAuth();
    const { panToCoords } = props;
    
    useEffect(() => {
        if (!window.Phaser || !currentUser) return;

        const config = {
            type: Phaser.AUTO,
            width: '100%',
            height: '100%',
            parent: 'phaser-container',
            scene: [MapScene],
            audio: {
                noAudio: true,
                disableWebAudio: true
            }
        };

        const game = new Phaser.Game(config);
        gameRef.current = game;
        
        // # Pass empty props on init to satisfy dependency rules. The next effect will send the real props.
        game.scene.start('MapScene', { props: {}, auth: { currentUser } });

        return () => { 
            if (gameRef.current) {
                gameRef.current.destroy(true);
                gameRef.current = null;
            }
         };
    }, [currentUser]);

    useEffect(() => {
        if (gameRef.current && gameRef.current.events) {
            gameRef.current.events.emit('updateProps', props);
        }
    }, [props]);
    
    useEffect(() => {
        if (panToCoords && gameRef.current) {
            const scene = gameRef.current.scene.getScene('MapScene');
            if (scene && scene.cameras.main) {
                scene.cameras.main.pan(panToCoords.x * TILE_SIZE, panToCoords.y * TILE_SIZE, 500, 'Sine.easeInOut');
            }
        }
    }, [panToCoords]);


    return <div id="phaser-container" className="w-full h-full" />;
};

export default React.memo(PhaserMap);

