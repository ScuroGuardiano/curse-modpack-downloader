#!/usr/bin/env node
const downloadFile = require('./download-file');
const getFileList = require('./get-file-list');
const fs = require('fs-extra');
const { promisify } = require('util');
const extractZip = promisify(require('extract-zip'));
const path = require('path');
const { JSDOM } = require('jsdom');
const requestPromise = require('request-promise-native');

const BASE_URL = "https://minecraft.curseforge.com";

function createDownloadFolder() {
    try {
        fs.mkdirSync("./download");
    } catch (err) {
        if (err.code != "EEXIST") {
            console.error("ERROR: Can't create download folder! Make sure that program has access to current folder.");
            process.exit(1);
        }
    }
}
function createProjectFolder(projectName) {
    try {
        fs.mkdirSync('./download/' + projectName);
    } catch(err) {
        if(err.code == "EEXIST") {
            console.error(`ERROR: There's already folder for a project ${projectName}. To download it again, delete this folder.`);
        }
        else {
            console.error("ERROR: Can't create project folder! Make sure that program has access to current folder.");
        }
        process.exit(1);
    }
}
/**
 * 
 * @param {string} project project name
 * @returns { { url: string, version: string } }
 */
async function getLatestProjectFileUrl(project) {
    const url = `${BASE_URL}/projects/${project}/files`;
    /**@type {typeof getFileList} */
    let fileList;
    try {
        fileList = await getFileList(url);
    } catch (err) {
        switch (err.message) {
            case "404":
                console.error(`ERROR: Project ${project} not found.`);
                break;
            case "4xx":
                console.error("4xx Error, dunno")
                break;
            case "5xx":
                console.error("Server side error");
                break;
            default:
                console.error(err);
        }
        process.exit(1);
    }

    const latest = fileList[0];
    return latest
}
function loadManifest(path) {
    let manifest = fs.readFileSync(path).toString();
    return JSON.parse(manifest);
}
async function getModNameByFileUrl(fileUrl) {
    try {
        let res = await requestPromise.get(fileUrl);
        let { document } = (new JSDOM(res)).window;
        return document.querySelector(".info-data.overflow-tip").textContent;
    }
    catch(err) {
        if(err.statusCode && err.statusCode == 404) {
            console.error(`File ${fileUrl} not found on remote server. One mod url is invalid, aborting...`);
            process.exit(1);
        }
    }
}
async function generateFileListFromManifest(manifest) {
    return Promise.all(manifest.files
    .map(async file => {
        const fileUrl = `${BASE_URL}/projects/${file.projectID}/files/${file.fileID}`;
        const name = await getModNameByFileUrl(fileUrl);
        return {
            name: name,
            downloadUrl: fileUrl + "/download"
        }
    }));
}
function removeIllegalCharactersFromFilename(filename) {
    return filename.replace(/[/\\?%*:|"<>]/g, '-');
}

/**
 * 
 * @param {string[]} argv 
 */
async function main(argv) {
    if(argv.length < 3) {
        console.error("Usage: cursemd <project name>");
        process.exit(1);
    }
    const project = argv[2];
    const latest = await getLatestProjectFileUrl(project);
    createDownloadFolder();
    const projectFolderName = removeIllegalCharactersFromFilename(project + ' ' + latest.version);
    createProjectFolder(projectFolderName);
    const projectFolderPath = path.resolve(`./download/${projectFolderName}`);
    const projectArchivePath = `${projectFolderPath}/${project}.zip`

    console.log("Downloading project main file v." + latest.version);
    await downloadFile(`${BASE_URL}${latest.url}/download`, projectArchivePath);

    console.log("Extracting...");
    await extractZip(projectArchivePath, {dir: path.join(projectFolderPath, 'extracted')});
    console.log("Extracted");

    const manifest = loadManifest(path.join(projectFolderPath, "extracted", "manifest.json"));
    const dotMinecraft = path.join(projectFolderPath, ".minecraft");
    fs.mkdirSync(dotMinecraft);
    const modsPath = path.join(dotMinecraft, "mods");
    fs.mkdirSync(modsPath);
    
    console.log("Generating file list...");
    const fileList = await generateFileListFromManifest(manifest);
    console.log("Generated file list!");
    const total = fileList.length;
    let downloaded = 0;
    console.log(`There's ${total} mods to download...`);
    console.log("Starting downloading mods...");
    
    for(let i = 0; i < total; i++) {
        let progress = `(${downloaded + 1}/${total}) `;
        let maxWidth = `(${total}/${total}) `.length;
        if(progress.length < maxWidth)
            progress = progress + ' '.repeat(maxWidth - progress.length);
        await downloadFile(fileList[i].downloadUrl, path.join(modsPath, fileList[i].name), progress);
        downloaded++;
    }
    console.log("Finished downloading");
    console.log("Finishing job...");
    if(manifest.overrides) {
        const overridesDir = path.join(projectFolderPath, "extracted", manifest.overrides);
        console.log("Copying overrides...");
        fs.copySync(overridesDir, dotMinecraft, { overwrite: true });
        console.log("Copied overrides!");
    }
    console.log("Finished!")
    console.log(`Now you have to install minecraft ${manifest.minecraft.version}`);
    if(manifest.minecraft.modLoaders) {
        console.log('Then you need to install mod loaders: ');
        manifest.minecraft.modLoaders.forEach(modLoader => console.log(modLoader.id));
    }
    console.log(`After that copy everything from ${dotMinecraft}\nto your downloaded .minecraft and you're ready to go!`);
}
main(process.argv);