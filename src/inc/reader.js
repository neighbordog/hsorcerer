const fs = require('fs');
const path = require('path');

module.exports = function (onLine) {
    const instance = {
        HS_DIR: 'D:\\Hearthstone\\Logs',
        fileSize: 0,
        logFilePath: null,
        trackChangesInterval: null,
        listeners: [onLine],
        getNewestDirectory(dir) {
            const directories = fs.readdirSync(dir, { withFileTypes: true })
                .filter(dirent => dirent.isDirectory())
                .map(dirent => dirent.name)
                .sort((a, b) => fs.statSync(path.join(dir, b)).ctimeMs - fs.statSync(path.join(dir, a)).ctimeMs);

            return directories.length > 0 ? path.join(dir, directories[0]) : null;
        },
        init(onLine) {
            const dir = this.getNewestDirectory(this.HS_DIR);
            this.logFilePath = dir + '\\Power.log';
        },
        start() {
            this.trackChangesInterval = setInterval(this.trackFileChanges.bind(this), 1000)
        },
        stop() {
          this.trackChangesInterval = clearInterval(this.trackChangesInterval);
        },
        trackFileChanges() {
            if (!fs.existsSync(this.logFilePath)) {
                console.log('Power.log not found.');
                return;
            }

            fs.stat(this.logFilePath, (err, stats) => {
                if (err) {
                    return;
                }

                // Check if file size has changed
                if (stats.size > this.fileSize) {
                    const readStream = fs.createReadStream(this.logFilePath, {
                        start: this.fileSize,
                        end: stats.size,
                        encoding: 'utf8',
                    });

                    readStream.on('data', (chunk) => {
                        const lines = chunk.split('\n');
                        lines.forEach((line, index) => {
                            if (index === lines.length - 1 && line === '') return;

                            for(const callable of this.listeners) {
                                callable(line);
                            }
                        });
                    });
                    this.fileSize = stats.size;
                }
            });
        }
    }

    instance.init();

    return instance;
}
