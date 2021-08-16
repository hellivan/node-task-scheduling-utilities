import { bufferCount, firstValueFrom } from 'rxjs';

import { ObservableQueue } from './observable-queue';

describe('ObservableList', () => {
    test('Empty queue should have size 0', () => {
        const queue = new ObservableQueue<unknown>();
        expect(queue.size).toEqual(0);
    });

    test('Empty should be true for an empty queue', () => {
        const queue = new ObservableQueue<unknown>();
        expect(queue.empty).toBeTruthy();
    });

    test('Empty should be false for a non empty queue', () => {
        const queue = new ObservableQueue<unknown>();
        queue.enqueue('1');
        expect(queue.empty).toBeFalsy();
    });

    test('queue iterator should return elements in insertion order', () => {
        const queue = new ObservableQueue<string>();
        queue.enqueue('1');
        queue.enqueue('2');
        queue.enqueue('3');
        expect([...queue]).toEqual(['1', '2', '3']);
    });

    test('values() should return elements in insertion order', () => {
        const queue = new ObservableQueue<string>();
        queue.enqueue('1');
        queue.enqueue('2');
        queue.enqueue('3');
        expect(queue.values()).toEqual(['1', '2', '3']);
    });

    test('values() should return a shallow copy of the items list', () => {
        const queue = new ObservableQueue<string>();
        queue.enqueue('1');
        queue.enqueue('2');
        const d = queue.values();
        d.splice(0, 1);
        expect(queue.values()).toEqual(['1', '2']);
    });

    test('enqueue should add elements to the queue and change size accordingly', async () => {
        const queue = new ObservableQueue<string>();
        const sizeChangesPromise = firstValueFrom(queue.size$.pipe(bufferCount(4)));
        expect(queue.size).toEqual(0);
        queue.enqueue('1');
        expect(queue.size).toEqual(1);
        queue.enqueue('2');
        expect(queue.size).toEqual(2);
        queue.enqueue('3');
        expect(queue.size).toEqual(3);
        await expect(sizeChangesPromise).resolves.toEqual([0, 1, 2, 3]);
        expect([...queue]).toEqual(['1', '2', '3']);
    });

    test('dequeue should pop first element of queue and change size accordingly', async () => {
        const queue = new ObservableQueue<string>();
        queue.enqueue('1');
        queue.enqueue('2');
        queue.enqueue('3');

        const sizeChangesPromise = firstValueFrom(queue.size$.pipe(bufferCount(4)));
        expect(queue.size).toEqual(3);
        expect(queue.dequeue()).toEqual('1');
        expect(queue.size).toEqual(2);
        expect(queue.dequeue()).toEqual('2');
        expect(queue.size).toEqual(1);
        expect(queue.dequeue()).toEqual('3');
        expect(queue.size).toEqual(0);
        await expect(sizeChangesPromise).resolves.toEqual([3, 2, 1, 0]);
        expect([...queue]).toEqual([]);
    });

    test('dequeue on a empty queue should throw an error', () => {
        const queue = new ObservableQueue<string>();
        expect(() => queue.dequeue()).toThrowError('Cannot dequeue item from empty queue!');
    });

    test('clear should return all elements, remove them from the queue and update size accordingly', async () => {
        const queue = new ObservableQueue<string>();
        queue.enqueue('1');
        queue.enqueue('2');
        queue.enqueue('3');

        const sizeChangesPromise = firstValueFrom(queue.size$.pipe(bufferCount(2)));
        queue.clear();

        await expect(sizeChangesPromise).resolves.toEqual([3, 0]);
        expect([...queue]).toEqual([]);
    });

    test('drop should return false if element was not found in queue', async () => {
        const queue = new ObservableQueue<string>();
        queue.enqueue('1');
        queue.enqueue('2');
        queue.enqueue('3');
        expect(queue.drop('test')).toBeFalsy();
        expect(queue.size).toEqual(3);
    });

    test('drop should remove element and return true if element was found in queue', async () => {
        const queue = new ObservableQueue<string>();
        queue.enqueue('1');
        queue.enqueue('2');
        queue.enqueue('3');
        expect(queue.drop('2')).toBeTruthy();
        expect(queue.size).toEqual(2);
        expect([...queue]).toEqual(['1', '3']);
    });
});
