export class WorkerPoolError extends Error {
    public readonly code = 'NTSU_WORKER_POOL_ERROR';

    constructor(message: string) {
        super(message);
        Object.setPrototypeOf(this, WorkerPoolError.prototype);
    }
}
