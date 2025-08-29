import React, { useEffect, useRef } from 'react';
import Phaser from 'phaser';
import { useAuth } from '../../contexts/AuthContext';
import unitConfig from '../../gameData/units.json';
import heroesConfig from '../../gameData/heroes.json';

// # Import images needed for the map
import island1 from '../../images/islands/island_1.png';
import island2 from '../../images/islands/island_2.png';
import citySpriteSheet from '../../images/city_modal.png';
import villageSpriteSheet from '../../images/villages.png';
import ruinSpriteSheet from '../../images/ruins.png';
import godTownImage from '../../images/god-town.png';
import constructingWonderImage from '../../images/special_buildings/alliance_wonders.jpg';
import wreckImage from '../../images/wreck.png';
import waterImage from '../../images/water.png'; // Import water texture

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
        this.load.spritesheet('citySprite', citySpriteSheet, { frameWidth: 200, frameHeight: 150 });
        this.load.spritesheet('villageSprite', villageSpriteSheet, { frameWidth: 80, frameHeight: 40 });
        this.load.spritesheet('ruinSprite', ruinSpriteSheet, { frameWidth: 100, frameHeight: 100 });
        this.load.image('godTown', godTownImage);
        this.load.image('constructingWonder', constructingWonderImage);
        this.load.image('wreck', wreckImage);
        this.load.image('water', waterImage); // Load water texture
    }

    // # Create game objects and set up controls
    create() {
        const { worldState } = this.props;

        if (worldState) {
            // # Add a tiling sprite for the water background
            this.add.tileSprite(0, 0, worldState.width * TILE_SIZE, worldState.height * TILE_SIZE, 'water')
                .setOrigin(0, 0)
                .setDepth(-1);

            // # Set the boundaries of the camera to the world size to prevent scrolling into empty space
            this.cameras.main.setBounds(0, 0, worldState.width * TILE_SIZE, worldState.height * TILE_SIZE);
            
            // # Set a more reasonable default initial zoom level
            this.cameras.main.setZoom(0.5); 
        }

        this.drawMap();
        this.setupCameraControls();

        // # Simple tooltip for hovering over map objects
        this.tooltip = this.add.text(0, 0, '', {
            font: '14px Inter',
            fill: '#ffffff',
            backgroundColor: 'rgba(0,0,0,0.7)',
            padding: { x: 8, y: 4 },
            borderRadius: 4,
            align: 'center',
            wordWrap: { width: 200, useAdvancedWrap: true }
        }).setOrigin(0.5, 1).setDepth(100).setVisible(false);
        
        // # Listen for prop updates from React to redraw the map
        this.game.events.on('updateProps', (newProps) => {
            this.props = newProps;
            this.drawMap();
        });
    }
    
    // # Game loop for continuous updates
    update() {
        this.updateMovements();
    }

    // # Main function to draw everything on the map
    drawMap() {
        this.mapObjects.forEach(obj => obj.destroy());
        this.mapObjects.clear();
        
        const { worldState, combinedSlots, villages, ruins, godTowns, playerAlliance, conqueredVillages, cityPoints, scoutedCities, wonderSpots, allWonders, visibleWreckages } = this.props;

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
                    gameObject = this.add.sprite(baseProps.x, baseProps.y, 'citySprite', frame).setInteractive().setScale(0.5);
                    
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
                gameObject = this.add.sprite(baseProps.x, baseProps.y, 'villageSprite', (data.level || 1) - 1).setInteractive().setScale(0.35);

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
                gameObject = this.add.sprite(baseProps.x, baseProps.y, 'ruinSprite', isOccupied ? 1 : 0).setInteractive().setScale(0.5);

                tooltipText = isOccupied ? `Conquered Ruin\nOwner: ${data.ownerUsername}` : `Ruin: ${data.name}`;
                gameObject.on('pointerdown', (pointer) => this.props.onRuinClick(createFakeEvent(pointer), data));
                break;
            case 'god_town':
                gameObject = this.add.image(baseProps.x, baseProps.y, 'godTown').setInteractive().setScale(0.5);
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
                gameObject = this.add.image(baseProps.x, baseProps.y, 'constructingWonder').setInteractive().setScale(0.5);
                tooltipText = `Constructing Wonder\nAlliance: ${data.allianceName}`;
                gameObject.on('pointerdown', () => this.props.onConstructingWonderClick(data));
                break;
            case 'wreckage':
                 gameObject = this.add.image(baseProps.x, baseProps.y, 'wreck').setInteractive().setScale(0.5);
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
        (this.props.movements || []).forEach(movement => {
            existingMovementIds.add(movement.id);

            const departureTime = movement.departureTime?.toDate().getTime() || now;
            const arrivalTime = movement.arrivalTime?.toDate().getTime() || now;
            let progress = (now - departureTime) / (arrivalTime - departureTime);
            progress = Phaser.Math.Clamp(progress, 0, 1);

            const origin = movement.originCoords;
            const target = movement.targetCoords;

            if (!origin || !target) return;

            const currentX = (origin.x + (target.x - origin.x) * progress) * TILE_SIZE + TILE_SIZE / 2;
            const currentY = (origin.y + (target.y - origin.y) * progress) * TILE_SIZE + TILE_SIZE / 2;

            let movementObject = this.movementObjects.get(movement.id);
            if (!movementObject) {
                const icon = this.add.text(0, 0, '⚔️', { fontSize: '20px' }).setOrigin(0.5);
                const line = this.add.graphics();
                movementObject = this.add.container(currentX, currentY, [line, icon]).setDepth(50);
                this.movementObjects.set(movement.id, movementObject);
            }
            
            movementObject.setPosition(currentX, currentY);
        });

        // # Clean up old movement objects
        this.movementObjects.forEach((obj, id) => {
            if (!existingMovementIds.has(id)) {
                obj.destroy();
                this.movementObjects.delete(id);
            }
        });
    }

    // # Set up camera panning and zooming
    setupCameraControls() {
        const cam = this.cameras.main;
        
        this.input.on('wheel', (pointer, gameObjects, deltaX, deltaY, deltaZ) => {
            const newZoom = cam.zoom - deltaY * 0.001;
            cam.zoom = Phaser.Math.Clamp(newZoom, 0.1, 2.0);
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
        
        game.scene.start('MapScene', { props, auth: { currentUser } });

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
        const { panToCoords } = props;
        if (panToCoords && gameRef.current) {
            const scene = gameRef.current.scene.getScene('MapScene');
            if (scene && scene.cameras.main) {
                scene.cameras.main.pan(panToCoords.x * TILE_SIZE, panToCoords.y * TILE_SIZE, 500, 'Sine.easeInOut');
            }
        }
    }, [props.panToCoords]);


    return <div id="phaser-container" className="w-full h-full" />;
};

export default React.memo(PhaserMap);

