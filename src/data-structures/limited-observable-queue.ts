import { QueueError } from '../errors';
import { ObservableQueue } from './observable-queue';

export class LimitedObservableQueue<T> extends ObservableQueue<T> {
    private _maxSize: number;

    constructor(maxSize: number) {
        super();
        this._maxSize = maxSize;
    }

    public get maxSize(): number {
        return this._maxSize;
    }

    public get freeSlots(): number {
        return Math.max(0, this.maxSize - this.size);
    }

    public get full(): boolean {
        return this.freeSlots < 1;
    }

    public setMaxSize(maxSize: number): void {
        this._maxSize = maxSize;
    }

    public enqueue(item: T): void {
        if (this.full) throw new QueueError('Queue full! Cannot enqueue any more items!');
        super.enqueue(item);
    }
}
