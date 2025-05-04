export abstract class Perk {
    abstract name: string;
    abstract description: string;
    abstract icon: string;
    abstract cost: number;
    protected instanceId: string;
    protected logger?: (message: string, isEmote?: boolean) => void;

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

    abstract effect(player1: number, player2: number, battle: any): void;
    onRoundStart?(player1: number, player2: number, battle: any): void;
    duration?: number;
}

class BloodBoundPact extends Perk {
    name = "[BloodBound Pact]";
    description = "\"When you take damage, gain 1 point.\"";
    icon = "https://i.postimg.cc/KzQk4v23/Screenshot-2025-05-01-233656.png";
    cost = 2;
    duration = -1;

    effect(player1: number, player2: number, battle: any): void {
        const player1Name = battle.conn.chatRoom.getCharacter(player1)?.Name || "Player1";
        const player2Name = battle.conn.chatRoom.getCharacter(player2)?.Name || "Player2";
        this.log(`${this.name} is executed by ${battle.currentPlayer === player1 ? `<${player1Name}>` : `<${player2Name}>`}`, !(battle.currentPlayer === player1));
        const isPlayer1 = battle.currentPlayer === player1;
        if (isPlayer1) {
            battle.player1OnTakenDamage.push((damage: number) => {
                battle.player1Points += 1;
                this.log(`<${player1Name}> gained 1 point from BloodBound Pact after taking ${damage} damage`, false);
            });
            battle.player1ActivePerks.set(this.instanceId, { perk: this, rounds: this.duration });
        } else {
            battle.player2OnTakenDamage.push((damage: number) => {
                battle.player2Points += 1;
                this.log(`<${player2Name}> gained 1 point from BloodBound Pact after taking ${damage} damage`, true);
            });
            battle.player2ActivePerks.set(this.instanceId, { perk: this, rounds: this.duration });
        }
    }
}

class PulseofRenewal extends Perk {
    name = "[Pulse of Renewal]";
    description = "\"Gain 2 points immediately, then recover 1 point per round for the next 2 rounds.\"";
    icon = "https://i.postimg.cc/KzQk4v23/Screenshot-2025-05-01-233656.png";
    cost = 3;
    duration = 2;

    effect(player1: number, player2: number, battle: any): void {
        const player1Name = battle.conn.chatRoom.getCharacter(player1)?.Name || "Player1";
        const player2Name = battle.conn.chatRoom.getCharacter(player2)?.Name || "Player2";
        this.log(`${this.name} is executed by ${battle.currentPlayer === player1 ? `<${player1Name}>` : `<${player2Name}>`}`, !(battle.currentPlayer === player1));
        const isPlayer1 = battle.currentPlayer === player1;
        
        if (isPlayer1) {
            battle.player1Points += 2;
            this.log(`<${player1Name}> gained 2 points from Pulse of Renewal`, false);
            battle.player1ActivePerks.set(this.instanceId, { perk: this, rounds: this.duration });
        } else {
            battle.player2Points += 2;
            this.log(`<${player2Name}> gained 2 points from Pulse of Renewal`, true);
            battle.player2ActivePerks.set(this.instanceId, { perk: this, rounds: this.duration });
        }
    }

    onRoundStart(player1: number, player2: number, battle: any): void {
        const player1Name = battle.conn.chatRoom.getCharacter(player1)?.Name || "Player1";
        const player2Name = battle.conn.chatRoom.getCharacter(player2)?.Name || "Player2";

        // check player1's perk
        for (const [id, data] of battle.player1ActivePerks.entries()) {
            if (data.perk === this) {
                battle.player1Points += 1;
                data.rounds -= 1;
                this.log(`<${player1Name}> gained 1 point from Pulse of Renewal (${data.rounds} rounds left)`, false);
                if (data.rounds <= 0) {
                    battle.player1ActivePerks.delete(id);
                    this.log(`<${player1Name}>'s Pulse of Renewal has expired`, false);
                }
            }
        }

        // check player2's perk
        for (const [id, data] of battle.player2ActivePerks.entries()) {
            if (data.perk === this) {
                battle.player2Points += 1;
                data.rounds -= 1;
                this.log(`<${player2Name}> gained 1 point from Pulse of Renewal (${data.rounds} rounds left)`, true);
                if (data.rounds <= 0) {
                    battle.player2ActivePerks.delete(id);
                    this.log(`<${player2Name}>'s Pulse of Renewal has expired`, true);
                }
            }
        }
    }
}

class AttackBoost extends Perk {
    name = "[Attack Boost]";
    description = "\"Increase your attack by 1.\"";
    icon = "https://i.postimg.cc/KzQk4v23/Screenshot-2025-05-01-233656.png";
    cost = 3;

    effect(player1: number, player2: number, battle: any): void {
        const player1Name = battle.conn.chatRoom.getCharacter(player1)?.Name || "Player1";
        const player2Name = battle.conn.chatRoom.getCharacter(player2)?.Name || "Player2";
        this.log(`${this.name} is executed by ${battle.currentPlayer === player1 ? `<${player1Name}>` : `<${player2Name}>`}`, !(battle.currentPlayer === player1));
        const isPlayer1 = battle.currentPlayer === player1;
        if (isPlayer1) {
            battle.player1Atk += 1;
            battle.player1ActivePerks.set(this.instanceId, { perk: this, rounds: -1 });
            this.log(`<${player1Name}>'s attack increased to ${battle.player1Atk}`, false);
        } else {
            battle.player2Atk += 1;
            battle.player2ActivePerks.set(this.instanceId, { perk: this, rounds: -1 });
            this.log(`<${player2Name}>'s attack increased to ${battle.player2Atk}`, true);
        }
    }
}

class PointDrain extends Perk {
    name = "[Point Drain]";
    description = "\"Your rival will lose 1 point per round for 3 rounds.\"";
    icon = "https://i.postimg.cc/KzQk4v23/Screenshot-2025-05-01-233656.png";
    cost = 1;
    duration = 3;  // lasts for 3 rounds

    effect(player1: number, player2: number, battle: any): void {
        const player1Name = battle.conn.chatRoom.getCharacter(player1)?.Name || "Player1";
        const player2Name = battle.conn.chatRoom.getCharacter(player2)?.Name || "Player2";
        this.log(`${this.name} is executed by ${battle.currentPlayer === player1 ? `<${player1Name}>` : `<${player2Name}>`}`, !(battle.currentPlayer === player1));
        
        const isPlayer1 = battle.currentPlayer === player1;
        if (isPlayer1) {
            battle.player2ActivePerks.set(this.instanceId, { perk: this, rounds: this.duration });
            this.log(`<${player2Name}> will lose 1 point per round for ${this.duration} rounds`, true);
        } else {
            battle.player1ActivePerks.set(this.instanceId, { perk: this, rounds: this.duration });
            this.log(`<${player1Name}> will lose 1 point per round for ${this.duration} rounds`, false);
        }
    }

    onRoundStart(player1: number, player2: number, battle: any): void {
        const player1Name = battle.conn.chatRoom.getCharacter(player1)?.Name || "Player1";
        const player2Name = battle.conn.chatRoom.getCharacter(player2)?.Name || "Player2";
        
        // check player1's perk
        for (const [id, data] of battle.player1ActivePerks.entries()) {
            if (data.perk === this) {
                if (battle.player1Points > 0) {
                    battle.player1Points -= 1;
                    this.log(`<${player1Name}> lost 1 point from ${this.name} (${battle.player1Points} points left)`, false);
                } else {
                    this.log(`<${player1Name}> has no points to lose from ${this.name}`, false);
                }
                data.rounds -= 1;
                if (data.rounds <= 0) {
                    battle.player1ActivePerks.delete(id);
                    this.log(`<${player1Name}>'s ${this.name} has expired`, false);
                }
            }
        }

        // check player2's perk
        for (const [id, data] of battle.player2ActivePerks.entries()) {
            if (data.perk === this) {
                if (battle.player2Points > 0) {
                    battle.player2Points -= 1;
                    this.log(`<${player2Name}> lost 1 point from ${this.name} (${battle.player2Points} points left)`, true);
                } else {
                    this.log(`<${player2Name}> has no points to lose from ${this.name}`, true);
                }
                data.rounds -= 1;
                if (data.rounds <= 0) {
                    battle.player2ActivePerks.delete(id);
                    this.log(`<${player2Name}>'s ${this.name} has expired`, true);
                }
            }
        }
    }
}

class Regeneration extends Perk {
    name = "[Regeneration]";
    description = "\"Restore 2 HP per round for the next 2 rounds.\"";
    icon = "https://i.postimg.cc/KzQk4v23/Screenshot-2025-05-01-233656.png";
    cost = 3;
    duration = 2;

    effect(player1: number, player2: number, battle: any): void {
        const player1Name = battle.conn.chatRoom.getCharacter(player1)?.Name || "Player1";
        const player2Name = battle.conn.chatRoom.getCharacter(player2)?.Name || "Player2";
        this.log(`${this.name} is executed by ${battle.currentPlayer === player1 ? `<${player1Name}>` : `<${player2Name}>`}`, !(battle.currentPlayer === player1));
        const isPlayer1 = battle.currentPlayer === player1;
        
        if (isPlayer1) {
            battle.player1ActivePerks.set(this.instanceId, { perk: this, rounds: this.duration });
            this.log(`<${player1Name}> activated Regeneration for ${this.duration} rounds`, false);
        } else {
            battle.player2ActivePerks.set(this.instanceId, { perk: this, rounds: this.duration });
            this.log(`<${player2Name}> activated Regeneration for ${this.duration} rounds`, true);
        }
    }

    onRoundStart(player1: number, player2: number, battle: any): void {
        const player1Name = battle.conn.chatRoom.getCharacter(player1)?.Name || "Player1";
        const player2Name = battle.conn.chatRoom.getCharacter(player2)?.Name || "Player2";

        // check player1's perk
        for (const [id, data] of battle.player1ActivePerks.entries()) {
            if (data.perk === this) {
                battle.player1Hp += 2;
                data.rounds -= 1;
                this.log(`<${player1Name}>'s HP restored to ${battle.player1Hp} by Regeneration (${data.rounds} rounds left)`, false);
                if (data.rounds <= 0) {
                    battle.player1ActivePerks.delete(id);
                    this.log(`<${player1Name}>'s Regeneration has expired`, false);
                }
            }
        }

        // check player2's perk
        for (const [id, data] of battle.player2ActivePerks.entries()) {
            if (data.perk === this) {
                battle.player2Hp += 2;
                data.rounds -= 1;
                this.log(`<${player2Name}>'s HP restored to ${battle.player2Hp} by Regeneration (${data.rounds} rounds left)`, true);
                if (data.rounds <= 0) {
                    battle.player2ActivePerks.delete(id);
                    this.log(`<${player2Name}>'s Regeneration has expired`, true);
                }
            }
        }
    }
}

class IroncladAegis extends Perk {
    name = "[Ironclad Aegis]";
    description = "\"Temporarily increase your defense by 1 for 4 rounds.\"";
    icon = "https://i.postimg.cc/KzQk4v23/Screenshot-2025-05-01-233656.png";
    cost = 1;
    duration = 4;

    effect(player1: number, player2: number, battle: any): void {
        const player1Name = battle.conn.chatRoom.getCharacter(player1)?.Name || "Player1";
        const player2Name = battle.conn.chatRoom.getCharacter(player2)?.Name || "Player2";
        this.log(`${this.name} is executed by ${battle.currentPlayer === player1 ? `<${player1Name}>` : `<${player2Name}>`}`, !(battle.currentPlayer === player1));
        const isPlayer1 = battle.currentPlayer === player1;
        
        if (isPlayer1) {
            battle.player1Def += 1;
            battle.player1ActivePerks.set(this.instanceId, { perk: this, rounds: this.duration });
            this.log(`<${player1Name}>'s defense increased to ${battle.player1Def} for ${this.duration} rounds`, false);
        } else {
            battle.player2Def += 1;
            battle.player2ActivePerks.set(this.instanceId, { perk: this, rounds: this.duration });
            this.log(`<${player2Name}>'s defense increased to ${battle.player2Def} for ${this.duration} rounds`, true);
        }
    }

    onRoundStart(player1: number, player2: number, battle: any): void {
        const player1Name = battle.conn.chatRoom.getCharacter(player1)?.Name || "Player1";
        const player2Name = battle.conn.chatRoom.getCharacter(player2)?.Name || "Player2";

        // check player1's perk
        for (const [id, data] of battle.player1ActivePerks.entries()) {
            if (data.perk === this) {
                data.rounds -= 1;
                if (data.rounds <= 0) {
                    battle.player1Def -= 1;
                    battle.player1ActivePerks.delete(id);
                    this.log(`<${player1Name}>'s defense returned to ${battle.player1Def} (Ironclad Aegis expired)`, false);
                } else {
                    this.log(`<${player1Name}>'s Ironclad Aegis has ${data.rounds} rounds left`, false);
                }
            }
        }

        // check player2's perk
        for (const [id, data] of battle.player2ActivePerks.entries()) {
            if (data.perk === this) {
                data.rounds -= 1;
                if (data.rounds <= 0) {
                    battle.player2Def -= 1;
                    battle.player2ActivePerks.delete(id);
                    this.log(`<${player2Name}>'s defense returned to ${battle.player2Def} (Ironclad Aegis expired)`, true);
                } else {
                    this.log(`<${player2Name}>'s Ironclad Aegis has ${data.rounds} rounds left`, true);
                }
            }
        }
    }
}

class HealingPotion extends Perk {
    name = "[Healing Potion]";
    description = "\"Restore 3 HP immediately.\"";
    icon = "https://i.postimg.cc/KzQk4v23/Screenshot-2025-05-01-233656.png";
    cost = 2;

    effect(player1: number, player2: number, battle: any): void {
        const player1Name = battle.conn.chatRoom.getCharacter(player1)?.Name || "Player1";
        const player2Name = battle.conn.chatRoom.getCharacter(player2)?.Name || "Player2";
        this.log(`${this.name} is executed by ${battle.currentPlayer === player1 ? `<${player1Name}>` : `<${player2Name}>`}`, !(battle.currentPlayer === player1));
        
        const isPlayer1 = battle.currentPlayer === player1;
        if (isPlayer1) {
            battle.player1Hp += 3;
            this.log(`<${player1Name}>'s HP restored to ${battle.player1Hp}`, false);
        } else {
            battle.player2Hp += 3;
            this.log(`<${player2Name}>'s HP restored to ${battle.player2Hp}`, true);
        }
    }
}

class BloodSacrifice extends Perk {
    name = "[Blood Sacrifice]";
    description = "\"Sacrifice half of your current HP (rounded down) to permanently increase your attack by 2. If HP is 1, it remains unchanged.\"";
    icon = "https://i.postimg.cc/KzQk4v23/Screenshot-2025-05-01-233656.png";
    cost = 3;

    effect(player1: number, player2: number, battle: any): void {
        const player1Name = battle.conn.chatRoom.getCharacter(player1)?.Name || "Player1";
        const player2Name = battle.conn.chatRoom.getCharacter(player2)?.Name || "Player2";
        this.log(`${this.name} is executed by ${battle.currentPlayer === player1 ? `<${player1Name}>` : `<${player2Name}>`}`, !(battle.currentPlayer === player1));
        
        const isPlayer1 = battle.currentPlayer === player1;
        if (isPlayer1) {
            if (battle.player1Hp > 1) {
                const originalHp = battle.player1Hp;
                const newHp = Math.floor(battle.player1Hp / 2);
                battle.player1Hp = newHp;
                battle.player1Atk += 2;
                this.log(`<${player1Name}> sacrificed ${originalHp - newHp} HP (from ${originalHp} to ${newHp}) to increase attack to ${battle.player1Atk}`, false);
            } else {
                this.log(`<${player1Name}> cannot sacrifice HP when it's 1`, false);
            }
        } else {
            if (battle.player2Hp > 1) {
                const originalHp = battle.player2Hp;
                const newHp = Math.floor(battle.player2Hp / 2);
                battle.player2Hp = newHp;
                battle.player2Atk += 2;
                this.log(`<${player2Name}> sacrificed ${originalHp - newHp} HP (from ${originalHp} to ${newHp}) to increase attack to ${battle.player2Atk}`, true);
            } else {
                this.log(`<${player2Name}> cannot sacrifice HP when it's 1`, true);
            }
        }
    }
}

class AyakosMercy extends Perk {
    name = "[Ayako's Mercy]";
    description = "\"When your HP drops to 0 or below, you will be spared from death once, restoring 5 HP.\"";
    icon = "https://i.postimg.cc/KzQk4v23/Screenshot-2025-05-01-233656.png";
    cost = 4;
    duration = -1;  // lasts forever until triggered

    effect(player1: number, player2: number, battle: any): void {
        const player1Name = battle.conn.chatRoom.getCharacter(player1)?.Name || "Player1";
        const player2Name = battle.conn.chatRoom.getCharacter(player2)?.Name || "Player2";
        this.log(`${this.name} is executed by ${battle.currentPlayer === player1 ? `<${player1Name}>` : `<${player2Name}>`}`, !(battle.currentPlayer === player1));
        
        const isPlayer1 = battle.currentPlayer === player1;
        if (isPlayer1) {
            battle.player1OnTakenDamage.push((damage: number) => {
                if (battle.player1Hp <= 0) {
                    battle.player1Hp = 5;
                    this.log(`<${player1Name}> was spared from death by "A Goddess" and restored to 5 HP`, false);
                    battle.player1ActivePerks.delete(this.instanceId);
                    const index = battle.player1OnTakenDamage.indexOf(this);
                    if (index > -1) {
                        battle.player1OnTakenDamage.splice(index, 1);
                    }
                }
            });
            battle.player1ActivePerks.set(this.instanceId, { perk: this, rounds: this.duration });
            this.log(`<${player1Name}> is protected by ${this.name}`, false);
        } else {
            battle.player2OnTakenDamage.push((damage: number) => {
                if (battle.player2Hp <= 0) {
                    battle.player2Hp = 5;
                    this.log(`<${player2Name}> was spared from death by ${this.name} and restored to 5 HP`, true);
                    battle.player2ActivePerks.delete(this.instanceId);
                    const index = battle.player2OnTakenDamage.indexOf(this);
                    if (index > -1) {
                        battle.player2OnTakenDamage.splice(index, 1);
                    }
                }
            });
            battle.player2ActivePerks.set(this.instanceId, { perk: this, rounds: this.duration });
            this.log(`<${player2Name}> is protected by ${this.name}`, true);
        }
    }
}

class DegradingTaunt extends Perk {
    name = "[Degrading Taunt]";
    description = "\"Send a taunting message to your opponent.\"";
    icon = "https://i.postimg.cc/KzQk4v23/Screenshot-2025-05-01-233656.png";
    cost = 0;

    effect(player1: number, player2: number, battle: any): void {
        const player1Name = battle.conn.chatRoom.getCharacter(player1)?.Name || "Player1";
        const player2Name = battle.conn.chatRoom.getCharacter(player2)?.Name || "Player2";
        this.log(`${this.name} is executed by ${battle.currentPlayer === player1 ? `<${player1Name}>` : `<${player2Name}>`}`, !(battle.currentPlayer === player1));
        
        const isPlayer1 = battle.currentPlayer === player1;
        if (isPlayer1) {
            this.log(`dear <${player2Name}>, <${player1Name}> won't take any perks that are good for battle, but only wants me to tell you that, "You don't even have the qualifications to challenge me here. A filthy slave is your best role to play. Type '/bot submit' now and crawl to my feet, I might be merciful to give you a role as a boot cleaner. You will be so much happy to be the one who can clean the boots from a perfect leg"`, true);
        } else {
            this.log(`dear <${player1Name}>, <${player2Name}> won't take any perks that are good for battle, but only wants me to tell you that, "You don't even have the qualifications to challenge me here. A filthy slave is your best role to play. Type '/bot submit' now and crawl to my feet, I might be merciful to give you a role as a boot cleaner. You will be so much happy to be the one who can clean the boots from a perfect leg"`, false);
        }
    }
}

class BargainPact extends Perk {
    name = "[Bargain Pact]";
    description = "\"Your opponent gains 3 HP, but you gain 4 points.\"";
    icon = "https://i.postimg.cc/KzQk4v23/Screenshot-2025-05-01-233656.png";
    cost = 0;

    effect(player1: number, player2: number, battle: any): void {
        const player1Name = battle.conn.chatRoom.getCharacter(player1)?.Name || "Player1";
        const player2Name = battle.conn.chatRoom.getCharacter(player2)?.Name || "Player2";
        this.log(`${this.name} is executed by ${battle.currentPlayer === player1 ? `<${player1Name}>` : `<${player2Name}>`}`, !(battle.currentPlayer === player1));
        const isPlayer1 = battle.currentPlayer === player1;
        if (isPlayer1) {
            battle.player2Hp += 3;
            battle.player1Points += 4;
            this.log(`<${player2Name}> gained 3 HP from Bargain Pact`, true);
            this.log(`<${player1Name}> gained 4 points from Bargain Pact`, false);
        } else {
            battle.player1Hp += 3;
            battle.player2Points += 4;
            this.log(`<${player1Name}> gained 3 HP from Bargain Pact`, false);
            this.log(`<${player2Name}> gained 4 points from Bargain Pact`, true);
        }
    }
}

class DefenseBoost extends Perk {
    name = "[Defense Boost]";
    description = "\"Permanently increase your defense by 1.\"";
    icon = "https://i.postimg.cc/KzQk4v23/Screenshot-2025-05-01-233656.png";
    cost = 2;

    effect(player1: number, player2: number, battle: any): void {
        const player1Name = battle.conn.chatRoom.getCharacter(player1)?.Name || "Player1";
        const player2Name = battle.conn.chatRoom.getCharacter(player2)?.Name || "Player2";
        this.log(`${this.name} is executed by ${battle.currentPlayer === player1 ? `<${player1Name}>` : `<${player2Name}>`}`, !(battle.currentPlayer === player1));
        
        const isPlayer1 = battle.currentPlayer === player1;
        if (isPlayer1) {
            battle.player1Def += 1;
            battle.player1ActivePerks.set(this.instanceId, { perk: this, rounds: -1 });
            this.log(`<${player1Name}>'s defense increased to ${battle.player1Def}`, false);
        } else {
            battle.player2Def += 1;
            battle.player2ActivePerks.set(this.instanceId, { perk: this, rounds: -1 });
            this.log(`<${player2Name}>'s defense increased to ${battle.player2Def}`, true);
        }
    }
}

class CounterStrike extends Perk {
    name = "[Counter Strike]";
    description = "\"When you take damage, counterattack your opponent for 1 damage, ignoring their defense.\"";
    icon = "https://i.postimg.cc/KzQk4v23/Screenshot-2025-05-01-233656.png";
    cost = 4;
    duration = -1;  //last forever

    effect(player1: number, player2: number, battle: any): void {
        const player1Name = battle.conn.chatRoom.getCharacter(player1)?.Name || "Player1";
        const player2Name = battle.conn.chatRoom.getCharacter(player2)?.Name || "Player2";
        this.log(`${this.name} is executed by ${battle.currentPlayer === player1 ? `<${player1Name}>` : `<${player2Name}>`}`, !(battle.currentPlayer === player1));
        
        const isPlayer1 = battle.currentPlayer === player1;
        if (isPlayer1) {
            battle.player1OnTakenDamage.push((damage: number) => {
                battle.player2Hp -= 1;  // cause 1 damage that ignores defense
                this.log(`<${player1Name}> counterattacked <${player2Name}> for 1 damage`, false);
                this.log(`<${player2Name}> took 1 damage from counterattack`, true);
            });
            battle.player1ActivePerks.set(this.instanceId, { perk: this, rounds: this.duration });
            this.log(`<${player1Name}> is now ready to counterattack`, false);
        } else {
            battle.player2OnTakenDamage.push((damage: number) => {
                battle.player1Hp -= 1;  // cause 1 damage that ignores defense
                this.log(`<${player2Name}> counterattacked <${player1Name}> for 1 damage`, true);
                this.log(`<${player1Name}> took 1 damage from counterattack`, false);
            });
            battle.player2ActivePerks.set(this.instanceId, { perk: this, rounds: this.duration });
            this.log(`<${player2Name}> is now ready to counterattack`, true);
        }
    }
}

class LifeExchange extends Perk {
    name = "[Life Exchange]";
    description = "\"Sacrifice 4 HP to gain 5 points immediately. If HP is less than 4, it will be set to 1 instead.\"";
    icon = "https://i.postimg.cc/KzQk4v23/Screenshot-2025-05-01-233656.png";
    cost = 0;  // no points required, consumes HP

    effect(player1: number, player2: number, battle: any): void {
        const player1Name = battle.conn.chatRoom.getCharacter(player1)?.Name || "Player1";
        const player2Name = battle.conn.chatRoom.getCharacter(player2)?.Name || "Player2";
        this.log(`${this.name} is executed by ${battle.currentPlayer === player1 ? `<${player1Name}>` : `<${player2Name}>`}`, !(battle.currentPlayer === player1));
        
        const isPlayer1 = battle.currentPlayer === player1;
        if (isPlayer1) {
            if (battle.player1Hp > 4) {
                battle.player1Hp -= 4;
                battle.player1Points += 5;
                this.log(`<${player1Name}> sacrificed 4 HP to gain 5 points (HP: ${battle.player1Hp}, Points: ${battle.player1Points})`, false);
            } else {
                const originalHp = battle.player1Hp;
                battle.player1Hp = 1;
                battle.player1Points += 5;
                this.log(`<${player1Name}> sacrificed ${originalHp - 1} HP to gain 5 points (HP: ${battle.player1Hp}, Points: ${battle.player1Points})`, false);
            }
        } else {
            if (battle.player2Hp > 4) {
                battle.player2Hp -= 4;
                battle.player2Points += 5;
                this.log(`<${player2Name}> sacrificed 4 HP to gain 5 points (HP: ${battle.player2Hp}, Points: ${battle.player2Points})`, true);
            } else {
                const originalHp = battle.player2Hp;
                battle.player2Hp = 1;
                battle.player2Points += 5;
                this.log(`<${player2Name}> sacrificed ${originalHp - 1} HP to gain 5 points (HP: ${battle.player2Hp}, Points: ${battle.player2Points})`, true);
            }
        }
    }
}

class FortitudeGamble extends Perk {
    name = "[Fortitude Gamble]";
    description = "\"Your opponent gains 3 points, but you gain 5 HP.\"";
    icon = "https://i.postimg.cc/KzQk4v23/Screenshot-2025-05-01-233656.png";
    cost = 0;

    effect(player1: number, player2: number, battle: any): void {
        const player1Name = battle.conn.chatRoom.getCharacter(player1)?.Name || "Player1";
        const player2Name = battle.conn.chatRoom.getCharacter(player2)?.Name || "Player2";
        this.log(`${this.name} is executed by ${battle.currentPlayer === player1 ? `<${player1Name}>` : `<${player2Name}>`}`, !(battle.currentPlayer === player1));
        const isPlayer1 = battle.currentPlayer === player1;
        if (isPlayer1) {
            battle.player2Points += 3;
            battle.player1Hp += 5;
            this.log(`<${player2Name}> gained 3 points from Fortitude Gamble`, true);
            this.log(`<${player1Name}> gained 5 HP from Fortitude Gamble`, false);
        } else {
            battle.player1Points += 3;
            battle.player2Hp += 5;
            this.log(`<${player1Name}> gained 3 points from Fortitude Gamble`, false);
            this.log(`<${player2Name}> gained 5 HP from Fortitude Gamble`, true);
        }
    }
}

class SoulAbsorbing extends Perk {
    name = "[Soul Absorbing]";
    description = "\"Applies a debuff to your opponent for 3 rounds. Whenever the affected player loses 1 HP, the caster gains 1 point.\"";
    icon = "https://i.postimg.cc/KzQk4v23/Screenshot-2025-05-01-233656.png";
    cost = 6;
    duration = 3;

    effect(player1: number, player2: number, battle: any): void {
        const player1Name = battle.conn.chatRoom.getCharacter(player1)?.Name || "Player1";
        const player2Name = battle.conn.chatRoom.getCharacter(player2)?.Name || "Player2";
        this.log(`${this.name} is executed by ${battle.currentPlayer === player1 ? `<${player1Name}>` : `<${player2Name}>`}`, !(battle.currentPlayer === player1));
        const isPlayer1 = battle.currentPlayer === player1;
        if (isPlayer1) {
            // Apply debuff to player2
            const onDamage = (damage: number) => {
                if (damage > 0) {
                    battle.player1Points += damage;
                    this.log(`<${player1Name}> absorbed ${damage} point(s) from ${player2Name}'s HP loss (Soul Absorbing)`, false);
                }
            };
            // 记录回调和id，便于移除
            const callbackId = `${this.instanceId}_onDamage`;
            if (!battle.player2OnTakenDamageCallbacks) battle.player2OnTakenDamageCallbacks = {};
            battle.player2OnTakenDamageCallbacks[callbackId] = onDamage;
            battle.player2OnTakenDamage.push(onDamage);
            battle.player2ActivePerks.set(this.instanceId, { perk: this, rounds: this.duration, callbackId });
            this.log(`<${player2Name}> is affected by Soul Absorbing for ${this.duration} rounds`, true);
        } else {
            // Apply debuff to player1
            const onDamage = (damage: number) => {
                if (damage > 0) {
                    battle.player2Points += damage;
                    this.log(`<${player2Name}> absorbed ${damage} point(s) from ${player1Name}'s HP loss (Soul Absorbing)`, true);
                }
            };
            const callbackId = `${this.instanceId}_onDamage`;
            if (!battle.player1OnTakenDamageCallbacks) battle.player1OnTakenDamageCallbacks = {};
            battle.player1OnTakenDamageCallbacks[callbackId] = onDamage;
            battle.player1OnTakenDamage.push(onDamage);
            battle.player1ActivePerks.set(this.instanceId, { perk: this, rounds: this.duration, callbackId });
            this.log(`<${player1Name}> is affected by Soul Absorbing for ${this.duration} rounds`, false);
        }
    }

    onRoundStart(player1: number, player2: number, battle: any): void {
        // Remove debuff after duration
        // For player1
        for (const [id, data] of battle.player1ActivePerks.entries()) {
            if (data.perk === this) {
                data.rounds -= 1;
                if (data.rounds <= 0) {
                    // Remove callback
                    if (data.callbackId && battle.player1OnTakenDamageCallbacks && battle.player1OnTakenDamageCallbacks[data.callbackId]) {
                        const cb = battle.player1OnTakenDamageCallbacks[data.callbackId];
                        const idx = battle.player1OnTakenDamage.indexOf(cb);
                        if (idx > -1) battle.player1OnTakenDamage.splice(idx, 1);
                        delete battle.player1OnTakenDamageCallbacks[data.callbackId];
                    }
                    battle.player1ActivePerks.delete(id);
                    this.log(`Soul Absorbing on Player1 has expired`, false);
                }
            }
        }
        // For player2
        for (const [id, data] of battle.player2ActivePerks.entries()) {
            if (data.perk === this) {
                data.rounds -= 1;
                if (data.rounds <= 0) {
                    if (data.callbackId && battle.player2OnTakenDamageCallbacks && battle.player2OnTakenDamageCallbacks[data.callbackId]) {
                        const cb = battle.player2OnTakenDamageCallbacks[data.callbackId];
                        const idx = battle.player2OnTakenDamage.indexOf(cb);
                        if (idx > -1) battle.player2OnTakenDamage.splice(idx, 1);
                        delete battle.player2OnTakenDamageCallbacks[data.callbackId];
                    }
                    battle.player2ActivePerks.delete(id);
                    this.log(`Soul Absorbing on Player2 has expired`, true);
                }
            }
        }
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
                return new IroncladAegis(logger);
            case 7:
                return new HealingPotion(logger);
            case 8:
                return new BloodSacrifice(logger);
            case 9:
                return new AyakosMercy(logger);
            case 10:
                return new DegradingTaunt(logger);
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
            default:
                return null;
        }
    }
}

// // 创建并初始化perksMap
// export const perksMap: Map<number, Perk> = new Map([
//     [1, new BloodBoundPact()],
//     [2, new HealingAura()],
//     [3, new ExamplePerk3()],
//     [4, new ExamplePerk4()],
//     [5, new ExamplePerk5()]
//     // [6, new ExamplePerk6()],
//     // [7, new ExamplePerk7()],
//     // [8, new ExamplePerk8()],
//     // [9, new ExamplePerk9()],
//     // [10, new ExamplePerk10()]
// ]); 