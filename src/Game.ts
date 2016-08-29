import {Grid} from "./Grid"
import {Tile} from "./Tile"
import {Direction} from "./Direction"
import {KeyboardInputManager} from "./KeyboardInputManager"
import {LocalStorageManager} from "./LocalStorageManager"
import {HtmlActuator} from "./HtmlActuator"

export class Game {
    private size: number;
    private inputManager: KeyboardInputManager;
    private storageManager: LocalStorageManager;
    private actuator: HtmlActuator;
    private startTiles: number;
    private over: boolean;
    private won: boolean;
    private isPlaying: boolean;
    private grid: Grid;
    private score: number;

    public constructor(size: number, inputManager: KeyboardInputManager, storageManager: LocalStorageManager, actuator: HtmlActuator) {
        this.size = size;
        this.inputManager = inputManager;
        this.storageManager = storageManager;
        this.actuator = actuator;
        this.startTiles = 2;

        this.run();
    }

    public run(): void {
        this.inputManager.on("move", this.move.bind(this));
        this.inputManager.on("restart", this.restart.bind(this));
        this.inputManager.on("keepPlaying", this.keepPlaying.bind(this));
        
        this.setup();
    }

    private restart(): void {
        this.storageManager.clearGameState();
        this.actuator.continueGame(); // Clear the game won/lost message
        this.setup();
    }

    private keepPlaying(): void {
        this.isPlaying = true;
        this.actuator.continueGame(); // Clear the game won/lost message
    }

    private get isGameTerminated(): boolean {
        return this.over || (this.won && !this.isPlaying);
    }

    private setup(): void {
        let previousState: Game = this.storageManager.gameState;

        if (previousState) {
            this.grid = new Grid(previousState.grid.size, previousState.grid.cells);
            this.score = previousState.score;
            this.over = previousState.over;
            this.won = previousState.won;
            this.keepPlaying = previousState.keepPlaying;
        } else {
            this.grid = new Grid(this.size, null);
            this.score = 0;
            this.over = false;
            this.won = false;
            this.isPlaying = false;
            this.addStartTiles();
        }

        this.actuate();
    }

    private addStartTiles(): void {
        for (let i: number = 0; i < this.startTiles; i++) {
            this.addRandomTile();
        }
    }

    private addRandomTile(): void {
        if (this.grid.cellsAvailable()) {
            //let value: number = Math.random() < 0.9 ? 2 : 4;
            let value: number;

            if(Math.random() < 0.9) {
                value = 2;
            } else {
                value = 4;
            }

            let tile: Tile = new Tile(this.grid.randomAvailableCell(), value);

            this.grid.insertTile(tile);
        }
    }

    private actuate(): void {
        if (this.storageManager.bestScore < this.score) {
            this.storageManager.bestScore = this.score;
        }

        if (this.over) {
            this.storageManager.clearGameState();
        } else {
            this.storageManager.gameState = this.serialize();
        }

        this.actuator.actuate(this.grid, {
            score: this.score,
            over: this.over,
            won: this.won,
            bestScore: this.storageManager.bestScore,
            terminated: this.isGameTerminated
        });
    }

    private serialize(): any {
        return {
            grid: this.grid.serialize(),
            score: this.score,
            over: this.over,
            won: this.won,
            keepPlaying: this.keepPlaying
        };
    }

    private prepareTiles(): void {
        this.grid.eachCell((x: number, y: number, tile: Tile): void => {
            if (tile) {
                tile.mergedFrom = null;
                tile.savePosition();
            }
        });
    }

    private moveTile(tile: Tile, cell: IPosition): void {
        this.grid.cells[tile.x][tile.y] = null;
        this.grid.cells[cell.x][cell.y] = tile;
    
        tile.updatePosition(cell);
    }

    private move(direction: Direction): void {
        // 0: up, 1: right, 2: down, 3: left
        if (this.isGameTerminated) {
            return; // Don't do anything if the game's over
        }

        let cell: IPosition;
        let tile: Tile;
        let vector: IPosition = this.getVector(direction);
        let traversals: ITraversal = this.buildTraversals(vector);
        let moved: boolean = false;

        // Save the current tile positions and remove merger information
        this.prepareTiles();

        for(let x of traversals.x) {
            for(let y of traversals.y) {
                cell = {
                    x: x,
                    y: y
                };

                tile = this.grid.cellContent(cell);
                    
                if (tile) {
                    let positions: any = this.findFarthestPosition(cell, vector);
                    let next: Tile = this.grid.cellContent(positions.next);

                    // Only one merger per row traversal?
                    if (next && next.value === tile.value && !next.mergedFrom) {
                        let merged: Tile = new Tile(positions.next, tile.value * 2);

                        merged.mergedFrom = [tile, next];
                    
                        this.grid.insertTile(merged);
                        this.grid.removeTile(tile);

                        tile.updatePosition(positions.next);
                        
                        this.score += merged.value;

                        if (merged.value === 2048) {
                            this.won = true;
                        }
                    } else {
                        this.moveTile(tile, positions.farthest);
                    }

                    if (!this.positionsEquals(cell, tile)) {
                        moved = true; // The tile moved from its original cell!
                    }
                }
            }
        }

        // Traverse the grid in the right direction and move tiles
        /*traversals.x.forEach((x: number) => {
            traversals.y.((y: number) => {
                cell = {
                    x: x, 
                    y: y
                };
                tile = this.grid.cellContent(cell);
                    
                if (tile) {
                    let positions: any = this.findFarthestPosition(cell, vector);
                    let next: Tile = this.grid.cellContent(positions.next);

                    // Only one merger per row traversal?
                    if (next && next.value === tile.value && !next.mergedFrom) {
                        let merged: Tile = new Tile(positions.next, tile.value * 2);

                        merged.mergedFrom = [tile, next];
                    
                        this.grid.insertTile(merged);
                        this.grid.removeTile(tile);

                        tile.updatePosition(positions.next);
                        this.score += merged.value;

                        if (merged.value === 2048) {
                            console.log("Won");
                            this.won = true;
                        }
                    } else {
                        this.moveTile(tile, positions.farthest);
                    }

                    if (!this.positionsEquals(cell, tile)) {
                        moved = true; // The tile moved from its original cell!
                    }
                }
            });
        });*/

        if (moved) {
            this.addRandomTile();

            if (!this.movesAvailable()) {
                this.over = true; // Game over!
            }

            this.actuate();
        }
    }
    // Todo remove enum Direction and use number type
    private getVector(direction: Direction): IPosition {
        /*const directions: any = {
            0: { x: 0, y: -1 }, // Up
            1: { x: 1, y: 0 },  // Right
            2: { x: 0, y: 1 },  // Down
            3: { x: -1, y: 0 }   // Left
        };*/

        const directions: IPosition[] = [
            { x: 0, y: -1 }, // Up
            { x: 1, y: 0 }, // Right
            { x: 0, y: 1 }, // Down
            { x: -1, y: 0 }, // Left
        ];

        return directions[direction];
    }    

    private buildTraversals(vector: IPosition): ITraversal {
        let traversals: ITraversal = {
            x: [],
            y: [],
        };

        for (let pos: number = 0; pos < this.size; pos++) {
            traversals.x.push(pos);
            traversals.y.push(pos);
        }

        // Always traverse from the farthest cell in the chosen direction
        if (vector.x === 1) {
            traversals.x = traversals.x.reverse();
        }

        if (vector.y === 1) {
            traversals.y = traversals.y.reverse();
        }

        return traversals;
    }

    private findFarthestPosition(cell: IPosition, vector: IPosition): any {
        let previous: IPosition;

        do {
            previous = cell;
            cell = {
                x: previous.x + vector.x,
                y: previous.y + vector.y
            };
        } while (this.grid.withinBounds(cell) && this.grid.cellAvailable(cell));

        return {
            farthest: previous,
            next: cell
        };
    }

    private movesAvailable(): boolean {
        return this.grid.cellsAvailable() || this.tileMatchesAvailable();
    }

    private tileMatchesAvailable(): boolean {
        let tile: Tile;

        for (let x: number = 0; x < this.size; x++) {
            for (let y: number = 0; y < this.size; y++) {
                tile = this.grid.cellContent({
                    x: x,
                    y: y,
                });

                if (tile) {
                    for (let direction: number = 0; direction < 4; direction++) {
                        let vector: IPosition = this.getVector(direction);
                        let cell: IPosition  = {
                            x: x + vector.x, 
                            y: y + vector.y
                        };

                        let other: Tile = this.grid.cellContent(cell);

                        if (other && other.value === tile.value) {
                            return true;
                        }
                    }
                }
            }
        }

        return false;
    }

    private positionsEquals(first: IPosition, second: IPosition): boolean {
        return (first.x === second.x) && (first.y === second.y);
    }
}