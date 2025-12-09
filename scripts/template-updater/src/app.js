import fs from 'fs';
import path from 'path'
import fetch from 'node-fetch'
import YAML from 'yaml'

const args = process.argv;
const fileLocation = args[args.findIndex(e => e.startsWith("--github")) + 1] ?? null;

if (!fileLocation || !fileLocation.includes("ISSUE_TEMPLATE")) {
    console.error("No file location specified or file is not a yml file")
    process.exit();
}

const runScript = async () => {
    const githubPath = path.resolve(fileLocation);
    if (!fs.existsSync(githubPath)) {
        console.error(`${githubPath} does not exist`)
        return;
    }

    const targetFiles = fs.readdirSync(githubPath)
        .filter(e => (e.endsWith(".yml") || e.endsWith(".yaml")) && e !== "config.yml")
        .map(e => path.join(githubPath, e));

    // Test files
    for (let targetFile of targetFiles) {
        // Ensure we can read and write to the file
        try {
            fs.accessSync(targetFile, fs.constants.R_OK | fs.constants.W_OK)
        } catch (error) {
            console.error(`${targetFile} is not readable or writeable`, error);
            return;
        }
    }

    // Load all the api data
    const data = await fetch("https://api.feed-the-beast.com/v1/modpacks/public/modpack/popular/installs/FTB/all");
    const packData = await data.json();

    const apiModpacks = await Promise.all(
        packData.packs.map(async (packId) => {
            try {
                console.log(`Fetching modpack with the id of ${packId}`)
                const modpackReq = await fetch(`https://api.feed-the-beast.com/v1/modpacks/public/modpack/${packId}`);
                const data = await modpackReq.json();
                console.log(`Successfully fetched modpack with the id of ${packId}`)
                if (data.status === "success") {
                    return data;
                }
            } catch (error) {
                console.error(`Unable to fetch modpack ${packId} due to ${error.message}`, error);
            }

            return null;
        })
    );

    // Ignore null packs,
    const modpacks = apiModpacks
        .filter(e => e !== null && e.private !== true) // technically this can't be true but just to be sure :D
        .sort((a, b) => b.id - a.id);

    // Create the input to push into the yml file.
    const ymlOptions = modpacks.map(e => e.name)
    ymlOptions.push("Other...")

    console.log(`Getting ready to insert the following yaml data`)
    console.log(ymlOptions)

    for (let targetFile of targetFiles) {
        const ymlFileData = fs.readFileSync(targetFile, "utf-8");
        const ymlData = YAML.parse(ymlFileData);

        const packSection = ymlData.body.find(e => e.id === "ftb-modpack-dropdown");
        if (packSection) {
            packSection.attributes.options = ymlOptions;
        }

        // fs.writeFileSync(targetFile, YAML.stringify(ymlData));
        fs.writeFileSync(targetFile, YAML.stringify(ymlData, {defaultKeyType: 'PLAIN', defaultStringType: 'QUOTE_SINGLE'}));
    }

    console.log("Updated file successfully")
}

// Run the script 🔥 🎉
runScript()
    .catch(console.error)
