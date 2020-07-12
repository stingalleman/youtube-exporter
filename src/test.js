"use strict";

const express = require("express");
const server = express();

const prom = require("prom-client")
const register = prom.register;

// Create custom metrics

const Histogram = prom.Histogram;
const h = new Histogram({
	name: "test_histogram",
	help: "Example of a histogram",
	labelNames: ["code"],
});

const Counter = prom.Counter;
const c = new Counter({
	name: "test_counter",
	help: "Example of a counter",
	labelNames: ["code"],
});

const Gauge = prom.Gauge;
const g = new Gauge({
	name: "test_gauge",
	help: "Example of a gauge",
	labelNames: ["method", "code"],
});

// Setup server to Prometheus scrapes:

server.get("/metrics", async (req, res) => {
	try {
		res.set("Content-Type", register.contentType);
		res.end(await register.metrics());
	} catch (ex) {
		res.status(500).end(ex);
	}
});

const port = process.env.PORT || 3000;
console.log(
	`Server listening to ${port}, metrics exposed on /metrics endpoint`
);
server.listen(port);
