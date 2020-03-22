import { first, bufferCount } from 'rxjs/operators';

import { DynamicWorkerPool } from './dynamic-worker-pool';

class TestWorker {
    public async executeTask(t: string): Promise<string> {
        return `result: ${t}`;
    }

    public async dispose(): Promise<void> {
        // noting to do
    }
}

const testWorkerInstance = new TestWorker();

const workerFactory = { createWorker: (): TestWorker => testWorkerInstance };

describe('DynamicWorkerPool', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('size of new pool should be 0', () => {
        const testPool = new DynamicWorkerPool<string, string, TestWorker>(workerFactory, 0, 5, 0);
        expect(testPool.size).toEqual(0);
    });

    test('execute task should aquire new workers and execute tasks on them', async () => {
        const testPool = new DynamicWorkerPool<string, string, TestWorker>(workerFactory, 0, 2, 0);

        const workerDisposeSpy = jest.spyOn(testWorkerInstance, 'dispose');
        const createWorkerSpy = jest.spyOn(workerFactory, 'createWorker');

        expect(testPool.size).toEqual(0);

        const resultPromises = Promise.all([testPool.executeTask('1'), testPool.executeTask('2')]);

        expect(testPool.size).toEqual(2);

        const results = await resultPromises;

        expect(results).toEqual(['result: 1', 'result: 2']);
        expect(testPool.size).toEqual(0);
        expect(createWorkerSpy).toHaveBeenCalledTimes(2);
        expect(workerDisposeSpy).toHaveBeenCalledTimes(2);
    });

    test('worker pool should hould minSize workers', async () => {
        const testPool = new DynamicWorkerPool<string, string, TestWorker>(workerFactory, 3, 5, 0);

        const workerDisposeSpy = jest.spyOn(testWorkerInstance, 'dispose');
        const createWorkerSpy = jest.spyOn(workerFactory, 'createWorker');

        expect(testPool.size).toEqual(0);

        const resultPromises = Promise.all([
            testPool.executeTask('1'),
            testPool.executeTask('2'),
            testPool.executeTask('3'),
            testPool.executeTask('4'),
            testPool.executeTask('5')
        ]);

        expect(testPool.size).toEqual(5);

        await resultPromises;

        expect(testPool.size).toEqual(3);
        expect(createWorkerSpy).toHaveBeenCalledTimes(5);
        expect(workerDisposeSpy).toHaveBeenCalledTimes(2);
    });

    test('executeTask should reject if worker pool max size is reached', async () => {
        const testPool = new DynamicWorkerPool<string, string, TestWorker>(workerFactory, 0, 1, 0);

        const workerDisposeSpy = jest.spyOn(testWorkerInstance, 'dispose');
        const createWorkerSpy = jest.spyOn(workerFactory, 'createWorker');

        expect(testPool.size).toEqual(0);

        const resultPromises = Promise.all([testPool.executeTask('1'), testPool.executeTask('2')]);

        expect(testPool.size).toEqual(1);

        await expect(resultPromises).rejects.toThrowError('No free workers available in worker pool of max-size 1');

        expect(testPool.size).toEqual(0);
        expect(createWorkerSpy).toHaveBeenCalledTimes(1);
        expect(workerDisposeSpy).toHaveBeenCalledTimes(1);
    });

    test('worker pool should re-use existing workers in pool', async () => {
        const testPool = new DynamicWorkerPool<string, string, TestWorker>(workerFactory, 1, 1, 0);

        const workerDisposeSpy = jest.spyOn(testWorkerInstance, 'dispose');
        const createWorkerSpy = jest.spyOn(workerFactory, 'createWorker');

        expect(testPool.size).toEqual(0);

        await testPool.executeTask('1');

        expect(testPool.size).toEqual(1);

        await testPool.executeTask('2');

        expect(testPool.size).toEqual(1);
        expect(createWorkerSpy).toHaveBeenCalledTimes(1);
        expect(workerDisposeSpy).toHaveBeenCalledTimes(0);
    });

    test('worker pool should emit an error on error$ if worker disposal fails', async () => {
        const testPool = new DynamicWorkerPool<string, string, TestWorker>(workerFactory, 0, 1, 0);

        jest.spyOn(testWorkerInstance, 'dispose').mockImplementationOnce(async () => {
            throw new Error('DisposeError');
        });

        const errorPromise = testPool.error$.pipe(first()).toPromise();

        await testPool.executeTask('1');

        await expect(errorPromise).resolves.toMatchObject({
            message: 'Error while disposing worker-pool worker: DisposeError'
        });
    });

    test('executeTask on a stopped DynamicWorkerPool should reject', async () => {
        const testPool = new DynamicWorkerPool<string, string, TestWorker>(workerFactory, 2, 5, 0);
        testPool.stop();
        await expect(testPool.executeTask('1')).rejects.toThrowError('Cannot aquire worker from stopped worker pool!');
    });

    test('stop should terminate all current workers', async () => {
        const testPool = new DynamicWorkerPool<string, string, TestWorker>(workerFactory, 2, 5, 0);
        const workerDisposeSpy = jest.spyOn(testWorkerInstance, 'dispose');

        await Promise.all([
            testPool.executeTask('1'),
            testPool.executeTask('2'),
            testPool.executeTask('3'),
            testPool.executeTask('4'),
            testPool.executeTask('5')
        ]);

        await testPool.stop();
        expect(testPool.size).toEqual(0);
        expect(workerDisposeSpy).toHaveBeenCalledTimes(5);
    });

    test('busyWorkers$ should emit number of workers in use', async () => {
        const testPool = new DynamicWorkerPool<string, string, TestWorker>(workerFactory, 2, 5, 0);

        const busyWorkersHistoryPromise = testPool.busyWorkers$.pipe(bufferCount(13), first()).toPromise();

        await Promise.all([
            testPool.executeTask('1'),
            testPool.executeTask('2'),
            testPool.executeTask('3'),
            testPool.executeTask('4'),
            testPool.executeTask('5')
        ]);

        await testPool.executeTask('6');

        expect(await busyWorkersHistoryPromise).toEqual([0, 1, 2, 3, 4, 5, 4, 3, 2, 1, 0, 1, 0]);
    });

    test('idleWorkers$ should emit number of idle workers', async () => {
        const testPool = new DynamicWorkerPool<string, string, TestWorker>(workerFactory, 2, 5, 0);

        const idleWorkersHistoryPromise = testPool.idleWorkers$.pipe(bufferCount(5), first()).toPromise();

        await Promise.all([
            testPool.executeTask('1'),
            testPool.executeTask('2'),
            testPool.executeTask('3'),
            testPool.executeTask('4'),
            testPool.executeTask('5')
        ]);

        await testPool.executeTask('6');

        expect(await idleWorkersHistoryPromise).toEqual([0, 1, 2, 1, 2]);
    });

    test('availableWorkers$ should emit number of available workers', async () => {
        const testPool = new DynamicWorkerPool<string, string, TestWorker>(workerFactory, 2, 5, 0);

        const availableWorkersHistoryPromise = testPool.availableWorkers$.pipe(bufferCount(13), first()).toPromise();

        await Promise.all([
            testPool.executeTask('1'),
            testPool.executeTask('2'),
            testPool.executeTask('3'),
            testPool.executeTask('4'),
            testPool.executeTask('5')
        ]);

        await testPool.executeTask('6');

        expect(await availableWorkersHistoryPromise).toEqual([5, 4, 3, 2, 1, 0, 1, 2, 3, 4, 5, 4, 5]);
    });

    test('availableWorkers$ should emit 0 for a stopped pool', async () => {
        const testPool = new DynamicWorkerPool<string, string, TestWorker>(workerFactory, 2, 5, 0);

        const availableWorkersHistoryPromise = testPool.availableWorkers$.pipe(bufferCount(4), first()).toPromise();

        await testPool.executeTask('1');

        await testPool.stop();

        expect(await availableWorkersHistoryPromise).toEqual([5, 4, 5, 0]);
    });

    test('availableWorkers should return 0 for a stopped pool', async () => {
        const testPool = new DynamicWorkerPool<string, string, TestWorker>(workerFactory, 2, 5, 0);
        await testPool.stop();
        expect(testPool.availableWorkers).toEqual(0);
    });

    test('availableWorkers should return number of possible free workers', async () => {
        const testPool = new DynamicWorkerPool<string, string, TestWorker>(workerFactory, 2, 5, 0);
        expect(testPool.availableWorkers).toEqual(5);
        const taskResultPromise = testPool.executeTask('1');
        expect(testPool.availableWorkers).toEqual(4);
        await taskResultPromise;
        expect(testPool.availableWorkers).toEqual(5);
    });

    test('idleWorkers should return 0 for a stopped pool', async () => {
        const testPool = new DynamicWorkerPool<string, string, TestWorker>(workerFactory, 2, 5, 0);
        await testPool.stop();
        expect(testPool.idleWorkers).toEqual(0);
    });

    test('idleWorkers should return the number of created workers in idle state', async () => {
        const testPool = new DynamicWorkerPool<string, string, TestWorker>(workerFactory, 2, 5, 0);
        expect(testPool.idleWorkers).toEqual(0);
        const taskResultPromise = testPool.executeTask('1');
        expect(testPool.idleWorkers).toEqual(0);
        await taskResultPromise;
        expect(testPool.idleWorkers).toEqual(1);
    });

    test('busyWorkers should return 0 for a stopped pool', async () => {
        const testPool = new DynamicWorkerPool<string, string, TestWorker>(workerFactory, 2, 5, 0);
        await testPool.stop();
        expect(testPool.busyWorkers).toEqual(0);
    });

    test('busyWorkers should return the number of working workers', async () => {
        const testPool = new DynamicWorkerPool<string, string, TestWorker>(workerFactory, 2, 5, 0);
        expect(testPool.busyWorkers).toEqual(0);
        const taskResultPromise = testPool.executeTask('1');
        expect(testPool.busyWorkers).toEqual(1);
        await taskResultPromise;
        expect(testPool.busyWorkers).toEqual(0);
    });

    test('DynamicWorkerPool with idleTimeout should keep idle workers for specified time', async () => {
        const testPool = new DynamicWorkerPool<string, string, TestWorker>(workerFactory, 2, 5, 100);
        const workerDisposeSpy = jest.spyOn(testWorkerInstance, 'dispose');

        await Promise.all([
            testPool.executeTask('1'),
            testPool.executeTask('2'),
            testPool.executeTask('3'),
            testPool.executeTask('4'),
            testPool.executeTask('5')
        ]);

        await new Promise((resolve) => setTimeout(resolve, 10));

        expect(workerDisposeSpy).toHaveBeenCalledTimes(0);
        expect(testPool.size).toEqual(5);

        await new Promise((resolve) => setTimeout(resolve, 100));

        expect(testPool.size).toEqual(2);
        expect(workerDisposeSpy).toHaveBeenCalledTimes(3);

        await testPool.stop();
        expect(testPool.size).toEqual(0);
        expect(workerDisposeSpy).toHaveBeenCalledTimes(5);
    });
});
