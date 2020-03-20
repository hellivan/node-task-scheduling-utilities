export interface EventRegistration {
    register(): void;
    unregister(): void;
}

export class EventRegistrationList {
    private readonly registrations: EventRegistration[] = [];

    public push(eventRegistration: EventRegistration): void {
        this.registrations.push(eventRegistration);
    }

    public registerAll(): void {
        this.registrations.forEach((r) => r.register());
    }

    public unregisterAll(): void {
        this.registrations.forEach((r) => r.unregister());
    }

    public get size(): number {
        return this.registrations.length;
    }
}
