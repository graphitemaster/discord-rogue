let Discord = require('discord.js');
let Rogue = require('./rogue.js');

let client = new Discord.Client();
let game = new Rogue.Game();
let channel = null;
let handle = null;

client.on("ready", () => {
  // Search for the rogue channel
  channel = client.channels.find("name", "rogue");

  // Send the empty splash to the channel with scheme syntax highlighting,
  // and get the handle to the message sent so it can be modified
  channel.send("```scheme\n" + game.update(null) + "```")
    .then((message) => { handle = message; })
    .catch(console.error);
});

client.on("message", (message) => {
  // The bot should ignore itself
  if (message.author.bot) {
    return;
  }

  // The message came from the rogue channel
  if (message.channel.id === channel.id) {
    // Delete what ever that message was in the channel
    message.delete(0)
      .catch(console.error);

    // When we have a code block handle, send the message through to the
    // game and edit the code block with the contents of the new game
    // state
    if (handle) {
      handle.edit("```scheme\n" + game.update(message.content) + "```")
        .catch(console.error);
    }
  }
});

// Trim the incoming process arguments to exclude node and the script
// passed.
let args = process.argv.slice(2);
if (args.length <= 0) {
  // We expect the session token for the bot in args[0]
  console.error("Expected session token for Discord login");
} else {
  // Login with the session token passed on the command line and away
  // we go.
  client.login(args[0])
    .catch(console.error);
}
