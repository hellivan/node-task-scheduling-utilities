# ntsu - Node.js task scheduling utilities

[![Build Status](https://img.shields.io/circleci/build/github/hellivan/node-task-scheduling-utilities/master?logo=circleci&style=flat-square)](https://circleci.com/gh/hellivan/node-task-scheduling-utilities)
[![Code Coverage](https://img.shields.io/codecov/c/github/hellivan/node-task-scheduling-utilities/master?logo=codecov&style=flat-square)](https://codecov.io/gh/hellivan/node-task-scheduling-utilities)
[![MIT License](https://img.shields.io/npm/l/ntsu?style=flat-square)](LICENSE)
[![semantic-release](https://img.shields.io/badge/%20%20%F0%9F%93%A6%F0%9F%9A%80-semantic--release-e10079.svg?style=flat-square)](https://github.com/semantic-release/semantic-release)
[![Renovate enabled](https://img.shields.io/badge/renovate-enabled-brightgreen.svg?style=flat-square)](https://renovatebot.com/)
[![NPM Package](https://img.shields.io/npm/v/ntsu?logo=npm&style=flat-square)](https://www.npmjs.com/package/ntsu)
[![NPM Package Downloads](https://img.shields.io/npm/dm/ntsu?logo=npm&style=flat-square)](https://www.npmjs.com/package/ntsu)

Utility library that provides some basic mechanisms for task scheduling/execution in Node.js

## Installation

Using npm:

```
npm install --save ntsu
```

Using yarn

```
yarn add ntsu
```

## Usage

In ES6 / Typescript

```typescript
import { DynamicWorkerPool, QdScheduler, WorkerThreadWorker } from 'ntsu';
```

### QdScheduler

Queued task scheduler that executes provided tasks one after another or in parallel, depending on the provided
configuration. Tasks that cannot be executed immediately are queued for later execution. Queued tasks are executed as
soon as running tasks complete:

```typescript
import { QdScheduler } from 'ntsu';

// create new queued scheduler that can execute 3 tasks in parallel
// and is able to queue up to 100 tasks
const scheduler = new QdScheduler(3, 100);

for (let i = 0; i < 100; i++) {
    scheduler.queueTask({ exec: () => complexFunction(i) });
}

scheduler.start();
```

### DynamicWorkerPool

Generic worker pool that dynamically instantiates new workers as needed. Initially the pool
will be empty. When tasks are added for execution, the pool will create up to maxSize new workers
that will execute the given tasks. After task execution, all superfluous workers are disposed after a given
worker-idle timeout so that only minSize workers will remain in the pool. These workers are then reused in
future task executions.

```typescript
import { DynamicWorkerPool } from 'ntsu';

// create new dynamic worker pool that uses workerFactory to instantiate new workers
// and has a max size of 10. The pool will keep at least 3 idle workers. Workers are
// considered idle if no task is assigned withing 3 seconds
const pool = new DynamicWorkerPool(workerFactory, 3, 10, 3000);

const results = Promise.all(tasks.map((task) => scheduler.executeTask(task)));
```

### WorkerThreadWorker

WorkerPool worker implementation that is based on node.js `worker_threads`. This Worker implementation
will automatically create a new `worker_thread` based on the given script path and post the task's data
via `postMessage` method. Worker threads will be instantiated in a lazy way (as soon as `executeTask` is
called for the first time). If `worker_thread` fails or exits before emitting a repsonse message via `postMessage`
method, result-promise of `executeTask` will reject with an appropriate error message. `worker_thread`
termination or failure between task-execution will also be catched by this implemenation. If `worker_thread`
errors or terminates a new `worker_thread` will be instantiated upon next task execution.

```typescript
import { WorkerThreadWorker } from 'ntsu';

// create a workerfactory that instantiates new WorkerThreadWorker workers, that
// use workerThreadScript.js as worker_threads script
const workerFactory = {
    createWorker: () => new WorkerThreadWorker('workerThreadScript.js')
);
```

Where an example `worker_thread` script could be:

```js
// workerThreadScript.js

const { parentPort } = require('worker_threads');

parentPort.on('message', (message) => {
    parentPort.postMessage(`Hello "${message}"!`);
});
```
