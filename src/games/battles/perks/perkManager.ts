import { EventBus } from "./eventBus";
import { Perk } from "./perkPack/iPerks";

// PerkManager handles registration and unregistration of Perks for a player.
export class PerkManager {
    private activePerks: Map<string, Perk[]> = new Map();

    constructor(private bus: EventBus, private battle: any, private ownerId: number) {}

    // Activate a perk for the owner
    activate(perk: Perk) {
        const perkKey = perk.constructor.name;
        if (!perk.stackable) {
            // Not stackable: remove old instance if exists, then register new one
            this.unregister(perkKey);
            this.activePerks.set(perkKey, [perk]);
            perk.register(this.bus, this.ownerId, this.battle);
        } else {
            // Stackable: always register a new instance
            if (!this.activePerks.has(perkKey)) this.activePerks.set(perkKey, []);
            this.activePerks.get(perkKey)!.push(perk);
            perk.register(this.bus, this.ownerId, this.battle);
        }
    }

    // Unregister all instances of a perk by class name
    unregister(perkKey: string) {
        const perks = this.activePerks.get(perkKey);
        if (perks) {
            for (const perk of perks) {
                if (typeof (perk as any).unregister === "function") {
                    (perk as any).unregister(this.bus, this.ownerId, this.battle);
                }
            }
            this.activePerks.delete(perkKey);
        }
    }

    // Unregister all perks (e.g., on battle end)
    unregisterAll() {
        for (const perkKey of this.activePerks.keys()) {
            this.unregister(perkKey);
        }
    }
}
