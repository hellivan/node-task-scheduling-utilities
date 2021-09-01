export class WorkerError extends Error {
    public readonly code = 'NTSU_WORKER_ERROR';

    constructor(message: string) {
        super(message);
        Object.setPrototypeOf(this, WorkerError.prototype);
    }
}
