import { EventRegistration, EventRegistrationList } from './event-registration-list';

function createMockRegistration(): EventRegistration {
    return {
        register: jest.fn(),
        unregister: jest.fn()
    };
}

describe('EventRegistrationList', () => {
    test('size of a new registration list must be 0', () => {
        const list = new EventRegistrationList();
        expect(list.size).toEqual(0);
    });

    test('push should add registration', () => {
        const list = new EventRegistrationList();
        list.push(createMockRegistration());
        list.push(createMockRegistration());
        expect(list.size).toEqual(2);
    });

    test('registerAll should call register on all registrations', () => {
        const list = new EventRegistrationList();

        const r1 = createMockRegistration();
        list.push(r1);
        const r2 = createMockRegistration();
        list.push(r2);

        list.registerAll();
        expect(r1.register).toHaveBeenCalledTimes(1);
        expect(r2.register).toHaveBeenCalledTimes(1);
    });

    test('registerAll should call register on all registrations', () => {
        const list = new EventRegistrationList();

        const r1 = createMockRegistration();
        list.push(r1);
        const r2 = createMockRegistration();
        list.push(r2);

        list.unregisterAll();
        expect(r1.unregister).toHaveBeenCalledTimes(1);
        expect(r2.unregister).toHaveBeenCalledTimes(1);
    });
});
