module.exports = function(game, onEvent) {
    const instance = {
        game,
        isCreateGameBlock: false,
        createGameBlock: [],
        isStateBlock: false,
        stateBlock: [],
        listeners: [onEvent],
        isDamageBlock: false,
        callback(type, data) {
            for(const callable of this.listeners) {
                callable(type, data);
            }
        },
        parseLine(line) {
            this.checkForNewGame(line);
            this.checkForState(line);
            this.checkForTurn(line);
            this.checkForDamage(line);
            this.checkForCardPlayed(line);
            this.checkForCardSold(line);
            this.checkForGameOver(line);
            this.checkForMainStartTrigger(line);

            //if(/GameState.DebugPrintPower.+TAG_CHANGE Entity=GameEntity tag=NUM_TURNS_IN_PLAY value=/.test(line)) {


            //if(/PowerTaskList.DebugPrintPower.+TRANSIENT_ENTITY/.test(line)) {
            //    console.log(line)
            //}
        },
        checkForNewGame(line) {
            if(
                this.isCreateGameBlock
                && line.includes('FULL_ENTITY')
            ) {
                this.isCreateGameBlock = false;
                this.parseGameBlock();
            }

            if(line.includes('CREATE_GAME')) {
                this.createGameBlock = [];
                this.isCreateGameBlock = true;
            }

            if(this.isCreateGameBlock) {
                this.createGameBlock.push(line);
            }
        },
        checkForTurn(line) {
            if(/GameState.+ TAG_CHANGE Entity=GameEntity tag=NUM_TURNS_IN_PLAY value=/.test(line)) {
                const parsedTurn = line.match(/value=(\d+)/)[1];
                const turn = Math.ceil(parsedTurn /2);

                if(turn != this.game.turn) {
                    this.game.turn = turn;
                    this.callback('turn_end', turn);
                }
            }
        },
        checkForState(line) {
            if(
                this.isStateBlock
                && !/target \d+/.test(line)
            ) {
                this.isStateBlock = false;
                this.parseGameUpdateBlock();
            }

            if(/option \d+ type=POWER.+Drag To Sell.+error=NONE/.test(line)) {
                this.stateBlock = [];
                this.isStateBlock = true;
            }

            if(
                this.isStateBlock
                    && /target \d+/.test(line)
            ) {
                this.stateBlock.push(line);
            }
        },
        checkForDamage(line){
            if(
                this.isDamageBlock
            ) {
                if(
                    line.includes('Info')
                    && line.includes('HERO')
                ) {
                    const player = line.match(/player=(\d+)/)[1];


                    if(player === this.game.playerId) {
                        this.callback('damage_taken', this.damageTaken);
                    }
                }
                this.isDamageBlock = false;
                this.damageTaken = 0;
            }

            if(/GameState.DebugPrintPower.+META_DATA.+Meta=DAMAGE/.test(line)) {
                this.isDamageBlock = true;
                this.damageTaken = parseInt(line.match(/Data=(\d+)/)[1]);
            }
        },
        checkForGameOver(line) {
            if(/GameState.DebugPrintPower.+TAG_CHANGE Entity=GameEntity tag=NEXT_STEP value=FINAL_GAMEOVER/.test(line)) {
                this.callback('game_over', null);
            }
        },
        checkForCardPlayed(line) {
            if(/GameState.DebugPrintPower().+TAG_CHANGE Entity=.+cardId.+tag=ZONE value=PLAY/.test(line)) {
                const entityName = line.match(/entityName=([a-zA-Z0-9\-\'\,\.\!\?\s]+)\s/)[1].trim();
                const cardId = line.match(/cardId=(\w+)/)[1];
                const zone = line.match(/zone=(\w+)/)[1];
                const zonePos = line.match(/zonePos=(\d+)/)[1];
                const player = line.match(/player=(\d+)/)[1];

                if(
                    player === this.game.playerId
                    && zonePos !== '0'
                    && !entityName.includes('Triple Reward')
                    && entityName !== 'Blood Gem'
                    && cardId.startsWith('BG')
                    && !cardId.endsWith('t')
                ) {
                    this.callback('card_played', entityName);
                }
            }
        },
        checkForCardSold(line) {
            if(/PowerTaskList.DebugPrintPower.+zone=PLAY.+TRANSIENT_ENTITY/.test(line)) {
                if(line.includes('entityName')) {
                    const entityName = line.match(/entityName=([a-zA-Z0-9\-\'\,\.\!\?\s]+)\s/)[1].trim();
                    const cardId = line.match(/cardId=(\w+)/)[1];
                    const player = line.match(/player=(\d+)/)[1];

                    if(
                        player === this.game.playerId
                        && !cardId.includes('HERO')
                    ) {
                        if(entityName.includes('Tavern Tier')) {
                            this.callback('tavern_tier_updated', entityName);
                        } else {
                            this.callback('card_sold', entityName);
                        }
                    }
                }
            }
        },
        checkForMainStartTrigger(line) {
          if(/GameState.DebugPrintPower().+TAG_CHANGE.+Entity=GameEntity tag=STEP value=MAIN_START_TRIGGERS/.test(line)) {
            this.callback('main_start', null);
          }
        },
        parseGameBlock() {
            const createGameBlockJoined = this.createGameBlock.join('\n');
            const gameEntityId = createGameBlockJoined.match(/GameEntity EntityID=(\d+)/)[1];
            const playerId = createGameBlockJoined.match(/Player EntityID=\d+ PlayerID=(\d+) GameAccountId=\[hi=\d\d+ lo=\d\d+\]/)[1];
            const bobId = createGameBlockJoined.match(/Player EntityID=\d+ PlayerID=(\d+) GameAccountId=\[hi=(0) lo=(0)\]/)[1];

            this.game.gameEntityId = gameEntityId;
            this.game.playerId = playerId;
            this.game.bobId = bobId;
            this.game.turn = 0;
            this.game.tavern_tier = 1;

            this.callback('create_game', {
                gameEntityId,
                playerId,
                bobId
            });
        },
        parseGameUpdateBlock() {
            const currentBlock = {
                bob: []
            };

            const bobCards = [];

            for(let line of this.stateBlock) {
                if(
                    !line.includes('entityName')
                    || !/cardId=(\w+)/.test(line)
                    || !/player=(\d+)/.test(line)
                )
                    continue;

                const entityName = line.match(/entityName=([a-zA-Z0-9\-\'\,\.\!\?\s]+)\s/)[1].trim();

                const cardId = line.match(/cardId=(\w+)/)[1];
                const zone = line.match(/zone=(\w+)/)[1];
                const player = line.match(/player=(\d+)/)[1];

                if(
                    player === this.game.bobId
                    && !entityName.includes('Bob')
                ) {
                    bobCards.push(entityName)
                }

            }

            this.callback('update_bob', bobCards);
        }
    }

    return instance;
}
