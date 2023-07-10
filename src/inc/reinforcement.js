const fs = require('fs');

module.exports = function() {
    const instance = {
        learnRate: 0.1,
        explorationRate: 0.3,
        highestValue: 10,
        lowestValue: -10,
        data: {},
        init() {
            if(!fs.existsSync('./model.json')) {
                fs.writeFileSync('./model.json', '{}');
            }

            try {
                const data = fs.readFileSync('./model.json');
                this.data = JSON.parse(data);
            } catch (err) {
                console.log(err);
            }

            // find highest and lowest value in data
            let highestValue = 10;
            let lowestValue = -10;

            for(const turn in this.data) {
                for(const playerCard in this.data[turn]) {
                    for(const boughtCard in this.data[turn][playerCard]) {
                        const value = this.data[turn][playerCard][boughtCard];

                        if(value > highestValue) {
                            highestValue = value;
                        }

                        if(value < lowestValue) {
                            lowestValue = value;
                        }
                    }
                }
            }

            this.highestValue = highestValue;
            this.lowestValue = lowestValue;
        },
        save() {
            // write file async
            fs.writeFileSync('./model.json', JSON.stringify(this.data));
        },
        learn(bought, player, turn, damage_taken=0) {
            bought = [...new Set(bought)];
            player = [...new Set(player)];

            for(const boughtCard of bought) {
                for(const playerCard of player) {
                    this.process(this.keyableName(boughtCard), this.keyableName(playerCard), turn, damage_taken);
                }
            }

            this.save();
        },
        keyableName(name) {
            return name.replace(/ /g, '_').toLowerCase();
        },
        process(boughtCard, playerCard, turn, damage_taken) {
            if(!this.data[turn]) {
                this.data[turn] = {};
            }

            if(!this.data[turn][boughtCard]) {
                this.data[turn][boughtCard] = {};
            }

            if(!this.data[turn][boughtCard][playerCard]) {
                this.data[turn][boughtCard][playerCard] = 0;
            }

            const reward = this.getReward(damage_taken);

            this.data[turn][boughtCard][playerCard] = parseFloat((this.data[turn][boughtCard][playerCard] + this.learnRate * reward).toFixed(3));
        },
        getReward(damage_taken) {
            if(damage_taken >= 11) {
                return -10;
            } else if(damage_taken > 0 && damage_taken < 10) {
                return -5;
            }

            return 10;
        },
        recommend(bob, player, turn) {
            bob = [...new Set(bob)];
            player = [...new Set(player)];

            // console.log(bob, player)

            const results = [];
            for(let i = 0; i < bob.length; i++) {
                bobCard = this.keyableName(bob[i]);
                let resultsFound = 0;
                let totalValue = 0;
                let value = 0;

                for(let playerCard of player) {
                    playerCard = this.keyableName(playerCard);

                    if(this.data[turn] && this.data[turn][bobCard] && this.data[turn][bobCard][playerCard]) {
                        resultsFound++;
                        totalValue += this.data[turn][bobCard][playerCard];
                    }
                }

                if(resultsFound > 0 && (
                    totalValue > 0
                    || totalValue < 0
                )) {
                    value = totalValue / resultsFound;
                }


                results.push(value);
            }

            // sort results by highest value
            const sorted = results.map((value, index) => {
                return {
                    value,
                    index
                }
            }).sort((a, b) => {
                return b.value - a.value;
            });


            // match sorted with bob
            const sortedBob = sorted.map((item) => {
                return {
                    entityName: bob[item.index],
                    value: this.normalizeValue(item.value)
                };
            });

            return sortedBob;
        },
        normalizeValue(value) {
            let normalized = 0;

            const minNormalized = -100;
            const maxNormalized = 100;

            if(value < 0) {
                normalized = (value - this.lowestValue) / this.lowestValue * minNormalized + minNormalized
            } else if(value > 0) {
                normalized = (value - this.highestValue) / this.highestValue * maxNormalized + maxNormalized
            }

            return Math.round(normalized);
        }
    }

    instance.init();

    return instance;
}
