import { join as pathJoin } from 'path';

import { DynamicWorkerPool, WorkerThreadTask, WorkerThreadWorker } from '../src';

class WorkerThreadWorkerFactory<TData, TResult> {
    constructor(private readonly scriptPath: string) {}

    public createWorker(): WorkerThreadWorker<TData, TResult, WorkerThreadTask<TData>> {
        return new WorkerThreadWorker<TData, TResult, WorkerThreadTask<TData>>(this.scriptPath);
    }
}

interface ExecutorTaskData {
    readonly script: string;
    readonly context: { [key: string]: unknown };
}

describe('WorkerThreadWorker', () => {
    test('DynamicWorkerPool should execute task on worker thread', async () => {
        const pool = new DynamicWorkerPool<
            WorkerThreadTask<string>,
            string,
            WorkerThreadWorker<string, string, WorkerThreadTask<string>>
        >(
            new WorkerThreadWorkerFactory<string, string>(pathJoin(__dirname, 'worker-scripts', 'echo-worker.js')),
            2,
            10,
            1000
        );

        const result = await pool.executeTask({ timeout: 3000, data: 'World' });
        expect(result).toEqual('Hello "World"!');
        await pool.stop();
    });

    test('DynamicWorkerPool terminate worker thread on timeout', async () => {
        const pool = new DynamicWorkerPool<
            WorkerThreadTask<string>,
            string,
            WorkerThreadWorker<string, string, WorkerThreadTask<string>>
        >(
            new WorkerThreadWorkerFactory<string, string>(pathJoin(__dirname, 'worker-scripts', 'loop-worker.js')),
            2,
            10,
            1000
        );

        const taskResultPromise = pool.executeTask({ timeout: 100, data: 'World' });
        await expect(taskResultPromise).rejects.toThrowError('Worker execution timed out after 100 ms');
        await pool.stop();
    });

    test('DynamicWorkerPool should execute task on worker thread', async () => {
        const pool = new DynamicWorkerPool<
            WorkerThreadTask<ExecutorTaskData>,
            number,
            WorkerThreadWorker<ExecutorTaskData, number, WorkerThreadTask<ExecutorTaskData>>
        >(
            new WorkerThreadWorkerFactory<ExecutorTaskData, number>(
                pathJoin(__dirname, 'worker-scripts', 'executor-worker.js')
            ),
            2,
            10,
            1000
        );

        const data: ExecutorTaskData = {
            script: `
                (function(numbers){
                    let result = 0;
                    for(const n of numbers) {
                        result += n;
                    }
                    return result;
                })(numbers);
            `,
            context: {
                numbers: [1, 2, 3, 4, 5, 6, 8, 9, 10]
            }
        };

        const result = await pool.executeTask({ timeout: 1000, data });
        expect(result).toEqual(48);
        await pool.stop();
    });

    test('executeTask should reject if task on worker thread fail', async () => {
        const pool = new DynamicWorkerPool<
            WorkerThreadTask<ExecutorTaskData>,
            string,
            WorkerThreadWorker<ExecutorTaskData, string, WorkerThreadTask<ExecutorTaskData>>
        >(
            new WorkerThreadWorkerFactory<ExecutorTaskData, string>(
                pathJoin(__dirname, 'worker-scripts', 'executor-worker.js')
            ),
            2,
            10,
            1000
        );

        const data: ExecutorTaskData = {
            script: `
                (function(){
                    throw new Error('Worker Error!');
                })();
            `,
            context: {}
        };

        const taskResultPromise = pool.executeTask({ timeout: 3000, data });
        // NOTE: we cannot use expect(...).rejects.toThrowError since error event of worker thread is not an
        // error instance somehow, eventough it is directly forewarded in error-handler??
        await expect(taskResultPromise).rejects.toMatchObject({
            message: 'Script-Execution-Error: Worker Error!'
        });
        await pool.stop();
    });
});
