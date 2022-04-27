require('dotenv').config();

const fs = require('fs');
const http = require('https');
const cron = require('node-cron');
const tiktokScraper = require('tiktok-scraper');
const discord = require('discord.js');
const request = require('request');
const headers = {
    'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_11_3) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/88.0.4167.153 Safari/537.36',
    'referer': 'https://www.tiktok.com/',
    'cookie': 'tt_csrf_token=IG0LxNGl-X6229GRKe0U4xVqyl2Vs-bFMRIE; ttwid=1%7CYljutss9YpfEJHkuM9KaPsWkiZfFL9_c85S3yr1ZhdU%7C1651000882%7Cf33a95b96e8d6286dbd2792bd6d3c985649b00cdcb37367e3a0736ec45b314a5; msToken=noG58CkAi7jZCyM1fiXablSvzXbQS3usnsSfhGusxm4D-UczLen1Fwh7MdgBi5VC0qbT5yrfmNaDsyluMEL_BVSwNWsYo6v7vckRAdPlour4X6GrXulJmBsE; _abck=19793830B1544A8DB9FEF4B91E953692~-1~YAAQLdlraNAKTT6AAQAAyzRSZweYzpbHj6UEnMD+9tZrOHCXzXIROE/tbjBR9i8PkS75ba0ri8HerPtOUsKQNanBIvUspVe7UrHl6LjhZkqF1HTOAtEFsc5xEE4H+2RT/l0pf6kyi0eHLYu+rATyTdvbaoDc/6UuEwi49AJ64928npmi0nKYA915Z6JWYEI1MeAsjkPxV/Mkprf0TcWAeTc0wsIPM/FDV/Ilm1Gi1WnBUnmU7xuMUgcz46C2LOr84nf85T9r25H4QtwRkmr5f77NIHrQn/HvIGiuT/L4Ti0dA0//1hy1jkdLYZ3VwM6+EPRDuRf0nRZbvf2VQ0ob6mygGs4Lj9rN/6ok5nLZzIddwY1xz7vVIOOT8Vo=~-1~-1~-1; bm_sz=4325731A7D02A681D621B7AF82878C3E~YAAQLdlraNEKTT6AAQAAyzRSZw9klbAhkPlE58RP7sYAuzu0iSN1F1t12YswLYWPYDBtCgBHLeMAHr5tMZ30bSXNn5FSdkliv3Wk7mjjF3whUzBizt8j9y67dW4kdZ5nCW8vYweAzcYL8n1jQZfLJ/VX4ACDpkCjaYamjfU9rImH6RKqsisbCkbeC+gPKZnquHyCYfi+Gam/yS1m8hqFJh6qihGH9FjX4y67gniiJ+YmuTMuBtsGDCcN4xUbK8T9BM6sstEaIqJ2FFCi/rnJLmib+/tKBXnF1raSGZtEWF2QGVY=~4337720~3289414'
}

const client = new discord.Client({ intents: [discord.Intents.FLAGS.GUILDS, discord.Intents.FLAGS.GUILD_MESSAGES] });


const linkRegEx = new RegExp('https:\/\/(www|vm)\.tiktok\.com\/[a-zA-Z0-9_]+');
var quotations = new RegExp('"(.*?)"');

client.on('ready', () => {
    console.log(`Logged in as ${client.user.tag}!`);
});

client.on('message', async msg => {
    if (msg.author.bot) return;
    // check if the message contains a tiktok link , if so scrape it
    let link = msg.content.match(linkRegEx);
    if (link) {
        link = link[0];
        console.log(`Found a TikTok link! ${link}`);
        let videoMeta = await scrape(link);

        // save video to videos folder
        await saveVideo(videoMeta.videoUrl, videoMeta.id);

        // create embed
        let embed = new discord.MessageEmbed()
            .setTitle(videoMeta.text)
            .setURL(link)
            .setAuthor({
                name: videoMeta.authorMeta.name,
                icon_url: videoMeta.authorMeta.avatar
            })
            .setThumbnail(videoMeta.covers.default);

        // send embed
        msg.reply({
            embeds: [embed],
            files: [`videos/${videoMeta.id}.mp4`]
        });
    }
});

function getFullLink(shortLink) {
    return new Promise((resolve, reject) => {
        var r = request.get({
            url: shortLink,
            headers: headers,
            followRedirect: false
        }, function (err, res, body) {
            // use regex to get all data between quotation marks
            if(err) {
                reject(err);
            }
            resolve(body.match(quotations)[1]);
            // console.log(body);
        });
    });
}

async function scrape(link) {
    return new Promise(async (resolve, reject) => {
        let fullLink = await getFullLink(link);
        let videoMeta = await tiktokScraper.getVideoMeta(fullLink);
        resolve(videoMeta.collector[0]);
    });
}

async function saveVideo(link, id) {
    return new Promise((resolve, reject) => {
        const file = fs.createWriteStream(`videos/${id}.mp4`);
        http.get(link, function (response) {
            response.pipe(file);

            // after download completed close filestream
            file.on("finish", () => {
                file.close();
                resolve();
            });

            file.on("error", (err) => {
                fs.unlink(`videos/${id}.mp4`);
                reject(err);
            });
        });
    });
}

cron.schedule('* * */2 * *', function () {
    console.log('Clearing videos folder!');
    fs.readdir(`${__dirname}/videos`, (err, files) => {
        if (err) throw err;
        for (const file of files) {
            fs.unlink(`${__dirname}/videos/${file}`, err => {
                if (err) throw err;
            });
        }
    });
});

fs.readdir(`${__dirname}/videos`, (err, files) => {
    if (err) throw err;
    for (const file of files) {
        fs.unlink(`${__dirname}/videos/${file}`, err => {
            if (err) throw err;
        });
    }
});

client.login(process.env.DISCORD_TOKEN);