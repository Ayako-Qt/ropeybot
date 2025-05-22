export abstract class Perk {
    abstract name: string;
    abstract description: string;
    abstract icon: string;
    abstract cost: number;
    protected instanceId: string;
    protected logger?: (message: string, isEmote?: boolean) => void;
    stackable: boolean = true; // default: not stackable
    duration?: number;

    constructor(logger?: (message: string, isEmote?: boolean) => void) {
        this.instanceId = `${this.constructor.name.toLowerCase()}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        this.logger = logger;
    }

    protected log(message: string, isEmote: boolean = false): void {
        if (this.logger) {
            console.log("true-----------------");
            this.logger(message, isEmote);
        } else {
            console.log("false-----------------");

            console.log(message);
        }
    }

        // Register event listeners for this perk (event-driven system)
    abstract register(bus: any, ownerId: number, battle: any): void;
    // Optional: Unregister event listeners for this perk
    unregister?(bus: any, ownerId: number, battle: any): void;

    public getInstanceId(): string {
        return this.instanceId;
    }
}
