// A tiny rouge by graphitemaster

let fs = require('fs');

//     _____             __ _                       _   _
//    / ____|           / _(_)                     | | (_)
//   | |     ___  _ __ | |_ _  __ _ _   _ _ __ __ _| |_ _  ___  _ __
//   | |    / _ \| '_ \|  _| |/ _` | | | | '__/ _` | __| |/ _ \| '_ \
//   | |___| (_) | | | | | | | (_| | |_| | | | (_| | |_| | (_) | | | |
//    \_____\___/|_| |_|_| |_|\__, |\__,_|_|  \__,_|\__|_|\___/|_| |_|
//                             __/ |
//                            |___/

const W           = 32;      // width of framebuffer (game is 2px pixels smaller, for border (1px each side))
const H           = 30;      // height of framebuffer (game is 2px pixels smaller, for border (1px each side))
const DIST        = 4;       // maximum move distance in one play
const PATH        = "./data" // path for resources and save games (do not put a trailing / on this)
const ENEMY_MIN   = 1;       // minimum enemies per screen
const ENEMY_MAX   = 5;       // maximum enemies per screen
const RUPEE_MIN   = 1;       // minimum rupees per screen
const RUPEE_MAX   = 5;       // maximum rupees per screen
const PLAYER_HP   = 100;     // player starting HP
const GEN_QUALITY = 1000;    // generator quality, larger values = slower, smaller values = uglier maps
const LRADIUS     = 4;       // light radius in tiles (should be a multiple of 2 for nice circles)

const Chars = {
  // Entity characters
  Player:     "0",
  // Cell characters
  Unused:     " ",
  Floor:      "·",
  Wall:       "#",
  Corridor:   "•",
  DoorH:      "—",
  DoorV:      "|",
  UpStairs:   ">",
  DownStairs: "<",
  Rupee:      "◊",
};

// The meta of the game, you can add more weapons and more enemies here,
// the game randomly picks from them. Just be sure that the weapon number
// for the enemies actually references one of these weapons.
const Weapons = [
  { name: "weapon 1", description: "1", dmg: 10 },
  { name: "weapon 2", description: "2", dmg: 20 },
  { name: "weapon 3", description: "3", dmg: 30 },
  { name: "weapon 4", description: "4", dmg: 40 },
];

const Enemies = [
  // ^ weapon is the index to the weapons above ^
  { char: "E", name: "Eredin",  weapon: 3, hp: 12 },
  { char: "G", name: "Griffin", weapon: 2, hp: 22 },
  { char: "L", name: "Leshen",  weapon: 1, hp: 32 },
  { char: "S", name: "Sylvan",  weapon: 0, hp: 42 },
];

const Item = {
  Torch:  0,
  Health: 1,
  Map:    2,
  Silver: 3,
};

// We're limited to 10 items, no fewer and no more, the shop can't
// display more in the limited screen space
const Items = [
  { name: "Torch",   description: "Light up a room",            cost: 1 },
  { name: "Health",  description: "Restores health to 100 HP",  cost: 3 },
  { name: "Map",     description: "Reveals enemies and stairs", cost: 4 },
  { name: "Silver",  description: "Kills werewolf",             cost: 5 }
  // TODO: more items (we need 10 in total to "fill" the game out)
];

//    ______             _
//   |  ____|           (_)
//   | |__   _ __   __ _ _ _ __   ___
//   |  __| | '_ \ / _` | | '_ \ / _ \
//   | |____| | | | (_| | | | | |  __/
//   |______|_| |_|\__, |_|_| |_|\___|
//                  __/ |
//                 |___/

class Weapon {
  constructor(state) {
    this.name        = state.name;
    this.description = state.description;
    this.dmg         = state.dmg;
  }
}

const Entity = {
  Player: 0,
  Enemy:  1,
  Rupee:  2,
  Torch:  3
};

class Player {
  constructor(state) {
    // Immutable state
    this.char       = Chars.Player;
    this.type       = Entity.Player;

    // Mutable state
    this.weapon_idx = state ? state.weapon : 0;
    this.weapon_obj = new Weapon(Weapons[this.weapon_idx]);
    this.hp         = state ? state.hp : PLAYER_HP;
    this.x          = state ? state.x : 0;
    this.y          = state ? state.y : 0;
    this.kills      = state ? state.kills : 0;
    this.rupees     = state ? state.rupees : 0;
    this.items      = state ? state.items : [];
  }

  serialize() {
    return {
      weapon: this.weapon_idx,
      hp:     this.hp,
      x:      this.x,
      y:      this.y,
      kills:  this.kills,
      rupees: this.rupees,
      items:  this.items,
      type:   this.type
    };
  }
}

class Rupee {
  constructor(state) {
    // Immutable state
    this.char = Chars.Rupee;
    this.type = Entity.Rupee;

    // Mutable state
    this.x    = state ? state.x : 0;
    this.y    = state ? state.y : 0;
  }

  serialize() {
    return {
      x:     this.x,
      y:     this.y,
      type:  this.type
    };
  }
};

class Torch {
  constructor(state) {
    // Immutable state
    this.type = Entity.Torch;

    // Mutable state
    this.x = state ? state.x : 0;
    this.y = state ? state.y : 0;
  }
  serialize() {
    return {
      x:    this.x,
      y:    this.y,
      type: this.type
    };
  }
};

class Enemy {
  constructor(state) {
    let template    = Enemies[state.instance];

    // Immutable state
    this.name       = template.name;
    this.char       = template.char;
    this.type       = Entity.Enemy;

    // Mutable state
    this.weapon_idx = state.weapon ? state.weapon : template.weapon;
    this.weapon_obj = new Weapon(Weapons[this.weapon_idx]);
    this.hp         = state.hp ? state.hp : template.hp;
    this.x          = state.x ? state.x : template.x;
    this.y          = state.y ? state.y : template.y;
  }

  instance() {
    for (let i = 0; i < Enemies.length; i++) {
      let enemy = Enemies[i];
      if (enemy.name === this.name) {
        return i;
      }
    }
    return null;
  }

  serialize() {
    return {
      weapon:   this.weapon_index,
      hp:       this.hp,
      x:        this.x ? this.x : 0,
      y:        this.y ? this.y : 0,
      instance: this.instance(),
      type:     this.type
    };
  }
}

// Seedable 2^32-1 PRNG for map generation and game state
// https://en.wikipedia.org/wiki/Lehmer_random_number_generator
class Random {
  constructor(seed) {
    this.seed = seed % 2147483647;
    if (this.seed <= 0) {
      this.seed += 2147483646;
    }
    this.count = 0;
  }

  next() {
    return this.seed = this.seed * 16807 % 2147483647;
  }

  next_in_range(min, max) {
    let n = max - min + 1;
    let i = Math.floor(this.next() % n);
    if (i < 0) i = -i;
    return i + min;
  }
}

// Simple rasterization of game boards
class Framebuffer {
  constructor() {
    this.data = [];
    this.clear();
  }

  clear() {
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        // Generate +,-,| border and whitespace cells
        if ((x === 0 || x === W-1) && (y === 0 || y === H-1)) {
          this.set_pixel(x, y, "+");
        } else if (x === 0 || x === W-1) {
          this.set_pixel(x, y, "|");
        } else if (y === 0 || y === H-1) {
          this.set_pixel(x, y, "-");
        } else {
          this.set_pixel(x, y, " ");
        }
      }
    }
  }

  set_pixel(x, y, pixel) {
    this.data[y * W + x] = pixel;
  }

  get_pixel(x, y) {
    return this.data[y * W + x];
  }

  blit(x, y, w, h, data) {
    for (let i = 0; i < h; i++) {
      for (let j = 0; j < w; j++) {
        this.set_pixel(x + j, y + i, data[i * w + j]);
      }
    }
  }

  draw_text(x, y, data) {
    let length = data.length;
    if (length + x > W-2) {
      data = data.substring(0, W-2-x-3) + "...";
    }
    for (let i = 0; i < data.length; i++) {
      this.set_pixel(x + i, y, data[i]);
    }
  }

  draw_text_array(x, y, data) {
    for (let i = 0; i < data.length; i++) {
      for (let j = 0; j < data[i].length; j++) {
        this.set_pixel(x + j, y + i, data[i][j]);
      }
    }
  }

  as_string() {
    let result = "";
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        result += this.get_pixel(x, y);
      }
      result += "\n";
    }
    return result;
  }
};

const Direction = {
  North: 0,
  East:  1,
  South: 2,
  West:  3,
};

const Cell = {
  Unused:     0,
  Wall:       1,
  Floor:      2,
  Corridor:   4,
  Door:       5,
  UpStairs:   6,
  DownStairs: 7,
  Border:     8
};

class Map {
  constructor() {
    this.grid = [];
    this.w = W - 4;     // 2px border on each side
    this.h = H - 4 - 2; // 2px border on each side + 2 lines of status output
    this.set_cells(0, 0, this.w, this.h, Cell.Unused);
  }

  set_cell(x, y, type) {
    this.grid[x + this.w * y] = type;
  }

  set_cells(xbeg, ybeg, xend, yend, type) {
    for (let y = ybeg; y != yend + 1; ++y) {
      for (let x = xbeg; x != xend + 1; ++x) {
        this.set_cell(x, y, type);
      }
    }
  }

  get_cell(x, y) {
    return this.grid[x + this.w * y];
  }

  in_bounds(x, y) {
    return x >= 0 && x < this.w && y >= 0 && y < this.h;
  }

  is_cell_playable(cell) {
    return cell != Cell.Wall && cell != Cell.Unused;
  }

  is_area_playable(x, y) {
    if (!this.in_bounds(x, y)) {
      return false;
    }
    return this.is_cell_playable(this.get_cell(x, y));
  }

  is_area_stair(x, y) {
    let cell = this.get_cell(x, y);
    return cell === Cell.UpStairs || cell === Cell.DownStairs;
  }

  is_area_door(x, y) {
    let cell = this.get_cell(x, y);
    return cell === Cell.Door;
  }

  find_stairs(cell) {
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        if (this.get_cell(x, y) === cell) {
          return { x: x, y: y };
        }
      }
    }
    return null;
  }

  is_area_used(xbeg, ybeg, xend, yend) {
    for (let y = ybeg; y != yend + 1; ++y) {
      for (let x = xbeg; x != xend + 1; ++x) {
        if (this.get_cell(x, y) != Cell.Unused) {
          return false;
        }
      }
    }
    return true;
  }

  is_adjacent(x, y, type) {
    return this.get_cell(x - 1, y) === type || this.get_cell(x + 1, y) === type
        || this.get_cell(x, y - 1) === type || this.get_cell(x, y + 1) === type;
  }

  get_cell_wrap(x, y) {
    if (!this.in_bounds(x, y)) {
      return Cell.Wall;
    }
    return this.get_cell(x, y);
  }

  is_wall(x, y) {
    return this.get_cell_wrap(x, y) === Cell.Wall;
  }

  rasterize() {
    // Copy the grid
    let grid = Object.assign({}, this.grid);

    // Convert the grid to characters for rasterization
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        switch (grid[x + this.w * y]) {
        case Cell.Corridor:
          grid[x + this.w * y] = Chars.Corridor;
          break;
        case Cell.Floor:
          grid[x + this.w * y] = Chars.Floor;
          break;
        case Cell.Wall:
          grid[x + this.w * y] = Chars.Wall;
          break;
        case Cell.Door:
          // if there's wall above and below us, it's vertical
          if (this.is_wall(x, y + 1) && this.is_wall(x, y - 1)) {
            grid[x + this.w * y] = Chars.DoorV;
          } else {
            grid[x + this.w * y] = Chars.DoorH;
          }
          break;
        case Cell.DownStairs:
          grid[x + this.w * y] = Chars.DownStairs;
          break;
        case Cell.Unused:
          grid[x + this.w * y] = Chars.Unused;
          break;
        case Cell.UpStairs:
          grid[x + this.w * y] = Chars.UpStairs;
        }
      }
    }
    return grid;
  }
};

// Random map generation with reachability
class Generator {
  constructor(features, chance_room, chance_corridor) {
    this.features = features;
    this.chance_room = chance_room;
    this.chance_corridor = chance_corridor;
  }

  get_random_direction() {
    return this.random.next_in_range(0, 3);
  }

  generate(seed) {
    this.random = new Random(seed);
    let map = new Map();
    while (!this.make_dungeon(map)) {
      console.log("Failed to make betable map, trying again...");
    }
    return map;
  }

  make_corridor(map, x, y, max_length, direction) {
    let length = this.random.next_in_range(2, max_length);

    let xbeg = x;
    let ybeg = y;

    let xend = x;
    let yend = y;

    switch (direction) {
    /****/ case Direction.North: ybeg = y - length;
    break; case Direction.East:  xend = x + length;
    break; case Direction.South: yend = y + length;
    break; case Direction.West:  xbeg = x - length;
    break;
    }

    if (!map.in_bounds(xbeg, ybeg) || !map.in_bounds(xend, yend)) {
      return false;
    }

    if (!map.is_area_used(xbeg, ybeg, xend, yend)) {
      return false;
    }

    map.set_cells(xbeg, ybeg, xend, yend, Cell.Corridor);
    return true;
  }

  make_room(map, x, y, xmax, ymax, direction) {
    let xlen = this.random.next_in_range(4, xmax);
    let ylen = this.random.next_in_range(4, ymax);

    let xbeg = x;
    let ybeg = y;

    let xend = x;
    let yend = y;

    if (direction === Direction.North) {
      ybeg = y - ylen;
      xbeg = x - Math.floor(xlen / 2);
      xend = x + Math.floor((xlen + 1) / 2);
    } else if (direction === Direction.East) {
      ybeg = y - Math.floor(ylen / 2);
      yend = y + Math.floor((ylen + 1) / 2);
      xend = x + xlen;
    } else if (direction === Direction.South) {
      yend = y + ylen;
      xbeg = x - Math.floor(xlen / 2);
      xend = x + Math.floor((xlen + 1) / 2);
    } else if (direction === Direction.West) {
      ybeg = y - Math.floor(ylen / 2);
      yend = y + Math.floor((ylen + 1) / 2);
      xbeg = x - xlen;
    }

    if (!map.in_bounds(xbeg, ybeg) || !map.in_bounds(xend, yend)) {
      return false;
    }

    if (!map.is_area_used(xbeg, ybeg, xend, yend)) {
      return false;
    }

    map.set_cells(xbeg, ybeg, xend, yend, Cell.Wall);
    map.set_cells(xbeg + 1, ybeg + 1, xend - 1, yend - 1, Cell.Floor);

    return true;
  }

  make_feature(map, x, y, xmod, ymod, direction) {
    let chance = this.random.next_in_range(0, 100);
    if (chance <= this.chance_room) {
      if (this.make_room(map, x + xmod, y + ymod, 8, 6, direction)) {
        map.set_cell(x, y, Cell.Door);
        map.set_cell(x + xmod, y + ymod, Cell.Floor);
        return true;
      }
    } else {
      if (this.make_corridor(map, x + xmod, y + ymod, 6, direction)) {
        map.set_cell(x, y, Cell.Door);
        return true;
      }
    }
    return false;
  }

  make_features(map) {
    let tries = 0;
    let max_tries = GEN_QUALITY;

    for (; tries != max_tries; ++tries) {
      let x = this.random.next_in_range(1, map.w - 2);
      let y = this.random.next_in_range(1, map.h - 2);

      if (map.get_cell(x, y) != Cell.Wall && map.get_cell(x, y) != Cell.Corridor) {
        continue;
      }

      if (map.is_adjacent(x, y, Cell.Door)) {
        continue;
      }

      /****/ if (map.get_cell(x, y + 1) === Cell.Floor || map.get_cell(x, y + 1) === Cell.Corridor) {
        if (this.make_feature(map, x, y, 0, -1, Direction.North)) {
          return true;
        }
      } else if (map.get_cell(x - 1, y) === Cell.Floor || map.get_cell(x - 1, y) === Cell.Corridor) {
        if (this.make_feature(map, x, y, 1, 0, Direction.East)) {
          return true;
        }
      } else if (map.get_cell(x, y - 1) === Cell.Floor || map.get_cell(x, y - 1) === Cell.Corridor) {
        if (this.make_feature(map, x, y, 0, 1, Direction.South)) {
          return true;
        }
      } else if (map.get_cell(x + 1, y) === Cell.Floor || map.get_cell(x + 1, y) === Cell.Corridor) {
        if (this.make_feature(map, x, y, -1, 0, Direction.West)) {
          return true;
        }
      }
    }

    return false;
  }

  make_stairs(map, type) {
    let tries = 0;
    let max_tries = GEN_QUALITY;

    for ( ; tries != max_tries; ++tries) {
      let x = this.random.next_in_range(1, map.w - 2);
      let y = this.random.next_in_range(1, map.h - 2);

      if (!map.is_adjacent(x, y, Cell.Floor) && !map.is_adjacent(x, y, Cell.Corridor)) {
        continue;
      }

      if (map.is_adjacent(x, y, Cell.Door)) {
        continue;
      }

      map.set_cell(x, y, type);

      return true;
    }

    return false;
  }

  make_dungeon(map) {
    // Start off with a room in the middle and grow it from a random direction
    this.make_room(map, Math.floor(map.w / 2), Math.floor(map.h / 2), 8, 6, this.get_random_direction());

    // Iteratively make features from the room until all features are created
    for (let features = 1; features != this.features; ++features) {
      if (!this.make_features(map)) {
        break;
      }
    }

    // Create a set of stairs in each direction
    if (!this.make_stairs(map, Cell.UpStairs) || !this.make_stairs(map, Cell.DownStairs)) {
      return false;
    }

    return true;
  }
}

const Search = {
  Unknown:  0,
  Start:    1,
  Goal:     2,
  Valid:    3,
  Empty:    4,
  Obstacle: 5,
  Visited:  6
};

// Breadth-First Search path finding for AI, not A* or JPS but our board
// is small and we're on a grid with limited directions.
class AI {
  constructor(map, entities) {
    this.w = map.w;
    this.h = map.h;
    this.grid = [];

    // Insert entities into the grid as obstacles and goals
    for (let i = 0; i < entities.length; i++) {
      let entity = entities[i];
      if (entity.type === Entity.Player) {
        // The area around the player is the goal
        this.grid[(entity.y-1) * map.w +  entity.x]    = Search.Goal; // W
        this.grid[(entity.y+1) * map.w +  entity.x]    = Search.Goal; // S
        this.grid[ entity.y    * map.w + (entity.x-1)] = Search.Goal; // A
        this.grid[ entity.y    * map.w + (entity.x+1)] = Search.Goal; // D
      } else {
        // Enemies are obstacles
        this.grid[entity.y * map.w + entity.x] = Search.Obstacle;
      }
    }

    for (let y = 0; y < map.h; y++) {
      for (let x = 0; x < map.w; x++) {
        if (map.is_area_playable(x, y)) {
          // Which do not contain something already
          if (this.grid[y * map.w + x] === undefined) {
            this.grid[y * map.w + x] = Search.Empty;
          }
        } else if (this.grid[y * map.w + x] === undefined) {
          // Other places are obstacles
          this.grid[y * map.w + x] = Search.Obstacle;
        }
      }
    }
  }

  location_status(location) {
    let x = location.x;
    let y = location.y;
    if (x < 0 || x >= this.w || y < 0 || y >= this.h) {
      return Search.Invalid;
    } else if (this.grid[y * this.w + x] === Search.Goal) {
      return Search.Goal;
    } else if (this.grid[y * this.w + x] !== Search.Empty) {
      // Location is an obstacle or it has already been visited
      return Search.Obstacle;
    } else {
      return Search.Valid;
    }
  }

  explore(position, direction) {
    let x = position.x;
    let y = position.y;

    let path = position.path.slice();
    path.push(direction);

    switch (direction) {
    /****/ case Direction.North: y -= 1;
    break; case Direction.East:  x += 1;
    break; case Direction.South: y += 1;
    break; case Direction.West:  x -= 1;
    break;
    }

    let location = {
      x:      x,
      y:      y,
      path:   path,
      status: Search.Unknown
    };

    location.status = this.location_status(location);

    // New valid location becomes visited now
    if (location.status === Search.Valid) {
      this.grid[y * this.w + x] = Search.Visited;
    }

    return location;
  }

  find(position) {
    let location = {
      x:      position.x,
      y:      position.y,
      path:   [],
      status: Search.Start
    };

    let queue = [location];
    while (queue.length > 0) {
      let current_location = queue.shift();
      // Explore in each direction for the goal
      let directions = [
        Direction.North,
        Direction.East,
        Direction.South,
        Direction.West
      ];
      for (let i = 0; i < directions.length; i++) {
        let location = this.explore(current_location, directions[i]);
        if (location.status === Search.Goal) {
          return location.path;
        } else if (location.status === Search.Valid) {
          queue.push(location);
        }
      }
    }
    return null;
  }
}

//     _____
//    / ____|
//   | |  __  __ _ _ __ ___   ___
//   | | |_ |/ _` | '_ ` _ \ / _ \
//   | |__| | (_| | | | | | |  __/
//    \_____|\__,_|_| |_| |_|\___|
//
//

const Screen = {
  Game:      0, // Game screen
  Start:     1, // Start screen
  Resume:    2, // Resume screen
  Over:      3, // Game over screen
  Help:      4, // Help screen
  Inventory: 5, // Inventory screen
  Shop:      6  // Shop screen
};

class Game {
  constructor() {
    this.framebuffer = new Framebuffer();
    this.generator = new Generator(10, 75, 25);
    this.message = "";
    if (!this.load()) {
      this.create_game(Screen.Start);
    } else {
      this.resume_game();
    }
    if (!this.load_assets()) {
      console.error("failed to load game assets");
    }
  }

  set_screen(screen) {
    this.cursor = 1; // Reset the cursor on every screen switch
    this.screen = screen;
  }

  load_assets() {
    try {
      this.start_screen = fs.readFileSync(`${PATH}/start.txt`).toString().replace(/\r\n/g, '\n').split("\n");
      this.resume_screen = fs.readFileSync(`${PATH}/resume.txt`).toString().replace(/\r\n/g, '\n').split("\n");
      this.gameover_screen = fs.readFileSync(`${PATH}/gameover.txt`).toString().replace(/\r\n/g, '\n').split("\n");
    } catch(err) {
      return false;
    }
    return true;
  }

  create_game(screen) {
    this.seed = Math.random();
    this.random = new Random(this.seed);
    this.player = new Player();

    // Every new game starts off on the first floor
    this.floor = 0;
    this.offset = this.random.next();

    this.set_screen(screen);
    this.begin_game();
  }

  resume_game() {
    this.offset = this.random.next();
    this.set_screen(Screen.Resume);
    this.generate_map();
  }

  begin_game() {
    // Generate and populate the map randomly
    this.generate_map();
    this.populate_map();

    // Do not reveal enemies and stairs on new games
    this.reveal = false;

    // Pick a random spawn location for the player that isn't on an
    // enemy or a rupee
    do {
      let playable_area = this.find_random_playable_area();
      this.player.x = playable_area.x;
      this.player.y = playable_area.y;
    } while(this.check_for_enemy() || this.check_for_rupee());
  }

  generate_map() {
    this.map = this.generator.generate(this.floor + this.offset);
  }

  populate_map() {
    // Insert entities into the new map
    this.entities = [];
    this.entities.push(this.player);

    // Generate rupees
    let rupees = this.random.next_in_range(RUPEE_MIN, RUPEE_MAX);
    for (let i = 0; i < rupees; i++) {
      let location = this.find_random_playable_area();
      this.entities.push(new Rupee(location));
    }

    // Generate enemy entities
    let enemies = this.random.next_in_range(ENEMY_MIN, ENEMY_MAX);
    for (let i = 0; i < enemies; i++) {
      // Pick a random enemy
      let index = this.random.next_in_range(0, Enemies.length - 1);
      // Create a new instance of that enemy
      let enemy = new Enemy({instance: index});
      // Find a spawn position for it that is in a playable cell
      let location = this.find_random_playable_area();
      // Set that spawn position
      enemy.x = location.x;
      enemy.y = location.y;
      // Keep track of which enemies we have
      this.entities.push(enemy);
    }
  }

  render_map() {
    let map = this.map;
    let grid = map.rasterize();
    let result = "";
    for (let y = 0; y < map.h; y++) {
      for (let x = 0; x < map.w; x++) {
        // Check if enemy or player intersects this space
        let entity = this.get_area_entity(x, y, [Entity.Player, Entity.Enemy, Entity.Rupee, Entity.Torch]);
        let position = {x: x, y: y};
        let draw = this.night ? false : true;

        // When a map is used, then entities and stairs should be visible
        if (this.reveal && (entity || this.map.is_area_stair(x, y))) {
          draw = true;
        }

        // Area around the player is always visible
        if (this.midpoint_circle(position, LRADIUS, this.player)) {
          draw = true;
        }

        // Area around a torch entities are always visible
        let entities = this.entities;
        for (let i = 0; i < entities.length; i++) {
          let entity = entities[i];
          if (entity.type === Entity.Torch) {
            if (this.midpoint_circle(position, LRADIUS, entity)) {
              draw = true;
              break;
            }
          }
        }

        if (entity && entity.type != Entity.Torch) {
          // They turn to werewolfs at night
          let char = this.night && entity.type === Entity.Enemy ? "W" : entity.char;
          result += draw ? char : " ";
        } else {
          result += draw ? grid[x + map.w * y] : " ";
        }
      }
    }
    this.framebuffer.blit(2, 2, map.w, map.h, result);
  }

  dir_offset(direction) {
    switch (direction) {
    case Direction.North: return { x:  0, y: -1 };
    case Direction.East:  return { x:  1, y:  0 };
    case Direction.South: return { x:  0, y:  1 };
    case Direction.West:  return { x: -1, y:  0 };
    }
    return { x: 0, y: 0 };
  }

  // Implementation of Bresenham's line algorithm
  // https://en.wikipedia.org/wiki/Bresenham%27s_line_algorithm
  bresenham(a, b) {
    let result = [];
    let x0 = a.x;
    let y0 = a.y;
    let x1 = b.x;
    let y1 = b.y;
    let swap_xy = Math.abs(y1 - y0) > Math.abs(x1 - x0);
    if (swap_xy) {
      [x0, y0] = [y0, x0];
      [x1, y1] = [y1, x1];
    }
    if (x0 > x1) {
      [x0, x1] = [x1, x0];
      [y0, y1] = [y1, y0];
    }
    let delta_x = x1 - x0;
    let delta_y = Math.floor(Math.abs(y1 - y0));
    let error = Math.floor(delta_x / 2);
    let y = y0;
    let y_step = y0 < y1 ? 1 : -1;
    for (let x = x0; x < x1 + 1; x++) {
      if (swap_xy) {
        result.push({ x: y, y: x });
      } else {
        result.push({ x: x, y: y });
      }
      error -= delta_y;
      if (error < 0) {
        y += y_step;
        error += delta_x;
      }
    }
    return result;
  }

  // Implementation of Midpoint circle algorithm
  // https://en.wikipedia.org/wiki/Midpoint_circle_algorithm
  //
  // Note: this is modified to check if something is inside the circle
  // and not actually produce the circle. Midpoint only concerns itself
  // with generating a line forming the circle, this checks the line
  // segment to see if the point is in bounds, for all line segments
  // forming the circle.
  midpoint_circle(position, radius, check) {
    let x0 = position.x;
    let y0 = position.y;
    let x = radius;
    let y = 0;
    let x_change = (1 - (radius << 1)) | 0;
    let y_change = 0;
    let err = 0;
    while (x >= y) {
      for (let i = x0 - x; i <= x0 + x; i++) {
        if (check.x === i && (check.y === y0 + y || check.y === y0 - y)) {
          return true;
        }
      }
      for (let i = x0 - y; i <= x0 + y; i++) {
        if (check.x === i && (check.y === y0 + x || check.y === y0 - x)) {
          return true;
        }
      }
      y++;
      err += y_change;
      y_change += 2;
      if (((err << 1) + x_change) > 0) {
        x--;
        err += x_change;
        x_change += 2;
      }
    }
    return false;
  }

  line_of_sight(a, b) {
    let result = this.bresenham(a, b);
    for (let i = 0; i < result.length; i++) {
      let cell = result[i];
      if (!this.map.is_area_playable(cell.x, cell.y)) {
        return false;
      }
    }
    return true;
  }

  move_entity(entity, direction) {
    let offset = this.dir_offset(direction);
    if (this.map.is_area_playable(entity.x + offset.x, entity.y + offset.y)) {
      entity.x += offset.x;
      entity.y += offset.y;
      return true;
    }
    return false;
  }

  move_player(direction) {
    return this.move_entity(this.player, direction);
  }

  check_for_stair() {
    return this.map.is_area_stair(this.player.x, this.player.y) !== false;
  }

  check_enemy(enemy, x, y) {
    let that = this;
    const check = (direction) => {
      let offset = that.dir_offset(direction);
      return enemy.x === x + offset.x && enemy.y === y + offset.y;
    }
    return check(Direction.North) || check(Direction.East) || check(Direction.South) || check(Direction.West);
  }

  check_for_enemy() {
    // Search around the player for an enemy
    let x = this.player.x;
    let y = this.player.y;
    for (let i = 0; i < this.entities.length; i++) {
      let entity = this.entities[i];
      if (entity.type === Entity.Enemy && this.check_enemy(entity, x, y)) {
        return entity;
      }
    }
    return null;
  }

  check_for_rupee() {
    return this.get_area_entity(this.player.x, this.player.y, [Entity.Rupee]);
  }

  update_stair() {
    // Determine the stair type that the player is on, adjust the floor
    // number and calculate the opposite stair type for the spawn location
    // on the other floor.
    let stair_type = this.map.get_cell(this.player.x, this.player.y);
    let opposite_type = 0;
    switch (stair_type) {
      /****/ case Cell.UpStairs:   this.floor++; opposite_type = Cell.DownStairs;
      break; case Cell.DownStairs: this.floor--; opposite_type = Cell.UpStairs;
      break;
    }
    // Start the game on that floor
    this.begin_game();

    // Spawn the player on the stair case on the other floor that is
    // opposite to the stair case they came from.
    let stairs = this.map.find_stairs(opposite_type);
    this.player.x = stairs.x;
    this.player.y = stairs.y;

    return true;
  }

  remove_enemy(enemy) {
    let index = this.entities.indexOf(enemy);
    if (index > -1) {
      // Player gets another kill
      this.player.kills++;

      // Remove the enemy entity
      this.entities.splice(index, 1);

      // Give the player some HP for a successfull kill
      this.player.hp = Math.floor(this.player.hp * 1.125);
      this.message = `Kill: ${enemy.name}`;

      return true;
    }
    return false;
  }

  update_damage(enemy) {
    // Player always delivers damage first
    enemy.hp -= this.player.weapon_obj.dmg;
    if (enemy.hp <= 0) {
      // Enemy has been killed
      return this.remove_enemy(enemy);
    }
    // Enemy delivers damage to the player
    this.player.hp -= enemy.weapon_obj.dmg;
    if (this.player.hp <= 0) {
      this.player.hp = 0;
      return true;
    }
    return false;
  }

  update_enemy(enemy) {
    // Deliver and accept damage
    if (this.update_damage(enemy)) {
      // Something died
      if (this.player.hp <= 0) {
        // Create a new, unique game
        this.create_game(Screen.Over);
      }
    } else {
      this.message = `Atk: ${enemy.name}`;
    }
  }

  update_rupee(rupee) {
    let index = this.entities.indexOf(rupee);
    if (index > -1) {
      // Player gets another rupee
      this.player.rupees++;
      this.entities.splice(index, 1);
      this.message = "+1 Rupee";
    }
  }

  // Command check functions, to determine the command type

  // Determines if the command supplied is a movement command
  is_command_movement(command) {
    if (!command) {
      return false;
    }
    // Regular expression for any multiple of wasd and optional multiple numbers
    let movement = /([wasd]+)(\d+)?/;
    let groups = command.match(movement);
    if (!groups) {
      return false;
    }
    return groups;
  }

  // Determines if the command supplied is a inventory command
  is_command_inventory(command) {
    return command === "i";
  }

  is_command_shop(command) {
    return command === "v";
  }

  // Determines if the command supplied is a fight command
  is_command_fight(command) {
    return command === "f";
  }

  // Determines if the command supplied is a help command
  is_command_help(command) {
    return command === "h";
  }

  // Determines if the command supplie is an exit command
  is_command_exit(command) {
    return command === "e";
  }

  // Command handler functions, to handle the command type

  // Parses a movement command result of check_movement and applies
  // the movement for the player.
  do_command_movement(movement) {
    const get_direction = (char) => {
      switch (char) {
      case "w": return Direction.North;
      case "a": return Direction.West;
      case "s": return Direction.South;
      case "d": return Direction.East;
      }
    };

    if (movement[2]) {
      // Numeric movement should have just one character for direction
      // for instance, w4 is legal but ww3 is not.
      if (movement[1].length > 1) {
        return false;
      }
      let direction = get_direction(movement[1]);
      let count = parseInt(movement[2]);
      for (let i = 0; i < Math.min(count, DIST); i++) {
        if (!this.move_player(direction)) {
          return false;
        }
        // Intersected with an enemy, terminate movement
        if (this.check_for_enemy()) {
          break;
        }
      }
    } else if (movement[1].length === 1 || /^(.)\1+$/.test(movement[1])) {
      // When it's not a numeric movement then it's probably just multiple
      // characters specifying the movement, go ahead and apply those
      let length = Math.min(movement[1].length, DIST);
      for (let i = 0; i < length; i++) {
        if (!this.move_player(get_direction(movement[1][0]))) {
          return false;
        }
        // Intersected with an enemy, terminate movement
        if (this.check_for_enemy()) {
          break;
        }
      }
    }
    return true;
  }

  do_command_fight() {
    let enemy = this.check_for_enemy();
    if (enemy) {
      this.update_enemy(enemy);
      return true;
    }
    return false;
  }

  // Simulate one step of enemy AI
  update_ai() {
    for (let i = 0; i < this.entities.length; i++) {
      let entity = this.entities[i];
      if (entity.type !== Entity.Enemy) {
        continue;
      }
      if (!this.line_of_sight(this.player, entity)) {
        continue;
      }

      let ai = new AI(this.map, this.entities);
      let direction = ai.find(entity);
      if (direction) {
        this.move_entity(entity, direction[0]);
      }
    }
  }

  render_screen_game() {
    this.render_map();
    this.framebuffer.draw_text(2, 1, `${this.player.rupees} ${Chars.Rupee}`);
    this.framebuffer.draw_text(W - 10, 1, `${this.time}`);
    this.framebuffer.draw_text(2, H - 3, `${this.floor} KM | ${this.player.hp} HP | ${this.player.kills} Ks`);
    this.framebuffer.draw_text(2, H - 2, this.message);
  }

  render_screen_inventory() {
    this.framebuffer.draw_text(2, 1, `${this.player.rupees} ${Chars.Rupee}`);
    this.framebuffer.draw_text((W-2)/2-4, 2, `INVENTORY`);
    let items = this.player.items;
    let y = 4;
    for (let i = 0; i < items.length; i++) {
      let item = items[i];
      let cursor = i+1 === this.cursor ? ">" : " ";
      let line = `x${item.quanity} ${Items[item.item_idx].cost} ${Chars.Rupee}`
      this.framebuffer.draw_text(2, y, `${cursor} ${i+1} - ${Items[item.item_idx].name}`);
      this.framebuffer.draw_text(2, y+1, "".padStart(W-4, "-"));
      this.framebuffer.draw_text(W - (line.length + 2), y, line);
      y += 2;
    }
    if (items.length > this.cursor-1) {
      this.framebuffer.draw_text(2, H - 3, Items[items[this.cursor-1].item_idx].description);
    }
  }

  render_screen_shop() {
    this.framebuffer.draw_text(2, 1, `${this.player.rupees} ${Chars.Rupee}`);
    this.framebuffer.draw_text((W-2)/2-1, 2, `SHOP`);
    let y = 4;
    for (let i = 0; i < Items.length; i++) {
      let item = Items[i];
      let cost = `${item.cost} ${Chars.Rupee}`
      let cursor = i+1 === this.cursor ? ">" : " ";
      this.framebuffer.draw_text(2, y, `${cursor} ${i+1} - ${item.name}`);
      this.framebuffer.draw_text(2, y+1, "".padStart(W-4, "-"));
      this.framebuffer.draw_text(W - (cost.length + 2), y, cost);
      y += 2;
    }
    this.framebuffer.draw_text(2, H-3, Items[this.cursor-1].description);
    let items = this.player.items;
    for (let i = 0; i < items.length; i++) {
      let item = items[i];
      if (item.item_idx === this.cursor-1) {
        let quanity = item.quanity;
        this.framebuffer.draw_text(2, H-2, `x${quanity}`);
        break;
      }
    }
  }

  render_screen_start() {
    this.framebuffer.draw_text_array(1, 1, this.start_screen);
  }

  render_screen_resume() {
    this.framebuffer.draw_text_array(1, 1, this.resume_screen);
  }

  render_screen_over() {
    this.framebuffer.draw_text_array(1, 1, this.gameover_screen);
  }

  render_screen_help() {
    const w = "forward";
    const a = "left";
    const s = "down";
    const d = "right";
    const f = "fight";
    const i = "inventory";
    const v = "vendor";
    const h = "help";
    const b = "buy";
    const S = "sell";
    const u = "use";
    const e = "escape";

    // 11 characters each side centered
    this.framebuffer.draw_text((W-2)/2-3, 2, "MOVEMENT");

    this.framebuffer.draw_text(2, 3, "[w]");
    this.framebuffer.draw_text(W - (w.length + 2), 3, w);
    this.framebuffer.draw_text(2, 4, "".padStart(W-4, "-"));

    this.framebuffer.draw_text(2, 5, "[a]");
    this.framebuffer.draw_text(W - (a.length + 2), 5, a);
    this.framebuffer.draw_text(2, 6, "".padStart(W-4, "-"));

    this.framebuffer.draw_text(2, 7, "[s]");
    this.framebuffer.draw_text(W - (s.length + 2), 7, s);
    this.framebuffer.draw_text(2, 8, "".padStart(W-4, "-"));

    this.framebuffer.draw_text(2, 9, "[d]");
    this.framebuffer.draw_text(W - (d.length + 2), 9, d);
    this.framebuffer.draw_text(2, 10, "".padStart(W-4, "-"));

    // 12 characters each side centered
    this.framebuffer.draw_text((W-2)/2-2, 11, "ACTION");

    this.framebuffer.draw_text(2, 12, "[f]");
    this.framebuffer.draw_text(W - (f.length + 2), 12, f);
    this.framebuffer.draw_text(2, 13, "".padStart(W-4, "-"));

    this.framebuffer.draw_text(2, 14, "[i]");
    this.framebuffer.draw_text(W - (i.length + 2), 14, i);
    this.framebuffer.draw_text(2, 15, "".padStart(W-4, "-"));

    this.framebuffer.draw_text(2, 16, "[v]");
    this.framebuffer.draw_text(W - (v.length + 2), 16, v);
    this.framebuffer.draw_text(2, 17, "".padStart(W-4, "-"));

    this.framebuffer.draw_text(2, 18, "[b]");
    this.framebuffer.draw_text(W - (b.length + 2), 18, b);
    this.framebuffer.draw_text(2, 19, "".padStart(W-4, "-"));

    this.framebuffer.draw_text(2, 20, "[s]");
    this.framebuffer.draw_text(W - (S.length + 2), 20, S);
    this.framebuffer.draw_text(2, 21, "".padStart(W-4, "-"));

    this.framebuffer.draw_text(2, 22, "[u]");
    this.framebuffer.draw_text(W - (u.length + 2), 22, u);
    this.framebuffer.draw_text(2, 23, "".padStart(W-4, "-"));

    this.framebuffer.draw_text(2, 24, "[h]");
    this.framebuffer.draw_text(W - (h.length + 2), 24, h);
    this.framebuffer.draw_text(2, 25, "".padStart(W-4, "-"));

    this.framebuffer.draw_text(2, 26, "[e]");
    this.framebuffer.draw_text(W - (e.length + 2), 26, e);
    this.framebuffer.draw_text(2, 27, "".padStart(W-4, "-"));

    this.set_screen(Screen.Game);
  }

  update_screen_game(command) {
    // Determine the command supplied
    let movement  = this.is_command_movement(command);
    let inventory = this.is_command_inventory(command);
    let shop      = this.is_command_shop(command);
    let fight     = this.is_command_fight(command);
    let help      = this.is_command_help(command);
    let moved     = false;

    // Interact based on the command type
    if (movement) {
      if (this.check_for_enemy()) {
        this.message = "Cannot flee fight";
      } else {
        if (this.do_command_movement(movement)) {
          // Check to see if the movement encountered a fight
          let enemy = this.check_for_enemy();
          if (enemy) {
            this.message = `Enc: ${enemy.name}`;
          } else {
            moved = true;
          }
        } else {
          this.message = "Cannot go that way";
        }
      }
    } else if (fight) {
      if (!this.do_command_fight()) {
        this.message = "Nothing to fight";
      }
    } else if (inventory) {
      this.set_screen(Screen.Inventory);
    } else if (shop) {
      this.set_screen(Screen.Shop);
    } else if (help) {
      this.set_screen(Screen.Help);
    } else if (command && command.length > 0) {
      this.message = "Unknown or malformed command"; // exactly fits
    } else {
      let enemy = this.check_for_enemy();
      if (enemy) {
        this.message = `Enc: ${enemy.name}`;
      } else {
        this.message = "";
      }
    }

    // The player has moved, this is the only thing to trigger AI
    if (moved) {
      // Check if the player interacts with stair or enemy, update
      // based on the interaction state.
      let stair = this.check_for_stair();
      let enemy = this.check_for_enemy();
      let rupee = this.check_for_rupee();

      if (stair) {
        this.update_stair();
      } else if (enemy) {
        this.update_enemy(enemy);
      } else if (rupee) {
        this.update_rupee(rupee);
      }

      this.update_ai();
      enemy = this.check_for_enemy();
      if (enemy) {
        this.message = `Enc: ${enemy.name}`;
      }
    }
  }

  remove_item() {
    let items = this.player.items;
    let index = this.cursor-1;
    if (index < items.length) {
      let item = items[index];
      if (item.quanity === 1) {
        items.splice(index, 1);
        this.cursor = 1;
      } else {
        item.quanity--;
      }
      return true;
    }
    return false;
  }

  update_screen_inventory(command) {
    if (this.is_command_exit(command)) {
      this.set_screen(Screen.Game);
    } else if (this.is_command_shop(command)) {
      this.set_screen(Screen.Shop);
    } else if (command === "s") {
      let items = this.player.items;
      if (this.cursor-1 < items.length) {
        let item = items[this.cursor-1];
        let cost = Items[item.item_idx].cost;
        this.remove_item()
        this.player.rupees += cost;
      }
    } else if (command === "u") {
      let items = this.player.items;
      if (this.cursor-1 < items.length) {
        let item = items[this.cursor-1];
        if (item.item_idx === Item.Torch) { // Torch
          this.remove_item();
          this.entities.push(new Torch({x: this.player.x, y: this.player.y}));
          this.set_screen(Screen.Game);
        } else if (item.item_idx === Item.Health) {
          this.remove_item();
          this.player.hp = 100;
          this.set_screen(Screen.Game);
        } else if (item.item_idx === Item.Map) {
          this.remove_item();
          this.reveal = true;
          this.set_screen(Screen.Game);
        } else if (item.item_idx === Item.Silver) {
          let enemy = this.check_for_enemy();
          if (enemy) {
            this.remove_item();
            this.remove_enemy(enemy);
          } else {
            this.message = "Nothing to use on";
          }
          this.set_screen(Screen.Game);
        } else {
          // TODO(implement other items)
        }
      }
    } else {
     let i = parseInt(command);
     // Cursor selection is 1-based, array is 0-based
     if (i > 0 && i <= this.player.items.length) {
       this.cursor = i;
     }
    }
  }

  update_screen_shop(command) {
    if (this.is_command_exit(command)) {
      this.set_screen(Screen.Game);
    } else if (this.is_command_inventory(command)) {
      this.set_screen(Screen.Inventory);
    } else if (command === "b") {
      // Go ahead and buy the item
      let cost = Items[this.cursor-1].cost;
      if (this.player.rupees >= cost) {
        // Check if the player already has this item
        let items = this.player.items;
        let added = false;
        for (let i = 0; i < items.length; i++) {
          let item = items[i];
          // Just increase the quanity if they have this item
          if (item.item_idx === this.cursor-1) {
            item.quanity++;
            added = true;
            break;
          }
        }
        // Otherwise add a new item with a quanity of one
        if (!added) {
          items.push({ item_idx: this.cursor-1, quanity: 1 });
        }
        this.player.rupees -= cost;
      }
    } else {
      let i = parseInt(command);
      // Cursor selection is 1-based, array is 0-based
      if (i > 0 && i <= Items.length) {
        this.cursor = i;
      }
    }
  }

  update_screen_start(command) {
    if (command === "start" || command === "begin") {
      this.set_screen(Screen.Game);
    }
  }

  update_screen_resume(command) {
    if (command === "resume") {
      this.set_screen(Screen.Game);
    }
  }

  update_screen_over(command) {
    if (command === "start" || command === "begin") {
      this.set_screen(Screen.Game);
    }
  }

  update_time() {
    // Update the current time
    let date = new Date();
    const config = {
      timeZone: 'UTC',
      hour:     'numeric',
      minute:   'numeric',
      hour12:   true
    };
    this.time = date.toLocaleString('en-US', config);
    let hours = date.getUTCHours();
    this.night = hours <= 9 || hours >= 21; // 9AM to 9PM
  }

  update(command) {
    this.update_time();

    switch (this.screen) {
    case Screen.Game:
      this.update_screen_game(command);
      break;
    case Screen.Inventory:
      this.update_screen_inventory(command);
      break;
    case Screen.Shop:
      this.update_screen_shop(command);
      break;
    case Screen.Start:
      this.update_screen_start(command);
      break;
    case Screen.Resume:
      this.update_screen_resume(command);
      break;
    case Screen.Over:
      this.update_screen_over(command);
      break;
    case Screen.Help:
      this.update_screen_help(command);
      break;
    }

    // It's important we don't coalesce the render with the update because
    // the update may change the screen.

    // Clear frame buffer
    this.framebuffer.clear();

    // Render the current screen
    switch (this.screen) {
    case Screen.Game:
      this.render_screen_game();
      break;
    case Screen.Inventory:
      this.render_screen_inventory();
      break;
    case Screen.Shop:
      this.render_screen_shop();
      break;
    case Screen.Start:
      this.render_screen_start();
      break;
    case Screen.Resume:
      this.render_screen_resume();
      break;
    case Screen.Over:
      this.render_screen_over();
      break;
    case Screen.Help:
      this.render_screen_help();
      break;
    }

    // Save the game after every command
    this.save();

    // Rasterize as a message for discord
    this.message = "";
    return this.framebuffer.as_string();
  }

  get_area_entity(x, y, types) {
    for (let i = 0; i < this.entities.length; i++) {
      let entity = this.entities[i];
      if (entity.x === x && entity.y === y) {
        for (let j = 0; j < types.length; j++) {
          if (entity.type === types[j]) {
            return entity;
          }
        }
      }
    }
    return null;
  }

  find_random_playable_area() {
    let map = this.map;

    // Pick a random location in a playable cell that isn't stairs or door
    let x = 0;
    let y = 0;
    do {
      x = this.random.next_in_range(0, map.w);
      y = this.random.next_in_range(0, map.h);
    } while(!(map.is_area_playable(x, y) && !map.is_area_stair(x, y) && !map.is_area_door(x, y)));
    return { x: x, y: y };
  }

  serialize() {
    let entities = [];
    for (let i = 0; i < this.entities.length; i++) {
      entities.push(this.entities[i].serialize());
    }
    return {
      seed:     this.seed,
      floor:    this.floor,
      reveal:   this.reveal,
      entities: entities
    };
  }

  deserialize(object) {
    this.seed = object.seed;
    this.floor = object.floor;
    this.reveal = object.reveal;
    this.random = new Random(this.seed);
    this.entities = [];
    for (let i = 0; i < object.entities.length; i++) {
      let entity = object.entities[i];
      if (entity.type == Entity.Player) {
        this.player = new Player(entity);
        this.entities.push(this.player);
      } else if (entity.type === Entity.Enemy) {
        let instance = new Enemy(entity);
        this.entities.push(instance);
      }
    }
  }

  save() {
    fs.writeFileSync(`${PATH}/save.json`, JSON.stringify(this.serialize()));
  }

  load() {
    try {
      this.deserialize(JSON.parse(fs.readFileSync(`${PATH}/save.json`, "utf8")));
    } catch(err) {
      // Report errors to the console during loading, but only if the file
      // exists and something else went wrong.
      if (err.code != 'ENOENT') {
        console.error(err);
      }
      return false;
    }
    return true;
  }
}

// This state needs to persist
let game = new Game();

function clear_screen() {
  process.stdout.write('\033c');
}

function splash() {
  clear_screen();
  console.log(game.update(null));
}

function update(command) {
  clear_screen();
  console.log(game.update(command));
}

// Display the splash screen
splash();

// Call game.update(message) with the channel message

// This can be deleted.
let stdin = process.stdin;
stdin.setRawMode(true);
stdin.resume();
stdin.setEncoding('utf-8');
let command = "";
stdin.on('data', function(key) {
  if (key === '\u0003') {
    process.exit();
  } else if (key.charCodeAt(0) == 13) {
    update(command);
    command = "";
  } else {
    command += key;
  }
});
