const effects = require('./effects.js');
const settings = require('./settings.js');
const Discord = require('discord.js');
const ids = require('./id.json');
const ytdl = require('ytdl-core');
const auth = require('./auth.json');
const fs = require('fs');

const selfID = ids.selfID;
const quantumID = ids.quantumID;
const briID = ids.briID;
const retracksID = ids.retracksID;
const bebeID = ids.bebeID;
const prefix = '?';
const queue = new Map();
const client = new Discord.Client();

var isBreak = false;
var effectsChannel;
var timer = null;
var wasIdle = false;

function setBreak(freezeStatus) {
	isBreak = freezeStatus;
	if (isBreak) {
		return "I shall go do one sleeps";
	}
	return "Am woke aha";
}

function getWord(words, index, preserveCase = false) {
	if (words.length <= index)
		return "0";

	if (preserveCase)
		return words[index];

	return words[index].toLowerCase();
}

function isAdmin(userID) {
	return (isDev(userID) || userID == briID);
}

function isDev(userID) {
	return (userID == quantumID);
}

function isOperator(userID) {
	return (isAdmin(userID) || userID == bebeID);
}

client.once('ready', () => {
	effectsChannel = client.channels.get(ids.effectsChannelID);
	effects.readEffectsFromFile();
	effects.cacheAllEffects();
	settings.readSettingsFromFile();
	console.log('Ready!');
});

client.once('reconnecting', () => {
	console.log('Reconnecting!');
});

client.once('disconnect', () => {
	console.log('Disconnect!');
});

client.on('message', async message => {

	// On-demand restriction for accidental issues
	// May be used as spam-protection
	if (!isAdmin(message.author.id) && isBreak) {
		return;
	}

	// Don't respond to messages authored by the bot itself
	if (message.author.id == selfID)
		return;

	// Bots aren't allowed to execute commands (by default)
	// Only admins should be able to modify bot allowance
	if (message.author.bot && !settings.get("iba"))
		return;

	if (message.author.id == retracksID && settings.get("blr"))
		return;

	// Only respond to the prefix with content
	if (!message.content.startsWith(prefix) && message.content.length > 1)
		return;

	const serverQueue = queue.get(message.guild.id);

	/*
	 * 1) Strip the ? prefix from the message
	 * 2) Clean extra whitespaces
	 * 3) Break words at whitespaces
	 * 4) Take the first word
	 * 5) Convert to lowercase and assign as command
	 */
	words = message.content
			.substr(1, message.content.length)
			.replace(/\s+/g, " ")
			.split(' ');

	command = words[0].toLowerCase();

	switch (command) {
		// Bot management commands
		case "stop":
			if (isOperator(message.author.id))
				stop(message, serverQueue, false);
			return;

		case "disconnect":
			if (isAdmin(message.author.id))
				disconnect(serverQueue, true);
			return;

		case "skip":
			skip(message, serverQueue);
			return;

		case "freeze":
			if (isAdmin(message.author.id))
				message.channel.send(setBreak(true));
			else
				message.channel.send("This command need admin access");
			return;

		case "thaw":
			if (!isBreak)
				message.channel.send("I'm already woke my guy");
			else if (isAdmin(message.author.id))
				message.channel.send(setBreak(false));
			else
				message.channel.send("This command needs admin access");
			return;

		// Settings CRUD operations:
		case "togglebotinteraction":
			if (isAdmin(message.author.id)) {
				settings.toggle("iba");
				message.channel.send("External bot interaction is now set to " + settings.get("iba"));
			} else {
				message.channel.send("This command needs admin access");
			}
			return;

		case "blr":
		case "toggleblr":
		case "blacklistretrack":
		case "blacklistretracks":
		case "blacklistretrack5":
			if (isAdmin(message.author.id)) {
				settings.toggle("blr");
				message.channel.send("Blocking retrack5 is now set to " + settings.get("blr"));
			} else {
				message.channel.send("This command needs admin access");
			}
			return;
			
		case "togglerv":
		case "togglereq":
		case "togglereqv":
		case "togglereqverbose":
			if (isOperator(message.author.id)) {
				settings.toggle("reqverb");
				message.channel.send("Requestor verbose is now set to " + settings.get("reqverb"));
			} else {
				message.channel.send("This command needs operator access");
			}
			return;

		case "settimeout":
		case "timer":
		case "timeout":
		case "idle":
			if (isDev(message.author.id)) {
				settings.set("timeout", getWord(words, 1));
				message.channel.send("Idle timeout is now set to " + settings.get("timeout"));
			} else {
				message.channel.send("This command needs dev access");
			}
			return;

		case "commits":
		case "commitsettings":
			if (isAdmin(message.author.id))
				message.channel.send(settings.commit());
			else
				message.channel.send("This command needs admin access");
			return;

		case "lists":
		case "listset":
		case "listsettings":
			message.channel.send(settings.getSettings());
			return;
		

		// Effects CRUD operations:
		case "delete":
			if (isAdmin(message.author.id)) {
				effects.remove(getWord(words, 2, 1));
			}
			return;

		case "update":
			if (isOperator(message.author.id)) {
				message.channel.send(
					effects.update(getWord(words, 1), getWord(words, 2, true))
				);
			}
			return;

		case "add":
			if (isOperator(message.author.id)) {
				message.channel.send(
					effects.add(getWord(words, 1), getWord(words, 2, true))
				);
			}
			return;

		case "cache":
		case "forcecache":
			if (isOperator(message.author.id)) {
				message.channel.send(effects.cache(getWord(words, 1), true, command == "forcecache"));
			}
			return;

		case "cacheall":
		case "forcecacheall":
			if (isOperator(message.author.id)) {
				effects.cacheAllEffects(command == "forcecacheall");
				message.channel.send("Effects cached as audio formats to storage");
			} else {
				message.channel.send("This command needs operator access");
			}
			return;

		case "refreshcache":
			if (isAdmin(message.author.id))
				message.channel.send(effects.refreshCache());
			else
				message.channel.send("This command needs admin access");
			return;

		case "wipecache":
			if (isAdmin(message.author.id))
				message.channel.send(effects.clearCacheAll());
			else
				message.channel.send("This command needs admin access");
			return;


		case "commiteffects":
		case "commite":
			if (isOperator(message.author.id))
				message.channel.send(effects.commit());
			return;

		case "get":
			url = effects.getURL(getWord(words, 1));
			if (!url)
				message.channel.send("The effect isn't on record");
			else
				message.channel.send(words[1] + ": <" + url + ">");
			return;

		case "numeffects":
			message.channel.send(effects.getNumEffects() + " effects are currently stored in mem");
			return;

		case "listeffects":
		case "liste":
			message.channel.send(effects.getNames());
			return;

		// The effects themselves
		default:
			if (!command)
				return;

			url = effects.getURL(command);

			if (!url) {
				message.channel.send(command + " command doesn't exist mate");
				return;
			}
			execute(command, url, message, serverQueue);
	}
});

async function execute(command, url, message, serverQueue) {
	const voiceChannel = message.member.voiceChannel;

	if (!voiceChannel)
		return message.author.send('You need to be in a voice channel to play music!');

	const permissions = voiceChannel.permissionsFor(message.client.user);

	if (!permissions.has('CONNECT') || !permissions.has('SPEAK')) {
		return message.channel.send('I need the permissions to join and speak in your voice channel!');
	}

	if (settings.get("reqverb"))
		effectsChannel.send(message.content.substr(1, message.content.len) + ` requested by ` + message.author.id);

	if (timer)
		clearTimeout(timer);

	if (!serverQueue) {
		console.log("Creating serverQueue...");
		const queueContruct = {
			textChannel: message.channel,
			voiceChannel: voiceChannel,
			connection: null,
			songs: [],
			volume: 5,
			playing: true,
		};

		queue.set(message.guild.id, queueContruct);
		serverQueue = queue.get(message.guild.id);
		serverQueue.songs.push([command, url]);
		var connection = await voiceChannel.join();
		serverQueue.connection = connection;
		console.log("ServerQueue built:", serverQueue.textChannel.guild);
	} else {
		serverQueue.songs.push([command, url]);
		if (!wasIdle)
			return;
	}

	// If serverqueue doesn't exist, make one
	// If serverqueue exists, push the song, the queue will increment itself
	// If serverqueue exists but bot was idle, push the song and play it

	try {
		play(message.guild, serverQueue.songs[0]);
	} catch (err) {
		console.log(err);
		queue.delete(message.guild.id);
		return;
	}
}

function skip(message, serverQueue) {
	if (!message.member.voiceChannel) return message.channel.send('You have to be in a voice channel to stop the music!');
	if (!serverQueue) return message.channel.send('There is no song that I could skip!');
	serverQueue.connection.dispatcher.end();
}

function stop(message, serverQueue, shouldDisconnect) {
	if (!message.member.voiceChannel && !isAdmin(message.author.id))
		return message.channel.send('You have to be in a voice channel to stop the music!');

	disconnect(serverQueue, shouldDisconnect);
}

function disconnect(serverQueue, shouldExit) {
	if (!serverQueue)
		return;

	serverQueue.songs = [];
	wasIdle = false;

	if (shouldExit && serverQueue.voiceChannel) {
		serverQueue.voiceChannel.leave();
		queue.delete(serverQueue.textChannel.guild.id);
	}
}

function play(guild, song) {
	const serverQueue = queue.get(guild.id);

	if (!song) {
		wasIdle = true;
		timer = setTimeout(disconnect, parseInt(settings.get("timeout"), 10) * 1000, serverQueue, true);
		return;
	}

	if (effects.isCached(song[0])) {
		stream = fs.createReadStream("./vid_cache/" + song[0]);
	} else {
		stream = ytdl(song[1], {quality: 'lowest'});
	}

	const dispatcher = serverQueue.connection.playStream(stream)
	.on('end', () => {
			console.log('Music ended!');
			serverQueue.songs.shift();
			play(guild, serverQueue.songs[0]);
		})
	.on('error', error => {
			console.error(error);
			stream.close();
		});
	dispatcher.setVolumeLogarithmic(serverQueue.volume / 5);

}

client.login(auth.token);