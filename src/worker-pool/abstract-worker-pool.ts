import { WorkerPool } from './worker-pool';

export interface AbstractWorkerPoolWorker<TTask, TResult> {
    executeTask(t: TTask): Promise<TResult>;
}

export abstract class AbstractWorkerPool<TTask, TResult, TWorker extends AbstractWorkerPoolWorker<TTask, TResult>>
    implements WorkerPool<TTask, TResult>
{
    public async executeTask(task: TTask): Promise<TResult> {
        const worker = this.aquireWorker();
        try {
            const result = await worker.executeTask(task);
            this.releaseWorker(worker);
            return result;
        } catch (err) {
            this.releaseWorker(worker);
            throw err;
        }
    }

    protected abstract aquireWorker(): TWorker;
    protected abstract releaseWorker(worker: TWorker): void;
}
