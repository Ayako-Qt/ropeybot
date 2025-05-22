// Event bus for battle system
// Provides a simple publish-subscribe mechanism for battle events

export type BattleEventType =
  | "beforeDamage"
  | "afterDamage"
  | "beforeDeath"
  | "afterDeath"
  | "perkActivated"
  | "perkExpired"
  | "roundStart"
  | "player1StartAction"
  | "player2StartAction"
  | "player1EndAction"
  | "player2EndAction"
  | "roundEnd";

export interface BattleEvent {
  type: BattleEventType;
  target: number; // player id
  amount?: number;
  cancel?: boolean; // for death prevention or event cancellation
  [key: string]: any;
}

type EventHandler = (event: BattleEvent) => void;

export class EventBus {
  private listeners: { [type: string]: EventHandler[] } = {};

  // Register an event handler for a specific event type
  on(type: BattleEventType, handler: EventHandler) {
    if (!this.listeners[type]) this.listeners[type] = [];
    this.listeners[type].push(handler);
  }

  // Emit an event to all registered handlers
  emit(event: BattleEvent) {
    const handlers = this.listeners[event.type] || [];
    for (const handler of handlers) {
      handler(event);
    }
  }

  // Remove an event listener for a specific event type
  off(type: BattleEventType, handler: EventHandler) {
    if (!this.listeners[type]) return;
    this.listeners[type] = this.listeners[type].filter(h => h !== handler);
  }
}
