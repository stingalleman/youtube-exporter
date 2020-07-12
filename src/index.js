const fs = require("fs");
const { google } = require("googleapis");
const express = require("express");
const moment = require("moment");
const OAuth2 = google.auth.OAuth2;

// moment.locale("nl");

const app = express();

const prom = require("prom-client");
const register = prom.register;

const refresh = 15;

/**
 * define metrics
 */

const yt_streamStatus = new prom.Gauge({
	name: "yt_streamStatus",
	help: "Stream Status",
});

const yt_healthStatus = new prom.Gauge({
	name: "yt_healthStatus",
	help: "Stream Status",
});

const yt_concurrentViewers = new prom.Gauge({
	name: "yt_concurrentViewers",
	help: "Concurrent Viewers",
});

const yt_uptime = new prom.Gauge({
	name: "yt_uptime",
	help: "Stream uptime",
});

/**
 * token directories
 */
const TOKEN_DIR = "./.credentials/";
const TOKEN_PATH = TOKEN_DIR + "youtube-creds.json";

function init() {
	// Authorize a client with the loaded credentials, then call the YouTube API.
	authorize(execute);
}

init();
setInterval(function () {
	init();
}, refresh * 1000);

/**
 * Create an OAuth2 client with the given credentials, and then execute the
 * given callback function.
 *
 * @param {Object} credentials The authorization client credentials.
 * @param {function} callback The callback to call with the authorized client.
 */
function authorize(callback) {
	const clientSecret = process.env.CLIENTSECRET;
	const clientId = process.env.CLIENTID;
	const redirectUrl = process.env.REDIRECTURL;
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
		access_type: "offline",
		scope: [
			"https://www.googleapis.com/auth/youtube.readonly",
			"https://www.googleapis.com/auth/youtube.force-ssl",
			"https://www.googleapis.com/auth/youtube.upload",
			"https://www.googleapis.com/auth/youtube",
		],
	});
	console.log("Auth link: " + authUrl);
	app.get("/auth*", function (req, res) {
		try {
			oauth2Client.getToken(req.query.code, function (err, token) {
				if (err) {
					console.log("Error while trying to retrieve access token", err);
					return;
				}
				oauth2Client.credentials = token;
				storeToken(token);
				callback(oauth2Client);
				res.send("Successfully authenticated!");
			});
		} catch (err) {
			if (err) res.status(500).send(err);
		}
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
 * @param {google.auth.OAuth2} auth An authorized OAuth2 client.
 */
async function execute(auth) {
	const service = google.youtube("v3");
	const broadcastData = await service.liveBroadcasts.list({
		part: ["snippet,contentDetails,status"],
		broadcastStatus: "active",
		auth: auth,
	});

	// If stream
	if (broadcastData.data.items[0].contentDetails.boundStreamId && broadcastData.data.items[0].id) {
		const livestreamData = await service.liveStreams.list({
			part: ["snippet,contentDetails,status"],
			auth: auth,
			id: broadcastData.data.items[0].contentDetails.boundStreamId,
		});
		const videoData = await service.videos.list({
			part: ["liveStreamingDetails, id"],
			auth: auth,
			id: broadcastData.data.items[0].id,
		});

		// Metric yt_uptime
		yt_uptime.set(moment().diff(videoData.data.items[0].liveStreamingDetails.actualStartTime, "seconds"));

		// Metric yt_concurrentViewers
		yt_concurrentViewers.set(parseInt(videoData.data.items[0].liveStreamingDetails.concurrentViewers));

		// Metric yt_streamStatus
		if (livestreamData.data.items[0].status.streamStatus == "inactive") {
			yt_streamStatus.set(0);
		} else if (livestreamData.data.items[0].status.streamStatus == "error") {
			yt_streamStatus.set(1);
		} else if (livestreamData.data.items[0].status.streamStatus == "created") {
			yt_streamStatus.set(2);
		} else if (livestreamData.data.items[0].status.streamStatus == "ready") {
			yt_streamStatus.set(3);
		} else if (livestreamData.data.items[0].status.streamStatus == "active") {
			yt_streamStatus.set(4);
		}

		// Metric yt_healthStatus
		if (livestreamData.data.items[0].status.healthStatus.status == "noData") {
			yt_healthStatus.set(0);
		} else if (livestreamData.data.items[0].status.healthStatus.status == "bad") {
			yt_healthStatus.set(1);
		} else if (livestreamData.data.items[0].status.healthStatus.status == "ok") {
			yt_healthStatus.set(2);
		} else if (livestreamData.data.items[0].status.healthStatus.status == "good") {
			yt_healthStatus.set(3);
		}
	} else {
		// no stream
		yt_concurrentViewers.set(0);
		yt_healthStatus.set(0);
		yt_streamStatus.set(0);
	}
}

app.get("/", (req, res) => {
	// eslint-disable-next-line quotes
	res.send('<a href="/metrics">Metrics</a>');
});

app.get("/metrics", async (req, res) => {
	try {
		res.set("Content-Type", register.contentType);
		res.status(200).send(await register.metrics());
	} catch (ex) {
		res.status(500).end(ex);
	}
});

app.listen(9010, () => console.log("listening on http://localhost:9010/metrics"));
