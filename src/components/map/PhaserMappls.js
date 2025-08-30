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

// # The main Phaser Scene for our map
class MapScene extends Phaser.Scene {
    constructor() {
        super({ key: 'MapScene' });
        this.props = {};
        this.mapObjects = new Map();
        this.movementObjects = new Map();
        this.tooltip = null;
        this.auth = {};
        // # Centralized settings for icon sizes. Adjust these values to resize map icons.
        this.iconScales = {
            city: 0.3,
            village: 0.5,
            ruin: 0.25,
            god_town: 0.5,
            constructing_wonder: 0.5,
            wreckage: 0.5,
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
        this.load.image('constructingWonder', constructingWonderImage);
        this.load.image('wreck', wreckImage);
        this.load.image('water', waterImage); // Load water texture
        this.load.image('arrow', 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAoAAAAMCAQAAAAAdtPUAAAADklEQVR42mNkgANGQgwAANLQIwU7/zf2AAAAAElFTkSuQmCC');
    }

    // # Create game objects and set up controls
    create() {
        const { worldState } = this.props;

        if (worldState) {
            // # Add a tiling sprite for the water background
            this.add.tileSprite(0, 0, worldState.width * TILE_SIZE, worldState.height * TILE_SIZE, 'water')
                .setOrigin(0, 0)
                .setDepth(-1);

            // # Set the boundaries of the camera to the world size
            this.cameras.main.setBounds(0, 0, worldState.width * TILE_SIZE, worldState.height * TILE_SIZE);
            this.cameras.main.setZoom(0.5); 
            
            // # Add resize handler to fix initial view and zoom constraints
            this.scale.on('resize', this.resize, this);
            this.resize(this.scale.gameSize);
        }

        // # Generate textures for movement arrows
        this.generateArrowTextures();
        this.drawMap();
        this.setupCameraControls();

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
                this.cameras.main.setZoom(0.5);
                this.scale.on('resize', this.resize, this);
                this.resize(this.scale.gameSize);
            }
            this.drawMap();
        });
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
            const minZoom = Math.max(gameSize.width / worldWidth, gameSize.height / worldHeight);
            this.cameras.main.minZoom = minZoom;
            if (this.cameras.main.zoom < minZoom) {
                this.cameras.main.setZoom(minZoom);
            }
        }
    }
    
    // # Game loop for continuous updates
    update() {
        this.updateMovements();
    }

    // # Main function to draw everything on the map
    drawMap() {
        this.mapObjects.forEach(obj => obj.destroy());
        this.mapObjects.clear();
        
        const { worldState, combinedSlots, villages, ruins, godTowns, wonderSpots, allWonders, visibleWreckages } = this.props;

        if (!worldState) return;

        // # Draw islands
        worldState.islands.forEach(island => {
            const islandImageKey = island.imageName === 'island_2.png' ? 'island2' : 'island1';
            const islandSprite = this.add.image(island.x * TILE_SIZE, island.y * TILE_SIZE, islandImageKey)
                .setDisplaySize(island.radius * 2 * TILE_SIZE, island.radius * 2 * TILE_SIZE)
                .setOrigin(0.5).setDepth(0);
            this.mapObjects.set(`island-${island.id}`, islandSprite);
        });

        // # Draw all map objects
        Object.values(combinedSlots || {}).forEach(slot => this.drawMapObject(slot, 'city'));
        Object.values(villages || {}).forEach(village => this.drawMapObject(village, 'village'));
        Object.values(ruins || {}).forEach(ruin => this.drawMapObject(ruin, 'ruin'));
        Object.values(godTowns || {}).forEach(town => this.drawMapObject(town, 'god_town'));
        Object.values(wonderSpots || {}).forEach(spot => this.drawMapObject(spot, 'wonder_spot'));
        Object.values(allWonders || {}).forEach(wonder => this.drawMapObject(wonder, 'constructing_wonder'));
        Object.values(visibleWreckages || {}).forEach(wreckage => this.drawMapObject(wreckage, 'wreckage'));
    }

    // # Helper to draw a single map object
    drawMapObject(data, type) {
        if (!data) return;
        const key = `${type}-${data.id}`;
        const x = data.x * TILE_SIZE + TILE_SIZE / 2;
        const y = data.y * TILE_SIZE + TILE_SIZE / 2;
        let gameObject;
        let tooltipText = '';

        const baseProps = {
            key: key,
            x: x,
            y: y,
            details: data,
        };

        const createFakeEvent = (pointer) => {
            const rect = this.game.canvas.getBoundingClientRect();
            const screenX = rect.left + pointer.x;
            const screenY = rect.top + pointer.y;

            return {
                currentTarget: {
                    getBoundingClientRect: () => ({
                        left: screenX,
                        top: screenY,
                        right: screenX,
                        bottom: screenY,
                        width: 0,
                        height: 0,
                    }),
                },
                stopPropagation: () => {},
            };
        };

        switch (type) {
            case 'city':
                if (data.ownerId) {
                    const points = this.props.cityPoints[data.slotId] || 0;
                    let frame = 0;
                    if (points >= 2000) frame = 1;
                    if (points > 10000) frame = 2;
                    gameObject = this.add.sprite(baseProps.x, baseProps.y, 'citySprite', frame).setInteractive().setScale(this.iconScales.city);
                    
                    tooltipText = `${data.cityName}\nOwner: ${data.ownerUsername || 'Unclaimed'}\nPoints: ${points.toLocaleString()}`;
                    
                    if (data.ownerId === this.auth.currentUser.uid) gameObject.setTint(0xffff00);
                    else if (this.props.playerAlliance && data.alliance === this.props.playerAlliance.tag) gameObject.setTint(0x00aaff);
                    else if (this.props.playerAlliance?.diplomacy?.allies?.some(a => a.tag === data.alliance)) gameObject.setTint(0x00ff00);
                    else if (this.props.playerAlliance?.diplomacy?.enemies?.some(e => e.tag === data.alliance)) gameObject.setTint(0xff0000);
                    else gameObject.setTint(0xffa500);
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
                gameObject = this.add.sprite(baseProps.x, baseProps.y, 'villageSprite', (data.level || 1) - 1).setInteractive().setScale(this.iconScales.village);

                if (this.props.conqueredVillages && this.props.conqueredVillages[data.id]) {
                    gameObject.setTint(0x90ee90);
                    tooltipText = `Your Village: ${data.name}\nHappiness: ${Math.floor(this.props.conqueredVillages[data.id].happiness || 100)}%`;
                } else {
                    tooltipText = `Village: ${data.name}\nLevel: ${data.level || 1}`;
                }
                gameObject.on('pointerdown', (pointer) => this.props.onVillageClick(createFakeEvent(pointer), data));
                break;
            case 'ruin':
                const isOccupied = data.ownerId && data.ownerId !== 'ruins';
                gameObject = this.add.sprite(baseProps.x, baseProps.y, 'ruinSprite', isOccupied ? 1 : 0).setInteractive().setScale(this.iconScales.ruin);

                tooltipText = isOccupied ? `Conquered Ruin\nOwner: ${data.ownerUsername}` : `Ruin: ${data.name}`;
                gameObject.on('pointerdown', (pointer) => this.props.onRuinClick(createFakeEvent(pointer), data));
                break;
            case 'god_town':
                gameObject = this.add.image(baseProps.x, baseProps.y, 'godTown').setInteractive().setScale(this.iconScales.god_town);
                tooltipText = data.stage === 'ruins' ? `Strange Ruins` : `God Town: ${data.name}`;
                gameObject.on('pointerdown', () => this.props.onGodTownClick(data.id));
                break;
            case 'wonder_spot':
                 gameObject = this.add.graphics({ x: baseProps.x, y: baseProps.y });
                 gameObject.fillStyle(0xFFFF00, 0.5);
                 gameObject.fillCircle(0, 0, TILE_SIZE / 2);
                 gameObject.setInteractive(new Phaser.Geom.Circle(0, 0, TILE_SIZE / 2), Phaser.Geom.Circle.Contains);
                 tooltipText = "Build an Alliance Wonder";
                 gameObject.on('pointerdown', () => this.props.onWonderSpotClick(data));
                break;
            case 'constructing_wonder':
                gameObject = this.add.image(baseProps.x, baseProps.y, 'constructingWonder').setInteractive().setScale(this.iconScales.constructing_wonder);
                tooltipText = `Constructing Wonder\nAlliance: ${data.allianceName}`;
                gameObject.on('pointerdown', () => this.props.onConstructingWonderClick(data));
                break;
            case 'wreckage':
                 gameObject = this.add.image(baseProps.x, baseProps.y, 'wreck').setInteractive().setScale(this.iconScales.wreckage);
                 const resourceType = Object.keys(data.resources)[0];
                 tooltipText = `Sea Resources\n${resourceType}: ${data.resources[resourceType].toLocaleString()}`;
                 gameObject.on('pointerdown', (pointer) => this.props.onWreckageClick(createFakeEvent(pointer), data));
                break;
            default:
                break;
        }

        if (gameObject) {
            gameObject.setData('details', data);
            gameObject.on('pointerover', (pointer) => {
                this.tooltip.setText(tooltipText);
                this.tooltip.setPosition(pointer.worldX, pointer.worldY - 30);
                this.tooltip.setVisible(true);
            });
            gameObject.on('pointerout', () => {
                this.tooltip.setVisible(false);
            });
            this.mapObjects.set(key, gameObject);
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