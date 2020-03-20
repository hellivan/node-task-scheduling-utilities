import { TimerEventRegistration } from './timer-event-registration';

describe('TimerRegistration', () => {
    jest.useFakeTimers();

    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('register should start timeout', () => {
        const cb = (): void => undefined;
        const registration = new TimerEventRegistration(cb, 1234);

        registration.register();

        expect(setTimeout).toHaveBeenCalledWith(cb, 1234);
    });

    test('unregister should clear timeout', () => {
        const registration = new TimerEventRegistration(() => undefined, 1234);

        registration.register();
        registration.unregister();

        expect(clearTimeout).toHaveBeenCalledTimes(1);
    });

    test('calling register on a registered TimerRegistration should throw an error', () => {
        const registration = new TimerEventRegistration(() => undefined, 1234);

        registration.register();

        expect(() => registration.register()).toThrowError('Timer already registered!');
    });

    test('calling unregister on a unregistered TimerRegistration should throw an error', () => {
        const registration = new TimerEventRegistration(() => undefined, 1234);

        expect(() => registration.unregister()).toThrowError('Not registered!');
    });
});
