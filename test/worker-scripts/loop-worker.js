/* eslint-disable @typescript-eslint/no-var-requires */
const { isMainThread, parentPort } = require('worker_threads');

if (isMainThread) throw new Error('Cannot import worker-script into main thread!');

if (parentPort != null) {
    parentPort.on('message', () => {
        while (true) {}
    });
} else {
    throw new Error('No parent port found!');
}
