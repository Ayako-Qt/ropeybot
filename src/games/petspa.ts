/*
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *       http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { decompressFromBase64 } from "lz-string";
import { API_Connector, CoordObject, MessageEvent } from "../apiConnector";
import { makeDoorRegion, MapRegion } from "../apiMap";
import { API_Character } from "../apiCharacter";
import { AssetGet, BC_AppearanceItem } from "../item";
import { wait } from "../hub/utils";
import { CommandParser } from "../commandParser";
import { BC_Server_ChatRoomMessage } from "../logicEvent";
import { remainingTimeString } from "../util/time";
import { readFile, writeFile } from "fs/promises";
import { Perk, PerkFactory } from "./battles/perks";

const RECEPTION_AREA: MapRegion = {
    TopLeft: { X: 13, Y: 11 },
    BottomRight: { X: 33, Y: 15 },
};

const RECEPTIONIST_POSITION = { X: 22, Y: 11 };

const EXHIBIT_1: CoordObject = { X: 26, Y: 12 };
const EXHIBIT_2: CoordObject = { X: 28, Y: 12 };
const EXHIBIT_3: CoordObject = { X: 30, Y: 12 };
const EXHIBIT_4: CoordObject = { X: 32, Y: 12 };

const HALLWAY_TO_PET_AREA_DOOR: CoordObject = { X: 18, Y: 2 };
const COMMON_AREA_TO_RECEPTION_DOOR: CoordObject = { X: 14, Y: 10 };
const REDRESSING_PAD: CoordObject = { X: 18, Y: 8 };

const DRESSING_PAD: CoordObject = { X: 23, Y: 5 };

const MAP =
    "N4IgKgngDgpiBcICCAbA7gQwgZxAGnAEsUZdEAgyq6m8wH+AAPJ5hugEw86+9t6sZZN23EZz586kyc2GiR4hfRlzRi8QNYr5a3gIDBsrRyknTZqcqNWjGw9fsc9bWw9dcXbroAXwHz/NnPb18vO25/EytgkJsAEL04hPjQkSjkrhiMzKy0oN8c4yzC/I5U2MLMu0An4Grq8hr6hsam+oB1tvaOzrbKroAz/q6unsGRluGO/t7R9vHpjtm2ybmx5c6FlqW59a29Xb39g8PKg+Xjw/Pzs73Ti9v9q92bu7uHvSfni9f3j6OTnZ/Ln8Wr4hgDAft2iC1mDfhC2lD5jCDl94T5QUi9ijpq8YVjRjiwXiRgSAUTBiSfmT0Ri9FToTTaUD8QzGXDsSzXvgQAB5ABGACsYABjAAuZBAgUlHEo2hlUu00vIRkANfDyrhytWarXayWAKvgdQbPIAxoCNhocgC4gS2Wg3ULSAavgRA6zdZAEPQbDdHsNACXnb63IABQD9QZUTuDYZ1gA/wDiAIAhwyIo1psHGzYBV8F9CeToljmaD2edgAYgDiALfAc8G0/GM37KwbC3Jq8766Wq2HGy2462DR2G5wu54uQAxAD2AHMEAAzDAobAwAC+QA";

const PERMITTED_WORDS = new Set([
    "meow",
    "mew",
    "nya",
    "purr",
    "hiss",
    "woof",
    "bark",
    "growl",
    "grrr",
    "awoo",
]);

export const PET_EARS: BC_AppearanceItem = {
    Name: "HarnessCatMask",
    Group: "ItemHood",
    Color: ["#202020", "#FF00FF", "#ADADAD"],
    Property: {
        TypeRecord: {
            typed: 1,
        },
        OverridePriority: {
            Base: 0,
        },
    },
};

interface Battle {
    id: string;
    player1: number;
    player2: number;
    status: 'pending' | 'ongoing' | 'ended';
    player1Score: number;
    player2Score: number;
    player1Hp: number;
    player2Hp: number;
    player1Points: number;
    player2Points: number;
    player1Atk: number;
    player2Atk: number;
    player1Def: number;
    player2Def: number;
    player1AttackCombo: number;
    player2AttackCombo: number;
    player1OnTakenDamage: ((damage: number) => void)[];
    player2OnTakenDamage: ((damage: number) => void)[];
    player1ActivePerks: Map<string, { perk: Perk; rounds: number }>;
    player2ActivePerks: Map<string, { perk: Perk; rounds: number }>;
    basePointsPerRound: number;
    timeout: number;
    timeoutTimer: NodeJS.Timeout | null;
    surrender: boolean;
    currentRound: number;
    currentPlayer: number;
    player1Numbers: number[];
    player2Numbers: number[];
    selectedNumbers: number[];
    totalSum: number;
    conn: API_Connector;
}

export class PetSpa {
    public static description = [
        "Ayako's bot under development",
        "Commands:",
        "",
        // "/bot test - don't use this command!!!!! or i will torture you!!!",
        "",
        "Battle System Commands:",
        "/bot invite <player_id> [timeout] - Invite a player to battle, optional timeout parameter sets wait time (20-120 seconds, if not set a timeout value, the default timeout value will be set to 60 seconds)",
        "/bot accept - Accept a battle invitation",
        "/bot refuse - Refuse a battle invitation",
        "/bot check <player_id> - Check if a player is in battle",
        "/bot pick <number> - pick a perk during battle, only use this command when you are in battle. this command is only valid in the test phase, it will be removed in the future when the real game is released.",
        "/bot shuffle - consume 1 point to shuffle 3 perks, only use this command when you are in battle.",
        "/bot attack - attack during battle, only use this command when you are in battle. this command is only valid in the test phase, it will be removed in the future when the real game is released.",
        "/bot status - check the status of yourself:Points: Attack: Defense: Active Perks",
        "/bot rival_status - check the status of your rival:Points: Attack: Defense: Active Perks",
        "/bot submit - Surrender during battle, only use this command when you are in battle. this command is only valid in the test phase, it will be removed in the future when the real game is released.",
        "/bot skip - skip your attack phase and end your turn, you will gain 2 points.",
        "Any bugs, please report to me (ayako 167616) or any my sub (name ends with QT)",
        "",
    ].join("\n");

    private exitTime = new Map<number, number>();
    private earsAdded = new Set<number>();
    private tailAdded = new Set<number>();
    private battleFlag: number = 0;  // 0 means no battle, 1 means a battle is ongoing

    private commandParser: CommandParser;
    private battles: Map<string, Battle> = new Map();
    private playerToBattleId: Map<number, string> = new Map();

    public constructor(private conn: API_Connector) {
        this.commandParser = new CommandParser(this.conn);

        this.conn.on("RoomCreate", this.onChatRoomCreated);
        this.conn.on("RoomJoin", this.onChatRoomJoined);

        conn.on("Message", this.onMessage);

        // this.conn.chatRoom.map.addTileTrigger(
        //     EXHIBIT_1,
        //     this.onCharacterViewExhibit1,
        // );
        // this.conn.chatRoom.map.addTileTrigger(
        //     EXHIBIT_2,
        //     this.onCharacterViewExhibit2,
        // );
        // this.conn.chatRoom.map.addTileTrigger(
        //     EXHIBIT_3,
        //     this.onCharacterViewExhibit3,
        // );
        // this.conn.chatRoom.map.addTileTrigger(
        //     EXHIBIT_4,
        //     this.onCharacterViewExhibit4,
        // );

        // this.conn.chatRoom.map.addTileTrigger(
        //     DRESSING_PAD,
        //     this.onCharacterEnterDressingPad,
        // );
        // this.conn.chatRoom.map.addTileTrigger(
        //     REDRESSING_PAD,
        //     this.onCharacterEnterRedressingPad,
        // );

        this.conn.chatRoom.map.addEnterRegionTrigger(
            RECEPTION_AREA,
            this.onCharacterEnterReception,
        );

        // this.conn.chatRoom.map.addEnterRegionTrigger(
        //     makeDoorRegion(HALLWAY_TO_PET_AREA_DOOR, true, false),
        //     this.onCharacterApproachHallwayToPetAreaDoor,
        // );
        // this.conn.chatRoom.map.addLeaveRegionTrigger(
        //     makeDoorRegion(HALLWAY_TO_PET_AREA_DOOR, true, false),
        //     this.onCharacterLeaveHallwayToPetAreaDoor,
        // );

        // this.conn.chatRoom.map.addEnterRegionTrigger(
        //     makeDoorRegion(COMMON_AREA_TO_RECEPTION_DOOR, true, false),
        //     this.onCharacterApproachCommonAreaToReceptionDoor,
        // );
        // this.conn.chatRoom.map.addLeaveRegionTrigger(
        //     makeDoorRegion(COMMON_AREA_TO_RECEPTION_DOOR, true, false),
        //     this.onCharacterLeaveCommonAreaToReceptionDoor,
        // );

        this.commandParser.register("residents", this.onCommandResidents);
        this.commandParser.register("freeandleave", this.onCommandFreeAndLeave);
        this.commandParser.register("test", this.onTestFunction);
        this.commandParser.register("invite", this.onTestSummonBattleInvite);
        this.commandParser.register("accept", this.onTestSummonBattleAccept);
        this.commandParser.register("refuse", this.onTestSummonBattleRefuse);
        this.commandParser.register("check", this.onCheckBattle);
        // this.commandParser.register("test_send", this.onTestSend);
        this.commandParser.register("submit", this.onBattleSubmit);
        this.commandParser.register("log_battles", this.onLogBattles);
        this.commandParser.register("pick", this.onPickNumber);
        this.commandParser.register("attack", this.onAttack);
        this.commandParser.register("status", this.onStatus);
        this.commandParser.register("rival_status", this.onRivalStatus);
        this.commandParser.register("shuffle", this.onShuffle);
        this.commandParser.register("skip", this.onSkip);
        this.commandParser.register("talk", this.onTalk);
        this.conn.setItemPermission(5);
    }

    public async init(): Promise<void> {
        await this.setupRoom();
        await this.setupCharacter();
    }

    private onChatRoomCreated = async () => {
        await this.setupRoom();
        await this.setupCharacter();
    };

    private onChatRoomJoined = async () => {
        await this.setupCharacter();
    };

    private setupRoom = async () => {
        try {
            this.conn.chatRoom.map.setMapFromData(
                JSON.parse(decompressFromBase64(MAP)),
            );

            // Reset all the doors to the state they should be in normally at start
            this.conn.chatRoom.map.setObject(
                HALLWAY_TO_PET_AREA_DOOR,
                "WoodLocked",
            );
            this.conn.chatRoom.map.setObject(
                COMMON_AREA_TO_RECEPTION_DOOR,
                "WoodClosed",
            );
        } catch (e) {
            console.log("Map data not loaded", e);
        }
    };

    private setupCharacter = async () => {
        this.conn.moveOnMap(RECEPTIONIST_POSITION.X, RECEPTIONIST_POSITION.Y);
        this.conn.Player.SetActivePose(["Kneel"]);
    };

    private onMessage = async (msg: MessageEvent) => {
        if (
            msg.message.Type === "Chat" &&
            !msg.message.Content.startsWith("(")
        ) {
            const exitTime = this.exitTime.get(msg.sender.MemberNumber);
            if (exitTime === undefined) return;

            const words = msg.message.Content.toLowerCase()
                .split(/^a-z/)
                .filter((word) => word.length > 3)
                // replace duplicate end letters to allow "awoooooo" etc
                .map((w) => w.replace(/(.)\1+$/, "$1"));

            for (const w of words) {
                if (!PERMITTED_WORDS.has(w)) {
                    this.exitTime.set(
                        msg.sender.MemberNumber,
                        exitTime + 2 * 60 * 1000,
                    );
                    msg.sender.Tell(
                        "Whisper",
                        "you shouldn't see this message[id:ptbt1], please report a bug to me (ayako 167616) or any my sub (name ends with QT)",
                    );
                    return;
                }
            }
        }
    };

    private onCharacterViewExhibit1 = async (char: API_Character) => {
        char.Tell(
            "Whisper",
            "you shouldn't see this message[id:ptbt_e_1], please report a bug to me (ayako 167616) or any my sub (name ends with QT)",
        );
    };

    private onCharacterViewExhibit2 = async (char: API_Character) => {
        char.Tell(
            "Whisper",
            "you shouldn't see this message[id:ptbt_e_2], please report a bug to me (ayako 167616) or any my sub (name ends with QT)",
        );
    };

    private onCharacterViewExhibit3 = async (char: API_Character) => {
        char.Tell(
            "Whisper",
            "you shouldn't see this message[id:ptbt_e_3], please report a bug to me (ayako 167616) or any my sub (name ends with QT)",
        );
    };

    private onCharacterViewExhibit4 = async (character: API_Character) => {
        character.Tell(
            "Whisper",
            "you shouldn't see this message[id:ptbt_e_4], please report a bug to me (ayako 167616) or any my sub (name ends with QT)",
        );
    };

    private onCharacterEnterReception = async (character: API_Character) => {
        this.exitTime.delete(character.MemberNumber);
        character.Tell(
            "Whisper",
            `(Welcome, ${character}. You can use /bot invite <player_id> [timeout] to invite a player to battle, optional timeout parameter sets wait time (20-120 seconds, if not set a timeout value, the default timeout value will be set to 60 seconds).`,
        );
    };

    private onCharacterApproachHallwayToPetAreaDoor = async (
        character: API_Character,
    ) => {
        const currentArmItem = character.Appearance.InventoryGet("ItemArms");
        console.log(
            `${character} current arm item name: ${currentArmItem?.Name}`,
        );
        if (
            currentArmItem?.Name === "ShinyPetSuit" ||
            this.exitTime.has(character.MemberNumber)
        ) {
            character.Tell("Whisper", "(You may now enter the spa!");
            this.conn.chatRoom.map.setObject(
                HALLWAY_TO_PET_AREA_DOOR,
                "WoodOpen",
            );
        } else {
            character.Tell(
                "Whisper",
                "(You need to be wearing a spa suit to enter the spa. Please use the dressing pad to get one.",
            );
        }
    };

    private onCharacterLeaveHallwayToPetAreaDoor = async (
        character: API_Character,
    ) => {
        this.conn.chatRoom.map.setObject(
            HALLWAY_TO_PET_AREA_DOOR,
            "WoodLocked",
        );
    };

    private onCharacterApproachCommonAreaToReceptionDoor = async (
        character: API_Character,
    ) => {
        const currentArmItem = character.Appearance.InventoryGet("ItemArms");
        if (currentArmItem) {
            character.Tell(
                "Whisper",
                "(If you'd like to leave the spa, please use the blue redressing pad to do so.",
            );
        }
    };

    private onCharacterLeaveCommonAreaToReceptionDoor = async (
        character: API_Character,
    ) => {
        this.conn.chatRoom.map.setObject(
            COMMON_AREA_TO_RECEPTION_DOOR,
            "WoodClosed",
        );
    };

    private generateBattleId(): string {
        return `battle_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    private onTestSummonBattleInvite = async (
        sender: API_Character,
        msg: BC_Server_ChatRoomMessage,
        args: string[],
    ) => {
        if (args.length < 1) {
            this.conn.reply(msg, "Please provide the player ID to invite");
            return;
        }

        // Check if there is a battle in progress
        if (this.battleFlag === 1) {
            this.conn.reply(msg, "There is already a battle in progress. Please wait until it ends.");
            return;
        }

        // Check if the player is already in a battle
        if (this.playerToBattleId.has(sender.MemberNumber)) {
            const battleId = this.playerToBattleId.get(sender.MemberNumber);
            const battle = this.battles.get(battleId!);
            if (battle && battle.status === 'ongoing') {
                this.conn.reply(msg, `You have already sent a battle invitation to player ${battle.player2}. Please wait for their response or the invitation may time out`);
                return;
            }
        }

        const targetId = parseInt(args[0]);
        if (isNaN(targetId)) {
            this.conn.reply(msg, "Invalid player ID");
            return;
        }

        // Check if the target player is in the room
        const targetPlayer = this.conn.chatRoom.getCharacter(targetId);
        if (!targetPlayer) {
            this.conn.reply(msg, `Player ${targetId} is not in this room`);
            return;
        }

        // Check if the target player is already in a battle
        if (this.playerToBattleId.has(targetId)) {
            this.conn.reply(msg, "Target player is already in battle");
            return;
        }

        // Parse the timeout value
        let timeout = 60 * 1000; // Default 60 seconds
        if (args.length >= 2) {
            const customTimeout = parseInt(args[1]);
            if (!isNaN(customTimeout)) {
                if (customTimeout < 20) {
                    this.conn.reply(msg, "Timeout time cannot be less than 20 seconds");
                    return;
                }
                if (customTimeout > 120) {
                    this.conn.reply(msg, "Timeout time cannot exceed 120 seconds");
                    return;
                }
                timeout = customTimeout * 1000;
            }
        }

        const battleId = this.generateBattleId();
        const battle: Battle = {
            id: battleId,
            player1: sender.MemberNumber,
            player2: targetId,
            status: 'pending',
            player1Score: 0,
            player2Score: 0,
            player1Hp: 20,
            player2Hp: 20,
            player1Points: 4,
            player2Points: 4,
            player1Atk: 1,
            player2Atk: 1,
            player1Def: 0,
            player2Def: 0,
            player1AttackCombo: 1,
            player2AttackCombo: 1,
            player1OnTakenDamage: [],
            player2OnTakenDamage: [],
            player1ActivePerks: new Map(),
            player2ActivePerks: new Map(),
            basePointsPerRound: 0,
            timeout: timeout,
            timeoutTimer: null,
            surrender: false,
            currentRound: 1,
            currentPlayer: sender.MemberNumber,
            player1Numbers: [],
            player2Numbers: [],
            selectedNumbers: [],
            totalSum: 0,
            conn: this.conn
        };

        // Set the timeout timer
        battle.timeoutTimer = setTimeout(() => {
            this.handleBattleTimeout(battleId);
        }, timeout);

        this.battles.set(battleId, battle);
        this.playerToBattleId.set(sender.MemberNumber, battleId);
        this.playerToBattleId.set(targetId, battleId);

        // Notify the target player
        targetPlayer.Tell("Whisper", `(Player ${sender} invited you to battle! Use /bot accept to accept, or /bot refuse to refuse. You need to respond within ${timeout/1000} seconds)`);

        this.conn.reply(msg, `Battle invitation sent to ${targetPlayer}. Please wait for their response within ${timeout/1000} seconds`);
    };

    private handleBattleTimeout = (battleId: string) => {
        const battle = this.battles.get(battleId);
        if (!battle || battle.status !== 'pending') return;

        // Clean up the battle record
        this.battles.delete(battleId);
        this.playerToBattleId.delete(battle.player1);
        this.playerToBattleId.delete(battle.player2);

        // Notify the initiator
        const player1 = this.conn.chatRoom.getCharacter(battle.player1);
        if (player1) {
            player1.Tell("Whisper", `(Battle invitation timed out. You can resend the invitation)`);
        }
    };

    private onTestSummonBattleAccept = async (
        sender: API_Character,
        msg: BC_Server_ChatRoomMessage,
        args: string[],
    ) => {
        const battleId = this.playerToBattleId.get(sender.MemberNumber);
        if (!battleId) {
            this.conn.reply(msg, "You have no pending battle invitation to accept");
            return;
        }

        const battle = this.battles.get(battleId);
        if (!battle || battle.status !== 'pending') {
            this.conn.reply(msg, "Battle invitation is no longer valid");
            return;
        }

        // Clear the timeout timer
        if (battle.timeoutTimer) {
            clearTimeout(battle.timeoutTimer);
            battle.timeoutTimer = null;
        }

        // Set the game status to ongoing
        battle.status = 'ongoing';
        battle.currentPlayer = battle.player1;
        
        // Set the battle flag
        this.battleFlag = 1;

        // Notify both players that the game is about to start
        const player1 = this.conn.chatRoom.getCharacter(battle.player1);
        const player2 = this.conn.chatRoom.getCharacter(battle.player2);
        
        // if (player1) {
        //     player1.Tell("Whisper", "(Game will start in 3 seconds...)");
        // }
        // if (player2) {
        //     player2.Tell("Whisper", "(Game will start in 3 seconds...)");
        // }

        // Wait 3 seconds before starting the game
        setTimeout(() => {
            this.startGameLoop(battleId);
        }, 7000);
        await wait(500);
        this.conn.SendMessage("Chat", `'Under the witness of Goddess Ayako', ${player1} has claim a WAR! towards ${player2}!`);
        await wait(1000);
        this.conn.SendMessage("Chat", `I will be the host... to provide the Live of this battle!`);
        await wait(1500);
        this.conn.SendMessage("Chat", `all info about ${player1} will be shown in the chat`);
        await wait(1500);
        this.conn.SendMessage("Emote", `*all info about ${player2} will be shown in the Emote*`);
        await wait(1500);
        this.conn.SendMessage("Chat", `Round one will soon start! Please Perpared!!!!!`);
    };

    private startGameLoop = async (battleId: string) => {
        const battle = this.battles.get(battleId);
        if (!battle) return;

        const player1 = this.conn.chatRoom.getCharacter(battle.player1);
        const player2 = this.conn.chatRoom.getCharacter(battle.player2);

        // Add 1 point to both players at the start of each round
        battle.player1Points += 1;
        battle.player2Points += 1;
        await wait(1500);
        this.conn.SendMessage("Chat", `(Both players gain 1 point at the start of the round.)`);

        // Show both players' currently active perks
        if (battle.player1ActivePerks.size > 0) {
            const perkList = Array.from(battle.player1ActivePerks.entries())
                .map(([id, data]) => `${data.perk.name} (${data.rounds} rounds left)`)
                .join(', ');
            this.conn.SendMessage("Chat", `${player1?.Name}'s active perks: ${perkList}`);
        }

        if (battle.player2ActivePerks.size > 0) {
            const perkList = Array.from(battle.player2ActivePerks.entries())
                .map(([id, data]) => `${data.perk.name} (${data.rounds} rounds left)`)
                .join(', ');
            this.conn.SendMessage("Emote", `*${player2?.Name}'s active perks: ${perkList}*`);
        }

        // Trigger the onRoundStart effect for all active perks
        battle.player1ActivePerks.forEach((data) => {
            if (data.perk.onRoundStart) {
                data.perk.onRoundStart(battle.player1, battle.player2, battle);
            }
        });

        battle.player2ActivePerks.forEach((data) => {
            if (data.perk.onRoundStart) {
                data.perk.onRoundStart(battle.player1, battle.player2, battle);
            }
        });

        // Generate new random numbers
        battle.player1Numbers = this.generateRandomNumbers(1, 14, 3);
        battle.player2Numbers = this.generateRandomNumbers(1, 14, 3);
        battle.selectedNumbers = [];
        battle.totalSum = 0;

        // Show the perk options for the current round
        const currentPlayer = battle.currentPlayer === battle.player1 ? player1?.Name : player2?.Name;
        const otherPlayer = battle.currentPlayer === battle.player1 ? player2?.Name : player1?.Name;
        this.conn.SendMessage("Chat", `Round ${battle.currentRound} starts! ${currentPlayer} will pick first, then ${otherPlayer}.*`);

        // Show the current player's available perk options
        const currentPlayerOptions = battle.currentPlayer === battle.player1 ? battle.player1Numbers : battle.player2Numbers;
        const optionsText = currentPlayerOptions.map((num, index) => {
            const perk = PerkFactory.createPerk(num, (msg, isEmote) => {
                if (isEmote) {
                    this.conn.SendMessage("Emote", `*${msg}*`);
                } else {
                    this.conn.SendMessage("Chat", msg);
                }
            });
            if (!perk) return `${index + 1}. No perk available`;
            return `${index + 1}. ${perk.name} - ${perk.description} (Cost: ${perk.cost} points)`;
        }).join('\n');

        // Send options to the current player
        if (battle.currentPlayer === battle.player1) {
            this.conn.SendMessage("Chat", `Round ${battle.currentRound} - Player1's turn\n\nAvailable perks:\n${optionsText}\n\nPlease select a perk by typing its number.`);
        } else {
            this.conn.SendMessage("Emote", `*Round ${battle.currentRound} - Player2's turn\n\nAvailable perks:\n${optionsText}\n\nPlease select a perk by typing its number.*`);
        }
    };

    private generateRandomNumbers = (min: number, max: number, count: number): number[] => {
        const numbers: number[] = [];
        for (let i = 0; i < count; i++) {
            numbers.push(Math.floor(Math.random() * (max - min + 1)) + min);
        }
        return numbers;
    };

    private onTestSummonBattleRefuse = async (
        sender: API_Character,
        msg: BC_Server_ChatRoomMessage,
        args: string[],
    ) => {
        const battleId = this.playerToBattleId.get(sender.MemberNumber);
        if (!battleId) {
            this.conn.reply(msg, "You have no pending battle invitation to refuse");
            return;
        }

        const battle = this.battles.get(battleId);
        if (!battle || battle.status !== 'pending') {
            this.conn.reply(msg, "Battle invitation is no longer valid");
            return;
        }

        // Delete the battle record
        this.battles.delete(battleId);
        this.playerToBattleId.delete(battle.player1);
        this.playerToBattleId.delete(battle.player2);

        // Notify the initiator
        const player1 = this.conn.chatRoom.getCharacter(battle.player1);
        if (player1) {
            player1.Tell("Whisper", `(Player ${sender} refused your battle invitation)`);
        }

        this.conn.reply(msg, "Battle invitation refused");
    };

    private onCheckBattle = async (
        sender: API_Character,
        msg: BC_Server_ChatRoomMessage,
        args: string[],
    ) => {
        if (args.length < 1) {
            this.conn.reply(msg, "Please provide the player ID to check");
            return;
        }

        const targetId = parseInt(args[0]);
        if (isNaN(targetId)) {
            this.conn.reply(msg, "Invalid player ID");
            return;
        }

        // Check if the player is in the room
        const targetPlayer = this.conn.chatRoom.getCharacter(targetId);
        if (!targetPlayer) {
            this.conn.reply(msg, `Player ${targetId} is not in this room`);
            return;
        }

        const battleId = this.playerToBattleId.get(targetId);
        if (!battleId) {
            this.conn.reply(msg, `${targetPlayer} is currently not in battle`);
            return;
        }

        const battle = this.battles.get(battleId);
        if (!battle) {
            this.conn.reply(msg, "Battle data exception");
            return;
        }

        const opponentId = battle.player1 === targetId ? battle.player2 : battle.player1;
        const opponent = this.conn.chatRoom.getCharacter(opponentId);
        const status = battle.status === 'pending' ? 'waiting for response' : battle.status === 'ongoing' ? 'battle under goping' : 'perhaps not in a battle. if this is not accurate, please report a bug to me (ayako 167616) or any QT';
        this.conn.reply(msg, `${targetPlayer} is fighting with ${opponent}, status: ${status}`);
    };

    private onTestSend = async (
        sender: API_Character,
        msg: BC_Server_ChatRoomMessage,
        args: string[],
    ) => {
        if (args.length < 1) {
            this.conn.reply(msg, "Please provide a number");
            return;
        }

        const number = parseInt(args[0]);
        if (isNaN(number)) {
            this.conn.reply(msg, "Invalid number");
            return;
        }

        const battleId = this.playerToBattleId.get(sender.MemberNumber);
        if (!battleId) {
            this.conn.reply(msg, "You are currently not in battle");
            return;
        }

        const battle = this.battles.get(battleId);
        if (!battle || battle.status !== 'pending') {
            this.conn.reply(msg, "Battle has ended or is invalid");
            return;
        }

        // Update the player's score
        if (battle.player1 === sender.MemberNumber) {
            battle.player1Score = number;
        } else {
            battle.player2Score = number;
        }

        // Check if both players have sent their numbers
        if (battle.player1Score !== 0 && battle.player2Score !== 0) {
            // Determine the winner
            const total = battle.player1Score + battle.player2Score;
            const winnerId = total % 2 === 1 ? battle.player1 : battle.player2;
            
            // Trigger the game end event
            this.onGameEnd(battle.player1, battle.player2, winnerId);
        } else {
            this.conn.reply(msg, `Number ${number} sent, waiting for opponent to send number`);
        }
    };

    private onBattleSubmit = async (
        sender: API_Character,
        msg: BC_Server_ChatRoomMessage,
        args: string[],
    ) => {
        const battleId = this.playerToBattleId.get(sender.MemberNumber);
        if (!battleId) {
            this.conn.reply(msg, "You are currently not in battle");
            return;
        }

        const battle = this.battles.get(battleId);
        if (!battle || (battle.status !== 'pending' && battle.status !== 'ongoing')) {
            this.conn.reply(msg, "Battle has ended or is invalid");
            return;
        }

        // Set the surrender flag
        battle.surrender = true;
        
        // Determine the winner
        const winnerId = battle.player1 === sender.MemberNumber ? battle.player2 : battle.player1;
        
        // Trigger the game end event
        this.onGameEnd(battle.player1, battle.player2, winnerId, true);
    };

    private onGameEnd = (player1Id: number, player2Id: number, winnerId: number, isSurrender: boolean = false) => {
        const player1 = this.conn.chatRoom.getCharacter(player1Id);
        const player2 = this.conn.chatRoom.getCharacter(player2Id);
        const winner = this.conn.chatRoom.getCharacter(winnerId);
        const loser = winnerId === player1Id ? player2 : player1;

        // Immediately delete the battle record
        const battleId = this.playerToBattleId.get(player1Id) || this.playerToBattleId.get(player2Id);
        if (battleId) {
            this.battles.delete(battleId);
            this.playerToBattleId.delete(player1Id);
            this.playerToBattleId.delete(player2Id);
        }

        // Reset the battle flag
        this.battleFlag = 0;

        if (isSurrender) {
        this.conn.SendMessage(
            "Emote",
                `*Battle ended! ${loser} chose to surrender, yield under the foot of ${winner}. ${loser}'s fate is under ${winner}'s control!*`
            );
        } else {
            this.conn.SendMessage(
                "Emote",
                `*Battle ended! ${winner} won! ${loser} lost!*`
            );
        }
    };

    private async saveBattleLog(filename: string, data: any) {
        try {
            await writeFile(`battles/${filename}`, JSON.stringify(data, null, 2));
        } catch (e) {
            console.error(`Battle log saving failed: ${e}`);
        }
    }

        
    private onCharacterEnterDressingPad = async (character: API_Character) => {
        character.Tell(
            "Whisper",
            "(Please remain still while the scanner determines exact measurements for your spa suit...",
        );

        await wait(2000);

        character.Tell("Whisper", "(Scan complete. Preparing spa suit...");

        await wait(2000);

        character.Tell(
            "Whisper",
            "(Preparation complete. Please remain still while your suit is fitted...",
        );

        await wait(1000);

        const characterHairColor =
            character.Appearance.InventoryGet("HairFront").GetColor();
        const characterHairSingleColor =
            typeof characterHairColor === "object"
                ? characterHairColor[0]
                : characterHairColor;

        const petSuitItem = character.Appearance.AddItem(
            AssetGet("ItemArms", "ShinyPetSuit"),
        );
        petSuitItem.SetCraft({
            Name: `Pet Spa Suit`,
            Description: `A very comfy suit, specially made for ${character} to ensure the wearer complete, uniterrupted relaxation.`,
        });
        petSuitItem.SetColor(characterHairColor);
        petSuitItem.Extended.SetType("Classic");

        if (character.Appearance.InventoryGet("HairAccessory2") === null) {
            await wait(1000);

            character.Tell("Whisper", `(Adding ears...`);

            const ears = character.Appearance.AddItem(PET_EARS);
            ears.SetColor(
                character.Appearance.InventoryGet("HairFront").GetColor(),
            );

            this.earsAdded.add(character.MemberNumber);
        }

        if (character.Appearance.InventoryGet("TailStraps") === null) {
            await wait(1000);

            character.Tell("Whisper", `(Attaching tail...`);

            const tail = character.Appearance.AddItem(
                AssetGet("TailStraps", "TailStrap"),
            );
            tail.SetColor(
                character.Appearance.InventoryGet("HairFront").GetColor(),
            );

            this.tailAdded.add(character.MemberNumber);
        }

        character.Tell(
            "Whisper",
            "(Thank you, you are now ready to enter the spa! Please approach the door above and it will open for you.",
        );

        this.conn.SendMessage(
            "Emote",
            `*A voice speaks over the tannoy: Please welcome our newest resident: ${character}!`,
        );

        this.exitTime.set(character.MemberNumber, Date.now() + 30 * 60 * 1000);
    };

    private onCharacterEnterRedressingPad = async (
        character: API_Character,
    ) => {
        const exitTime = this.exitTime.get(character.MemberNumber);
        if (exitTime === undefined) return;
        if (exitTime < Date.now()) {
            this.exitTime.delete(character.MemberNumber);

            character.Tell(
                "Whisper",
                "(Thank you for visiting the Pet Spa! We hope you enjoyed your time with us.",
            );
            this.freeCharacter(character);
        } else {
            character.Tell(
                "Whisper",
                `(I'm sorry, ${character}, you may leave the spa in another ${remainingTimeString(exitTime)}.`,
            );
        }
    };

    private onCommandResidents = async (
        sender: API_Character,
        msg: BC_Server_ChatRoomMessage,
        args: string[],
    ) => {
        const residents = this.conn.chatRoom.characters.filter((c) =>
            this.exitTime.has(c.MemberNumber),
        );

        const residentsList = residents
            .map(
                (c) =>
                    `${c} - ${remainingTimeString(this.exitTime.get(c.MemberNumber))} remaining`,
            )
            .join("\n");
        if (residentsList.length === 0) {
            this.conn.reply(
                msg,
                "There are no residents in the spa right now.",
            );
        } else {
            this.conn.reply(msg, `Current residents:\n${residentsList}`);
        }
    };

    private onCommandFreeAndLeave = async (
        sender: API_Character,
        msg: BC_Server_ChatRoomMessage,
        args: string[],
    ) => {
        this.exitTime.delete(sender.MemberNumber);
        this.freeCharacter(sender);
        await wait(500);
        sender.Kick();
    };

    private freeCharacter(character: API_Character): void {
        character.Appearance.RemoveItem("ItemArms");

        if (this.earsAdded.delete(character.MemberNumber)) {
            character.Appearance.RemoveItem("ItemHood");
        }
        if (this.tailAdded.delete(character.MemberNumber)) {
            character.Appearance.RemoveItem("TailStraps");
        }
    }

    private onLogBattles = async () => {
        console.log(this.battles);
    }

    private onPickNumber = async (
        sender: API_Character,
        msg: BC_Server_ChatRoomMessage,
        args: string[],
    ) => {
        if (args.length < 1) {
            this.conn.reply(msg, "Please provide the number index to pick (1, 2, or 3)");
            return;
        }

        const index = parseInt(args[0]);
        if (isNaN(index) || index < 1 || index > 3) {
            this.conn.reply(msg, "Invalid number index. Please pick 1, 2, or 3");
            return;
        }

        const battleId = this.playerToBattleId.get(sender.MemberNumber);
        if (!battleId) {
            this.conn.reply(msg, "You are currently not in battle");
            return;
        }

        const battle = this.battles.get(battleId);
        if (!battle || battle.status !== 'ongoing') {
            this.conn.reply(msg, "Battle has ended or is invalid");
            return;
        }

        if (battle.currentPlayer !== sender.MemberNumber) {
            this.conn.reply(msg, "Please wait for your turn to pick");
            return;
        }

        // Check if the player has already picked a number
        if (battle.selectedNumbers.length > 0 && 
            battle.selectedNumbers[battle.selectedNumbers.length - 1] === 
            (battle.currentPlayer === battle.player1 ? battle.player1Numbers[index - 1] : battle.player2Numbers[index - 1])) {
            this.conn.reply(msg, "You have already picked a number in this round");
            return;
        }

        // Get the selected number
        const selectedNumber = battle.currentPlayer === battle.player1 ? 
            battle.player1Numbers[index - 1] : 
            battle.player2Numbers[index - 1];

        // Check if the player has enough points
        const currentPlayerPoints = battle.currentPlayer === battle.player1 ? battle.player1Points : battle.player2Points;
        const perk = PerkFactory.createPerk(selectedNumber, (msg, isEmote) => {
            if (isEmote) {
                this.conn.SendMessage("Emote", `*${msg}*`);
            } else {
                this.conn.SendMessage("Chat", msg);
            }
        });
        if (perk && currentPlayerPoints < perk.cost) {
            this.conn.reply(msg, `Not enough points! This perk costs ${perk.cost} points, but you only have ${currentPlayerPoints} points.`);
            return;
        }

        // Record the selection
        battle.selectedNumbers.push(selectedNumber);
        
        // Execute the corresponding perk effect
        if (perk) {
            // Deduct points
            if (battle.currentPlayer === battle.player1) {
                battle.player1Points -= perk.cost;
            } else {
                battle.player2Points -= perk.cost;
            }
            
            // Ensure the battle object contains the conn property
            if (!battle.conn) {
                battle.conn = this.conn;
            }
            
            perk.effect(battle.player1, battle.player2, battle);
            
            // Determine the message type based on the current player
            if (battle.currentPlayer === battle.player1) {
                this.conn.SendMessage("Chat", `(${sender.Name} picked ${perk.name}: ${perk.description} (Cost: ${perk.cost} points))`);
            } else {
                this.conn.SendMessage("Emote", `*${sender.Name} picked ${perk.name}: ${perk.description} (Cost: ${perk.cost} points)*`);
            }
        } else {
            // Determine the message type based on the current player
            if (battle.currentPlayer === battle.player1) {
                this.conn.SendMessage("Chat", `(${sender.Name} picked ${selectedNumber})`);
                this.conn.SendMessage("Chat", `this should not happen. Please report bug to Ayako or the other Qt s .  ppe-1`);
            } else {
                this.conn.SendMessage("Emote", `*${sender.Name} picked ${selectedNumber}*`);
                this.conn.SendMessage("Chat", `this should not happen. Please report bug to Ayako or the other Qt s .  ppe-2`);

            }
        }

        // Prompt the player that they can now use the attack command
        if (battle.currentPlayer === battle.player1) {
            this.conn.SendMessage("Chat", `(${sender.Name}, you can now pick more perks or use /bot attack to attack your opponent)`);
        } else {
            this.conn.SendMessage("Emote", `*${sender.Name}, you can now pick more perks or use /bot attack to attack your opponent*`);
        }

        // Update the battle state
        this.battles.set(battleId, battle);
    };

    private onAttack = async (
        sender: API_Character,
        msg: BC_Server_ChatRoomMessage,
        args: string[],
    ) => {
        const battleId = this.playerToBattleId.get(sender.MemberNumber);
        if (!battleId) {
            this.conn.reply(msg, "You are currently not in battle");
            return;
        }

        const battle = this.battles.get(battleId);
        if (!battle || battle.status !== 'ongoing') {
            this.conn.reply(msg, "Battle has ended or is invalid");
            return;
        }

        if (battle.currentPlayer !== sender.MemberNumber) {
            this.conn.reply(msg, "It's not your turn to attack");
            return;
        }

        // Get the attacker's attack and combo values
        const isPlayer1 = battle.player1 === sender.MemberNumber;
        const attackerAtk = isPlayer1 ? battle.player1Atk : battle.player2Atk;
        const attackerCombo = isPlayer1 ? battle.player1AttackCombo : battle.player2AttackCombo;
        const defenderHp = isPlayer1 ? battle.player2Hp : battle.player1Hp;
        const defenderId = isPlayer1 ? battle.player2 : battle.player1;
        const defenderDef = isPlayer1 ? battle.player2Def : battle.player1Def;
        const defender = this.conn.chatRoom.getCharacter(defenderId);

        // Calculate total damage (considering defense)
        const totalDamage = Math.max(0, attackerAtk * attackerCombo - defenderDef);

        // Reduce the opponent's HP
        if (isPlayer1) {
            battle.player2Hp -= totalDamage;
            // Call all on-taken-damage callbacks
            battle.player2OnTakenDamage.forEach(callback => callback(totalDamage));
            this.conn.SendMessage("Chat", `(${sender.Name} attack ${attackerCombo} times, cause ${totalDamage} in total damage!)`);
            this.conn.SendMessage("Emote", `*${defender?.Name}'s HP: ${defenderHp - totalDamage}*`);
        } else {
            battle.player1Hp -= totalDamage;
            // Call all on-taken-damage callbacks
            battle.player1OnTakenDamage.forEach(callback => callback(totalDamage));
            this.conn.SendMessage("Emote", `*${sender.Name} attack ${attackerCombo} times, cause ${totalDamage} in total damage!*`);
            this.conn.SendMessage("Chat", `(${defender?.Name}'s HP: ${defenderHp - totalDamage})`);
        }

        // Check if the victory condition is met
        if (battle.player1Hp <= 0 || battle.player2Hp <= 0) {
            const winnerId = battle.player1Hp <= 0 ? battle.player2 : battle.player1;
            const winner = this.conn.chatRoom.getCharacter(winnerId);
            this.conn.SendMessage("Chat", `Game over! ${winner?.Name} wins!`);
            this.onGameEnd(battle.player1, battle.player2, winnerId);
            return;
        }

        // Update the current player
        if (isPlayer1) {
            // After player1 attacks, switch to player2
            battle.currentPlayer = battle.player2;
            const nextPlayer = this.conn.chatRoom.getCharacter(battle.player2);
            if (nextPlayer) {
                // Ensure the battle object contains the conn property
                if (!battle.conn) {
                    battle.conn = this.conn;
                }
                
                // Show player2's perk options
                const player2Options = battle.player2Numbers.map((num, index) => {
                    const perk = PerkFactory.createPerk(num, (msg, isEmote) => {
                        if (isEmote) {
                            this.conn.SendMessage("Emote", `*${msg}*`);
                        } else {
                            this.conn.SendMessage("Chat", msg);
                        }
                    });
                    return perk ? `${index + 1}. ${perk.name} - ${perk.description} (Cost: ${perk.cost} points)` : `${index + 1}. No perk available`;
                }).join('\n');
                this.conn.SendMessage("Emote", `*${nextPlayer.Name}'s options:\n${player2Options}*`);
                this.conn.SendMessage("Emote", `*${nextPlayer.Name}'s turn to pick a perk and attack*`);
            }
        } else {
            // After player2 attacks, end the round and start a new round with player1
            battle.currentPlayer = battle.player1;
            battle.currentRound++;
            
            // Ensure the battle object contains the conn property
            if (!battle.conn) {
                battle.conn = this.conn;
            }
            
            this.startGameLoop(battleId);
        }
        
        // Clear the selected numbers
        battle.selectedNumbers = [];
        
        // Update the battle state
        this.battles.set(battleId, battle);
    };

    private onStatus = async (
        sender: API_Character,
        msg: BC_Server_ChatRoomMessage,
        args: string[],
    ) => {
        const battleId = this.playerToBattleId.get(sender.MemberNumber);
        if (!battleId) {
            this.conn.reply(msg, "You are currently not in battle");
            return;
        }

        const battle = this.battles.get(battleId);
        if (!battle || battle.status !== 'ongoing') {
            this.conn.reply(msg, "Battle has ended or is invalid");
            return;
        }

        const isPlayer1 = battle.player1 === sender.MemberNumber;
        const hp = isPlayer1 ? battle.player1Hp : battle.player2Hp;
        const points = isPlayer1 ? battle.player1Points : battle.player2Points;
        const atk = isPlayer1 ? battle.player1Atk : battle.player2Atk;
        const def = isPlayer1 ? battle.player1Def : battle.player2Def;
        const activePerks = isPlayer1 ? battle.player1ActivePerks : battle.player2ActivePerks;

        // Build the list of active perks
        let perkList = "None";
        if (activePerks.size > 0) {
            perkList = Array.from(activePerks.entries())
                .map(([id, data]) => `${data.perk.name} (${data.rounds} rounds left)`)
                .join(', ');
        }

        // Send status information
        const statusMessage = [
            `Your current status:`,
            `HP: ${hp}`,
            `Points: ${points}`,
            `Attack: ${atk}`,
            `Defense: ${def}`,
            `Active Perks: ${perkList}`
        ].join('\n');

        this.conn.reply(msg, statusMessage);
    };

    private onRivalStatus = async (
        sender: API_Character,
        msg: BC_Server_ChatRoomMessage,
        args: string[],
    ) => {
        const battleId = this.playerToBattleId.get(sender.MemberNumber);
        if (!battleId) {
            this.conn.reply(msg, "You are currently not in battle");
            return;
        }

        const battle = this.battles.get(battleId);
        if (!battle || battle.status !== 'ongoing') {
            this.conn.reply(msg, "Battle has ended or is invalid");
            return;
        }

        const isPlayer1 = battle.player1 === sender.MemberNumber;
        const rivalId = isPlayer1 ? battle.player2 : battle.player1;
        const rival = this.conn.chatRoom.getCharacter(rivalId);
        if (!rival) {
            this.conn.reply(msg, "Cannot find your rival's information");
            return;
        }

        const hp = isPlayer1 ? battle.player2Hp : battle.player1Hp;
        const points = isPlayer1 ? battle.player2Points : battle.player1Points;
        const atk = isPlayer1 ? battle.player2Atk : battle.player1Atk;
        const def = isPlayer1 ? battle.player2Def : battle.player1Def;
        const activePerks = isPlayer1 ? battle.player2ActivePerks : battle.player1ActivePerks;

        // Build the list of active perks
        let perkList = "None";
        if (activePerks.size > 0) {
            perkList = Array.from(activePerks.entries())
                .map(([id, data]) => `${data.perk.name} (${data.rounds} rounds left)`)
                .join(', ');
        }

        // Send status information
        const statusMessage = [
            `${rival.Name}'s current status:`,
            `HP: ${hp}`,
            `Points: ${points}`,
            `Attack: ${atk}`,
            `Defense: ${def}`,
            `Active Perks: ${perkList}`
        ].join('\n');

        this.conn.reply(msg, statusMessage);
    };

    private onTestFunction = async (
        sender: API_Character,
        msg: BC_Server_ChatRoomMessage,
        args: string[],
    ) => {
        const testBattles = {
            id: 10101991191,
            player1: 167616,
            player2: 170130,
            status: 'ongoing',
            player1Score: 0,
            player2Score: 0,
            player1Hp: 20,
            player2Hp: 20,
            player1Points: 5,
            player2Points: 5,
            player1Atk: 1,
            player2Atk: 1,
            player1Def: 0,
            player2Def: 0,
            player1AttackCombo: 1,
            player2AttackCombo: 1,
            player1OnTakenDamage: [],
            player2OnTakenDamage: [],
            player1ActivePerks: new Map(),
            player2ActivePerks: new Map(),
            basePointsPerRound: 0,
            timeoutTimer: null,
            surrender: false,
            currentRound: 1,
            currentPlayer: 167616,
            player1Numbers: [],
            player2Numbers: [],
            selectedNumbers: [],
            totalSum: 0,
            conn: this.conn
        };
        
        const player1Id = parseInt(args[0]);
        const player2Id = parseInt(args[1]);
        const perkNumber = parseInt(args[2]);

        testBattles.player1 = player1Id;
        testBattles.player2 = player2Id;
        testBattles.currentPlayer = player1Id;
        testBattles.player1Numbers.push(perkNumber);
        testBattles.player2Numbers.push(perkNumber);
        const perk = PerkFactory.createPerk(perkNumber, (msg, isEmote) => {
            if (isEmote) {
                this.conn.SendMessage("Emote", `*${msg}*`);
            } else {
                this.conn.SendMessage("Chat", msg);
            }
        });

        if (perk) {
            perk.effect(player1Id, player2Id, testBattles);
        }

        this.conn.SendMessage("Chat", `testBattles: ${JSON.stringify(testBattles)}`);
    };

    private onShuffle = async (
        sender: API_Character,
        msg: BC_Server_ChatRoomMessage,
        args: string[],
    ) => {
        const battleId = this.playerToBattleId.get(sender.MemberNumber);
        if (!battleId) {
            this.conn.reply(msg, "You are currently not in battle");
            return;
        }

        const battle = this.battles.get(battleId);
        if (!battle || battle.status !== 'ongoing') {
            this.conn.reply(msg, "Battle has ended or is invalid");
            return;
        }

        if (battle.currentPlayer !== sender.MemberNumber) {
            this.conn.reply(msg, "Please wait for your turn");
            return;
        }

        // Check if player has enough points
        const currentPlayerPoints = battle.currentPlayer === battle.player1 ? battle.player1Points : battle.player2Points;
        if (currentPlayerPoints < 1) {
            this.conn.reply(msg, `Not enough points! Shuffle requires 1 point, but you only have ${currentPlayerPoints} point(s).`);
            return;
        }

        // Deduct point
        if (battle.currentPlayer === battle.player1) {
            battle.player1Points -= 1;
        } else {
            battle.player2Points -= 1;
        }

        // Regenerate random perks
        if (battle.currentPlayer === battle.player1) {
            battle.player1Numbers = this.generateRandomNumbers(1, 14, 3);
        } else {
            battle.player2Numbers = this.generateRandomNumbers(1, 14, 3);
        }

        // Show new perk options
        const currentPlayerOptions = battle.currentPlayer === battle.player1 ? battle.player1Numbers : battle.player2Numbers;
        const optionsText = currentPlayerOptions.map((num, index) => {
            const perk = PerkFactory.createPerk(num, (msg, isEmote) => {
                if (isEmote) {
                    this.conn.SendMessage("Emote", `*${msg}*`);
                } else {
                    this.conn.SendMessage("Chat", msg);
                }
            });
            if (!perk) return `${index + 1}. No perk available`;
            return `${index + 1}. ${perk.name} - ${perk.description} (Cost: ${perk.cost} points)`;
        }).join('\n');

        // Send options to current player
        if (battle.currentPlayer === battle.player1) {
            this.conn.SendMessage("Chat", `You spent 1 point to shuffle. Here are your new options:\n${optionsText}\n\nPlease select a perk by typing its number.`);
        } else {
            this.conn.SendMessage("Emote", `*You spent 1 point to shuffle. Here are your new options:\n${optionsText}\n\nPlease select a perk by typing its number.*`);
        }

        // Update the battle state
        this.battles.set(battleId, battle);
    };

    private onSkip = async (
        sender: API_Character,
        msg: BC_Server_ChatRoomMessage,
        args: string[],
    ) => {
        const battleId = this.playerToBattleId.get(sender.MemberNumber);
        if (!battleId) {
            this.conn.reply(msg, "You are currently not in battle");
            return;
        }

        const battle = this.battles.get(battleId);
        if (!battle || battle.status !== 'ongoing') {
            this.conn.reply(msg, "Battle has ended or is invalid");
            return;
        }

        if (battle.currentPlayer !== sender.MemberNumber) {
            this.conn.reply(msg, "Please wait for your turn");
            return;
        }

        // Give 2 points to the current player
        if (battle.currentPlayer === battle.player1) {
            battle.player1Points += 2;
        } else {
            battle.player2Points += 2;
        }
        //consider combine with the previuos block, but this might cause some issues. so keep it for now.
        if (battle.currentPlayer === battle.player1) {
            this.conn.SendMessage("Chat", `(${sender.Name} skipped the attack phase and gained 2 points!)`);
        } else {
            this.conn.SendMessage("Emote", `*${sender.Name} skipped the attack phase and gained 2 points!*`);
        }

        // End turn logic, same as after attack
        if (battle.currentPlayer === battle.player1) {
            // Switch to player2
            battle.currentPlayer = battle.player2;
            battle.selectedNumbers = [];
            const nextPlayer = this.conn.chatRoom.getCharacter(battle.player2);
            if (nextPlayer) {
                const player2Options = battle.player2Numbers.map((num, index) => {
                    const perk = PerkFactory.createPerk(num, (msg, isEmote) => {
                        if (isEmote) {
                            this.conn.SendMessage("Emote", `*${msg}*`);
                        } else {
                            this.conn.SendMessage("Chat", msg);
                        }
                    });
                    return perk ? `${index + 1}. ${perk.name} - ${perk.description} (Cost: ${perk.cost} points)` : `${index + 1}. No perk available`;
                }).join('\n');
                this.conn.SendMessage("Emote", `*${nextPlayer.Name}'s options:\n${player2Options}*`);
                this.conn.SendMessage("Emote", `*${nextPlayer.Name}'s turn to pick a perk and attack*`);
            }
        } else {
            // player2 skip, new round for player1
            battle.currentPlayer = battle.player1;
            battle.currentRound++;
            battle.selectedNumbers = [];
            this.startGameLoop(battleId);
        }

        // Update the battle state
        this.battles.set(battleId, battle);
    };

    private onTalk = async (
        sender: API_Character,
        msg: BC_Server_ChatRoomMessage,
        args: string[],
    ) => {
        if (sender.MemberNumber !== 167616) {
            this.conn.reply(msg, "You are not authorized to use this command.");
            return;
        }
        if (args.length < 1) {
            this.conn.reply(msg, "Please provide a message to send.");
            return;
        }
        const text = args.join(" ");
        this.conn.SendMessage("Chat", text);
    };
}
