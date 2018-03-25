const server = require('http').createServer();
const johnny = require('johnny-five');
const io = require('socket.io')(server);

server.listen(process.env.PORT || 4000);

let IBI = 600;
let hasPulse = false;
let timeLastBeat = 0;
let peak = 512;
let trough = 512;
const DEFAULT_THRESHOLD = 550;
let threshold = 550;
let amplitude = 100;
let firstBeat = true;
let secondBeat = false;
const IDLE_TIME = 2500;
const RATE_COLLECTION_TOTAL = 10;
let rate = [];

rate.length = RATE_COLLECTION_TOTAL;
rate = rate.fill(0);

main();

function main() {
	initSocket();
	initBoard();
}

function initSocket() {
	return new Promise((resolve, reject) => {
		io.on('connection', (socket) => resolve(socket));
	});
}

function initBoard() {
	const board = new johnny.Board();

	board.on('ready', () => {
		let heartRateSensor = new johnny.Sensor({
			pin: 0,
			freq: 5
		});

		heartRateSensor.on('change', () => {
			BPM = processSignal(heartRateSensor.value);

			if (BPM) {
				io.emit('BPM', BPM);
			}
		});
	});
}

function processSignal(signal) {
	let BPM;
	let timeNow = Date.now();
  let timeSinceLastBeat = timeNow - timeLastBeat;
	
	if (shouldUpdateTrough(signal, timeSinceLastBeat)) {
		trough = signal;
	}

	if (shouldUpdatePeak(signal)) {
		peak = signal;
	}

	if (shouldCheckForPulse(signal, timeSinceLastBeat)) {
		hasPulse = true;
		IBI = timeNow - timeLastBeat;
		timeLastBeat = timeNow;

		if (firstBeat) {
			firstBeat = false;
			secondBeat = true;
			return;
		}

		if (secondBeat) {
			secondBeat = false;
			rates = seadRates();
		}

		BPM = getBPM();
	}

  if (signal < threshold && hasPulse) {
		resetForNextPulse();
  }

  if (timeSinceLastBeat > IDLE_TIME) {
		resetDefaults(timeNow);
	}

	return BPM;
}

function shouldUpdateTrough(signal, timeSinceLastBeat) {
  return signal < threshold && timeSinceLastBeat > getDicroticNoiseDelay(IBI) && signal < trough;
}

function shouldUpdatePeak(signal) {
	return signal > threshold && signal > peak;
}

function shouldCheckForPulse(signal, timeSinceLastBeat) {
	return timeSinceLastBeat > 250 && 
		signal > threshold &&
		!hasPulse &&
		timeSinceLastBeat > getDicroticNoiseDelay(IBI);
}

function getDicroticNoiseDelay() {
	return (IBI / 5) * 3;
}

function seadRates() {
	return rate.fill(IBI);
}

function getBPM() {
	let runningTotal = 0;
	for (let i = 0; i <= RATE_COLLECTION_TOTAL - 2; i++) {
		rate[i] = rate[i + 1];
		runningTotal += rate[i];
	}

	rate[RATE_COLLECTION_TOTAL - 1] = IBI;
	runningTotal += rate[RATE_COLLECTION_TOTAL - 1];
	runningTotal /= RATE_COLLECTION_TOTAL;
	return 60000 / runningTotal;
}

function resetForNextPulse() {
	hasPulse = false;
	amplitude = peak - trough;
	threshold = amplitude / 2 + trough;
	peak = threshold;
	trough = threshold;
}

function resetDefaults(timeNow) {
	threshold = DEFAULT_THRESHOLD;
	peak = 512;
	trough = 512;
	timeLastBeat = timeNow;
	firstBeat = true;
	secondBeat = false;
}
