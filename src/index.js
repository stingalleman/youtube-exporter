const fs = require("fs");
const readline = require("readline");
const { google } = require("googleapis");
const express = require("express");
const OAuth2 = google.auth.OAuth2;

const app = express();

const prom = require("prom-client");
const register = prom.register;

/**
 * define metrics
 */

const streamStatusGauge = new prom.Gauge({
	name: "yt_streamStatus_counter",
	help: "Stream Status",
});

/**
 * define scopes
 */
const SCOPES = [
	"https://www.googleapis.com/auth/youtube.readonly",
	"https://www.googleapis.com/auth/youtube.force-ssl",
	"https://www.googleapis.com/auth/youtube.upload",
	"https://www.googleapis.com/auth/youtube",
];

/**
 * token directories
 */
const TOKEN_DIR = "./.credentials/";
const TOKEN_PATH = TOKEN_DIR + "youtube-creds.json";

// Load client secrets from a local file.
fs.readFile("config.json", function processClientSecrets(err, content) {
	if (err) {
		console.log("Error loading client secret file: " + err);
		return;
	}
	// Authorize a client with the loaded credentials, then call the YouTube API.
	authorize(JSON.parse(content), execute);
});

/**
 * Create an OAuth2 client with the given credentials, and then execute the
 * given callback function.
 *
 * @param {Object} credentials The authorization client credentials.
 * @param {function} callback The callback to call with the authorized client.
 */
function authorize(credentials, callback) {
	const clientSecret = credentials.googleAPI.client_secret;
	const clientId = credentials.googleAPI.client_id;
	const redirectUrl = credentials.googleAPI.redirect_uris[0];
	const oauth2Client = new OAuth2(clientId, clientSecret, redirectUrl);

	// Check if we have previously stored a token.
	fs.readFile(TOKEN_PATH, function (err, token) {
		if (err) {
			getNewToken(oauth2Client, callback);
		} else {
			oauth2Client.credentials = JSON.parse(token);
			callback(oauth2Client);
		}
	});
}

/**
 * Get and store new token after prompting for user authorization, and then
 * execute the given callback with the authorized OAuth2 client.
 *
 * @param {google.auth.OAuth2} oauth2Client The OAuth2 client to get token for.
 * @param {getEventsCallback} callback The callback to call with the authorized
 *     client.
 */
function getNewToken(oauth2Client, callback) {
	const authUrl = oauth2Client.generateAuthUrl({
		access_type: "online",
		scope: SCOPES,
	});
	console.log("Authorize this app by visiting this url: ", authUrl);
	const rl = readline.createInterface({
		input: process.stdin,
		output: process.stdout,
	});
	rl.question("Enter the code from that page here: ", function (code) {
		rl.close();
		oauth2Client.getToken(code, function (err, token) {
			if (err) {
				console.log("Error while trying to retrieve access token", err);
				return;
			}
			oauth2Client.credentials = token;
			storeToken(token);
			callback(oauth2Client);
		});
	});
}

/**
 * Store token to disk be used in later program executions.
 *
 * @param {Object} token The token to store to disk.
 */
function storeToken(token) {
	try {
		fs.mkdirSync(TOKEN_DIR);
	} catch (err) {
		if (err.code != "EEXIST") {
			throw err;
		}
	}
	fs.writeFile(TOKEN_PATH, JSON.stringify(token), (err) => {
		if (err) throw err;
		console.log("Token stored to " + TOKEN_PATH);
	});
}

/**
 * Lists the names and IDs of up to 10 files.
 *
 * @param {google.auth.OAuth2} auth An authorized OAuth2 client.
 */
async function execute(auth) {
	const service = google.youtube("v3");
	const broadcastData = await service.liveBroadcasts.list({
		part: ["snippet,contentDetails,status"],
		broadcastStatus: "active",
		auth: auth,
	});
	const livestreamData = await service.liveStreams.list({
		part: ["snippet,cdn,contentDetails,status"],
		auth: auth,
		id: broadcastData.data.items[0].contentDetails.boundStreamId,
	});
	console.log(livestreamData.data.items[0].status.streamStatus);

	if (livestreamData.data.items[0].status.streamStatus == "inactive") {
		streamStatusGauge.set(0);
	}
}

app.get("/auth/*", function (req, res) {
	try {
		res.send(req.query.code);
	} catch (err) {
		if (err) console.log(err);
	}
});

app.get("/metrics", async (req, res) => {
	try {
		res.set("Content-Type", register.contentType);
		res.send(await register.metrics());
	} catch (ex) {
		res.status(500).end(ex);
	}
});

app.listen("3000", () => console.log("listening on http://localhost:3000"));
