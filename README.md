# discord-rogue

The following is a tiny Rogue like game for Discord.

# Features

* Procedural map generation and population
  * Unlimited dungeons
* Polynomial-counter based stair navigation (unique rooms retain layout)
* Day and night cycle
  * Werewolves come out at night
* Shop and inventory system
  * Items that affect gameplay
* Breadth first search path finding
* Pixel accurate line of sight
* Realtime lighting
* Save, load and resume
* Macro movement
* Turn based combat

# Bug reports

You may file any bugs on the issue tracker

### Single source file

Yes everything is a single source file, this turns out to be much easier
to embed and use with your bot and easier to update. Do not submit bug
reports about splitting up the source code into multiple files, they
will be closed on sight.

### Failed to load game assets

The game searches for three text files containing a 30x28 characters
describing splash screens for start, resume and gameover. These are not
provided and you must supply your own.

# Optimizations

The code isn't as optimal as it can be, we do a lot of O(n) runs through
lists of entities and some O(n^2) stuff for generation of dungeons,
however simplicity was chosen over performance for the first iteration.

# Technical challenges

The way this is to be used is with discord.js's codeblock and edit
functionality. `game.update()` is meant to be called on every channel
message, with the contents of the message. This means the entire game is
turn based in nature and limited in area. In particular, the ascii
framebuffer used to represent the game cannot exceed 32x30 characters in
size otherwise the code block would be too wide or too tall for the
smallest Discord supported device: the iPhone.

The game supports an infinite variety of dungeons in each direction
from the starting floor. Coming back to a floor you've been to before
it will have the same layout as when you first discovered it. This
required that map generation be completely deterministic based on a
custom configurable PRNG.

Since every game move is based on a coarse cell-grid, certain pixel
space operations like ray casting for line of sight and trigonometric
operations for realtime light radius calculation doesn't work to establish
which cells are influenced, instead rasterization techniques were used
like Bresenham line and Midpoint circle.

Javascript only supports double precision IEEE-754 numeric operations,
however the game operates exclusively in integer domain for the grid,
this means lots of calculations involving divisions require the use of
`Math.floor` to keep things integer-discrete. For example, the
rasterization techniques require numerical stability for calculating
integer error otherwise they don't work.

# Feature requests

You may request features on the issue tracker but they may be closed if
deemed too difficult or outside the scope of what this game is used for

# License

```
Copyright (c) 2018 Dale Weiler

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```
