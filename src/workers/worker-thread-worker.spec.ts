const WorkerConstructorMockFn = jest.fn();
jest.mock('worker_threads', () => ({
    Worker: WorkerConstructorMockFn
}));

import { EventEmitter } from 'events';
import { bufferCount, firstValueFrom, take } from 'rxjs';

import { WorkerThreadTask, WorkerThreadWorker } from './worker-thread-worker';

class TestWorkerMock extends EventEmitter {
    public postMessage(): void {
        // nothing to do
    }

    public terminate(): Promise<number> {
        return Promise.resolve(0);
    }
}

abstract class AbstractAutoWorkerMock<TData> extends EventEmitter {
    constructor(private readonly emitTimeout: number) {
        super();
    }

    public postMessage(data: TData): void {
        setTimeout(() => this.emitAutoEvent(data), this.emitTimeout);
    }

    public terminate(): Promise<number> {
        return Promise.resolve(0);
    }

    protected abstract emitAutoEvent(data: TData): void;
}

class AutoResponseWorkerMock extends AbstractAutoWorkerMock<string> {
    protected emitAutoEvent(data: string): void {
        this.emit('message', `Result: ${data}`);
    }
}

class AutoErrorWorkerMock extends AbstractAutoWorkerMock<string> {
    protected emitAutoEvent(data: string): void {
        this.emit('error', new Error(`Error: ${data}`));
    }
}

class AutoExitWorkerMock extends AbstractAutoWorkerMock<number> {
    protected emitAutoEvent(data: number): void {
        this.emit('exit', data);
    }
}

describe('WorkerThreadWorker', () => {
    beforeEach(() => {
        WorkerConstructorMockFn.mockReset();
    });

    test('executeTask should create new worker thread, post dask-data and return emitted message', async () => {
        const workerMock = new AutoResponseWorkerMock(0);
        WorkerConstructorMockFn.mockImplementationOnce(() => workerMock);

        const worker = new WorkerThreadWorker<string, string, WorkerThreadTask<string>>('worker_script_path');

        const result = await worker.executeTask({
            timeout: 3000,
            data: 'test'
        });

        expect(result).toEqual('Result: test');
        expect(WorkerConstructorMockFn).toHaveBeenCalledWith('worker_script_path');
    });

    test('executeTask should reject if worker emits an error', async () => {
        const workerMock = new AutoErrorWorkerMock(0);
        WorkerConstructorMockFn.mockImplementationOnce(() => workerMock);

        const worker = new WorkerThreadWorker<string, string, WorkerThreadTask<string>>('worker_script_path');

        const resultPromise = worker.executeTask({
            timeout: 3000,
            data: 'test-data'
        });

        await expect(resultPromise).rejects.toThrowError('Error: test-data');
    });

    test('executeTask should reject if worker exits before emitting a message', async () => {
        const workerMock = new AutoExitWorkerMock(0);
        WorkerConstructorMockFn.mockImplementationOnce(() => workerMock);

        const worker = new WorkerThreadWorker<number, string, WorkerThreadTask<number>>('worker_script_path');

        const resultPromise = worker.executeTask({
            timeout: 3000,
            data: -1
        });

        await expect(resultPromise).rejects.toThrowError('Worker terminated with code -1');
    });

    test('executeTask on a busy worker should reject', async () => {
        const workerMock = new TestWorkerMock();
        WorkerConstructorMockFn.mockImplementationOnce(() => workerMock);

        const worker = new WorkerThreadWorker<string, string, WorkerThreadTask<string>>('worker_script_path');

        const resultPromise = worker.executeTask({
            timeout: 10000,
            data: 'test'
        });

        const busyResultPromise = worker.executeTask({
            timeout: 10000,
            data: 'test'
        });
        await expect(busyResultPromise).rejects.toThrowError('Worker busy. Cannot execute mutiple tasks in parallel!');

        workerMock.emit('message', 'Result!');

        const result = await resultPromise;

        expect(result).toEqual('Result!');
    });

    test('executeTask should timeout if worker does not repsond in the given time', async () => {
        const workerMock = new TestWorkerMock();
        WorkerConstructorMockFn.mockImplementationOnce(() => workerMock);

        const worker = new WorkerThreadWorker<string, string, WorkerThreadTask<string>>('worker_script_path');

        const executionStart = Date.now();
        const resultPromise = worker.executeTask({
            timeout: 100,
            data: 'test'
        });
        await expect(resultPromise).rejects.toThrowError('Worker execution timed out after 100 ms');
        const duration = Date.now() - executionStart;
        expect(duration).toBeGreaterThanOrEqual(100);
        expect(duration).toBeLessThan(150);
    });

    test('error$ should emit an error if termination of timed out worker fails', async () => {
        const workerMock = new TestWorkerMock();
        WorkerConstructorMockFn.mockImplementationOnce(() => workerMock);
        jest.spyOn(workerMock, 'terminate').mockImplementationOnce(() => Promise.reject(new Error('TerminationError')));

        const worker = new WorkerThreadWorker<string, string, WorkerThreadTask<string>>('worker_script_path');

        const errorEmitterPromise = firstValueFrom(worker.error$.pipe(take(2), bufferCount(2)));

        const resultPromise = worker.executeTask({
            timeout: 0,
            data: 'test'
        });

        await expect(resultPromise).rejects.toThrowError('Worker execution timed out after 0 ms');

        const emittedError = await errorEmitterPromise;
        expect(emittedError[0]).toMatchObject({ message: 'Worker execution timed out after 0 ms' });
        expect(emittedError[1]).toMatchObject({ message: 'Error while terminating worker: TerminationError' });
    });

    test('executeTask should reuse worker thread if previous execution succeeded', async () => {
        const workerMock = new AutoResponseWorkerMock(0);
        WorkerConstructorMockFn.mockImplementationOnce(() => workerMock);

        const worker = new WorkerThreadWorker<string, string, WorkerThreadTask<string>>('worker_script_path');

        const result1 = await worker.executeTask({
            timeout: 3000,
            data: 'test1'
        });

        expect(result1).toEqual('Result: test1');

        const result2 = await worker.executeTask({
            timeout: 3000,
            data: 'test2'
        });

        expect(result2).toEqual('Result: test2');

        expect(WorkerConstructorMockFn).toHaveBeenCalledTimes(1);
    });

    test('executeTask should create new worker thread if previous failed', async () => {
        WorkerConstructorMockFn.mockImplementationOnce(() => new AutoErrorWorkerMock(0));

        const worker = new WorkerThreadWorker<string, string, WorkerThreadTask<string>>('worker_script_path');

        const task1Promise = worker.executeTask({
            timeout: 3000,
            data: 'SomeError'
        });

        await expect(task1Promise).rejects.toThrowError('Error: SomeError');

        WorkerConstructorMockFn.mockImplementationOnce(() => new AutoResponseWorkerMock(0));

        const result = await worker.executeTask({
            timeout: 3000,
            data: 'test'
        });

        expect(result).toEqual('Result: test');

        expect(WorkerConstructorMockFn).toHaveBeenCalledTimes(2);
    });

    test('executeTask should create new worker thread if previous exited', async () => {
        WorkerConstructorMockFn.mockImplementationOnce(() => new AutoExitWorkerMock(0));

        const worker = new WorkerThreadWorker<number, string, WorkerThreadTask<number>>('worker_script_path');

        const task1Promise = worker.executeTask({
            timeout: 3000,
            data: 0
        });

        await expect(task1Promise).rejects.toThrowError('Worker terminated with code 0');

        WorkerConstructorMockFn.mockImplementationOnce(() => new AutoResponseWorkerMock(0));

        const result = await worker.executeTask({
            timeout: 3000,
            data: 1000
        });

        expect(result).toEqual('Result: 1000');

        expect(WorkerConstructorMockFn).toHaveBeenCalledTimes(2);
    });

    test('executeTask should create new worker thread if previous timed out', async () => {
        WorkerConstructorMockFn.mockImplementationOnce(() => new AutoResponseWorkerMock(10));

        const worker = new WorkerThreadWorker<string, string, WorkerThreadTask<string>>('worker_script_path');

        const task1Promise = worker.executeTask({
            timeout: 0,
            data: 'test1'
        });

        await expect(task1Promise).rejects.toThrowError('Worker execution timed out after 0 ms');

        WorkerConstructorMockFn.mockImplementationOnce(() => new AutoResponseWorkerMock(0));

        const result = await worker.executeTask({
            timeout: 3000,
            data: 'test2'
        });

        expect(result).toEqual('Result: test2');

        expect(WorkerConstructorMockFn).toHaveBeenCalledTimes(2);
    });

    test('error$ should emit an error if worker fails', async () => {
        WorkerConstructorMockFn.mockImplementationOnce(() => new AutoErrorWorkerMock(0));

        const worker = new WorkerThreadWorker<string, string, WorkerThreadTask<string>>('worker_script_path');

        const errorEmitterPromise = firstValueFrom(worker.error$);

        const taskPromise = worker.executeTask({
            timeout: 3000,
            data: 'Some Error'
        });

        await expect(taskPromise).rejects.toThrowError('Error: Some Error');
        const emittedError = await errorEmitterPromise;
        expect(emittedError).toMatchObject({ message: 'Worker failed with error: Error: Some Error' });
    });

    test('error$ should emit an error if worker exits with statuscode 0', async () => {
        WorkerConstructorMockFn.mockImplementationOnce(() => new AutoExitWorkerMock(0));

        const worker = new WorkerThreadWorker<number, string, WorkerThreadTask<number>>('worker_script_path');

        const errorEmitterPromise = firstValueFrom(worker.error$);

        const taskPromise = worker.executeTask({
            timeout: 3000,
            data: 0
        });

        await expect(taskPromise).rejects.toThrowError('Worker terminated with code 0');

        const emittedError = await errorEmitterPromise;
        expect(emittedError).toMatchObject({
            message: 'Worker terminated gracefully. This should not happen in a WorkerThreadWorker!'
        });
    });

    test('error$ should emit an error if worker exits with statuscode 0', async () => {
        WorkerConstructorMockFn.mockImplementationOnce(() => new AutoExitWorkerMock(0));

        const worker = new WorkerThreadWorker<number, string, WorkerThreadTask<number>>('worker_script_path');

        const errorEmitterPromise = firstValueFrom(worker.error$);

        const taskPromise = worker.executeTask({
            timeout: 3000,
            data: 1
        });

        await expect(taskPromise).rejects.toThrowError('Worker terminated with code 1');

        const emittedError = await errorEmitterPromise;
        expect(emittedError).toMatchObject({ message: 'Worker terminated with exit code 1!' });
    });

    test('executeTask on a disposed worker should reject', async () => {
        const worker = new WorkerThreadWorker<number, string, WorkerThreadTask<number>>('worker_script_path');
        worker.dispose();
        const taskPromise = worker.executeTask({
            timeout: 3000,
            data: 1
        });

        await expect(taskPromise).rejects.toThrowError('Cannot get worker in a disposed WorkerThreadWorker!');
    });

    test('executeTask should create new worker if worker was terminated', async () => {
        WorkerConstructorMockFn.mockImplementationOnce(() => new AutoResponseWorkerMock(0));

        const worker = new WorkerThreadWorker<string, string, WorkerThreadTask<string>>('worker_script_path');

        const result1 = await worker.executeTask({
            timeout: 3000,
            data: 'test1'
        });

        expect(result1).toEqual('Result: test1');

        WorkerConstructorMockFn.mockImplementationOnce(() => new AutoResponseWorkerMock(0));

        worker.terminateWorker();

        const result2 = await worker.executeTask({
            timeout: 3000,
            data: 'test2'
        });

        expect(result2).toEqual('Result: test2');

        expect(WorkerConstructorMockFn).toHaveBeenCalledTimes(2);
    });

    test('executeTask should create new worker if worker failed between task executions', async () => {
        const workerMock = new AutoResponseWorkerMock(0);
        WorkerConstructorMockFn.mockImplementationOnce(() => workerMock);

        const worker = new WorkerThreadWorker<string, string, WorkerThreadTask<string>>('worker_script_path');
        const errorEmitterPromise = firstValueFrom(worker.error$);

        const result1 = await worker.executeTask({
            timeout: 3000,
            data: 'test1'
        });

        expect(result1).toEqual('Result: test1');

        workerMock.emit('error', new Error('Random Error'));

        WorkerConstructorMockFn.mockImplementationOnce(() => new AutoResponseWorkerMock(0));
        const result2 = await worker.executeTask({
            timeout: 3000,
            data: 'test2'
        });

        expect(result2).toEqual('Result: test2');

        expect(WorkerConstructorMockFn).toHaveBeenCalledTimes(2);
        const emittedError = await errorEmitterPromise;
        expect(emittedError).toMatchObject({ message: 'Worker failed with error: Random Error' });
    });

    test('executeTask should create new worker if worker terminates between task executions', async () => {
        const workerMock = new AutoResponseWorkerMock(0);
        WorkerConstructorMockFn.mockImplementationOnce(() => workerMock);

        const worker = new WorkerThreadWorker<string, string, WorkerThreadTask<string>>('worker_script_path');
        const errorEmitterPromise = firstValueFrom(worker.error$);

        const result1 = await worker.executeTask({
            timeout: 3000,
            data: 'test1'
        });

        expect(result1).toEqual('Result: test1');

        workerMock.emit('exit', 10);

        WorkerConstructorMockFn.mockImplementationOnce(() => new AutoResponseWorkerMock(0));
        const result2 = await worker.executeTask({
            timeout: 3000,
            data: 'test2'
        });

        expect(result2).toEqual('Result: test2');

        expect(WorkerConstructorMockFn).toHaveBeenCalledTimes(2);
        const emittedError = await errorEmitterPromise;
        expect(emittedError).toMatchObject({ message: 'Worker terminated with exit code 10!' });
    });
});
