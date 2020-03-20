import { AbstractWorkerPool } from './abstract-worker-pool';

class TestWorker {
    public async executeTask(t: string): Promise<string> {
        return `result: ${t}`;
    }
}

const testWorkerInstance = new TestWorker();

class TestWorkerPool extends AbstractWorkerPool<string, string, TestWorker> {
    public aquireWorker(): TestWorker {
        return testWorkerInstance;
    }

    public releaseWorker(): void {
        // nothing to do
    }
}

describe('AbstractWorkerPool', () => {
    test('executeTask should fail if qorker aquiration fails', async () => {
        const testPool = new TestWorkerPool();
        jest.spyOn(testPool, 'aquireWorker').mockImplementationOnce(() => {
            throw new Error('AquireError');
        });

        await expect(testPool.executeTask('test-task')).rejects.toThrowError('AquireError');
    });

    test('executeTask should aquire a worker, execute the task and release it afterwards', async () => {
        const testPool = new TestWorkerPool();
        const aquireWorkerSpy = jest.spyOn(testPool, 'aquireWorker');
        const releaseWorkerSpy = jest.spyOn(testPool, 'releaseWorker');

        const result = await testPool.executeTask('test-task');

        expect(aquireWorkerSpy).toHaveBeenCalledTimes(1);
        expect(releaseWorkerSpy).toHaveBeenCalledWith(testWorkerInstance);
        expect(result).toStrictEqual('result: test-task');
    });

    test('executeTask should release worker even if task execution fails', async () => {
        const testPool = new TestWorkerPool();
        const releaseWorkerSpy = jest.spyOn(testPool, 'releaseWorker');
        jest.spyOn(testWorkerInstance, 'executeTask').mockImplementationOnce(async () => {
            throw new Error('TaskError');
        });

        await expect(testPool.executeTask('test-task')).rejects.toThrowError('TaskError');
        expect(releaseWorkerSpy).toHaveBeenCalledWith(testWorkerInstance);
    });
});
