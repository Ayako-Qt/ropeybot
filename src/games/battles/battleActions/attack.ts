import { EventBus } from "../perks/eventBus";

/**
 * Apply damage to a target, emit afterDamage and beforeDeath events as needed.
 * @param battle The battle object
 * @param targetId The player id to receive damage
 * @param amount The base attack value or special damage
 * @param source The source of the damage (e.g. 'normalAttack', 'CounterStrike', etc.)
 * @param attackerId The player id who caused the damage (optional, for message and auto calculation)
 * @param conn The API_Connector instance (optional, for message)
 * @param ignoreDefense If true, ignore defender's defense
 */
export function applyDamage(
    battle: any,
    targetId: number,
    amount: number,
    source: string = "unknown",
    attackerId?: number,
    conn?: any,
    ignoreDefense: boolean = false
) {
    let finalDamage = preCalculateDamage(battle, targetId, amount, source, attackerId, conn, ignoreDefense);
    // Deduct HP
    if (targetId === battle.player1) {
        battle.player1Hp -= finalDamage;
    } else if (targetId === battle.player2) {
        battle.player2Hp -= finalDamage;
    }
    // Emit afterDamage event
    if (battle.eventBus) {
        battle.eventBus.emit({ type: "afterDamage", target: targetId, amount: finalDamage, source });
    }
    // Check for death and emit beforeDeath event if needed
    if ((targetId === battle.player1 && battle.player1Hp <= 0) ||
        (targetId === battle.player2 && battle.player2Hp <= 0)) {
        if (battle.eventBus) {
            const event = { type: "beforeDeath", target: targetId, battle, cancel: false };
            battle.eventBus.emit(event);
            // event.cancel: for checking if the death is prevented by a perk
        }
    }
    
} 

export function preCalculateDamage(
    battle: any,
    targetId: number,
    amount: number,
    source: string = "unknown",
    attackerId?: number,
    conn?: any,
    ignoreDefense: boolean = false
) {
    let finalDamage = amount;
    if (attackerId !== undefined) {
        const attackerAtk = attackerId === battle.player1 ? battle.player1Atk : battle.player2Atk;
        if (ignoreDefense) {
            finalDamage = attackerAtk;
        } else {
            const defenderDef = targetId === battle.player1 ? battle.player1Def : battle.player2Def;
            finalDamage = Math.max(0, attackerAtk - defenderDef);
        }
    }
    return finalDamage;
}