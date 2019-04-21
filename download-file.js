const request = require("request");
const cliProgress = require('cli-progress');
const requestProgress = require('request-progress');
const fs = require("fs");
const path = require("path");

/**
 * Downloads file from given url and saves it to given targetPath
 * @param {string} url file source url
 * @param {string} targetPath path, where file will be saved
 * @param {string} additionalInfo a string that will be displayed before progress bar. It should have fixed size
 */
module.exports = function downloadFile(url, targetPath, additionalInfo = "") {
    return new Promise((resolve, reject) => {
        /** @type { cliProgress.Bar } */
        let bar = null;
        let filename = path.basename(targetPath);
        //If filename is too long it will short it
        if(filename.length > 40) {
            filename = filename.substring(0, 30) + "..." + filename.substring(filename.length - 7);
        }
        //If filename is too short it will add some padding.
        if(filename.length < 40) {
            filename = filename + ' '.repeat(40 - filename.length);
        }
        function createBar() {
            bar = new cliProgress.Bar({
                format: `${additionalInfo}${filename} [{bar}] {percentage}% | {value}KB/{total}KB ({speed} KB/s) {eta}s`,
                barCompleteChar: "#"
            });
        }
        requestProgress(
                request.get(url), 
                {
                    throttle: 100
                }
            )
            .on('progress', state => {
                if (!bar) {
                    createBar();
                    bar.start(Math.floor(state.size.total / 1024), 0);
                }
                bar.update(Math.floor(state.size.transferred / 1024), {
                    speed: Math.floor(state.speed / 1024)
                });
            })
            .on('end', () => {
                if(!bar) {
                    createBar();
                    bar.start(1, 0);
                }
                bar.update(bar.getTotal());
                bar.stop();
                resolve();
            })
            .on('err', reject)
            .pipe(fs.createWriteStream(targetPath));
    });
}