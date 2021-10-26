#!/usr/bin/env node

import {execSync} from 'child_process';
import { promises as fs } from 'fs';
import readline from 'readline';
import process from 'process';
import ansiEscapes from 'ansi-escapes';
import ora from 'ora';

const runCommand = async command => {
    try {
        execSync(`${command}`);
    } catch (e) {
        console.error(`Failed to execute ${command}`, e);
        return false;
    }

    return true;
};

const updateFile = async (filename, replacements) => {
    try {
        let data = await fs.readFile(filename, 'utf-8');

        // replace if doesn't already exists
        if(data.indexOf(replacements[0].replacer) === -1) {
            data = data.replace(replacements[0].needle, replacements[0].replacer);
        }

        return await fs.writeFile(filename, data, 'utf-8');
    } catch (e) {
        console.log(e);
    }
};

const clearConsole = () => {
    process.stdout.write(ansiEscapes.clearScreen);
    process.stdout.write(ansiEscapes.eraseUp);
};

(async () => {
    clearConsole();

    const args = process.argv.slice(2);

    const logo = '%@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@\n' +
        '@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@\n' +
        '@@@@@@@@@**#@@@@@@@@@@@@@@@@@@@@@@**#@@@@@@@@@@%**@@@@@@@@@@%**%@@@@@@@@@@@@#**++#@@@@@@@@\n' +
        '@@@@@@@@+---@@@@@@@@@@@@@@@@@@@@@*---%@@@@@@@@@---+@@@@@@@@@=---@@@@@@@@@#=------=@@@@@@@@\n' +
        '@@@@@@@@+---@@@@@@@@@@@@@@@@@@@@@*---#@@@@@@@@@---+@@@@@@@@@=---@@@@@@@@@@@%#=---+@@@@@@@@\n' +
        '@@@@@@@@+---=+==+#@@@*=+%@@@*=+%@*----=--=+%@@@----=---=#@@@=---@@@%*=--=+#@@@=--@@@@@@@@@\n' +
        '@@@@@@@@+---------*@@---+@@@---+@*-----=----+@@-----=----=@@=---@@+---++=--=@@#*@@@@@@@@@@\n' +
        '@@@@@@@@+---%@@----@@---+@@%---+@*---*@@@+---%@---=@@@#---+@=---@*---=+++---*@@@@@@@@@@@@@\n' +
        '@@@@@@@@+---@@@=---@@---=@@#---*@*---*@@@=---%@---=@@@*---+@=---@*----+++++*@@@@@@@@@@@@@@\n' +
        '@@@@@@@@+---@@@=---@@*--------=@@#----------+@@----------=@@=---@@+----==--#@@@@@@@@@@@@@@\n' +
        '@@@@@@@@%==*@@@#==*@@@%*+===+#@@@@#==*+===*%@@@%+=*+===+#@@@#==*@@@%*+===+*@@@@@@@@@@@@@@@\n' +
        '@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@\n' +
        '@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@\n';

    console.log(logo);

    /*
     *
     * Install nuxt.js via npx create-nuxt-app and predefined answers
     * https://github.com/nuxt/create-nuxt-app/issues/444
     *
     */

    const appName = args[0];
    if(!appName) {
        console.log('Please provide an app name like: npx @hubblecommerce/hubble <project-name>');
        process.exit(-1);
    }

    const createProjectDir = `mkdir ${appName}`;
    const projectDirCreated = await runCommand(createProjectDir);
    if(!projectDirCreated) process.exit(-1);

    // Change the directory
    try {
        process.chdir(appName);
    } catch (err) {
        console.error("error occurred while "
            + "changing directory: " + err);
    }

    const installNuxtLoader = ora('Installing nuxt.js').start();
    const installNuxtCommand = `npx create-nuxt-app --answers '{"name":"my-app","language":"js","pm":"npm","ui":"none","target":"server","features":[],"linter":[],"test":"none","mode":"universal","devTools":[]}'`;
    const nuxtInstalled = await runCommand(installNuxtCommand);
    if(!nuxtInstalled) process.exit(-1);
    installNuxtLoader.stop();
    clearConsole();

    /*
     *
     * Install hubble via npm
     * runs its own postinstall script to move files from module to root dir etc.
     * see scripts/post-install.js for details
     *
     */

    const installHubbleLoader = ora('Installing hubble').start();
    // const installHubbleCommand = 'npm i @hubblecommerce/hubble --save-dev';
    // const hubbleInstalled = runCommand(installHubbleCommand);
    // if(!hubbleInstalled) process.exit(-1);
    installHubbleLoader.stop();
    clearConsole();

    /*
     *
     * Set hubble as module in nuxt.config.js
     *
     */

    const configureNuxtJs = async function() {
        const file = 'nuxt.config.js';
        const newValue = 'buildModules: [\n' +
            '    [\'@hubblecommerce/hubble\']';

        await updateFile(file, [{
            needle: 'buildModules: [',
            replacer: newValue
        }], function (err) {
            console.error(err);
            process.exit(-1);
        });
    };

    await configureNuxtJs();

    /*
     *
     * Remove files set by nuxt-create-app we don't need
     *
     */

    const removeFileIfNotExists = async function(file) {
        try {
            const data = await fs.readFile(file, 'binary');
            fs.unlink(file);

            console.log(`Removed file ${file}`);
        } catch (e) {
            console.log(`File ${file} already removed. Skipping`);
        }
    };

    const removeNuxtDefaultFiles = async function() {
        const paths = [
            'pages/index.vue',
            'layouts/default.vue'
        ];

        for (const file of paths) {
            await removeFileIfNotExists(file);
            clearConsole();
        }
    };

    await removeNuxtDefaultFiles();

    /*
     *
     * Ask user for API credentials
     * write credentials to .env file
     *
     */

    const setEnvVariables = async function() {
        let apiBaseUrl = args[1] || null;
        let apiAccessKey = args[2] || null;

        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });

        const question1 = () => {
            return new Promise((resolve, reject) => {
                rl.question('Please enter your API url: ', (url) => {
                    apiBaseUrl = url;
                    resolve();
                })
            })
        }

        const question2 = () => {
            return new Promise((resolve, reject) => {
                rl.question('Please enter your API access key: ', (key) => {
                    apiAccessKey = key;
                    resolve();
                })
            })
        }

        const askForCreds = async () => {
            if(apiBaseUrl == null) {
                await question1();
            }

            if(apiAccessKey == null) {
                await question2();
            }

            rl.close();
        }

        rl.on("close", async function() {
            const envFile = '.env';
            const apiUrlVal = 'API_BASE_URL            = \'\'';
            const apiUrlNewVal = `API_BASE_URL            = \'${apiBaseUrl}\'`;
            const apiKeyVal = 'API_SW_ACCESS_KEY       = \'\'';
            const apiKeyNewVal = `API_SW_ACCESS_KEY       = \'${apiAccessKey}\'`;

            await updateFile(envFile, [{
                needle: apiUrlVal,
                replacer: apiUrlNewVal
            }], function (err) {
                console.error(err);
                process.exit(-1);
            });

            await updateFile(envFile, [{
                needle: apiKeyVal,
                replacer: apiKeyNewVal
            }], function (err) {
                console.error(err);
                process.exit(-1);
            });
        });

        await askForCreds();
    };

    await setEnvVariables();

    clearConsole();
    console.log("hubble PWA was installed successfully. \n \nYou can start your app via: \n \nnpm run dev");
})();
