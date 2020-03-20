import { EventRegistration } from './event-registration-list';

export class TimerEventRegistration implements EventRegistration {
    private timeoutTimer: NodeJS.Timeout | null = null;

    constructor(private readonly cb: () => void, private readonly timeout: number) {}

    public register(): void {
        if (this.timeoutTimer != null) throw new Error('Timer already registered!');
        this.timeoutTimer = setTimeout(this.cb, this.timeout);
    }

    public unregister(): void {
        if (this.timeoutTimer == null) throw new Error('Not registered!');
        clearTimeout(this.timeoutTimer);
        this.timeoutTimer = null;
    }
}
