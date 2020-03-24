import {
    DynamicWorkerPool,
    DynamicWorkerPoolWorker,
    WorkerFactory,
    WorkerPool,
    WorkerThreadTask,
    WorkerThreadWorker,
    QdScheduler
} from './index';

describe('exports', () => {
    test('classes must be exported', () => {
        expect(DynamicWorkerPool).toBeDefined();

        expect(WorkerThreadWorker).toBeDefined();

        expect(QdScheduler).toBeDefined();
    });

    test('interfaces must be exported', () => {
        const dynamicWorkerPoolWorker: DynamicWorkerPoolWorker<string, string> = {
            dispose: () => Promise.resolve(),
            executeTask: (v: string) => Promise.resolve(v)
        };

        expect(dynamicWorkerPoolWorker).toBeDefined();

        const workerFactory: WorkerFactory<string> = {
            createWorker: () => 'test'
        };
        expect(workerFactory).toBeDefined();

        const workerThreadTask: WorkerThreadTask<string> = {
            timeout: 1234,
            data: 'foo'
        };
        expect(workerThreadTask).toBeDefined();

        const workerPool: WorkerPool<string, string> = {
            executeTask: (task: string) => Promise.resolve(task)
        };
        expect(workerPool).toBeDefined();
    });
});
