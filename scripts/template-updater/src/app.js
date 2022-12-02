import fs from 'fs';
import path from 'path'
import fetch from 'node-fetch'
import YAML from 'yaml'

const args = process.argv;
const fileLocation = args[args.findIndex(e => e.startsWith("--file")) + 1] ?? null;

if (!fileLocation || !fileLocation.endsWith(".yml")) {
    console.error("No file location specified or file is not a yml file")
    process.exit();
}

const runScript = async () => {
    const ymlFile = path.resolve(fileLocation);
    if (!fs.existsSync(ymlFile)) {
        console.error(`${ymlFile} does not exist`)
        return;
    }

    // Ensure we can read and write to the file
    try {
        fs.accessSync(ymlFile, fs.constants.R_OK | fs.constants.W_OK)
    } catch (error) {
        console.error(`${ymlFile} is not readable or writeable`, error);
    }

    // Load all the api data
    const data = await fetch("https://api.modpacks.ch/public/modpack/popular/installs/FTB/all");
    const packData = await data.json();

    const apiModpacks = await Promise.all(
        packData.packs.map(async (packId) => {
            try {
                console.log(`Fetching modpack with the id of ${packId}`)
                const modpackReq = await fetch(`https://api.modpacks.ch/public/modpack/${packId}`);
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
    const ymlOptions = modpacks.map(e => ({ label: e.name }))

    console.log(`Getting ready to insert the following yaml data`)
    console.log(ymlOptions)

    const ymlFileData = fs.readFileSync(ymlFile, "utf-8");
    const ymlData = YAML.parse(ymlFileData);

    const packSection = ymlData.body.find(e => e.id === "modpack");
    if (packSection) {
        packSection.attributes.options = ymlOptions;
    }

    fs.writeFileSync(ymlFile, YAML.stringify(ymlData));
    console.log("Updated file successfully")
}

// Run the script 🔥 🎉
runScript()
    .catch(console.error)
