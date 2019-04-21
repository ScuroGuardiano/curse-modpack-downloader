const requestPromise = require('request-promise-native');
const { JSDOM } = require('jsdom');

/**
 * Return list of available files from given /files url.
 * @param { string } url - url to project file list, usually BASE_URL/projects/{project-name}/files
 * @returns { Array<{url: string, version: string}> }
 */
module.exports = async function getFileList(url) {
    try {
        let res = await requestPromise.get(url);
        let { document } = (new JSDOM(res)).window;
        return Array.from(document.querySelectorAll('.twitch-link'))
        .map(link => { return {
            url: link.href,
            version: link.textContent.trim()
        }});
    }
    catch(err) {
        if(err.statusCode) {
            if(err.statusCode == 404)
                throw new Error("404");
            if(err.statusCode >= 500)
                throw new Error("5xx");
            if(err.statusCode >= 400)
                throw new Error("4xx"); 
        }
        throw err;
    }
}
