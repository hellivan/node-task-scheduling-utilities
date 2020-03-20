import { LimitedObservableQueue } from './limited-observable-queue';

describe('LimitedObservableQueue', () => {
    test('freeSlots should return maxSize for an empty queue', () => {
        const queue = new LimitedObservableQueue<string>(5);
        expect(queue.freeSlots).toEqual(5);
    });

    test('freeSlots should return the available capacity of the queue', () => {
        const queue = new LimitedObservableQueue<string>(5);
        queue.enqueue('1');
        queue.enqueue('2');
        expect(queue.freeSlots).toEqual(3);
    });

    test('freeSlots should return 0 for a complete filled up queue', () => {
        const queue = new LimitedObservableQueue<string>(2);
        queue.enqueue('1');
        queue.enqueue('2');
        expect(queue.freeSlots).toEqual(0);
    });

    test('full should return false for an empty queue', () => {
        const queue = new LimitedObservableQueue<string>(5);
        expect(queue.full).toBeFalsy();
    });

    test('full should return false for a non empty but not completely filled up queue', () => {
        const queue = new LimitedObservableQueue<string>(5);
        queue.enqueue('1');
        expect(queue.full).toBeFalsy();
    });

    test('full should return true for a complete filled up queue', () => {
        const queue = new LimitedObservableQueue<string>(1);
        queue.enqueue('1');
        expect(queue.full).toBeTruthy();
    });

    test('enqueue should equeue items if queue is not full yet', () => {
        const queue = new LimitedObservableQueue<string>(2);
        queue.enqueue('1');
        queue.enqueue('2');
        expect([...queue]).toEqual(['1', '2']);
    });

    test('enqueue should throw an error if queue is full', () => {
        const queue = new LimitedObservableQueue<string>(2);
        queue.enqueue('1');
        queue.enqueue('2');
        expect(() => queue.enqueue('3')).toThrowError('Queue full! Cannot enqueue any more items!');
    });

    test('maxSize should return the maxSize of the queue', () => {
        const queue = new LimitedObservableQueue<string>(2);
        expect(queue.maxSize).toEqual(2);
        queue.enqueue('1');
        queue.enqueue('2');
        expect(queue.freeSlots).toEqual(0);
    });

    test('setMaxSize should update maxSize of the queue', () => {
        const queue = new LimitedObservableQueue<string>(1);
        expect(queue.maxSize).toEqual(1);
        queue.setMaxSize(2);
        expect(queue.maxSize).toEqual(2);
    });

    test(`increasing a queue's maxSize should provide new free slots`, () => {
        const queue = new LimitedObservableQueue<string>(0);
        expect(queue.freeSlots).toEqual(0);
        queue.setMaxSize(2);
        expect(queue.freeSlots).toEqual(2);
    });

    test(`decreasing a queue's maxSize should decrease free slots`, () => {
        const queue = new LimitedObservableQueue<string>(2);
        expect(queue.freeSlots).toEqual(2);
        queue.setMaxSize(0);
        expect(queue.freeSlots).toEqual(0);
    });

    test(`full should return true after setting a queue's maxSize to a value < queue.size`, () => {
        const queue = new LimitedObservableQueue<string>(5);
        queue.enqueue('1');
        queue.enqueue('2');
        queue.setMaxSize(1);
        expect(queue.full).toEqual(true);
    });

    test(`freeSlots should return 0 after setting a queue's maxSize to a value < queue.size`, () => {
        const queue = new LimitedObservableQueue<string>(5);
        queue.enqueue('1');
        queue.enqueue('2');
        queue.setMaxSize(1);
        expect(queue.freeSlots).toEqual(0);
    });
});
