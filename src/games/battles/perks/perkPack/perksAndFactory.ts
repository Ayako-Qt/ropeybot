import { EventBus, BattleEvent } from "../eventBus";
import { Perk } from "./iPerks";
import { applyDamage, preCalculateDamage } from "../../battleActions/attack";

// BloodBoundPact: When you take damage, gain 1 point. Lasts forever unless removed.
export class BloodBoundPact extends Perk {
    name = "【BloodBound Pact】";
    description = "When you take damage, gain 1 point.";
    icon = "https://i.postimg.cc/KzQk4v23/Screenshot-2025-05-01-233656.png";
    cost = 2;
    stackable = true;
    duration = -1; // Permanent

    // The effect method is required by the Perk base class, but not used in the event-driven system.
    effect(player1: number, player2: number, battle: any): void {
        // No-op: logic is handled by the event-driven register method.
    }

    // Register the event handler for the event-driven system
    register(bus: EventBus, ownerId: number, battle: any) {
        bus.on("afterDamage", (event: BattleEvent) => {
            if (event.target === ownerId && event.amount !== undefined && event.amount >= 0) {
                if (battle.player1 === ownerId) {
                    battle.player1Points += 1;
                    this.log(`<${battle.conn.chatRoom.getCharacter(ownerId)?.Name || "Player1"}> gained 1 point from BloodBound Pact after taking ${event.amount} damage`, false);
                } else if (battle.player2 === ownerId) {
                    battle.player2Points += 1;
                    this.log(`<${battle.conn.chatRoom.getCharacter(ownerId)?.Name || "Player2"}> gained 1 point from BloodBound Pact after taking ${event.amount} damage`, true);
                }
            }
        });
    }
}

export class AyakosMercy extends Perk {
    name = "【Ayako's Mercy】";
    description = "When your HP drops to 0 or below, you will be spared from death once, restoring 5 HP.";
    icon = "https://i.postimg.cc/KzQk4v23/Screenshot-2025-05-01-233656.png";
    cost = 4;
    duration = -1; // Permanent until triggered
    stackable = false;

    private handler?: (event: BattleEvent) => void;

    register(bus: EventBus, ownerId: number, battle: any) {
        this.handler = (event: BattleEvent) => {
            if (event.type === "beforeDeath" && event.target === ownerId) {
                if (ownerId === battle.player1) {
                    if (battle.player1Hp <= 0) {
                        battle.player1Hp = 5;
                        this.log(`<${battle.conn.chatRoom.getCharacter(ownerId)?.Name || "Player1"}> was spared from death by Ayako's Mercy and restored to 5 HP`, false);
                        battle.player1ActivePerks.delete(this.getInstanceId());
                        event.cancel = true;
                        if (bus && this.handler && typeof bus.off === 'function') bus.off("beforeDeath", this.handler);
                    }
                } else if (ownerId === battle.player2) {
                    if (battle.player2Hp <= 0) {
                        battle.player2Hp = 5;
                        this.log(`<${battle.conn.chatRoom.getCharacter(ownerId)?.Name || "Player2"}> was spared from death by Ayako's Mercy and restored to 5 HP`, true);
                        battle.player2ActivePerks.delete(this.getInstanceId());
                        event.cancel = true;
                        if (bus && this.handler && typeof bus.off === 'function') bus.off("beforeDeath", this.handler);
                    }
                }
            }
        };
        bus.on("beforeDeath", this.handler);
    }

    unregister(bus: EventBus, ownerId: number, battle: any) {
        if (this.handler && typeof bus.off === 'function') {
            bus.off("beforeDeath", this.handler);
        }
    }

    effect(player1: number, player2: number, battle: any): void {
        // No-op for event-driven system
    }
}

export class CounterStrike extends Perk {
    name = "【Counter Strike】";
    description = "When you take damage, counterattack your opponent for 1 damage, ignoring their defense.";
    icon = "https://i.postimg.cc/KzQk4v23/Screenshot-2025-05-01-233656.png";
    cost = 4;
    duration = -1; // Permanent

    private handler?: (event: BattleEvent) => void;

    register(bus: EventBus, ownerId: number, battle: any) {
        this.handler = (event: BattleEvent) => {
            // Only trigger on real damage (not healing or 0), and only if the source is not CounterStrike
            if (event.type === "afterDamage" && event.target === ownerId && event.amount !== undefined && event.amount > 0 && event.source !== "CounterStrike") {
                // Find the opponent
                const opponentId = (ownerId === battle.player1) ? battle.player2 : battle.player1;
                // Counterattack: deal 1 damage ignoring defense
                // Log messages
                this.log(`<${battle.conn.chatRoom.getCharacter(ownerId)?.Name || "Player"}> counterattacked <${battle.conn.chatRoom.getCharacter(opponentId)?.Name || "Opponent"}> for 1 damage (ignores defense)`, ownerId !== battle.player1);
                const opponent = battle.conn.chatRoom.getCharacter(opponentId);
                const opponentHp = opponentId === battle.player1 ? battle.player1Hp : battle.player2Hp;
                const preCalculateHp = opponentHp - preCalculateDamage(battle, opponentId, 1, "CounterStrike", ownerId, battle.conn, true);
                this.log(`→ <${opponent?.Name || "Opponent"}> took 1 damage from counterattack\n→ ${opponent?.Name || "Opponent"}'s HP: ${preCalculateHp}`, opponentId !== battle.player1);
                applyDamage(battle, opponentId, 1, "CounterStrike", ownerId, battle.conn, true);
                // Emit afterDamage for the counterattack, mark source as 'CounterStrike'
                bus.emit({ type: "afterDamage", target: opponentId, amount: 1, source: "CounterStrike" });
            }
        };
        bus.on("afterDamage", this.handler);
    }

    unregister(bus: EventBus, ownerId: number, battle: any) {
        if (this.handler && typeof bus.off === 'function') {
            bus.off("afterDamage", this.handler);
        }
    }

    effect(player1: number, player2: number, battle: any): void {
        // No-op for event-driven system
    }
}

export class DefenseBoost extends Perk {
    name = "【Defense Boost】";
    description = "Permanently increase your defense by 1.";
    icon = "https://i.postimg.cc/KzQk4v23/Screenshot-2025-05-01-233656.png";
    cost = 4;
    stackable = false;
    duration = -1;

    register(bus: EventBus, ownerId: number, battle: any) {
        const playerName = battle.conn.chatRoom.getCharacter(ownerId)?.Name || (ownerId === battle.player1 ? "Player1" : "Player2");
        if (ownerId === battle.player1) {
            battle.player1Def += 1;
            battle.player1ActivePerks.set(this.getInstanceId(), { perk: this, rounds: -1 });
            this.log(`<${playerName}>'s defense increased to ${battle.player1Def}`, false);
        } else {
            battle.player2Def += 1;
            battle.player2ActivePerks.set(this.getInstanceId(), { perk: this, rounds: -1 });
            this.log(`<${playerName}>'s defense increased to ${battle.player2Def}`, true);
        }
    }

    effect(player1: number, player2: number, battle: any): void {
        // No-op for event-driven system
    }
}

export class Regeneration extends Perk {
    name = "【Regeneration】";
    description = "Restore 2 HP per round for the next 2 rounds.";
    icon = "https://i.postimg.cc/KzQk4v23/Screenshot-2025-05-01-233656.png";
    cost = 2;
    duration = 2;
    stackable = false;

    private handler?: (event: any) => void;

    register(bus: EventBus, ownerId: number, battle: any) {
        // 激活时加入activePerks
        const instanceId = this.getInstanceId();
        if (ownerId === battle.player1) {
            battle.player1ActivePerks.set(instanceId, { perk: this, rounds: this.duration });
            this.log(`<${battle.conn.chatRoom.getCharacter(ownerId)?.Name || "Player1"}> activated Regeneration for ${this.duration} rounds`, false);
        } else {
            battle.player2ActivePerks.set(instanceId, { perk: this, rounds: this.duration });
            this.log(`<${battle.conn.chatRoom.getCharacter(ownerId)?.Name || "Player2"}> activated Regeneration for ${this.duration} rounds`, true);
        }
        // 监听roundStart事件
        this.handler = (event: any) => {
            if (event.type === "roundStart") {
                // player1
                const data1 = battle.player1ActivePerks.get(instanceId);
                if (data1 && data1.perk === this) {
                    battle.player1Hp += 2;
                    data1.rounds -= 1;
                    this.log(`<${battle.conn.chatRoom.getCharacter(battle.player1)?.Name || "Player1"}>'s HP restored to ${battle.player1Hp} by Regeneration (${data1.rounds} rounds left)`, false);
                    if (data1.rounds <= 0) {
                        battle.player1ActivePerks.delete(instanceId);
                        this.log(`<${battle.conn.chatRoom.getCharacter(battle.player1)?.Name || "Player1"}>'s Regeneration has expired`, false);
                    }
                }
                // player2
                const data2 = battle.player2ActivePerks.get(instanceId);
                if (data2 && data2.perk === this) {
                    battle.player2Hp += 2;
                    data2.rounds -= 1;
                    this.log(`<${battle.conn.chatRoom.getCharacter(battle.player2)?.Name || "Player2"}>'s HP restored to ${battle.player2Hp} by Regeneration (${data2.rounds} rounds left)`, true);
                    if (data2.rounds <= 0) {
                        battle.player2ActivePerks.delete(instanceId);
                        this.log(`<${battle.conn.chatRoom.getCharacter(battle.player2)?.Name || "Player2"}>'s Regeneration has expired`, true);
                    }
                }
            }
        };
        bus.on("roundStart", this.handler);
    }

    unregister(bus: EventBus, ownerId: number, battle: any) {
        if (this.handler && typeof bus.off === 'function') {
            bus.off("roundStart", this.handler);
        }
    }
}

export class LifeExchange extends Perk {
    name = "【Life Exchange】";
    description = "Sacrifice 2 HP to gain 1 point immediately. If HP is less than 2, it will be set to 1 instead.";
    icon = "https://i.postimg.cc/KzQk4v23/Screenshot-2025-05-01-233656.png";
    cost = 0;
    stackable = false;
    duration = 0;

    register(bus: EventBus, ownerId: number, battle: any) {
        const playerName = battle.conn.chatRoom.getCharacter(ownerId)?.Name || (ownerId === battle.player1 ? "Player1" : "Player2");
        if (ownerId === battle.player1) {
            if (battle.player1Hp > 2) {
                battle.player1Hp -= 2;
                battle.player1Points += 1;
                this.log(`<${playerName}> sacrificed 2 HP to gain 1 point (HP: ${battle.player1Hp}, Points: ${battle.player1Points})`, false);
            } else {
                const originalHp = battle.player1Hp;
                battle.player1Hp = 1;
                battle.player1Points += 1;
                this.log(`<${playerName}> sacrificed ${originalHp - 1} HP to gain 1 point (HP: ${battle.player1Hp}, Points: ${battle.player1Points})`, false);
            }
        } else {
            if (battle.player2Hp > 2) {
                battle.player2Hp -= 2;
                battle.player2Points += 1;
                this.log(`<${playerName}> sacrificed 2 HP to gain 1 point (HP: ${battle.player2Hp}, Points: ${battle.player2Points})`, true);
            } else {
                const originalHp = battle.player2Hp;
                battle.player2Hp = 1;
                battle.player2Points += 1;
                this.log(`<${playerName}> sacrificed ${originalHp - 1} HP to gain 1 point (HP: ${battle.player2Hp}, Points: ${battle.player2Points})`, true);
            }
        }
    }
}

export class HealingPotion extends Perk {
    name = "【Healing Potion】";
    description = "Restore 3 HP immediately.";
    icon = "https://i.postimg.cc/KzQk4v23/Screenshot-2025-05-01-233656.png";
    cost = 2;
    stackable = false;
    duration = 0;

    register(bus: EventBus, ownerId: number, battle: any) {
        const playerName = battle.conn.chatRoom.getCharacter(ownerId)?.Name || (ownerId === battle.player1 ? "Player1" : "Player2");
        if (ownerId === battle.player1) {
            battle.player1Hp += 3;
            this.log(`3c${playerName}>'s HP restored to ${battle.player1Hp}`, false);
        } else {
            battle.player2Hp += 3;
            this.log(`3c${playerName}>'s HP restored to ${battle.player2Hp}`, true);
        }
    }

    effect(player1: number, player2: number, battle: any): void {
        // No-op for event-driven system
    }
}

export class BloodSacrifice extends Perk {
    name = "【Blood Sacrifice】";
    description = "Sacrifice half of your current HP (rounded down) to permanently increase your attack by 2. If HP is 1, it remains unchanged.";
    icon = "https://i.postimg.cc/KzQk4v23/Screenshot-2025-05-01-233656.png";
    cost = 3;
    stackable = false;
    duration = 0;

    register(bus: EventBus, ownerId: number, battle: any) {
        const playerName = battle.conn.chatRoom.getCharacter(ownerId)?.Name || (ownerId === battle.player1 ? "Player1" : "Player2");
        if (ownerId === battle.player1) {
            if (battle.player1Hp > 1) {
                const originalHp = battle.player1Hp;
                const newHp = Math.floor(battle.player1Hp / 2);
                battle.player1Hp = newHp;
                battle.player1Atk += 2;
                this.log(`<${playerName}> sacrificed ${originalHp - newHp} HP (from ${originalHp} to ${newHp}) to increase attack to ${battle.player1Atk}`, false);
            } else {
                this.log(`<${playerName}> cannot sacrifice HP when it's 1`, false);
            }
        } else {
            if (battle.player2Hp > 1) {
                const originalHp = battle.player2Hp;
                const newHp = Math.floor(battle.player2Hp / 2);
                battle.player2Hp = newHp;
                battle.player2Atk += 2;
                this.log(`<${playerName}> sacrificed ${originalHp - newHp} HP (from ${originalHp} to ${newHp}) to increase attack to ${battle.player2Atk}`, true);
            } else {
                this.log(`<${playerName}> cannot sacrifice HP when it's 1`, true);
            }
        }
    }

    effect(player1: number, player2: number, battle: any): void {
        // No-op for event-driven system
    }
}

export class PointDrain extends Perk {
    name = "【Point Drain】";
    description = "Your rival will lose 1 point per round for 3 rounds.";
    icon = "https://i.postimg.cc/KzQk4v23/Screenshot-2025-05-01-233656.png";
    cost = 1;
    duration = 3;  // lasts for 3 rounds
    stackable = false;

    private handler?: (event: any) => void;

    register(bus: EventBus, ownerId: number, battle: any) {
        // 只让对手流失点数
        const instanceId = this.getInstanceId();
        const opponentId = ownerId === battle.player1 ? battle.player2 : battle.player1;
        if (opponentId === battle.player1) {
            battle.player1ActivePerks.set(instanceId, { perk: this, rounds: this.duration });
            this.log(`<${battle.conn.chatRoom.getCharacter(battle.player1)?.Name || "Player1"}> will lose 1 point per round for ${this.duration} rounds`, false);
        } else {
            battle.player2ActivePerks.set(instanceId, { perk: this, rounds: this.duration });
            this.log(`<${battle.conn.chatRoom.getCharacter(battle.player2)?.Name || "Player2"}> will lose 1 point per round for ${this.duration} rounds`, true);
        }
        // 监听roundStart事件
        this.handler = (event: any) => {
            if (event.type === "roundStart") {
                // 只处理对手
                if (opponentId === battle.player1) {
                    const data = battle.player1ActivePerks.get(instanceId);
                    if (data && data.perk === this) {
                        if (battle.player1Points > 0) {
                            battle.player1Points -= 1;
                            this.log(`<${battle.conn.chatRoom.getCharacter(battle.player1)?.Name || "Player1"}> lost 1 point from Point Drain (${battle.player1Points} points left)`, false);
                        } else {
                            this.log(`<${battle.conn.chatRoom.getCharacter(battle.player1)?.Name || "Player1"}> has no points to lose from Point Drain`, false);
                        }
                        data.rounds -= 1;
                        if (data.rounds <= 0) {
                            battle.player1ActivePerks.delete(instanceId);
                            this.log(`<${battle.conn.chatRoom.getCharacter(battle.player1)?.Name || "Player1"}>'s Point Drain has expired`, false);
                        }
                    }
                } else {
                    const data = battle.player2ActivePerks.get(instanceId);
                    if (data && data.perk === this) {
                        if (battle.player2Points > 0) {
                            battle.player2Points -= 1;
                            this.log(`<${battle.conn.chatRoom.getCharacter(battle.player2)?.Name || "Player2"}> lost 1 point from Point Drain (${battle.player2Points} points left)`, true);
                        } else {
                            this.log(`<${battle.conn.chatRoom.getCharacter(battle.player2)?.Name || "Player2"}> has no points to lose from Point Drain`, true);
                        }
                        data.rounds -= 1;
                        if (data.rounds <= 0) {
                            battle.player2ActivePerks.delete(instanceId);
                            this.log(`<${battle.conn.chatRoom.getCharacter(battle.player2)?.Name || "Player2"}>'s Point Drain has expired`, true);
                        }
                    }
                }
            }
        };
        bus.on("roundStart", this.handler);
    }

    unregister(bus: EventBus, ownerId: number, battle: any) {
        if (this.handler && typeof bus.off === 'function') {
            bus.off("roundStart", this.handler);
        }
    }

    effect(player1: number, player2: number, battle: any): void {
        // No-op for event-driven system
    }
}

export class AttackBoost extends Perk {
    name = "【Attack Boost】";
    description = "Permanently increase your attack by 1.";
    icon = "https://i.postimg.cc/KzQk4v23/Screenshot-2025-05-01-233656.png";
    cost = 5;
    stackable = false;
    duration = -1;

    register(bus: EventBus, ownerId: number, battle: any) {
        const playerName = battle.conn.chatRoom.getCharacter(ownerId)?.Name || (ownerId === battle.player1 ? "Player1" : "Player2");
        if (ownerId === battle.player1) {
            battle.player1Atk += 1;
            battle.player1ActivePerks.set(this.getInstanceId(), { perk: this, rounds: -1 });
            this.log(`<${playerName}>'s attack increased to ${battle.player1Atk}`, false);
        } else {
            battle.player2Atk += 1;
            battle.player2ActivePerks.set(this.getInstanceId(), { perk: this, rounds: -1 });
            this.log(`<${playerName}>'s attack increased to ${battle.player2Atk}`, true);
        }
    }

    effect(player1: number, player2: number, battle: any): void {
        // No-op for event-driven system
    }
}

export class PulseofRenewal extends Perk {
    name = "【Pulse of Renewal】";
    description = "Gain 2 points immediately, then recover 1 point per round for the next 2 rounds.";
    icon = "https://i.postimg.cc/KzQk4v23/Screenshot-2025-05-01-233656.png";
    cost = 3;
    duration = 2;
    stackable = false;

    private handler?: (event: any) => void;

    register(bus: EventBus, ownerId: number, battle: any) {
        const playerName = battle.conn.chatRoom.getCharacter(ownerId)?.Name || (ownerId === battle.player1 ? "Player1" : "Player2");
        if (ownerId === battle.player1) {
            battle.player1Points += 2;
            this.log(`<${playerName}> gained 2 points from Pulse of Renewal`, false);
            battle.player1ActivePerks.set(this.getInstanceId(), { perk: this, rounds: this.duration });
        } else {
            battle.player2Points += 2;
            this.log(`<${playerName}> gained 2 points from Pulse of Renewal`, true);
            battle.player2ActivePerks.set(this.getInstanceId(), { perk: this, rounds: this.duration });
        }
        // 监听roundStart事件
        this.handler = (event: any) => {
            if (event.type === "roundStart") {
                // player1
                for (const [id, data] of battle.player1ActivePerks.entries()) {
                    if (data.perk === this) {
                        battle.player1Points += 1;
                        data.rounds -= 1;
                        this.log(`<${battle.conn.chatRoom.getCharacter(battle.player1)?.Name || "Player1"}> gained 1 point from Pulse of Renewal (${data.rounds} rounds left)`, false);
                        if (data.rounds <= 0) {
                            battle.player1ActivePerks.delete(id);
                            this.log(`<${battle.conn.chatRoom.getCharacter(battle.player1)?.Name || "Player1"}>'s Pulse of Renewal has expired`, false);
                        }
                    }
                }
                // player2
                for (const [id, data] of battle.player2ActivePerks.entries()) {
                    if (data.perk === this) {
                        battle.player2Points += 1;
                        data.rounds -= 1;
                        this.log(`<${battle.conn.chatRoom.getCharacter(battle.player2)?.Name || "Player2"}> gained 1 point from Pulse of Renewal (${data.rounds} rounds left)`, true);
                        if (data.rounds <= 0) {
                            battle.player2ActivePerks.delete(id);
                            this.log(`<${battle.conn.chatRoom.getCharacter(battle.player2)?.Name || "Player2"}>'s Pulse of Renewal has expired`, true);
                        }
                    }
                }
            }
        };
        bus.on("roundStart", this.handler);
    }

    unregister(bus: EventBus, ownerId: number, battle: any) {
        if (this.handler && typeof bus.off === 'function') {
            bus.off("roundStart", this.handler);
        }
    }

    effect(player1: number, player2: number, battle: any): void {
        // No-op for event-driven system
    }
}

export class DegradingTaunt extends Perk {
    name = "【Degrading Taunt】";
    description = "Send a taunting message to your opponent.";
    icon = "https://i.postimg.cc/KzQk4v23/Screenshot-2025-05-01-233656.png";
    cost = 0;
    stackable = false;
    duration = 0;

    register(bus: EventBus, ownerId: number, battle: any) {
        const playerName = battle.conn.chatRoom.getCharacter(ownerId)?.Name || (ownerId === battle.player2 ? "Player1" : "Player2");
        const opponentId = ownerId === battle.player2 ? battle.player2 : battle.player1;
        const opponentName = battle.conn.chatRoom.getCharacter(opponentId)?.Name || (opponentId === battle.player2 ? "Player1" : "Player2");
        if (ownerId === battle.player1) {
            this.log(`dear <${opponentName}>, <${playerName}> won't take any perks that are good for battle, but only wants me to tell you that, "You don't even have the qualifications to challenge me here. A filthy slave is your best role to play. Type '/bot submit' now and crawl to my feet, I might be merciful to give you a role as a boot cleaner. You will be so much happy to be the one who can clean the boots from a perfect leg"`, true);
        } else {
            this.log(`dear <${playerName}>, <${opponentName}> won't take any perks that are good for battle, but only wants me to tell you that, "You don't even have the qualifications to challenge me here. A filthy slave is your best role to play. Type '/bot submit' now and crawl to my feet, I might be merciful to give you a role as a boot cleaner. You will be so much happy to be the one who can clean the boots from a perfect leg"`, false);
        }
    }

    effect(player1: number, player2: number, battle: any): void {
        // No-op for event-driven system
    }
}

export class BargainPact extends Perk {
    name = "【Bargain Pact】";
    description = "Your opponent gains 3 HP, but you gain 4 points.";
    icon = "https://i.postimg.cc/KzQk4v23/Screenshot-2025-05-01-233656.png";
    cost = 0;
    stackable = false;
    duration = 0;

    register(bus: EventBus, ownerId: number, battle: any) {
        const playerName = battle.conn.chatRoom.getCharacter(ownerId)?.Name || (ownerId === battle.player1 ? "Player1" : "Player2");
        const opponentId = ownerId === battle.player1 ? battle.player2 : battle.player1;
        const opponentName = battle.conn.chatRoom.getCharacter(opponentId)?.Name || (opponentId === battle.player1 ? "Player1" : "Player2");
        if (ownerId === battle.player1) {
            battle.player2Hp += 3;
            battle.player1Points += 4;
            this.log(`${opponentName}> gained 3 HP from Bargain Pact`, true);
            this.log(`${playerName}> gained 4 points from Bargain Pact`, false);
        } else {
            battle.player1Hp += 3;
            battle.player2Points += 4;
            this.log(`${opponentName}> gained 3 HP from Bargain Pact`, false);
            this.log(`${playerName}> gained 4 points from Bargain Pact`, true);
        }
    }

    effect(player1: number, player2: number, battle: any): void {
        // No-op for event-driven system
    }
}

export class FortitudeGamble extends Perk {
    name = "【Fortitude Gamble】";
    description = "Your opponent gains 3 points, but you gain 5 HP.";
    icon = "https://i.postimg.cc/KzQk4v23/Screenshot-2025-05-01-233656.png";
    cost = 0;
    stackable = false;
    duration = 0;

    register(bus: EventBus, ownerId: number, battle: any) {
        const playerName = battle.conn.chatRoom.getCharacter(ownerId)?.Name || (ownerId === battle.player1 ? "Player1" : "Player2");
        const opponentId = ownerId === battle.player1 ? battle.player2 : battle.player1;
        const opponentName = battle.conn.chatRoom.getCharacter(opponentId)?.Name || (opponentId === battle.player1 ? "Player1" : "Player2");
        if (ownerId === battle.player1) {
            battle.player2Points += 3;
            battle.player1Hp += 5;
            this.log(`<${opponentName}> gained 3 points from Fortitude Gamble`, true);
            this.log(`<${playerName}> gained 5 HP from Fortitude Gamble`, false);
        } else {
            battle.player1Points += 3;
            battle.player2Hp += 5;
            this.log(`<${opponentName}> gained 3 points from Fortitude Gamble`, false);
            this.log(`<${playerName}> gained 5 HP from Fortitude Gamble`, true);
        }
    }

    effect(player1: number, player2: number, battle: any): void {
        // No-op for event-driven system
    }
}

export class SoulAbsorbing extends Perk {
    name = "【Soul Absorbing】";
    description = "Applies a debuff to your opponent for 3 rounds. Whenever the affected player loses 1 HP, the caster gains 1 point.";
    icon = "https://i.postimg.cc/KzQk4v23/Screenshot-2025-05-01-233656.png";
    cost = 6;
    duration = 3;
    stackable = false;

    private handler?: (event: any) => void;
    private roundHandler?: () => void;
    private debuffedPlayerId?: number;
    private casterId?: number;

    register(bus: EventBus, ownerId: number, battle: any) {
        // 只给对手加debuff
        const casterId = ownerId;
        const debuffedPlayerId = ownerId === battle.player1 ? battle.player2 : battle.player1;
        this.casterId = casterId;
        this.debuffedPlayerId = debuffedPlayerId;
        const casterName = battle.conn.chatRoom.getCharacter(casterId)?.Name || (casterId === battle.player1 ? "Player1" : "Player2");
        const debuffedName = battle.conn.chatRoom.getCharacter(debuffedPlayerId)?.Name || (debuffedPlayerId === battle.player1 ? "Player1" : "Player2");
        // 只在debuffed方activePerks中添加
        const instanceId = this.getInstanceId();
        if (debuffedPlayerId === battle.player1) {
            battle.player1ActivePerks.set(instanceId, { perk: this, rounds: this.duration, casterId });
            this.log(`<${debuffedName}> is affected by Soul Absorbing for ${this.duration} rounds`, false);
        } else {
            battle.player2ActivePerks.set(instanceId, { perk: this, rounds: this.duration, casterId });
            this.log(`<${debuffedName}> is affected by Soul Absorbing for ${this.duration} rounds`, true);
        }
        // 监听afterDamage事件
        this.handler = (event: any) => {
            if (event.type === "afterDamage" && event.target === debuffedPlayerId && event.amount && event.amount > 0) {
                // 只有施法者获得点数
                if (casterId === battle.player1) {
                    battle.player1Points += event.amount;
                    this.log(`<${casterName}> absorbed ${event.amount} point(s) from ${debuffedName}'s HP loss (Soul Absorbing)`, false);
                } else {
                    battle.player2Points += event.amount;
                    this.log(`<${casterName}> absorbed ${event.amount} point(s) from ${debuffedName}'s HP loss (Soul Absorbing)`, true);
                }
            }
        };
        bus.on("afterDamage", this.handler);
        // 新增：监听roundStart事件，自动递减和移除debuff
        this.roundHandler = () => {
            const instanceId = this.getInstanceId();
            let data;
            if (debuffedPlayerId === battle.player1) {
                data = battle.player1ActivePerks.get(instanceId);
            } else {
                data = battle.player2ActivePerks.get(instanceId);
            }
            if (data && data.perk === this) {
                data.rounds -= 1;
                if (data.rounds <= 0) {
                    if (debuffedPlayerId === battle.player1) {
                        battle.player1ActivePerks.delete(instanceId);
                        this.log(`Soul Absorbing on Player1 has expired`, false);
                    } else {
                        battle.player2ActivePerks.delete(instanceId);
                        this.log(`Soul Absorbing on Player2 has expired`, true);
                    }
                    // 自动注销事件监听
                    if (this.roundHandler && typeof bus.off === 'function') {
                        bus.off('roundStart', this.roundHandler);
                    }
                }
            }
        };
        bus.on('roundStart', this.roundHandler);
    }

    unregister(bus: EventBus, ownerId: number, battle: any) {
        if (this.handler && typeof bus.off === 'function') {
            bus.off("afterDamage", this.handler);
        }
        if (this.roundHandler && typeof bus.off === 'function') {
            bus.off("roundStart", this.roundHandler);
        }
    }

    effect(player1: number, player2: number, battle: any): void {
        // No-op for event-driven system
    }
}

export class PowerStrike1 extends Perk {
    name = "【Power Strike I】";
    description = "Spend 2 points to deal damage equal to your attack +1 to your opponent.(can not trigger Soul Absorbing)";
    icon = "https://i.postimg.cc/KzQk4v23/Screenshot-2025-05-01-233656.png";
    cost = 2;
    stackable = false;
    duration = 0;

    register(bus: EventBus, ownerId: number, battle: any) {
        const opponentId = ownerId === battle.player1 ? battle.player2 : battle.player1;
        const atk = ownerId === battle.player1 ? battle.player1Atk : battle.player2Atk;
        const damage = atk + 1;
        if (opponentId === battle.player1) {
            battle.player1Hp -= damage;
            this.log(`Dealt ${damage} damage to Player1 (Power Strike I)`, false);
        } else {
            battle.player2Hp -= damage;
            this.log(`Dealt ${damage} damage to Player2 (Power Strike I)`, true);
        }
    }

    effect(player1: number, player2: number, battle: any): void {
        // No-op for event-driven system
    }
}

export class PowerStrike2 extends Perk {
    name = "【Power Strike II】";
    description = "Spend 3 points to deal damage equal to your attack +2 to your opponent.(can not trigger Soul Absorbing)";
    icon = "https://i.postimg.cc/KzQk4v23/Screenshot-2025-05-01-233656.png";
    cost = 3;
    stackable = false;
    duration = 0;

    register(bus: EventBus, ownerId: number, battle: any) {
        const opponentId = ownerId === battle.player1 ? battle.player2 : battle.player1;
        const atk = ownerId === battle.player1 ? battle.player1Atk : battle.player2Atk;
        const damage = atk + 2;
        if (opponentId === battle.player1) {
            battle.player1Hp -= damage;
            this.log(`Dealt ${damage} damage to Player1 (Power Strike II)`, false);
        } else {
            battle.player2Hp -= damage;
            this.log(`Dealt ${damage} damage to Player2 (Power Strike II)`, true);
        }
    }

    effect(player1: number, player2: number, battle: any): void {
        // No-op for event-driven system
    }
}

export class PowerStrike3 extends Perk {
    name = "【Power Strike III】";
    description = "Spend 4 points to deal damage equal to your attack +3 to your opponent.(can not trigger Soul Absorbing)";
    icon = "https://i.postimg.cc/KzQk4v23/Screenshot-2025-05-01-233656.png";
    cost = 4;
    stackable = false;
    duration = 0;

    register(bus: EventBus, ownerId: number, battle: any) {
        const opponentId = ownerId === battle.player1 ? battle.player2 : battle.player1;
        const atk = ownerId === battle.player1 ? battle.player1Atk : battle.player2Atk;
        const damage = atk + 3;
        if (opponentId === battle.player1) {
            battle.player1Hp -= damage;
            this.log(`Dealt ${damage} damage to Player1 (Power Strike III)`, false);
        } else {
            battle.player2Hp -= damage;
            this.log(`Dealt ${damage} damage to Player2 (Power Strike III)`, true);
        }
    }

    effect(player1: number, player2: number, battle: any): void {
        // No-op for event-driven system
    }
}

export class FortunePotion extends Perk {
    name = "【Fortune Potion】";
    description = "Randomly gain one of two effects: either gain 6 HP or lose 2 HP.";
    icon = "https://i.postimg.cc/KzQk4v23/Screenshot-2025-05-01-233656.png";
    cost = 1;
    stackable = false;
    duration = 0;

    register(bus: EventBus, ownerId: number, battle: any) {
        const playerName = battle.conn.chatRoom.getCharacter(ownerId)?.Name || (ownerId === battle.player1 ? "Player1" : "Player2");
        const isGain = Math.random() < 0.5;
        if (ownerId === battle.player1) {
            if (isGain) {
                battle.player1Hp += 6;
                this.log(`<${playerName}> drank Fortune Potion and gained 6 HP!`, false);
            } else {
                battle.player1Hp -= 2;
                this.log(`<${playerName}> drank Fortune Potion and lost 2 HP!`, false);
            }
        } else {
            if (isGain) {
                battle.player2Hp += 6;
                this.log(`<${playerName}> drank Fortune Potion and gained 6 HP!`, true);
            } else {
                battle.player2Hp -= 2;
                this.log(`<${playerName}> drank Fortune Potion and lost 2 HP!`, true);
            }
        }
    }

    effect(player1: number, player2: number, battle: any): void {
        // No-op for event-driven system
    }
}

export class PerkFactory {
    static createPerk(perkId: string | number, logger?: (message: string, isEmote?: boolean) => void): Perk | null {
        const id = typeof perkId === 'string' ? parseInt(perkId) : perkId;
        switch (id) {
            case 1:
                return new BloodBoundPact(logger);
            case 2:
                return new PulseofRenewal(logger);
            case 3:
                return new AttackBoost(logger);
            case 4:
                return new PointDrain(logger);
            case 5:
                return new Regeneration(logger);
            case 6:
                return new DegradingTaunt(logger);
            case 7:
                return new HealingPotion(logger);
            case 8:
                return new BloodSacrifice(logger);
            case 9:
                return new AyakosMercy(logger);
            case 10:
                return new FortunePotion(logger);
            case 11:
                return new BargainPact(logger);
            case 12:
                return new DefenseBoost(logger);
            case 13:
                return new CounterStrike(logger);
            case 14:
                return new LifeExchange(logger);
            case 15:
                return new FortitudeGamble(logger);
            case 16:
                return new SoulAbsorbing(logger);
            case 17:
                return new PowerStrike1(logger);
            case 18:
                return new PowerStrike2(logger);
            case 19:
                return new PowerStrike3(logger);
            
            // default:
            //     return null;
        }
    }
}