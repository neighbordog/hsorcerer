const reader = require('./inc/reader');
const parser = require('./inc/parser');
const reinforcement = require('./inc/reinforcement');

// [Log]
// FileSizeLimit.Int=-1



const hsorcerer = {
    messageLevel: 1,
    currentGame: {
        gameEntityId: null,
        playerId: null,
        bobId: null,
        turn: 0,
        tavern_tier: 1,
    },
    waitingForGame: true,
    playState: {
        damage_taken: 0,
        game_has_ended: false,
        player: [],
        bob: [],
        boughtThisTurn: [],
    },
    Reader: null,
    Parser: null,
    Reinforcement: null,
    async init() {
        this.Reader = reader(this.parseLine.bind(this));
        this.Parser = parser(this.currentGame, this.onEvent.bind(this));
        this.Reinforcement = await reinforcement();

        this.Reader.start();
    },
    parseLine(line) {
        const parsedLine = this.Parser.parseLine(line);
    },
    onEvent(type, data) {
        const lookUpTable = {
            'create_game': function(data) {
                this.message('Game has started...')
                this.lookingForGame = false;

                this.playState.game_has_ended = false;
                this.playState.damage_taken = 0;
                this.playState.player = [];
                this.playState.bob = [];
                this.playState.boughtThisTurn = [];
            },
            'turn_end': function(data) {
                this.message(`Turn ${data-1} has ended...`)

                if(this.playState.damage_taken > 0) {
                    this.message(`Took ${this.playState.damage_taken} damage...`)
                }

                this.Reinforcement.learn(
                    this.playState.boughtThisTurn,
                    this.playState.player,
                    this.currentGame.turn,
                    this.playState.damage_taken
                );

                this.playState.boughtThisTurn = [];
                this.playState.damage_taken = 0;

            },
            'damage_taken': function(data) {
                this.message('Took damage...')
                this.playState.damage_taken = data;
            },
            'update_bob': function(data) {
                this.message('State has been updated...')

                this.playState.bob = data;

                if(this.currentGame.tavern_tier < 6)
                    this.playState.bob.push(this.getNextTavernTierCard());

                const recommendation = this.Reinforcement.recommend(
                    this.playState.bob,
                    this.playerPlayStateWithoutTavernTierCard(),
                    this.currentGame.turn
                );

                this.message(`Recommendation: ${recommendation}`)
            },
            'card_played' : function(data) {
                this.message('Card has been played...', data)

                this.playState.player.push(data);
                this.playState.boughtThisTurn.push(data)
            },
            'card_sold' : function(data) {
                this.message('Card has been sold...', data)

                const index = this.playState.player.indexOf(data);
                if (index > -1) {
                    this.playState.player.splice(index, 1);
                }
            },
            'tavern_tier_updated': function(data) {
                const tier = data.match(/Tavern Tier (\d+)/)[1];

                this.message('Tavern tier has been updated...', data)

                this.currentGame.tavern_tier = parseInt(tier);
                this.playState.boughtThisTurn.push(this.getCurrentTavernTierCard());
            },
            'game_over': function(data) {
                this.message('Game has ended...')
                this.playState.game_has_ended = true;
                this.lookingForGame = true;
            }
        }

        if(lookUpTable[type])
            lookUpTable[type].call(this, data);
    },
    getCurrentTavernTierCard() {
        return `Tavern Tier ${this.currentGame.tavern_tier}`
    },
    getNextTavernTierCard() {
        return `Tavern Tier ${this.currentGame.tavern_tier+1}`
    },
    playerPlayStateWithoutTavernTierCard() {
        return this.playState.player.filter(card => card.startsWith('Tavern Tier') === false);
    },
    message(message, $level='info') {
        if(this.messageLevel === 0)
            return;

        console.log(`[${$level}] ${message}`);
    }
}

hsorcerer.init();


