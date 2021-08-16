import { BehaviorSubject, distinctUntilChanged, Observable } from 'rxjs';

export class ObservableQueue<T> implements Iterable<T> {
    public readonly size$: Observable<number>;
    private readonly sizeSubject = new BehaviorSubject<number>(0);
    private readonly items: T[] = [];

    constructor() {
        this.size$ = this.sizeSubject.pipe(distinctUntilChanged());
    }

    public get size(): number {
        return this.sizeSubject.value;
    }

    public get empty(): boolean {
        return this.size < 1;
    }

    public enqueue(item: T): void {
        this.items.push(item);
        this.updateQueueLength();
    }

    public values(): T[] {
        return [...this.items];
    }

    public dequeue(): T {
        if (this.items.length <= 0) throw new Error('Cannot dequeue item from empty queue!');
        const item = this.items[0];
        this.items.splice(0, 1);
        this.updateQueueLength();
        return item;
    }

    public drop(item: T): boolean {
        const index = this.items.indexOf(item);
        if (index >= 0) {
            this.items.splice(index, 1);
            this.updateQueueLength();
            return true;
        }
        return false;
    }

    public clear(): T[] {
        const currentItems = [...this.items];
        this.items.splice(0, this.items.length);
        this.updateQueueLength();
        return currentItems;
    }

    public [Symbol.iterator](): Iterator<T> {
        return this.items.values();
    }

    private updateQueueLength(): void {
        this.sizeSubject.next(this.items.length);
    }
}
