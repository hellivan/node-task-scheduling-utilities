export class QueueError extends Error {
    public readonly code = 'NTSU_QUEUE_ERROR';

    constructor(message: string) {
        super(message);
        Object.setPrototypeOf(this, QueueError.prototype);
    }
}
