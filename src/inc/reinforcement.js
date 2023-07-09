const fs = require('fs');

module.exports = async function() {
    const instance = {
        learnRate: 0.1,
        explorationRate: 0.3,
        data: {},
        async init() {
            if(!fs.existsSync('./model.json')) {
                fs.writeFileSync('./model.json', '{}');
            }

            try {
                const data = await fs.promises.readFile('./model.json');
                this.data = JSON.parse(data);
            } catch (err) {
                console.log(err);
            }
        },
        save() {
            // write file async
            fs.writeFile('./model.json', JSON.stringify(this.data), (err) => {
                if (err) {
                    console.log(err);
                    return;
                }
            });
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

            this.data[turn][boughtCard][playerCard] += this.learnRate * reward;
        },
        getReward(damage_taken) {
            if(damage_taken >= 11) {
                return -1;
            } else if(damage_taken < 10) {
                return -0.5;
            }

            return 1;
        },
        recommend(bob, player, turn) {
            bob = [...new Set(bob)];
            player = [...new Set(player)];

            //console.log(bob, player)

            const results = [];
            for(let i = 0; i < bob.length; i++) {
                bobCard = this.keyableName(bob[i]);
                let resultsFound = 0;
                let totalValue = 0;
                let value = 0;

                for(let playerCard of player) {
                    playerCard = this.keyableName(playerCard);

                    if(this.data[turn] && this.data[turn][playerCard] && this.data[turn][playerCard][bobCard]) {
                        resultsFound++;
                        totalValue += this.data[turn][playerCard][bobCard];
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

            if(Math.random() < this.explorationRate) {
                return bob[Math.floor(Math.random() * bob.length)];
            } else {
                const highestValue = Math.max(...results);
                const highestValueIndex = results.indexOf(highestValue);

                return bob[highestValueIndex];
            }
        }
    }

    instance.init();

    return instance;
}
